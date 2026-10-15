import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  ARCHETYPES,
  applyOps,
  catalog,
  findNode,
  IdSchema,
  type LintIssue,
  type Op,
  OpListSchema,
  outlineScreen,
  type Screen,
} from "@interactive-displays/core";
import { decorCatalog, getThemeManifest } from "@interactive-displays/themes/manifest";
import type { FastifyBaseLogger } from "fastify";
import { z } from "zod";
import { jsonSchema } from "./catalogInfo.ts";
import { DESIGN_GUIDE } from "./mcp/guide.ts";
import type { CommandResult, ShowService } from "./showService.ts";

export const DEFAULT_AI_MODEL = "claude-opus-5-5";

// Enough turns to look, edit a few times and check, without letting one request run away.
const MAX_TURNS = 16;

export interface FillRequest {
  baseRevision: number;
  // What the person wants, such as "fill the placeholders" or "add a torpedo status panel".
  brief: string;
}

// A proposal: the ops that would make the change, the screen they give, and what the model said. Nothing is saved;
// the editor shows it and applies the ops through its own session if the person accepts, so Undo works as usual.
export interface FillProposal {
  ops: Op[];
  screen: Screen;
  lint: LintIssue[];
  summary: string;
}

type Log = Pick<FastifyBaseLogger, "info" | "warn" | "error">;

// Tools that work on a copy of one screen: the model can look, edit and check, but never reach the show.
export const workingCopyTools = (start: Screen, lint: (screen: Screen) => LintIssue[]) => {
  let screen = start;
  const ops: Op[] = [];

  const look = () => {
    const issues = lint(screen);
    return issues.length === 0 ? outlineScreen(screen) : `${outlineScreen(screen)}\n\nLint:\n${issues.map((issue) => `- ${issue.nodeId}: ${issue.message}`).join("\n")}`;
  };

  const tools = [
    betaZodTool({
      name: "look",
      description: "The screen as it stands with your changes so far: one line per node, then any lint warnings.",
      inputSchema: z.object({}),
      run: () => look(),
    }),
    betaZodTool({
      name: "get_node",
      description: "One node as JSON, with its props, bindings, actions and children.",
      inputSchema: z.object({ id: IdSchema }),
      run: ({ id }) => {
        const node = findNode(screen.root, id);
        return node ? JSON.stringify(node) : `There is no node "${id}"`;
      },
    }),
    betaZodTool({
      name: "get_widget",
      description: "A widget kind's props as JSON Schema, with an example. Kinds are listed in the system prompt.",
      inputSchema: z.object({ kind: z.string() }),
      run: ({ kind }) => {
        const definition = catalog.get(kind);
        return definition
          ? JSON.stringify({ kind, description: definition.description, props: jsonSchema(definition.props), example: definition.example })
          : `There is no widget "${kind}"`;
      },
    }),
    betaZodTool({
      name: "apply_ops",
      description: "Applies ops to the screen, all or nothing. Locked nodes cannot change. Returns the new outline, or why it failed.",
      inputSchema: z.object({ ops: OpListSchema }),
      run: ({ ops: next }) => {
        const result = applyOps(screen, next, { catalog, decor: decorCatalog, respectLocks: true });
        if (!result.ok) return `Rejected, nothing changed:\n${result.issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n")}`;
        screen = result.screen;
        ops.push(...next);
        return look();
      },
    }),
  ];

  return { tools, result: () => ({ ops: [...ops], screen }) };
};

const systemPrompt = (service: ShowService, screen: Screen): string => {
  const show = service.loaded()?.show;
  const theme = getThemeManifest(show?.theme.id ?? "base");
  const context = {
    theme: theme.id,
    layouts: Object.fromEntries(Object.entries(ARCHETYPES).map(([id, archetype]) => [id, archetype.slots])),
    states: show?.states.map(({ id, effect }) => ({ id, effect })) ?? [],
    signals: show?.signals.map(({ id, label, scope }) => ({ id, label, scope })) ?? [],
    screens: [...(service.loaded()?.screens.keys() ?? [])],
    widgets: [...catalog.values()].map(({ kind, description }) => `${kind}: ${description}`),
    decor: theme.decor.map(({ kind, description }) => `${kind}: ${description}`),
  };
  return (
    `You edit one screen of a sci-fi film set display system, the way a careful set designer would.\n\n${DESIGN_GUIDE}\n` +
    `## This show\n${JSON.stringify(context, null, 1)}\n\n` +
    `## The screen\nYou are editing "${screen.id}". Start with look, read nodes you change with get_node and widget props ` +
    "with get_widget, then apply_ops. Keep the result lint-clean. When you are done, say in one or two plain sentences what " +
    "you changed; the person reviews it before anything is saved."
  );
};

// The built-in "Fill with AI": a tool loop on a working copy of one screen, when the server has an API key.
export const createAssistant = ({
  service,
  apiKey,
  model = DEFAULT_AI_MODEL,
  fetch: customFetch,
  log,
}: {
  service: ShowService;
  apiKey: string;
  model?: string;
  // Tests answer for the API.
  fetch?: typeof fetch;
  log: Log;
}) => {
  const client = new Anthropic({ apiKey, ...(customFetch ? { fetch: customFetch } : {}) });

  const fill = async (screenId: string, request: FillRequest): Promise<CommandResult<FillProposal>> => {
    const screen = service.loaded()?.screens.get(screenId);
    if (!screen) return { ok: false, status: 404, message: `Screen "${screenId}" does not exist` };
    if (screen.revision !== request.baseRevision) {
      return { ok: false, status: 409, message: "The screen changed; reload it", revision: screen.revision };
    }
    const working = workingCopyTools(screen, service.lint);
    const runner = client.beta.messages.toolRunner({
      model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      max_iterations: MAX_TURNS,
      system: systemPrompt(service, screen),
      tools: working.tools,
      messages: [{ role: "user", content: request.brief }],
    });
    let final: Anthropic.Beta.BetaMessage;
    try {
      final = await runner.runUntilDone();
    } catch (error) {
      log.error({ err: error }, "Fill with AI failed");
      const message = error instanceof Anthropic.APIError ? `The AI service refused: ${error.message}` : "The AI request failed; see the server log";
      return { ok: false, status: 503, message };
    }
    const { ops, screen: proposed } = working.result();
    const summary = final.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n")
      .trim();
    log.info({ screen: screenId, ops: ops.length, stop: final.stop_reason }, "Fill with AI proposed a change");
    return { ok: true, value: { ops, screen: proposed, lint: service.lint(proposed), summary: summary || "No changes." } };
  };

  return { model, fill };
};

export type Assistant = ReturnType<typeof createAssistant>;
