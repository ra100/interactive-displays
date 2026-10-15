import { createServer, type Server } from "node:http";

// A stand-in for the Messages API so Fill with AI runs end to end without a key or network: it looks at the
// screen, turns it into a torpedo bay with one apply_ops call, then says what it did. The server under test
// reaches it through ANTHROPIC_BASE_URL.
const TORPEDO_OPS = [
  { op: "update", id: "title", props: { text: "TORPEDO BAY" } },
  {
    op: "replace",
    id: "note",
    node: {
      id: "tubes",
      type: "container",
      layout: { kind: "stack", direction: "row", gap: "medium" },
      children: [
        {
          node: {
            id: "tube-lights",
            type: "container",
            layout: { kind: "stack", direction: "column", gap: "small" },
            children: [
              { node: { id: "tube-1", type: "widget", kind: "status-light", props: { label: "TUBE 1 LOADED", status: "ok" } } },
              { node: { id: "tube-2", type: "widget", kind: "status-light", props: { label: "TUBE 2 LOADED", status: "ok" } } },
              { node: { id: "tube-3", type: "widget", kind: "status-light", props: { label: "TUBE 3 CYCLING", status: "warning", blink: true } } },
            ],
          },
        },
        {
          node: {
            id: "spread",
            type: "widget",
            kind: "gauge",
            props: { label: "FIRING SPREAD", value: 60, min: 0, max: 100, unit: "%", tone: "accent" },
            bind: { value: { ambient: { kind: "walk", min: 45, max: 80, volatility: 0.3 } } },
          },
        },
      ],
    },
  },
];

export const FILL_SUMMARY = "Turned this into the torpedo bay: a status light for each tube and a firing spread gauge.";

const reply = (turn: number) => {
  if (turn === 0) return { content: [{ type: "tool_use", id: "look-1", name: "look", input: {} }], stop_reason: "tool_use" };
  if (turn === 1) return { content: [{ type: "tool_use", id: "edit-1", name: "apply_ops", input: { ops: TORPEDO_OPS } }], stop_reason: "tool_use" };
  return { content: [{ type: "text", text: FILL_SUMMARY }], stop_reason: "end_turn" };
};

export const startFakeClaude = async (port: number): Promise<{ url: string; requests: () => number; close: () => Promise<void> }> => {
  let requests = 0;
  const server: Server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString()));
    request.on("end", () => {
      requests += 1;
      const { messages } = JSON.parse(body) as { messages: unknown[] };
      // One user message to start, then an assistant turn and a tool result per round.
      const message = { id: `msg_${requests}`, type: "message", role: "assistant", model: "fake", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, ...reply((messages.length - 1) / 2) };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(message));
    });
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${port}`,
    requests: () => requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
};
