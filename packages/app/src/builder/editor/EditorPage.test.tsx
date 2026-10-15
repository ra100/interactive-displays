import { applyOps, catalog, type Op, type Screen, ScreenSchema } from "@interactive-displays/core";
import { decorCatalog } from "@interactive-displays/themes/manifest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Call, fakeFetch } from "../../testing/fakeFetch.ts";
import { fakeServer } from "../../testing/fakeSocket.ts";
import { sampleOverview } from "../../testing/fixtures.ts";
import { EditorPage } from "./EditorPage.tsx";

vi.mock("socket.io-client", async () => ({ io: (await import("../../testing/fakeSocket.ts")).fakeIo }));

const bridge = (): Screen =>
  ScreenSchema.parse({
    schemaVersion: 2,
    id: "bridge",
    name: "Bridge",
    revision: 0,
    published: 0,
    root: {
      id: "root",
      type: "container",
      layout: { kind: "frame", archetype: "sidebar" },
      children: [
        { slot: "title", node: { id: "title", type: "widget", kind: "title", props: { text: "BRIDGE" } } },
        { slot: "nav", node: { id: "helm", type: "widget", kind: "button", props: { label: "HELM" } } },
        { slot: "main", node: { id: "note", type: "widget", kind: "text", props: { text: "All quiet." } } },
      ],
    },
  });

// A small stand-in for the server: it applies ops like the real one and counts revisions.
let draft: Screen;
let conflicts = 0;
let calls: Call[];

beforeEach(() => {
  fakeServer.reset();
  localStorage.clear();
  draft = bridge();
  conflicts = 0;
  calls = fakeFetch(({ method, path, body }) => {
    if (path === "/api/session") return { body: { tokenRequired: false, tokenValid: true, publicUrl: null } };
    if (path === "/api/assets") return { body: { assets: [] } };
    if (method === "GET" && path === "/api/screens/bridge") return { body: { screen: draft, lint: [], onAir: [] } };
    if (method === "POST" && path === "/api/screens/bridge/ops") {
      const { baseRevision, ops } = body as { baseRevision: number; ops: Op[] };
      if (conflicts > 0 || baseRevision !== draft.revision) {
        conflicts = Math.max(0, conflicts - 1);
        return { status: 409, body: { error: "The screen changed", revision: draft.revision } };
      }
      const result = applyOps(draft, ops, { catalog, decor: decorCatalog });
      if (!result.ok) return { status: 422, body: { error: "Invalid", issues: result.issues } };
      draft = { ...result.screen, revision: draft.revision + 1 };
      return { body: { screen: draft, lint: [] } };
    }
    if (method === "POST" && path === "/api/screens/bridge/publish") {
      draft = { ...draft, published: draft.revision };
      return { body: { screen: draft, onAir: ["lobby"] } };
    }
    if (method === "GET" && path === "/api/screens/bridge/revisions") {
      return { body: { revisions: [{ revision: draft.revision, savedAt: "2026-10-15T10:00:00.000Z" }, { revision: 0, savedAt: null }] } };
    }
    if (method === "POST" && path === "/api/screens/bridge/revert") {
      draft = { ...bridge(), revision: draft.revision + 1 };
      return { body: { screen: draft, lint: [] } };
    }
    return undefined;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const open = async () => {
  render(
    <MemoryRouter initialEntries={["/builder/bridge"]}>
      <Routes>
        <Route path="/builder/:screenId" element={<EditorPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(fakeServer.emitted.length).toBe(0));
  fakeServer.send("connect");
  fakeServer.send("overview", sampleOverview());
  await screen.findByRole("heading", { name: "Bridge", level: 1 });
};

const opsSent = () =>
  calls.filter((call) => call.path === "/api/screens/bridge/ops").map((call) => call.body as { baseRevision: number; ops: Op[] });

const outline = () => within(screen.getByRole("tree", { name: "Outline" }));
const inspector = () => within(screen.getByRole("tabpanel", { name: "Selection" }));
const preview = () => screen.getByRole("region", { name: "Preview" });

const selectInOutline = async (name: RegExp) => userEvent.click(outline().getByRole("treeitem", { name }));

describe("screen editor", () => {
  it("opens the draft, watches it and shows it with the display runtime", async () => {
    await open();
    expect(fakeServer.emitted.map((event) => event.event)).toEqual(["hello", "watch"]);
    expect(fakeServer.emitted[1]).toEqual({ event: "watch", payload: { screenId: "bridge" } });
    expect(within(preview()).getByText("BRIDGE")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("edits a prop from the inspector and saves it as an op", async () => {
    await open();
    await selectInOutline(/Button · HELM/);
    const label = inspector().getByLabelText("Label");
    await userEvent.clear(label);
    await userEvent.type(label, "HELM CONTROL");
    await userEvent.tab();

    await waitFor(() => expect(opsSent()).toEqual([{ baseRevision: 0, ops: [{ op: "update", id: "helm", props: { label: "HELM CONTROL" } }] }]));
    expect(within(preview()).getByText("HELM CONTROL")).toBeInTheDocument();

  });

  it("selects a node by clicking it in the preview", async () => {
    await open();
    await userEvent.click(within(preview()).getByText("All quiet."));
    expect(inspector().getByRole("heading", { name: "Text · All quiet." })).toBeInTheDocument();
  });

  it("undoes and redoes with the buttons", async () => {
    await open();
    await selectInOutline(/Text · All quiet/);
    await userEvent.click(inspector().getByRole("radio", { name: "danger" }));
    await waitFor(() => expect(opsSent()).toHaveLength(1));

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(opsSent()).toHaveLength(2));
    // The tone was not set before, so undo removes it again.
    expect(opsSent()[1]).toEqual({ baseRevision: 1, ops: [{ op: "update", id: "note", props: { tone: null } }] });

    await userEvent.click(screen.getByRole("button", { name: "Redo" }));
    await waitFor(() => expect(opsSent()[2]?.ops).toEqual([{ op: "update", id: "note", props: { tone: "danger" } }]));
  });

  it("adds a widget from the Add panel into the selected slot", async () => {
    await open();
    await userEvent.click(outline().getByRole("treeitem", { name: /^status/ }));
    const add = within(screen.getByRole("region", { name: "Add" }));
    await userEvent.click(add.getByText("Button", { selector: ".palette-item__label" }));

    await waitFor(() =>
      expect(opsSent()[0]?.ops).toEqual([
        {
          op: "insert",
          parent: "root",
          index: 3,
          child: { slot: "status", node: { id: "button", type: "widget", kind: "button", props: { label: "ENGAGE" } } },
        },
      ]),
    );
    expect(inspector().getByRole("heading", { name: "Button · ENGAGE" })).toBeInTheDocument();
  });

  it("deletes the selection with the Delete key", async () => {
    await open();
    await selectInOutline(/Text · All quiet/);
    fireEvent.keyDown(window, { key: "Delete" });
    await waitFor(() => expect(opsSent()[0]?.ops).toEqual([{ op: "remove", id: "note" }]));
    expect(within(preview()).queryByText("All quiet.")).not.toBeInTheDocument();
  });

  it("moves a node to another slot from the inspector", async () => {
    await open();
    await selectInOutline(/Button · HELM/);
    await userEvent.selectOptions(inspector().getByLabelText("Slot"), "status");
    await waitFor(() => expect(opsSent()[0]?.ops).toEqual([{ op: "move", id: "helm", parent: "root", index: 2 }, { op: "place", id: "helm", slot: "status" }]));
  });

  it("edits a prop for one show state only", async () => {
    await open();
    await userEvent.selectOptions(screen.getByLabelText("State"), "red-alert");
    await selectInOutline(/Text · All quiet/);
    await userEvent.click(inspector().getByRole("radio", { name: "Only in Red alert" }));
    await userEvent.click(inspector().getByRole("radio", { name: "danger" }));

    await waitFor(() =>
      expect(opsSent()[0]?.ops).toEqual([{ op: "set", id: "note", when: [{ state: "red-alert", props: { tone: "danger" } }] }]),
    );
    expect(inspector().getByText("Changes per state")).toBeInTheDocument();
  });

  it("asks before publishing a screen that is on air, then publishes the saved revision", async () => {
    await open();
    await selectInOutline(/Button · HELM/);
    await userEvent.click(inspector().getByRole("radio", { name: "danger" }));
    await waitFor(() => expect(opsSent()).toHaveLength(1));
    expect(await screen.findByText("Saved")).toBeInTheDocument();

    fakeServer.send("overview", sampleOverview({ screens: [{ ...sampleOverview().screens[0], revision: 1, published: 0 } as never] }));
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = within(screen.getByRole("dialog", { name: "Publish Bridge?" }));
    expect(dialog.getByText(/on air at once on lobby/)).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Publish" }));

    await waitFor(() =>
      expect(calls.find((call) => call.path === "/api/screens/bridge/publish")?.body).toEqual({ revision: 1 }),
    );
    expect(await screen.findByText("Published revision 1 to 1 display")).toBeInTheDocument();
  });

  it("shows edits someone else makes to the same draft", async () => {
    await open();
    const theirs = bridge();
    if (theirs.root.type === "container") theirs.root.children[2] = { slot: "main", node: { id: "note", type: "widget", kind: "text", props: { text: "Edited elsewhere." } } };
    fakeServer.send("screen", { screenId: "bridge", screen: { ...theirs, revision: 4 }, lint: [] });
    expect(await within(preview()).findByText("Edited elsewhere.")).toBeInTheDocument();
  });

  it("says so when the screen is deleted", async () => {
    await open();
    fakeServer.send("screen", { screenId: "bridge", screen: null, lint: [] });
    expect(await screen.findByRole("heading", { name: "This screen was deleted" })).toBeInTheDocument();
  });

  it("reloads and sends again when someone else saved first", async () => {
    await open();
    conflicts = 1;
    await selectInOutline(/Button · HELM/);
    await userEvent.click(inspector().getByRole("radio", { name: "danger" }));

    await waitFor(() => expect(opsSent()).toHaveLength(2));
    expect(opsSent().map((sent) => sent.baseRevision)).toEqual([0, 0]);
    expect(draft.revision).toBe(1);
  });

  it("restores an earlier revision from the history", async () => {
    await open();
    draft = { ...draft, revision: 2 };
    fakeServer.send("screen", { screenId: "bridge", screen: draft, lint: [] });
    await userEvent.click(screen.getByRole("tab", { name: "History" }));
    const history = within(screen.getByRole("tabpanel", { name: "History" }));
    expect(await history.findByText("Revision 0")).toBeInTheDocument();
    expect(history.getByText("Revision 2")).toBeInTheDocument();
    await userEvent.click(history.getByRole("button", { name: "Restore" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restore" }));

    await waitFor(() =>
      expect(calls.find((call) => call.path === "/api/screens/bridge/revert")?.body).toEqual({ baseRevision: 2, revision: 0 }),
    );
    expect(await screen.findByText("Restored revision 0 as revision 3")).toBeInTheDocument();
  });

  it("sends the draft to a display as a preview", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Send to display" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Preview on Engineering 1" }));
    expect(calls.find((call) => call.path === "/api/displays/eng-1/preview")).toMatchObject({ method: "PUT", body: { screen: "bridge" } });
  });
});
