import { vi } from "vitest";

export interface Call {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
}

type Responder = (call: Call) => { status?: number; body: unknown } | undefined;

// Replaces fetch with routes the test defines; unknown routes answer 404. Records every call.
export const fakeFetch = (respond: Responder) => {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const headers = (init.headers ?? {}) as Record<string, string>;
      const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
      const call = { method: init.method ?? "GET", path: input, body, headers };
      calls.push(call);
      const answer = respond(call) ?? { status: 404, body: { error: "Not found" } };
      return new Response(JSON.stringify(answer.body), {
        status: answer.status ?? 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return calls;
};
