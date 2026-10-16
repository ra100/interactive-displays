import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  ARCHETYPES,
  catalog,
  IdSchema,
  OpListSchema,
  outlineScreen,
  RecipeSchema,
  type Screen,
  sectionsOf,
  SignalIdSchema,
  UiScaleSchema,
  PanelInchesSchema,
  ButtonCmSchema,
  CueListSchema,
  VideoCommandSchema,
} from "@interactive-displays/core";
import { getThemeManifest } from "@interactive-displays/themes/manifest";
import { z } from "zod";
import { catalogInfo, jsonSchema } from "../catalogInfo.ts";
import type { Generation } from "../generation.ts";
import { GenerateBody, RegenerateBody, toGenerateRequest, toRegenerateRequest } from "../http/api.ts";
import { buildOverview } from "../overview.ts";
import type { CommandResult, ShowService } from "../showService.ts";
import { DESIGN_GUIDE } from "./guide.ts";

export interface McpDeps {
  service: ShowService;
  generation: Generation;
  // Displays connected right now, for list_displays.
  connected: () => ReadonlySet<string>;
}

const RESOURCE = "interactive-displays://";

const json = (value: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });

const failure = (message: string, extra: Record<string, unknown> = {}): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify({ error: message, ...extra }, null, 2) }],
  isError: true,
});

// A command's result as a tool result: the value shaped by `ok`, or the error with its issues and revision.
const result = <T,>(outcome: CommandResult<T>, ok: (value: T) => unknown): CallToolResult => {
  if (outcome.ok) return json(ok(outcome.value));
  return failure(outcome.message, {
    status: outcome.status,
    ...(outcome.issues ? { issues: outcome.issues } : {}),
    ...(outcome.revision === undefined ? {} : { revision: outcome.revision }),
  });
};

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const LIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

const GENERATE_SHAPE = (({ suite: _suite, ...shape }) => shape)(GenerateBody.shape);

// The MCP face of the command layer. Every tool goes through the same service and generation the REST API uses,
// so validation, revisions, locks and broadcasts are identical; MCP edits always respect locks. Publishing and
// running the show (assigning screens, changing state or signals) are off until the operator allows them.
export const createMcpServer = ({ service, generation, connected }: McpDeps): McpServer => {
  const server = new McpServer(
    { name: "interactive-displays", version: "2.0.0" },
    {
      instructions:
        "Interactive Displays drives sci-fi screens on a film set. Read the design guide resource first, generate screens " +
        "from a section with generate_screen, then refine them with apply_ops. Displays show published copies; edits change drafts.",
    },
  );

  const settings = () => service.loaded()?.show.settings;
  const screenOf = (id: string): Screen | undefined => service.loaded()?.screens.get(id);
  const summary = (screen: Screen) => ({
    id: screen.id,
    name: screen.name,
    revision: screen.revision,
    lint: service.lint(screen),
    outline: outlineScreen(screen),
  });

  const gated = (setting: "aiPublish" | "aiLiveControl", run: () => Promise<CallToolResult> | CallToolResult) => {
    if (!settings()?.[setting]) {
      const switchName = setting === "aiPublish" ? "AI may publish" : "AI may run the show";
      return failure(`The operator has not allowed this; turn on "${switchName}" in the operator console`, { status: 403 });
    }
    return run();
  };

  // Discover

  server.registerTool(
    "get_catalog",
    {
      title: "Widget catalog",
      description: "Widgets screens can use. Without kind: a short list. With kind: that widget's props as JSON Schema and an example.",
      inputSchema: { kind: z.string().optional().describe('A widget kind such as "gauge"') },
      annotations: READ,
    },
    ({ kind }) => {
      if (kind === undefined) {
        return json([...catalog.values()].map(({ kind: each, label, category, description }) => ({ kind: each, label, category, description })));
      }
      const definition = catalog.get(kind);
      if (!definition) return failure(`There is no widget "${kind}"`, { kinds: [...catalog.keys()] });
      const { label, category, description, example } = definition;
      return json({ kind, label, category, description, props: jsonSchema(definition.props), example });
    },
  );

  server.registerTool(
    "get_theme",
    {
      title: "Theme",
      description: "The show's theme (or another one): its layouts with their slots, tones, variants, effects and decor.",
      inputSchema: { id: IdSchema.optional().describe("A theme id; the show's theme when left out") },
      annotations: READ,
    },
    ({ id }) => {
      const show = service.loaded()?.show;
      const theme = getThemeManifest(id ?? show?.theme.id ?? "base");
      return json({
        id: theme.id,
        name: theme.name,
        description: theme.description,
        layouts: Object.fromEntries(Object.entries(ARCHETYPES).map(([key, archetype]) => [key, { ...archetype, ownChrome: theme.archetypes.includes(key as never) }])),
        tones: theme.tones,
        variants: Object.fromEntries(Object.entries(theme.variants).map(([key, variant]) => [key, variant.name])),
        effects: Object.keys(theme.effects),
        decor: theme.decor.map(({ kind, label, description, example }) => ({ kind, label, description, example })),
        ...(show && (id === undefined || id === show.theme.id) ? { inUse: show.theme } : {}),
      });
    },
  );

  server.registerTool(
    "list_screens",
    { title: "Screens", description: "Every screen draft with its revision, section and published revision.", annotations: READ },
    () => {
      const overview = buildOverview(service, connected());
      return overview ? json(overview.screens) : failure("The server has no active show", { status: 503 });
    },
  );

  server.registerTool(
    "get_screen",
    {
      title: "Screen",
      description: 'A screen\'s draft (or published copy). format "outline" is a compact line per node; "json" is the full document.',
      inputSchema: {
        id: IdSchema,
        format: z.enum(["outline", "json"]).default("outline"),
        published: z.boolean().default(false).describe("The copy displays show, rather than the draft"),
      },
      annotations: READ,
    },
    ({ id, format, published }) => {
      const draft = screenOf(id);
      if (!draft) return failure(`Screen "${id}" does not exist`, { status: 404 });
      const screen = published ? service.loaded()?.published.get(id) : draft;
      if (!screen) return failure(`Screen "${id}" has never been published`, { status: 404 });
      return format === "json" ? json(screen) : { content: [{ type: "text", text: outlineScreen(screen) }] };
    },
  );

  server.registerTool(
    "list_displays",
    {
      title: "Displays and show state",
      description:
        "The show's state and states, shared signal values, the running order of cues and the last one run, and every display with what it shows and whether it is connected.",
      annotations: READ,
    },
    () => {
      const overview = buildOverview(service, connected());
      if (!overview) return failure("The server has no active show", { status: 503 });
      const { show, state, cue, signals, displays } = overview;
      return json({
        state,
        cues: show.cues,
        lastCue: cue,
        states: show.states.map(({ id, label, effect }) => ({ id, label, effect })),
        signals: show.signals.map((signal) => ({ id: signal.id, label: signal.label, value: signals[signal.id] })),
        settings: show.settings,
        displays,
      });
    },
  );

  server.registerTool(
    "list_recipes",
    {
      title: "Sections",
      description: "Sections screens can be generated for. With section: that recipe in full (systems, readings, buttons, nav, status lines).",
      inputSchema: { section: z.string().optional().describe('A section key such as "trek/engineering"') },
      annotations: READ,
    },
    ({ section }) => {
      const sections = sectionsOf(generation.packs());
      if (section === undefined) {
        return json(
          sections.map(({ key, recipe }) => ({
            key,
            label: recipe.label,
            description: recipe.description,
            systems: recipe.systems.map((system) => system.label),
          })),
        );
      }
      const found = sections.find((each) => each.key === section || each.recipe.id === section);
      return found ? json({ key: found.key, recipe: found.recipe }) : failure(`There is no section "${section}"`, { sections: sections.map((each) => each.key) });
    },
  );

  server.registerTool(
    "list_blocks",
    {
      title: "Blocks",
      description: "Reusable panel compositions the generator fills from a system, with their layouts in the parts language.",
      inputSchema: { pack: IdSchema.optional() },
      annotations: READ,
    },
    ({ pack }) => json(generation.packs().filter((each) => pack === undefined || each.id === pack).map((each) => ({ pack: each.id, blocks: each.blocks }))),
  );

  // Generate

  server.registerTool(
    "generate_screen",
    {
      title: "Generate a screen",
      description: "Creates a new draft screen for a section, validated and lint-checked. The same seed gives the same screen.",
      inputSchema: GENERATE_SHAPE,
      annotations: WRITE,
    },
    async (input) => result(await generation.generate(toGenerateRequest(GenerateBody.parse(input))), (screens) => screens.map(summary)),
  );

  server.registerTool(
    "generate_suite",
    {
      title: "Generate a suite",
      description: "Creates an overview screen plus one screen per system of a section, linked by their nav buttons.",
      inputSchema: GENERATE_SHAPE,
      annotations: WRITE,
    },
    async (input) =>
      result(await generation.generate({ ...toGenerateRequest(GenerateBody.parse(input)), suite: true }), (screens) =>
        screens.map(({ id, name, revision }) => ({ id, name, revision })),
      ),
  );

  server.registerTool(
    "regenerate",
    {
      title: "Regenerate",
      description: "Rebuilds everything that is not locked on a generated screen, or rerolls just the panels in nodes.",
      inputSchema: { id: IdSchema, ...RegenerateBody.shape },
      annotations: WRITE,
    },
    async ({ id, ...input }) => result(await generation.regenerate(id, toRegenerateRequest(RegenerateBody.parse(input))), summary),
  );

  // Edit and check

  server.registerTool(
    "apply_ops",
    {
      title: "Edit a screen",
      description: "Applies ops to a screen's draft, all or nothing, against baseRevision. Locked nodes cannot change.",
      inputSchema: { id: IdSchema, baseRevision: z.number().int().min(0), ops: OpListSchema },
      annotations: WRITE,
    },
    async ({ id, baseRevision, ops }) => result(await service.applyOps(id, baseRevision, ops, { respectLocks: true }), summary),
  );

  server.registerTool(
    "create_screen",
    {
      title: "Create a screen",
      description: "Creates a draft from a full screen document (see get_screen with format json for the shape).",
      inputSchema: { screen: z.record(z.string(), z.unknown()) },
      annotations: WRITE,
    },
    async ({ screen }) => result(await service.createScreen(screen), summary),
  );

  server.registerTool(
    "lint_screen",
    { title: "Check a screen", description: "Structural warnings for a screen's draft.", inputSchema: { id: IdSchema }, annotations: READ },
    ({ id }) => {
      const screen = screenOf(id);
      return screen ? json(service.lint(screen)) : failure(`Screen "${id}" does not exist`, { status: 404 });
    },
  );

  // Library

  server.registerTool(
    "save_recipe",
    {
      title: "Save a recipe",
      description: "Adds or replaces a section recipe in the show's copy of a content pack. See list_recipes with a section for the shape.",
      inputSchema: { pack: IdSchema.default("trek"), recipe: z.record(z.string(), z.unknown()) },
      annotations: WRITE,
    },
    async ({ pack, recipe }) => result(await generation.saveRecipe(pack, recipe), (saved) => ({ section: `${pack}/${saved.id}` })),
  );

  server.registerTool(
    "save_block",
    {
      title: "Save a block",
      description: "Adds or replaces a reusable block in the show's copy of a content pack. See list_blocks for the shape.",
      inputSchema: { pack: IdSchema.default("trek"), block: z.record(z.string(), z.unknown()) },
      annotations: WRITE,
    },
    async ({ pack, block }) => result(await generation.saveBlock(pack, block), (saved) => ({ block: saved.id })),
  );

  // Gated: on air

  server.registerTool(
    "publish_screen",
    {
      title: "Publish a screen",
      description: 'Puts a draft on the displays. Needs "AI may publish" in the operator console.',
      inputSchema: { id: IdSchema, revision: z.number().int().min(0).optional().describe("The draft revision you checked") },
      annotations: LIVE,
    },
    ({ id, revision }) =>
      gated("aiPublish", async () =>
        result(await service.publish(id, revision), (screen) => ({ id: screen.id, published: screen.revision, displays: service.displaysShowing(id) })),
      ),
  );

  server.registerTool(
    "assign_screen",
    {
      title: "Assign a screen",
      description: 'Sets the screen a display shows (null for its default). Needs "AI may run the show".',
      inputSchema: { display: IdSchema, screen: IdSchema.nullable() },
      annotations: LIVE,
    },
    ({ display, screen }) =>
      gated("aiLiveControl", async () => result(await service.updateDisplay(display, { screen }), (definition) => ({ display: definition }))),
  );

  server.registerTool(
    "set_state",
    {
      title: "Set the show state",
      description: 'Switches every display to a show state such as red-alert. Needs "AI may run the show".',
      inputSchema: { state: IdSchema },
      annotations: LIVE,
    },
    ({ state }) => gated("aiLiveControl", async () => result(await service.setState(state), (value) => ({ state: value }))),
  );

  server.registerTool(
    "set_theme",
    {
      title: "Re-skin the show",
      description: 'Redraws every display in another theme and optional variant (see get_theme). Needs "AI may run the show".',
      inputSchema: { id: IdSchema, variant: IdSchema.optional() },
      annotations: LIVE,
    },
    ({ id, variant }) => gated("aiLiveControl", async () => result(await service.setTheme({ id, variant }), (theme) => ({ theme }))),
  );

  server.registerTool(
    "set_cues",
    {
      title: "Write the running order",
      description:
        "Replaces the show's cues, first to last. Each cue has an id and label and changes at least one of: state, signals (shared manual ones, id -> value), screens (displayId -> screen id, or null for the default) and videos ({display, target, command}). Nothing goes on air until a cue runs.",
      inputSchema: { cues: CueListSchema },
      annotations: WRITE,
    },
    async ({ cues }) => result(await service.defineCues(cues), (saved) => ({ cues: saved.map((cue) => cue.id) })),
  );

  server.registerTool(
    "run_cue",
    {
      title: "Run a cue",
      description:
        'Runs a cue from the show\'s running order (list_displays lists them), or with no cue the next one, like the operator\'s GO. A cue changes the state, shared values, screens and videos at once. Needs "AI may run the show".',
      inputSchema: { cue: IdSchema.optional() },
      annotations: LIVE,
    },
    ({ cue }) => gated("aiLiveControl", async () => result(await (cue ? service.runCue(cue) : service.go()), (ran) => ran)),
  );

  server.registerTool(
    "set_scale",
    {
      title: "Resize everything on the displays",
      description:
        'Sets how big every display draws its screen: 1 sizes parts to the display, 0.5 halves them so more fits on a large 4K panel (0.25–2). A display with its own scale keeps it. Needs "AI may run the show".',
      inputSchema: { scale: UiScaleSchema },
      annotations: LIVE,
    },
    ({ scale }) => gated("aiLiveControl", async () => result(await service.setScale(scale), (current) => ({ scale: current }))),
  );

  server.registerTool(
    "set_panel",
    {
      title: "Set the panel size",
      description:
        'Tells the displays how big their panels are (diagonal in inches, 5–200) and how tall buttons should be on them in centimetres (0.8–4, 1.5 by default), so buttons come out the same real size on any screen. Needs "AI may run the show".',
      inputSchema: { inches: PanelInchesSchema.optional(), buttonCm: ButtonCmSchema.optional() },
      annotations: LIVE,
    },
    (panel) => gated("aiLiveControl", async () => result(await service.setPanel(panel), (current) => ({ panel: current }))),
  );

  server.registerTool(
    "set_signal",
    {
      title: "Set a signal",
      description: 'Sets a shared manual signal to a value, or moves it by delta. Needs "AI may run the show".',
      inputSchema: { signal: SignalIdSchema, value: z.number().finite().optional(), delta: z.number().finite().optional() },
      annotations: LIVE,
    },
    ({ signal, value, delta }) =>
      gated("aiLiveControl", () => {
        if ((value === undefined) === (delta === undefined)) return failure("Send either value or delta", { status: 400 });
        const change = value === undefined ? { delta: delta ?? 0 } : { value };
        return result(service.setSignal(signal, change), (current) => ({ signal, value: current }));
      }),
  );

  server.registerTool(
    "video_command",
    {
      title: "Control a video",
      description: 'Plays, pauses, toggles or restarts a video widget on the screen a display shows. Needs "AI may run the show".',
      inputSchema: { display: IdSchema, target: IdSchema.describe("The video widget's id"), command: VideoCommandSchema },
      annotations: LIVE,
    },
    ({ display, target, command }) =>
      gated("aiLiveControl", () => result(service.video(display, target, command), () => ({ display, target, command }))),
  );

  // Resources

  server.registerResource(
    "guide",
    `${RESOURCE}guide`,
    { title: "Design guide", description: "How screens are built and edited: layouts, tones, live values, controls and ops.", mimeType: "text/markdown" },
    (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: DESIGN_GUIDE }] }),
  );

  server.registerResource(
    "catalog",
    `${RESOURCE}catalog`,
    { title: "Catalog", description: "Every widget with its props as JSON Schema, the layouts, effects and themes.", mimeType: "application/json" },
    (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(catalogInfo()) }] }),
  );

  server.registerResource(
    "recipes",
    `${RESOURCE}recipes`,
    { title: "Recipes", description: "Every section recipe and block, as the generator sees them.", mimeType: "application/json" },
    (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ packs: generation.packs() }) }] }),
  );

  server.registerResource(
    "screen",
    new ResourceTemplate(`${RESOURCE}screens/{id}`, {
      list: () => ({
        resources: [...(service.loaded()?.screens.values() ?? [])].map((screen) => ({
          uri: `${RESOURCE}screens/${screen.id}`,
          name: screen.name,
          mimeType: "application/json",
        })),
      }),
    }),
    { title: "Screen draft", description: "A screen's draft document.", mimeType: "application/json" },
    (uri, { id }) => {
      const screen = typeof id === "string" ? screenOf(id) : undefined;
      if (!screen) throw new Error(`Screen "${String(id)}" does not exist`);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(screen) }] };
    },
  );

  // Prompts

  const say = (text: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text } }] });

  server.registerPrompt(
    "design-screen",
    {
      title: "Design a screen",
      description: "Generate a screen for a section and refine it to a brief.",
      argsSchema: { section: z.string().describe('A section such as "trek/engineering"'), brief: z.string().optional() },
    },
    ({ section, brief }) =>
      say(
        `Design a screen for the ${section} section${brief ? `: ${brief}` : ""}.\n` +
          "1. Read the design guide resource.\n" +
          "2. generate_screen for the section; try a couple of seeds or layouts if the first is a poor fit.\n" +
          "3. Read it with get_screen (outline). Lock what works, regenerate or reroll what does not.\n" +
          "4. Make the remaining changes with apply_ops, using tone roles, never colours.\n" +
          "5. lint_screen until it is clean, then summarise what you made. Do not publish unless asked.",
      ),
  );

  server.registerPrompt(
    "fill-placeholders",
    { title: "Fill placeholders", description: "Replace a screen's placeholder widgets with real panels.", argsSchema: { screen: z.string() } },
    ({ screen }) =>
      say(
        `Fill the placeholders on screen "${screen}".\n` +
          "1. get_screen (outline) and find the placeholder widgets and their intent.\n" +
          "2. If the screen was generated, lock everything you want to keep and call regenerate: placeholders become matching panels.\n" +
          "3. Otherwise replace each placeholder with apply_ops (replace op), using widgets from get_catalog that fit its intent.\n" +
          "4. lint_screen until it is clean and report what went where.",
      ),
  );

  server.registerPrompt(
    "new-section-recipe",
    {
      title: "New section recipe",
      description: "Write a recipe for a new ship section so screens can be generated for it.",
      argsSchema: { section: z.string().describe('What the section is, such as "shuttle bay"') },
    },
    ({ section }) =>
      say(
        `Write a content recipe for a new section: ${section}.\n` +
          "1. Read an existing one with list_recipes (section trek/engineering) for the shape, and list_blocks for the blocks it can prefer.\n" +
          `2. Write systems with plausible readings (ranges and alert ranges), buttons and technobabble notes. The JSON Schema is:\n${JSON.stringify(jsonSchema(RecipeSchema))}\n` +
          "3. save_recipe, fix any issues it reports, then generate_screen for the new section to check it.",
      ),
  );

  return server;
};
