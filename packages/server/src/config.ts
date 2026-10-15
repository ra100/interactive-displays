import path from "node:path";
import { z } from "zod";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

// docker compose passes unset variables as empty strings; treat those as unset.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(0).max(65535).default(3010),
  HOST: z.string().min(1).default("0.0.0.0"),
  DATA_DIR: z.string().min(1).default(path.join(repoRoot, "data")),
  APP_DIST: z.string().min(1).default(path.join(repoRoot, "packages/app/dist")),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  // Protects the editor, operator console and every API write. Displays never need it.
  EDITOR_TOKEN: optional(z.string().min(8, "EDITOR_TOKEN must be at least 8 characters")),
  // The address displays and tablets use to reach the server, for QR codes, e.g. http://10.0.0.5:3010.
  PUBLIC_URL: optional(z.url()),
  // Turns on the editor's built-in "Fill with AI". MCP clients bring their own model and need no key.
  ANTHROPIC_API_KEY: optional(z.string().min(1)),
  AI_MODEL: optional(z.string().min(1)),
});

export interface Config {
  port: number;
  host: string;
  dataDir: string;
  appDist: string;
  logLevel: z.infer<typeof EnvSchema>["LOG_LEVEL"];
  editorToken?: string;
  publicUrl?: string;
  ai?: { apiKey: string; model?: string; fetch?: typeof fetch };
}

// All configuration comes from environment variables, so Docker and local runs work the same way.
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid configuration\n${problems.join("\n")}`);
  }
  const { PORT, HOST, DATA_DIR, APP_DIST, LOG_LEVEL, EDITOR_TOKEN, PUBLIC_URL, ANTHROPIC_API_KEY, AI_MODEL } = parsed.data;
  return {
    port: PORT,
    host: HOST,
    dataDir: path.resolve(DATA_DIR),
    appDist: path.resolve(APP_DIST),
    logLevel: LOG_LEVEL,
    ...(EDITOR_TOKEN ? { editorToken: EDITOR_TOKEN } : {}),
    ...(PUBLIC_URL ? { publicUrl: PUBLIC_URL.replace(/\/+$/, "") } : {}),
    ...(ANTHROPIC_API_KEY ? { ai: { apiKey: ANTHROPIC_API_KEY, ...(AI_MODEL ? { model: AI_MODEL } : {}) } } : {}),
  };
};
