import {
  ARCHETYPES,
  catalog,
  EFFECTS,
  IdSchema,
  resolveScreenId,
} from "@interactive-displays/core";
import { themeManifests } from "@interactive-displays/themes/manifest";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { connectedDisplayIds, type RealtimeServer } from "../realtime.ts";
import type { CommandResult, ShowService } from "../showService.ts";

const IdParams = z.object({ id: IdSchema });

const OpsBody = z.object({ baseRevision: z.number().int().min(0), ops: z.unknown() });
const StateBody = z.object({ state: IdSchema });
const DisplayBody = z
  .object({
    name: z.string().min(1).max(60).nullable().optional(),
    screen: IdSchema.nullable().optional(),
  })
  .strict();

const badRequest = (reply: FastifyReply, error: z.ZodError) =>
  reply.code(400).send({
    error: "Request is not valid",
    issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  });

const send = <T>(reply: FastifyReply, result: CommandResult<T>, success: (value: T) => unknown, status = 200) => {
  if (result.ok) return reply.code(status).send(success(result.value));
  const { status: code, message, issues, revision } = result;
  return reply.code(code).send({ error: message, ...(issues ? { issues } : {}), ...(revision !== undefined ? { revision } : {}) });
};

const jsonSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });

// REST adapter over the command layer. The editor and operator console (Phase 2) and MCP (Phase 5) use it.
export const registerApi = (app: FastifyInstance, service: ShowService, io: RealtimeServer) => {
  app.get("/api/catalog", async () => ({
    widgets: [...catalog.values()].map((definition) => ({
      kind: definition.kind,
      label: definition.label,
      category: definition.category,
      description: definition.description,
      props: jsonSchema(definition.props),
      example: definition.example,
    })),
    archetypes: ARCHETYPES,
    effects: EFFECTS,
    themes: [...themeManifests.values()].map((theme) => ({
      id: theme.id,
      name: theme.name,
      description: theme.description,
      archetypes: theme.archetypes,
      variants: Object.fromEntries(Object.entries(theme.variants).map(([id, variant]) => [id, variant.name])),
      decor: theme.decor.map((definition) => ({
        kind: definition.kind,
        label: definition.label,
        description: definition.description,
        props: jsonSchema(definition.props),
        example: definition.example,
      })),
    })),
  }));

  app.get("/api/show", async (_request, reply) => {
    const loaded = service.loaded();
    if (!loaded) return reply.code(503).send({ error: "The server has no active show; check its log" });

    const connected = connectedDisplayIds(io);
    const ids = new Set([
      ...loaded.show.displays.map((display) => display.id),
      ...Object.keys(loaded.runtime.seen),
      ...connected,
    ]);

    return {
      show: loaded.show,
      state: service.state(),
      screens: [...loaded.screens.values()].map(({ id, name, section, tags, revision }) => ({
        id,
        name,
        tags,
        revision,
        ...(section ? { section } : {}),
      })),
      displays: [...ids].sort().map((id) => {
        const definition = loaded.show.displays.find((display) => display.id === id);
        return {
          id,
          ...(definition?.name ? { name: definition.name } : {}),
          ...(definition?.screen ? { assigned: definition.screen } : {}),
          showing: resolveScreenId(loaded.show, id) ?? null,
          connected: connected.has(id),
          lastSeen: loaded.runtime.seen[id] ?? null,
        };
      }),
    };
  });

  app.get("/api/screens/:id", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    const screen = service.loaded()?.screens.get(params.data.id);
    if (!screen) return reply.code(404).send({ error: `Screen "${params.data.id}" does not exist` });
    return { screen, lint: service.lint(screen) };
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

  app.post("/api/displays/:id/identify", async (request, reply) => {
    const params = IdParams.safeParse(request.params);
    if (!params.success) return badRequest(reply, params.error);
    return send(reply, service.identify(params.data.id), (label) => ({ label }));
  });
};
