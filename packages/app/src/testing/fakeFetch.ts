import { packs } from "@interactive-displays/content";
import { vi } from "vitest";

export interface Call {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
}

type Responder = (call: Call) => { status?: number; body: unknown } | undefined;

// Replaces fetch with routes the test defines; GET /api/content answers with the real content packs unless the
// test says otherwise, and other unknown routes answer 404. Records every call.
export const fakeFetch = (respond: Responder) => {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const headers = (init.headers ?? {}) as Record<string, string>;
      const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
      const call = { method: init.method ?? "GET", path: input, body, headers };
      calls.push(call);
      const fallback = call.method === "GET" && input === "/api/content" ? { body: { packs } } : { status: 404, body: { error: "Not found" } };
      const answer = respond(call) ?? fallback;
      return new Response(JSON.stringify(answer.body), {
        status: answer.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return calls;
};
