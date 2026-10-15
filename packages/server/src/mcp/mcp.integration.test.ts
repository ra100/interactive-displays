import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { Screen } from "@interactive-displays/core";
import { afterEach, describe, expect, it } from "vitest";
import { createTestServer } from "../testing/testServer.ts";

const server = createTestServer();
const clients: Client[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) await client.close();
  await server.teardown();
});

const start = async (options: { editorToken?: string } = {}) => {
  await server.setup(options);
  await server.start();
};

const connect = async (token?: string) => {
  const transport = new StreamableHTTPClientTransport(new URL(`${server.url()}/mcp`), {
    requestInit: token ? { headers: { authorization: `Bearer ${token}` } } : {},
  });
  const client = new Client({ name: "test", version: "1.0.0" });
  // The SDK's types disagree under exactOptionalPropertyTypes (sessionId may be undefined).
  await client.connect(transport as Transport);
  clients.push(client);
  return client;
};

interface ToolOutcome {
  isError: boolean;
  text: string;
  // The text parsed as JSON, when it is JSON.
  data: unknown;
}

const call = async (client: Client, name: string, args: Record<string, unknown> = {}): Promise<ToolOutcome> => {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text?: string }[];
  const text = content[0]?.text ?? "";
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = undefined;
  }
  return { isError: result.isError === true, text, data };
};

const settings = (patch: Record<string, boolean>, token?: string) =>
  server.api("PUT", "/api/show/settings", patch, token ? { token } : {});

describe("MCP endpoint", () => {
  it("lists its tools, resources and prompts", async () => {
    await start();
    const client = await connect();
    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    expect(tools).toEqual(
      expect.arrayContaining([
        "get_catalog",
        "get_theme",
        "list_screens",
        "get_screen",
        "list_displays",
        "list_recipes",
        "list_blocks",
        "generate_screen",
        "generate_suite",
        "regenerate",
        "apply_ops",
        "create_screen",
        "lint_screen",
        "save_recipe",
        "save_block",
        "publish_screen",
        "assign_screen",
        "set_state",
        "set_signal",
      ]),
    );
    const applyOps = (await client.listTools()).tools.find((tool) => tool.name === "apply_ops");
    expect(JSON.stringify(applyOps?.inputSchema)).toContain('"insert"');

    const resources = (await client.listResources()).resources.map((resource) => resource.uri);
    expect(resources).toEqual(expect.arrayContaining(["interactive-displays://guide", "interactive-displays://catalog", "interactive-displays://screens/bridge"]));
    const guide = await client.readResource({ uri: "interactive-displays://guide" });
    expect(guide.contents[0]).toMatchObject({ mimeType: "text/markdown" });

    const prompts = (await client.listPrompts()).prompts.map((prompt) => prompt.name);
    expect(prompts).toEqual(["design-screen", "fill-placeholders", "new-section-recipe"]);
    const prompt = await client.getPrompt({ name: "design-screen", arguments: { section: "trek/helm" } });
    expect(JSON.stringify(prompt.messages)).toContain("generate_screen");
  });

  it("reads the same show REST does", async () => {
    await start();
    const client = await connect();
    const screens = (await call(client, "list_screens")).data as { id: string }[];
    const rest = await server.api<{ screens: { id: string }[] }>("GET", "/api/screens");
    expect(screens.map((screen) => screen.id).sort()).toEqual(rest.body.screens.map((screen) => screen.id).sort());

    const json = await call(client, "get_screen", { id: "bridge", format: "json" });
    const draft = await server.api<{ screen: Screen }>("GET", "/api/screens/bridge");
    expect(json.data).toEqual(draft.body.screen);
    const outline = await call(client, "get_screen", { id: "bridge" });
    expect(outline.text.split("\n")[0]).toContain("bridge");

    expect(((await call(client, "get_catalog")).data as { kind: string }[]).map((widget) => widget.kind)).toContain("gauge");
    expect((await call(client, "get_catalog", { kind: "gauge" })).data).toMatchObject({ kind: "gauge", props: { type: "object" } });
    expect((await call(client, "get_theme")).data).toMatchObject({ id: "lcars", inUse: { id: "lcars" } });
    expect((await call(client, "list_displays")).data).toMatchObject({ state: "normal", settings: { aiPublish: false } });
    expect(((await call(client, "list_recipes")).data as { key: string }[]).map((section) => section.key)).toContain("trek/engineering");
    expect((await call(client, "get_screen", { id: "nowhere" })).isError).toBe(true);
  });

  it("generates and edits through the command layer, respecting locks", async () => {
    await start();
    const client = await connect();
    const generated = await call(client, "generate_screen", { section: "trek/tactical", seed: 42, id: "weapons" });
    expect(generated.isError).toBe(false);
    expect(generated.data).toMatchObject([{ id: "weapons", revision: 0 }]);

    // The same seed over REST gives the same screen.
    const rest = await server.api<{ screens: Screen[] }>("POST", "/api/generate", { section: "trek/tactical", seed: 42, id: "weapons-rest" });
    const viaMcp = await server.api<{ screen: Screen }>("GET", "/api/screens/weapons");
    expect(viaMcp.body.screen.root).toEqual(rest.body.screens[0]?.root);

    const locked = await call(client, "apply_ops", { id: "weapons", baseRevision: 0, ops: [{ op: "set", id: "title", locked: true }] });
    expect(locked.data).toMatchObject({ revision: 1 });
    const blocked = await call(client, "apply_ops", { id: "weapons", baseRevision: 1, ops: [{ op: "update", id: "title", props: { text: "X" } }] });
    expect(blocked.isError).toBe(true);
    const stale = await call(client, "apply_ops", { id: "weapons", baseRevision: 0, ops: [{ op: "meta", name: "Weapons" }] });
    expect(stale.data).toMatchObject({ status: 409, revision: 1 });

    const regenerated = await call(client, "regenerate", { id: "weapons", baseRevision: 1, seed: 7 });
    expect(regenerated.data).toMatchObject({ id: "weapons", revision: 2 });

    const suite = await call(client, "generate_suite", { section: "trek/medical", seed: 1 });
    expect((suite.data as { id: string }[]).map((screen) => screen.id)).toEqual(["medical", "medical-vitals", "medical-biobed", "medical-quarantine"]);
    expect((await call(client, "lint_screen", { id: "medical" })).isError).toBe(false);
  });

  it("saves recipes the generator then uses", async () => {
    await start();
    const client = await connect();
    const recipe = ((await call(client, "list_recipes", { section: "trek/helm" })).data as { recipe: Record<string, unknown> }).recipe;
    const saved = await call(client, "save_recipe", { recipe: { ...recipe, id: "shuttle-bay", label: "Shuttle bay", code: "SHB" } });
    expect(saved.data).toEqual({ section: "trek/shuttle-bay" });
    expect((await call(client, "save_recipe", { recipe: { id: "broken" } })).isError).toBe(true);
    const generated = await call(client, "generate_screen", { section: "trek/shuttle-bay", seed: 3 });
    expect(generated.data).toMatchObject([{ id: "shuttle-bay" }]);
  });

  it("publishes and runs the show only when the operator allows it", async () => {
    await start();
    const client = await connect();
    const refused = await call(client, "publish_screen", { id: "bridge" });
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain("AI may publish");
    expect((await call(client, "set_state", { state: "red-alert" })).isError).toBe(true);

    await settings({ aiPublish: true });
    expect((await call(client, "publish_screen", { id: "bridge" })).data).toMatchObject({ id: "bridge" });
    expect((await call(client, "set_state", { state: "red-alert" })).isError).toBe(true);

    await settings({ aiLiveControl: true });
    expect((await call(client, "set_state", { state: "red-alert" })).data).toEqual({ state: "red-alert" });
    expect((await server.api<{ state: string }>("GET", "/health")).body.state).toBe("red-alert");
    expect((await call(client, "set_signal", { signal: "shields", value: 40 })).data).toEqual({ signal: "shields", value: 40 });
    expect((await call(client, "set_signal", { signal: "shields" })).isError).toBe(true);
    expect((await call(client, "assign_screen", { display: "corridor-1", screen: "tactical" })).data).toMatchObject({
      display: { id: "corridor-1", screen: "tactical" },
    });
  });

  it("needs the editor token when one is set, for reads too", async () => {
    await start({ editorToken: "secret" });
    await expect(connect()).rejects.toThrow();
    const client = await connect("secret");
    expect((await call(client, "list_screens")).isError).toBe(false);
    expect((await server.api("GET", "/mcp")).status).toBe(401);
    expect((await server.api("GET", "/mcp", undefined, { token: "secret" })).status).toBe(405);
  });
});
