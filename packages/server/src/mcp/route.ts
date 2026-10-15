import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { FastifyInstance } from "fastify";
import { bearerToken, tokenAccepted } from "../auth.ts";
import { createMcpServer, type McpDeps } from "./server.ts";

// MCP over Streamable HTTP at /mcp, stateless: every request gets a fresh server and transport, so nothing is
// kept between calls and a restart loses nothing. With an editor token configured, every request needs it,
// reads included, because MCP clients act for an editor.
export const registerMcp = (app: FastifyInstance, deps: McpDeps, { editorToken }: { editorToken?: string | undefined } = {}) => {
  app.route({
    method: ["GET", "POST", "DELETE"],
    url: "/mcp",
    handler: async (request, reply) => {
      if (!tokenAccepted(editorToken, bearerToken(request.headers.authorization))) {
        return reply.code(401).header("www-authenticate", "Bearer").send({ error: "This server needs the editor token" });
      }
      // Stateless servers have no stream to resume and no session to end.
      if (request.method !== "POST") {
        return reply.code(405).header("allow", "POST").send({ error: "Send MCP requests with POST" });
      }
      const server = createMcpServer(deps);
      const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });
      reply.hijack();
      reply.raw.on("close", () => {
        void transport.close();
        void server.close();
      });
      try {
        // The SDK's own types disagree under exactOptionalPropertyTypes (onclose may be undefined).
        await server.connect(transport as Transport);
        await transport.handleRequest(request.raw, reply.raw, request.body);
      } catch (error) {
        request.log.error({ err: error }, "MCP request failed");
        if (!reply.raw.headersSent) {
          reply.raw.writeHead(500, { "content-type": "application/json" });
          reply.raw.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null }));
        }
      }
    },
  });
};
