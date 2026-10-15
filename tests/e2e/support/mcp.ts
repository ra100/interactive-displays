import { type APIRequestContext, expect } from "@playwright/test";

// Calls an MCP tool the way any MCP client does: a JSON-RPC request to /mcp over Streamable HTTP.
export const mcpTool = async (
  request: APIRequestContext,
  name: string,
  args: Record<string, unknown> = {},
  baseUrl = "",
): Promise<{ isError: boolean; data: unknown; text: string }> => {
  const response = await request.post(`${baseUrl}/mcp`, {
    headers: { accept: "application/json, text/event-stream" },
    data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
  });
  expect(response.ok()).toBe(true);
  const { result } = (await response.json()) as { result: { isError?: boolean; content: { text: string }[] } };
  const text = result.content[0]?.text ?? "";
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = undefined;
  }
  return { isError: result.isError === true, data, text };
};
