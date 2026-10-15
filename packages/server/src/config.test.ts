import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  it("has defaults that run from a checkout", () => {
    const config = loadConfig({});

    expect(config.port).toBe(3010);
    expect(config.host).toBe("0.0.0.0");
    expect(config.dataDir.endsWith(`${path.sep}data`)).toBe(true);
    expect(config.appDist.endsWith(path.join("packages", "app", "dist"))).toBe(true);
    expect(config.logLevel).toBe("info");
    expect(config.editorToken).toBeUndefined();
    expect(config.publicUrl).toBeUndefined();
  });

  it("reads the editor token and public URL", () => {
    const config = loadConfig({ EDITOR_TOKEN: "set-secret-1", PUBLIC_URL: "http://10.0.0.5:3010/" });

    expect(config.editorToken).toBe("set-secret-1");
    expect(config.publicUrl).toBe("http://10.0.0.5:3010");
  });

  it("treats empty values from docker compose as unset", () => {
    const config = loadConfig({ EDITOR_TOKEN: "", PUBLIC_URL: "" });

    expect(config.editorToken).toBeUndefined();
    expect(config.publicUrl).toBeUndefined();
  });

  it("rejects a short editor token and a malformed public URL", () => {
    expect(() => loadConfig({ EDITOR_TOKEN: "short" })).toThrow(/EDITOR_TOKEN/);
    expect(() => loadConfig({ PUBLIC_URL: "not a url" })).toThrow(/PUBLIC_URL/);
  });

  it("reads overrides from the environment", () => {
    const config = loadConfig({ PORT: "8080", DATA_DIR: "/srv/data", LOG_LEVEL: "warn" });

    expect(config.port).toBe(8080);
    expect(config.dataDir).toBe(path.resolve("/srv/data"));
    expect(config.logLevel).toBe("warn");
  });

  it("explains an invalid value", () => {
    expect(() => loadConfig({ PORT: "not-a-port" })).toThrow(/Invalid configuration[\s\S]*PORT/);
  });
});
