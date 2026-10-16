import type { ValidationIssue } from "@interactive-displays/core";
import { readToken } from "./token.ts";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; issues?: ValidationIssue[]; revision?: number };

interface ErrorBody {
  error?: string;
  issues?: ValidationIssue[];
  revision?: number;
}

// The REST API, with the editor token when this browser has one. Never throws: failures come back as values
// with a message the crew can read.
export const api = async <T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  file?: { type: string; data: Blob },
): Promise<ApiResult<T>> => {
  const headers: Record<string, string> = {};
  const token = readToken();
  if (token) headers["authorization"] = `Bearer ${token}`;
  let payload: string | Blob | undefined;
  if (file) {
    headers["content-type"] = file.type;
    payload = file.data;
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(path, { method, headers, ...(payload === undefined ? {} : { body: payload }) });
  } catch {
    return { ok: false, status: 0, error: "The server cannot be reached" };
  }

  const json: unknown = await response.json().catch(() => ({}));
  if (response.ok) return { ok: true, data: json as T };
  const problem = (typeof json === "object" && json !== null ? json : {}) as ErrorBody;
  return {
    ok: false,
    status: response.status,
    error: problem.error ?? `The server answered ${response.status}`,
    ...(problem.issues ? { issues: problem.issues } : {}),
    ...(problem.revision !== undefined ? { revision: problem.revision } : {}),
  };
};
