import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const server = process.env["SERVER_URL"] ?? "http://localhost:3010";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    proxy: {
      "/socket.io": { target: server, ws: true },
      "/api": server,
      "/health": server,
      "/media": server,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
