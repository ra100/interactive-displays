import { type DisplaySnapshot, PROTOCOL_VERSION, ScreenSchema } from "@interactive-displays/core";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App.tsx";
import { IDENTIFY_MS } from "./IdentifyOverlay.tsx";

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

const reload = vi.hoisted(() => ({ calls: 0 }));
vi.mock("./reloadPage.ts", () => ({
  reloadPage: () => {
    reload.calls += 1;
  },
}));

const serverSends = (event: string, payload?: unknown) => {
  act(() => {
    fake.handlers.get(event)?.(payload);
  });
};

const snapshot = (overrides: Partial<DisplaySnapshot> = {}): DisplaySnapshot => ({
  protocol: PROTOCOL_VERSION,
  show: {
    id: "demo",
    name: "Demo Show",
    theme: { id: "base" },
    states: [
      { id: "normal", label: "Normal", effect: "none" },
      { id: "red-alert", label: "Red alert", effect: "alert", banner: "RED ALERT" },
    ],
    signals: [],
    sounds: false,
  },
  state: "normal",
  signals: {},
  display: { id: "bridge-1" },
  screen: ScreenSchema.parse({
    schemaVersion: 2,
    id: "welcome",
    name: "Welcome",
    root: {
      id: "root",
      type: "container",
      layout: { kind: "stack", direction: "column" },
      children: [
        { node: { id: "title", type: "widget", kind: "title", props: { text: "WELCOME ABOARD" } } },
        {
          node: {
            id: "status",
            type: "widget",
            kind: "text",
            props: { text: "ALL CLEAR" },
            when: [{ state: "red-alert", props: { text: "BATTLE STATIONS", tone: "danger" } }],
          },
        },
        { node: { id: "go", type: "widget", kind: "button", props: { label: "ENGAGE" } } },
      ],
    },
  }),
  preview: false,
  navigated: false,
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
  reload.calls = 0;
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

  it("says when no screen is assigned, with the display id in large type", () => {
    renderAt("/d/bridge-1");
    serverSends("connect");
    serverSends("snapshot", snapshot({ screen: null }));

    expect(screen.getByText("NO SCREEN ASSIGNED")).toBeInTheDocument();
    expect(screen.getByText("bridge-1")).toHaveClass("status-message__code");
    expect(screen.getByText("Demo Show")).toBeInTheDocument();
  });

  it("switches state from a state event without a new snapshot", () => {
    const { container } = renderAt("/d/bridge-1");
    serverSends("connect");
    serverSends("snapshot", snapshot());
    expect(screen.getByText("ALL CLEAR")).toBeInTheDocument();

    serverSends("state", { state: "red-alert" });

    const root = container.querySelector(".screen");
    expect(root).toHaveAttribute("data-state", "red-alert");
    expect(root).toHaveAttribute("data-effect", "alert");
    expect(screen.getByText("BATTLE STATIONS")).toHaveAttribute("data-tone", "danger");
  });

  it("starts in the state from the snapshot", () => {
    const { container } = renderAt("/d/bridge-1");
    serverSends("connect");
    serverSends("snapshot", snapshot({ state: "red-alert" }));

    expect(container.querySelector(".screen")).toHaveAttribute("data-effect", "alert");
  });

  it("previews another theme and variant from the URL", () => {
    const { container } = renderAt("/d/bridge-1?theme=lcars&variant=picard");
    serverSends("connect");
    serverSends("snapshot", snapshot());

    const root = container.querySelector(".screen");
    expect(root).toHaveAttribute("data-theme", "lcars");
    expect(root).toHaveAttribute("data-variant", "picard");
  });

  it("renders an unknown state as normal", () => {
    const { container } = renderAt("/d/bridge-1");
    serverSends("connect");
    serverSends("snapshot", snapshot({ state: "mystery" }));

    expect(container.querySelector(".screen")).toHaveAttribute("data-effect", "none");
    expect(screen.getByText("ALL CLEAR")).toBeInTheDocument();
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

  it("marks a draft preview so nobody mistakes it for the published screen", () => {
    renderAt("/d/bridge-1");
    serverSends("connect");
    serverSends("snapshot", snapshot());
    expect(screen.queryByText("DRAFT PREVIEW")).not.toBeInTheDocument();

    serverSends("snapshot", snapshot({ preview: true }));
    expect(screen.getByText("DRAFT PREVIEW")).toBeInTheDocument();
  });

  it("reloads when the operator asks it to", () => {
    renderAt("/d/bridge-1");
    serverSends("connect");
    serverSends("reload");
    expect(reload.calls).toBe(1);
  });

  it("reloads once for a protocol mismatch", () => {
    renderAt("/d/bridge-1");
    serverSends("connect");
    serverSends("snapshot", snapshot({ protocol: PROTOCOL_VERSION + 1 }));
    expect(reload.calls).toBe(1);
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

describe("identify", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flashes the label over the screen for a few seconds", () => {
    renderAt("/d/bridge-1");
    serverSends("connect");
    serverSends("snapshot", snapshot());
    serverSends("identify", { label: "Bridge 1" });

    expect(screen.getByRole("alert")).toHaveTextContent("Bridge 1");
    expect(screen.getByRole("heading", { name: "WELCOME ABOARD" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(IDENTIFY_MS);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
