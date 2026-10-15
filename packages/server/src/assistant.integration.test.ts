import type { Screen } from "@interactive-displays/core";
import { afterEach, describe, expect, it } from "vitest";
import { createTestServer } from "./testing/testServer.ts";

const server = createTestServer();
afterEach(server.teardown);

interface Sent {
  model: string;
  system: string;
  messages: { role: string; content: unknown }[];
}

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown };

// Stands in for the Messages API: answers each request with the next scripted reply and keeps what was sent.
const scriptedApi = (replies: { content: Block[]; stop_reason: string }[]) => {
  const sent: Sent[] = [];
  const fetch = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push(JSON.parse(String(init?.body)) as Sent);
    const reply = replies[sent.length - 1] ?? { content: [{ type: "text", text: "Done." }], stop_reason: "end_turn" };
    const message = { id: `msg_${sent.length}`, type: "message", role: "assistant", model: "test", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, ...reply };
    return new Response(JSON.stringify(message), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { sent, fetch: fetch as typeof globalThis.fetch };
};

const toolUse = (id: string, name: string, input: unknown) => ({ content: [{ type: "tool_use" as const, id, name, input }], stop_reason: "tool_use" });

interface Proposal {
  ops: unknown[];
  screen: Screen;
  summary: string;
}

describe("Fill with AI", () => {
  it("is off without an API key", async () => {
    await server.setup();
    await server.start();
    expect((await server.api("GET", "/api/session")).body).toMatchObject({ ai: null });
    expect((await server.api("POST", "/api/screens/bridge/fill", { baseRevision: 0, brief: "x" })).status).toBe(503);
  });

  it("proposes ops from a tool loop on a copy of the screen and saves nothing", async () => {
    const api = scriptedApi([
      toolUse("t1", "look", {}),
      toolUse("t2", "apply_ops", { ops: [{ op: "update", id: "title", props: { text: "TORPEDO BAY" } }] }),
      toolUse("t3", "apply_ops", { ops: [{ op: "remove", id: "nowhere" }] }),
      { content: [{ type: "text", text: "Renamed the title to TORPEDO BAY." }], stop_reason: "end_turn" },
    ]);
    await server.setup({ ai: { apiKey: "test-key", fetch: api.fetch } });
    await server.start();
    expect((await server.api("GET", "/api/session")).body).toMatchObject({ ai: { model: "claude-opus-5-5" } });

    const { body: before } = await server.api<{ screen: Screen }>("GET", "/api/screens/bridge");
    const { status, body } = await server.api<Proposal>("POST", "/api/screens/bridge/fill", {
      baseRevision: before.screen.revision,
      brief: "Make this the torpedo bay",
    });
    expect(status).toBe(200);
    expect(body.summary).toBe("Renamed the title to TORPEDO BAY.");
    expect(body.ops).toEqual([{ op: "update", id: "title", props: { text: "TORPEDO BAY" } }]);
    expect(JSON.stringify(body.screen)).toContain("TORPEDO BAY");

    // The model saw the design guide, the screen outline, and why its bad edit was rejected.
    expect(api.sent[0]?.model).toBe("claude-opus-5-5");
    expect(JSON.stringify(api.sent[0]?.system)).toContain("Designing screens");
    expect(JSON.stringify(api.sent[1]?.messages)).toContain("bridge");
    expect(JSON.stringify(api.sent[3]?.messages)).toContain("Rejected, nothing changed");

    // Nothing was saved: the draft is unchanged until the editor applies the ops.
    const { body: after } = await server.api<{ screen: Screen }>("GET", "/api/screens/bridge");
    expect(after.screen).toEqual(before.screen);
  });

  it("keeps locked nodes and stale revisions safe", async () => {
    const api = scriptedApi([toolUse("t1", "apply_ops", { ops: [{ op: "update", id: "title", props: { text: "X" } }] })]);
    await server.setup({ ai: { apiKey: "test-key", fetch: api.fetch } });
    await server.start();
    await server.api("POST", "/api/screens/bridge/ops", { baseRevision: 0, ops: [{ op: "set", id: "title", locked: true }] });
    expect((await server.api("POST", "/api/screens/bridge/fill", { baseRevision: 0, brief: "x" })).status).toBe(409);
    const { body } = await server.api<Proposal>("POST", "/api/screens/bridge/fill", { baseRevision: 1, brief: "Rename the title" });
    expect(body.ops).toEqual([]);
    expect(JSON.stringify(api.sent[1]?.messages)).toContain("locked");
  });
});
