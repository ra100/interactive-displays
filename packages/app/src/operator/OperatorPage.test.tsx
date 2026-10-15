import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Call, fakeFetch } from "../testing/fakeFetch.ts";
import { fakeServer } from "../testing/fakeSocket.ts";
import { sampleOverview, sampleScreen } from "../testing/fixtures.ts";
import { timeAgo } from "./DisplayCard.tsx";
import { OperatorPage } from "./OperatorPage.tsx";

vi.mock("socket.io-client", async () => ({ io: (await import("../testing/fakeSocket.ts")).fakeIo }));

let session: { tokenRequired: boolean; tokenValid: boolean; publicUrl: string | null } = {
  tokenRequired: false,
  tokenValid: true,
  publicUrl: "http://10.0.0.5:3010",
};
let calls: Call[];

beforeEach(() => {
  fakeServer.reset();
  localStorage.clear();
  session = { tokenRequired: false, tokenValid: true, publicUrl: "http://10.0.0.5:3010" };
  calls = fakeFetch(({ method, path }) => {
    if (path === "/api/session") return { body: session };
    if (method === "GET" && path.endsWith("/published")) {
      const id = path.split("/")[3] ?? "";
      return { body: { screen: sampleScreen(id, id) } };
    }
    if (method !== "GET") return { body: {} };
    return undefined;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const open = async () => {
  render(
    <MemoryRouter>
      <OperatorPage />
    </MemoryRouter>,
  );
  await waitFor(() => expect(fakeServer.emitted.length).toBe(0));
  fakeServer.send("connect");
  fakeServer.send("overview", sampleOverview());
  return screen.findByRole("heading", { name: "Demo Show" });
};

const writes = () => calls.filter((call) => call.method !== "GET");

describe("operator console", () => {
  it("says hello as an operator", async () => {
    await open();
    expect(fakeServer.emitted[0]).toEqual({ event: "hello", payload: { role: "operator", protocol: expect.any(Number) } });
  });

  it("has a button per state, with the current one pressed", async () => {
    await open();
    expect(screen.getByRole("button", { name: "Normal" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Red alert/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("sets the show state", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: /Red alert/ }));
    expect(writes()).toEqual([expect.objectContaining({ method: "POST", path: "/api/state", body: { state: "red-alert" } })]);
  });

  it("follows state changes from other operators", async () => {
    await open();
    fakeServer.send("state", { state: "red-alert" });
    expect(screen.getByRole("button", { name: /Red alert/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("has a blackout panic button that also ends the blackout", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Blackout" }));
    fakeServer.send("state", { state: "blackout" });
    await userEvent.click(screen.getByRole("button", { name: "End blackout" }));

    expect(writes().map((call) => call.body)).toEqual([{ state: "blackout" }, { state: "normal" }]);
  });

  it("lists displays with what they show and whether they are connected", async () => {
    await open();
    const card = screen.getByRole("listitem", { name: "Engineering 1" });
    expect(within(card).getByText(/eng-1 · connected/)).toBeInTheDocument();
    expect(within(card).getByRole("combobox")).toHaveValue("engineering");
    expect(within(screen.getByRole("listitem", { name: "lobby" })).getByText(/never connected/)).toBeInTheDocument();
  });

  it("assigns a screen, and goes back to the show default", async () => {
    await open();
    const select = within(screen.getByRole("listitem", { name: "Engineering 1" })).getByRole("combobox");
    expect(within(select).getByRole("option", { name: "Draft only (not published)" })).toBeInTheDocument();

    await userEvent.selectOptions(select, "bridge");
    await userEvent.selectOptions(select, "");

    expect(writes().map((call) => [call.path, call.body])).toEqual([
      ["/api/displays/eng-1", { screen: "bridge" }],
      ["/api/displays/eng-1", { screen: null }],
    ]);
  });

  it("identifies and reloads connected displays only", async () => {
    await open();
    const card = screen.getByRole("listitem", { name: "Engineering 1" });
    await userEvent.click(within(card).getByRole("button", { name: "Identify" }));
    await userEvent.click(within(card).getByRole("button", { name: "Reload" }));

    expect(writes().map((call) => call.path)).toEqual(["/api/displays/eng-1/identify", "/api/displays/eng-1/reload"]);
    expect(within(screen.getByRole("listitem", { name: "lobby" })).getByRole("button", { name: "Identify" })).toBeDisabled();
  });

  it("renames a display", async () => {
    await open();
    const card = screen.getByRole("listitem", { name: "lobby" });
    await userEvent.click(within(card).getByRole("button", { name: "Rename" }));
    await userEvent.type(within(card).getByRole("textbox", { name: "Name for lobby" }), "Lobby screen{Enter}");

    expect(writes()).toEqual([expect.objectContaining({ method: "PUT", path: "/api/displays/lobby", body: { name: "Lobby screen" } })]);
  });

  it("shows a QR code with the display's address on the public URL", async () => {
    await open();
    const card = screen.getByRole("listitem", { name: "lobby" });
    await userEvent.click(within(card).getByRole("button", { name: "QR" }));
    expect(within(card).getByRole("img", { name: "QR code for lobby" })).toBeInTheDocument();
    expect(within(card).getByText("http://10.0.0.5:3010/d/lobby")).toBeInTheDocument();
  });

  it("shows a preview of what each display shows, from the published copy", async () => {
    await open();
    await waitFor(() => expect(calls.map((call) => call.path)).toContain("/api/screens/engineering/published"));
    expect(await screen.findByRole("heading", { name: "ENGINEERING", hidden: true })).toBeInTheDocument();
  });

  it("ends a draft preview", async () => {
    await open();
    const overview = sampleOverview();
    fakeServer.send("overview", {
      ...overview,
      displays: overview.displays.map((display) => (display.id === "eng-1" ? { ...display, preview: "draft" } : display)),
    });
    const card = screen.getByRole("listitem", { name: "Engineering 1" });
    expect(within(card).getByText("Draft preview")).toBeInTheDocument();

    await userEvent.click(within(card).getByRole("button", { name: "End preview" }));
    expect(writes()).toEqual([expect.objectContaining({ method: "DELETE", path: "/api/displays/eng-1/preview" })]);
  });

  it("explains a failed action", async () => {
    calls = fakeFetch(({ method, path }) => {
      if (path === "/api/session") return { body: session };
      if (method === "POST") return { status: 404, body: { error: "The show has no state" } };
      return undefined;
    });
    await open();
    await userEvent.click(screen.getByRole("button", { name: /Red alert/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The show has no state");
  });
});

describe("editor token", () => {
  it("asks for the token when the server needs one, then says hello with it", async () => {
    session = { tokenRequired: true, tokenValid: false, publicUrl: null };
    render(
      <MemoryRouter>
        <OperatorPage />
      </MemoryRouter>,
    );
    await userEvent.type(await screen.findByLabelText("Editor token"), "set-secret-1");
    session = { tokenRequired: true, tokenValid: true, publicUrl: null };
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(localStorage.getItem("interactive-displays.editorToken")).toBe("set-secret-1");
    fakeServer.send("connect");
    expect(fakeServer.emitted.at(-1)?.payload).toMatchObject({ role: "operator", token: "set-secret-1" });
  });

  it("asks again when the socket turns the token away", async () => {
    await open();
    fakeServer.send("error", { code: "UNAUTHORIZED", message: "This server needs the editor token" });
    expect(await screen.findByLabelText("Editor token")).toBeInTheDocument();
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-10-15T12:00:00.000Z");
  it.each([
    ["2026-10-15T11:59:30.000Z", "30 seconds ago"],
    ["2026-10-15T11:55:00.000Z", "5 minutes ago"],
    ["2026-10-15T09:00:00.000Z", "3 hours ago"],
    ["2026-10-14T12:00:00.000Z", "yesterday"],
  ])("%s → %s", (iso, text) => {
    expect(timeAgo(iso, now)).toBe(text);
  });
});
