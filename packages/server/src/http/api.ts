import {
  ARCHETYPE_IDS,
  type ArchetypeId,
  DENSITIES,
  ProfileSchema,
  AssetNameSchema,
  assetContentType,
  IdSchema,
  ShowSettingsSchema,
  SignalIdSchema,
  VideoCommandSchema,
} from "@interactive-displays/core";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { bearerToken, tokenAccepted } from "../auth.ts";
import { catalogInfo } from "../catalogInfo.ts";
import { buildOverview } from "../overview.ts";
import { connectedDisplayIds, type RealtimeServer } from "../realtime.ts";
import type { GenerateRequest, Generation, RegenerateRequest } from "../generation.ts";
import type { CommandResult, ShowService } from "../showService.ts";

export const ASSET_LIMIT_BYTES = 100 * 1024 * 1024;

const IdParams = z.object({ id: IdSchema });
const RevisionParams = z.object({ id: IdSchema, revision: z.coerce.number().int().min(0) });
const AssetParams = z.object({ name: AssetNameSchema });

const OpsBody = z.object({ baseRevision: z.number().int().min(0), ops: z.unknown() });
const PublishBody = z.object({ revision: z.number().int().min(0).optional() }).strict();
const RevertBody = z.object({ baseRevision: z.number().int().min(0), revision: z.number().int().min(0) }).strict();
const DuplicateBody = z.object({ id: IdSchema.optional(), name: z.string().min(1).max(120).optional() }).strict();
const StateBody = z.object({ state: IdSchema });
// Without the schema's defaults: Zod fills defaults even in a partial schema, which would reset every setting
// a request does not name.
const SettingsBody = z
  .object({
    liveEdit: ShowSettingsSchema.shape.liveEdit.unwrap(),
    displayGlobalActions: ShowSettingsSchema.shape.displayGlobalActions.unwrap(),
    sounds: ShowSettingsSchema.shape.sounds.unwrap(),
    aiPublish: ShowSettingsSchema.shape.aiPublish.unwrap(),
    aiLiveControl: ShowSettingsSchema.shape.aiLiveControl.unwrap(),
  })
  .partial()
  .strict();
const SignalsBody = z.object({ signals: z.unknown() }).strict();
const SignalParams = z.object({ id: SignalIdSchema });
const SignalValueBody = z
  .object({ value: z.number().finite().optional(), delta: z.number().finite().optional() })
  .strict()
  .refine((body) => (body.value === undefined) !== (body.delta === undefined), "Send either value or delta");
const VideoBody = z.object({ target: IdSchema, command: VideoCommandSchema }).strict();
const PreviewBody = z.object({ screen: IdSchema }).strict();
const DisplayBody = z
  .object({
    name: z.string().min(1).max(60).nullable().optional(),
    screen: IdSchema.nullable().optional(),
  })
  .strict();

const PackParams = z.object({ pack: IdSchema });
export const GenerateBody = z
  .object({
    section: z.string().min(1).max(130).describe('A section key such as "trek/engineering", or a recipe id'),
    id: IdSchema.optional().describe("The new screen's id; made from the name when left out"),
    name: z.string().min(1).max(120).optional(),
    seed: z.number().int().min(0).max(0xffffffff).optional().describe("The same seed gives the same screen; random when left out"),
    density: z.enum(DENSITIES).optional(),
    aspect: ProfileSchema.shape.aspect.unwrap().optional(),
    archetype: z.enum(ARCHETYPE_IDS as [ArchetypeId, ...ArchetypeId[]]).optional().describe("Layout; picked from the recipe's weights when left out"),
    suite: z.boolean().optional().describe("Also one screen per system, linked by nav buttons"),
  })
  .strict();
export const RegenerateBody = z
  .object({
    baseRevision: z.number().int().min(0),
    seed: z.number().int().min(0).max(0xffffffff).optional(),
    nodes: z.array(IdSchema).min(1).max(20).optional().describe("Panels to reroll; everything that is not locked when left out"),
  })
  .strict();

// Parsed bodies leave unset fields undefined; requests leave them out.
const defined = <T extends object>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, each]) => each !== undefined)) as { [K in keyof T]?: Exclude<T[K], undefined> };

export const toGenerateRequest = ({ section, ...rest }: z.infer<typeof GenerateBody>): GenerateRequest => ({ section, ...defined(rest) });

export const toRegenerateRequest = ({ baseRevision, ...rest }: z.infer<typeof RegenerateBody>): RegenerateRequest => ({
  baseRevision,
  ...defined(rest),
});

const badRequest = (reply: FastifyReply, error: z.ZodError) =>
  reply.code(400).send({
    error: "Request is not valid",
    issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  });

const send = <T>(reply: FastifyReply, result: CommandResult<T>, success: (value: T) => unknown, status = 200) => {
  if (result.ok) return reply.code(status).send(success(result.value));
  const { status: code, message, issues, revision } = result;
  return reply
    .code(code)
    .send({ error: message, ...(issues ? { issues } : {}), ...(revision !== undefined ? { revision } : {}) });
};

const isRead = (method: string) => method === "GET" || method === "HEAD";

// REST adapter over the command layer, used by the editor, the operator console and (Phase 5) MCP.
// With an editor token configured, every write needs it; reads stay open so displays and status pages work.
export const registerApi = (
  app: FastifyInstance,
  service: ShowService,
  generation: Generation,
  io: RealtimeServer,
  { editorToken, publicUrl }: { editorToken?: string | undefined; publicUrl?: string | undefined } = {},
) => {
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/") || isRead(request.method)) return;
    if (!tokenAccepted(editorToken, bearerToken(request.headers.authorization))) {
      await reply.code(401).send({ error: "This server needs the editor token" });
    }
  });

  // Uploads arrive as the raw file body, typed by the asset's extension.
  app.addContentTypeParser(
    /^(image|video)\/[a-z0-9.+-]+$|^application\/octet-stream$/,
    { parseAs: "buffer", bodyLimit: ASSET_LIMIT_BYTES },
    (_request, body, done) => done(null, body),
  );

  app.get("/api/session", async (request) => ({
    tokenRequired: Boolean(editorToken),
    tokenValid: tokenAccepted(editorToken, bearerToken(request.headers.authorization)),
    publicUrl: publicUrl ?? null,
  }));

  app.get("/api/catalog", async () => catalogInfo());

  // Content packs as the generator sees them: built in, with the show's own recipes and blocks.
  app.get("/api/content", async () => ({ packs: generation.packs() }));

  app.put("/api/content/:pack/recipes", async (request, reply) => {
    const params = PackParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    return send(reply, await generation.saveRecipe(params.data.pack, request.body), (recipe) => ({ recipe }));
  });

  app.put("/api/content/:pack/blocks", async (request, reply) => {
    const params = PackParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    return send(reply, await generation.saveBlock(params.data.pack, request.body), (block) => ({ block }));
  });

  app.post("/api/generate", async (request, reply) => {
    const body = GenerateBody.safeParse(request.body);
    if (!body.success) return badRequest(reply, body.error);
    const result = await generation.generate(toGenerateRequest(body.data));
    return send(reply, result, (screens) => ({ screens, lint: screens.map((screen) => service.lint(screen)) }), 201);
  });

  app.post("/api/screens/:id/regenerate", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    const body = RegenerateBody.safeParse(request.body);
    if (!body.success) return badRequest(reply, body.error);
    const result = await generation.regenerate(params.data.id, toRegenerateRequest(body.data));
    return send(reply, result, (screen) => ({ screen, lint: service.lint(screen) }));
  });

  app.get("/api/show", async (_request, reply) => {
    const overview = buildOverview(service, connectedDisplayIds(io));
    return overview ?? reply.code(503).send({ error: "The server has no active show; check its log" });
  });

  app.put("/api/show/settings", async (request, reply) => {
    const body = SettingsBody.safeParse(request.body);
    if (!body.success) return badRequest(reply, body.error);
    return send(reply, await service.updateSettings(defined(body.data)), (settings) => ({ settings }));
  });

  // Replaces the show's signal definitions.
  app.put("/api/show/signals", async (request, reply) => {
    const body = SignalsBody.safeParse(request.body);
    if (!body.success) return badRequest(reply, body.error);
    return send(reply, await service.defineSignals(body.data.signals), (signals) => ({ signals }));
  });

  app.get("/api/signals", async (_request, reply) => {
    if (!service.loaded()) return reply.code(503).send({ error: "The server has no active show; check its log" });
    return { values: service.signalValues() };
  });

  // Sets a shared manual signal: { value } or { delta }.
  app.put("/api/signals/:id/value", async (request, reply) => {
    const params = SignalParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    const body = SignalValueBody.safeParse(request.body);
    if (!body.success) return badRequest(reply, body.error);
    const change = body.data.value === undefined ? { delta: body.data.delta ?? 0 } : { value: body.data.value };
    return send(reply, service.setSignal(params.data.id, change), (value) => ({ id: params.data.id, value }));
  });

  // Every draft, for the screen library.
  app.get("/api/screens", async (_request, reply) => {
    const loaded = service.loaded();
    if (!loaded) return reply.code(503).send({ error: "The server has no active show; check its log" });
    return { screens: [...loaded.screens.values()].sort((a, b) => a.name.localeCompare(b.name)) };
  });

  app.get("/api/screens/:id", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    const screen = service.loaded()?.screens.get(params.data.id);
    if (!screen) return reply.code(404).send({ error: `Screen "${params.data.id}" does not exist` });
    return { screen, lint: service.lint(screen), onAir: service.displaysShowing(screen.id) };
  });

  app.get("/api/screens/:id/published", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    const screen = service.loaded()?.published.get(params.data.id);
    if (!screen) return reply.code(404).send({ error: `Screen "${params.data.id}" is not published` });
    return { screen };
  });

  app.post("/api/screens", async (request, reply) => {
    const result = await service.createScreen(request.body);
    return send(reply, result, (screen) => ({ screen, lint: service.lint(screen) }), 201);
  });

  app.post("/api/screens/:id/ops", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    const body = OpsBody.safeParse(request.body);
    if (!body.success) return badRequest(reply, body.error);

    const result = await service.applyOps(params.data.id, body.data.baseRevision, body.data.ops);
    return send(reply, result, (screen) => ({ screen, lint: service.lint(screen) }));
  });

  app.post("/api/screens/:id/publish", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    const body = PublishBody.safeParse(request.body ?? {});
    if (!body.success) return badRequest(reply, body.error);
    const result = await service.publish(params.data.id, body.data.revision);
    return send(reply, result, (screen) => ({ screen, onAir: service.displaysShowing(screen.id) }));
  });

  app.get("/api/screens/:id/revisions", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    return send(reply, await service.revisions(params.data.id), (revisions) => ({ revisions }));
  });

  app.get("/api/screens/:id/revisions/:revision", async (request, reply) => {
    const params = RevisionParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    return send(reply, await service.revision(params.data.id, params.data.revision), (screen) => ({ screen }));
  });

  app.post("/api/screens/:id/revert", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    const body = RevertBody.safeParse(request.body);
    if (!body.success) return badRequest(reply, body.error);
    const result = await service.revert(params.data.id, body.data.baseRevision, body.data.revision);
    return send(reply, result, (screen) => ({ screen, lint: service.lint(screen) }));
  });

  app.post("/api/screens/:id/duplicate", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    const body = DuplicateBody.safeParse(request.body ?? {});
    if (!body.success) return badRequest(reply, body.error);
    const copy = {
      ...(body.data.id ? { id: body.data.id } : {}),
      ...(body.data.name ? { name: body.data.name } : {}),
    };
    return send(reply, await service.duplicateScreen(params.data.id, copy), (screen) => ({ screen }), 201);
  });

  app.delete("/api/screens/:id", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    return send(reply, await service.deleteScreen(params.data.id), (id) => ({ deleted: id }));
  });

  app.post("/api/state", async (request, reply) => {
    const body = StateBody.safeParse(request.body);
    if (!body.success) return badRequest(reply, body.error);
    return send(reply, await service.setState(body.data.state), (state) => ({ state }));
  });

  app.put("/api/displays/:id", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    const body = DisplayBody.safeParse(request.body);
    if (!body.success) return badRequest(reply, body.error);

    const patch = {
      ...(body.data.name !== undefined ? { name: body.data.name } : {}),
      ...(body.data.screen !== undefined ? { screen: body.data.screen } : {}),
    };
    return send(reply, await service.updateDisplay(params.data.id, patch), (display) => ({ display }));
  });

  app.delete("/api/displays/:id", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    return send(reply, await service.forgetDisplay(params.data.id), (id) => ({ forgotten: id }));
  });

  app.post("/api/displays/:id/identify", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    return send(reply, service.identify(params.data.id), (label) => ({ label }));
  });

  app.post("/api/displays/:id/reload", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    return send(reply, service.reload(params.data.id), (id) => ({ reloaded: id }));
  });

  // Plays, pauses or restarts a video widget on the screen the display shows.
  app.post("/api/displays/:id/video", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    const body = VideoBody.safeParse(request.body);
    if (!body.success) return badRequest(reply, body.error);
    const { target, command } = body.data;
    return send(reply, service.video(params.data.id, target, command), () => ({ target, command }));
  });

  app.put("/api/displays/:id/preview", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    const body = PreviewBody.safeParse(request.body);
    if (!body.success) return badRequest(reply, body.error);
    return send(reply, service.setPreview(params.data.id, body.data.screen), (screen) => ({ preview: screen }));
  });

  app.delete("/api/displays/:id/preview", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    return send(reply, service.setPreview(params.data.id, null), () => ({ preview: null }));
  });

  app.get("/api/assets", async (_request, reply) => send(reply, await service.assets(), (assets) => ({ assets })));

  app.put("/api/assets/:name", async (request, reply) => {
    const params = AssetParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    const { name } = params.data;
    const body = request.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return reply.code(400).send({ error: `Send the file as the request body with content-type ${assetContentType(name)}` });
    }
    return send(reply, await service.saveAsset(name, body), (saved) => ({ asset: saved }), 201);
  });

  app.delete("/api/assets/:name", async (request, reply) => {
    const params = AssetParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    return send(reply, await service.deleteAsset(params.data.name), (name) => ({ deleted: name }));
  });
};
