import { type DisplaySnapshot, PROTOCOL_VERSION, ScreenSchema } from "@interactive-displays/core";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App.tsx";

const fake = vi.hoisted(() => {
  const handlers = new Map<string, (payload?: unknown) => void>();
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const calls = { connect: 0 };
  const socket = {
    on: (event: string, handler: (payload?: unknown) => void) => {
      handlers.set(event, handler);
      return socket;
    },
    emit: (event: string, payload: unknown) => {
      emitted.push({ event, payload });
      return socket;
    },
    connect: () => {
      calls.connect += 1;
      return socket;
    },
    disconnect: () => socket,
  };
  const reset = () => {
    handlers.clear();
    emitted.length = 0;
    calls.connect = 0;
  };
  return { socket, handlers, emitted, calls, reset };
});

vi.mock("socket.io-client", () => ({ io: () => fake.socket }));

const serverSends = (event: string, payload?: unknown) => {
  act(() => {
    fake.handlers.get(event)?.(payload);
  });
};

const snapshot = (overrides: Partial<DisplaySnapshot> = {}): DisplaySnapshot => ({
  protocol: PROTOCOL_VERSION,
  show: { id: "demo", name: "Demo Show", theme: { id: "base" } },
  display: { id: "bridge-1" },
  screen: ScreenSchema.parse({
    schemaVersion: 1,
    id: "welcome",
    name: "Welcome",
    root: {
      id: "root",
      type: "container",
      layout: { kind: "stack", direction: "column" },
      children: [
        { node: { id: "title", type: "widget", kind: "title", props: { text: "WELCOME ABOARD" } } },
        { node: { id: "go", type: "widget", kind: "button", props: { label: "ENGAGE" } } },
      ],
    },
  }),
  ...overrides,
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

beforeEach(() => {
  fake.reset();
  sessionStorage.clear();
});

describe("display page", () => {
  it("says hello with its display id once connected", () => {
    renderAt("/d/bridge-1");
    expect(screen.getByText("CONNECTING")).toBeInTheDocument();

    serverSends("connect");

    expect(fake.emitted).toEqual([
      { event: "hello", payload: { role: "display", displayId: "bridge-1", protocol: PROTOCOL_VERSION } },
    ]);
  });

  it("renders the screen from the snapshot", () => {
    renderAt("/d/bridge-1");
    serverSends("connect");
    serverSends("snapshot", snapshot());

    expect(screen.getByRole("heading", { name: "WELCOME ABOARD" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ENGAGE" })).toBeInTheDocument();
  });

  it("keeps the last screen while reconnecting", () => {
    renderAt("/d/bridge-1");
    serverSends("connect");
    serverSends("snapshot", snapshot());
    serverSends("disconnect");

    expect(screen.getByRole("heading", { name: "WELCOME ABOARD" })).toBeInTheDocument();
    expect(screen.getByText("RECONNECTING")).toBeInTheDocument();

    serverSends("connect");
    expect(screen.queryByText("RECONNECTING")).not.toBeInTheDocument();
  });

  it("reconnects after the server drops it on purpose", () => {
    renderAt("/d/bridge-1");
    serverSends("connect");
    serverSends("disconnect", "transport close");
    expect(fake.calls.connect).toBe(0);

    serverSends("disconnect", "io server disconnect");
    expect(fake.calls.connect).toBe(1);
  });

  it("says when no screen is assigned", () => {
    renderAt("/d/bridge-1");
    serverSends("connect");
    serverSends("snapshot", snapshot({ screen: null }));

    expect(screen.getByText("NO SCREEN ASSIGNED")).toBeInTheDocument();
    expect(screen.getByText("bridge-1 · Demo Show")).toBeInTheDocument();
  });

  it("shows a server error before any snapshot", () => {
    renderAt("/d/bridge-1");
    serverSends("connect");
    serverSends("error", { code: "NO_ACTIVE_SHOW", message: "No show is active" });

    expect(screen.getByText("No show is active")).toBeInTheDocument();
  });

  it("shows an error instead of reloading twice for a protocol mismatch", () => {
    sessionStorage.setItem("interactive-displays.protocolReload", String(PROTOCOL_VERSION + 1));
    renderAt("/d/bridge-1");
    serverSends("connect");
    serverSends("snapshot", snapshot({ protocol: PROTOCOL_VERSION + 1 }));

    expect(screen.getByText(/Clear the browser cache/)).toBeInTheDocument();
  });

  it("rejects an invalid display id", () => {
    renderAt("/d/Not%20Valid");
    expect(screen.getByText("INVALID DISPLAY ID")).toBeInTheDocument();
  });

  it("remembers the display id from the URL", () => {
    renderAt("/d/bridge-1");
    expect(localStorage.getItem("interactive-displays.displayId")).toBe("bridge-1");
  });

  it("gives a new browser an id at /d", () => {
    renderAt("/d");
    expect(screen.getByText(/^d-[0-9a-f]{6}$/)).toBeInTheDocument();
  });

  it("reuses the remembered id at /d", () => {
    localStorage.setItem("interactive-displays.displayId", "bridge-7");
    renderAt("/");
    expect(screen.getByText("bridge-7")).toBeInTheDocument();
  });
});
