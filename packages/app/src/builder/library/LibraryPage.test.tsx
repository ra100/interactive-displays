import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Call, fakeFetch } from "../../testing/fakeFetch.ts";
import { fakeServer } from "../../testing/fakeSocket.ts";
import { sampleOverview, sampleScreen } from "../../testing/fixtures.ts";
import { LibraryPage } from "./LibraryPage.tsx";

vi.mock("socket.io-client", async () => ({ io: (await import("../../testing/fakeSocket.ts")).fakeIo }));

let calls: Call[];

beforeEach(() => {
  fakeServer.reset();
  localStorage.clear();
  calls = fakeFetch(({ method, path }) => {
    if (path === "/api/session") return { body: { tokenRequired: false, tokenValid: true, publicUrl: null } };
    if (method === "GET" && path.startsWith("/api/screens/")) {
      const id = path.split("/")[3] ?? "";
      return { body: { screen: sampleScreen(id, id), lint: [], onAir: [] } };
    }
    if (method === "POST" && path === "/api/screens") return { status: 201, body: { screen: {}, lint: [] } };
    if (method === "POST" && path.endsWith("/duplicate")) return { status: 201, body: { screen: { id: "bridge-copy", name: "Bridge copy" } } };
    if (method === "DELETE") return { body: { deleted: path.split("/")[3] } };
    if (method === "PUT" && path === "/api/show/signals") return { body: { signals: [] } };
    return undefined;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const open = async () => {
  render(
    <MemoryRouter initialEntries={["/builder"]}>
      <Routes>
        <Route path="/builder" element={<LibraryPage />} />
        <Route path="/builder/:screenId" element={<p>Editing</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(fakeServer.emitted.length).toBe(0));
  fakeServer.send("connect");
  fakeServer.send("overview", sampleOverview());
  await screen.findByRole("heading", { name: "Demo Show" });
};

const card = (name: string) => {
  const heading = screen.getByRole("heading", { name });
  const item = heading.closest("li");
  if (!item) throw new Error(`no card for ${name}`);
  return within(item);
};

const writes = () => calls.filter((call) => call.method !== "GET");

describe("screen library", () => {
  it("says hello as a builder and lists every screen with its publish status", async () => {
    await open();
    expect(fakeServer.emitted[0]).toMatchObject({ event: "hello", payload: { role: "builder" } });
    expect(card("Bridge").getByText("Published")).toBeInTheDocument();
    expect(card("Engineering").getByText("Unpublished changes")).toBeInTheDocument();
    expect(card("Draft only").getByText("Never published")).toBeInTheDocument();
    expect(card("Engineering").getByText("On 1 display")).toBeInTheDocument();
  });

  it("finds screens by name, id, section or tag", async () => {
    await open();
    await userEvent.type(screen.getByLabelText("Search screens"), "engin");
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Engineering"]);
    await userEvent.clear(screen.getByLabelText("Search screens"));
    await userEvent.type(screen.getByLabelText("Search screens"), "nothing like it");
    expect(screen.getByText(/No screen matches/)).toBeInTheDocument();
  });

  it("does not offer to delete the default screen or an assigned one", async () => {
    await open();
    expect(card("Bridge").getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(card("Engineering").getByRole("button", { name: "Delete" })).toHaveAttribute("title", "Assigned to Engineering 1");
    expect(card("Draft only").getByRole("button", { name: "Delete" })).toBeEnabled();
  });

  it("deletes a screen after confirmation", async () => {
    await open();
    await userEvent.click(card("Draft only").getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete Draft only?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(writes()).toEqual([expect.objectContaining({ method: "DELETE", path: "/api/screens/draft" })]);
    expect(await screen.findByText("Deleted Draft only")).toBeInTheDocument();
  });

  it("duplicates a screen", async () => {
    await open();
    await userEvent.click(card("Bridge").getByRole("button", { name: "Duplicate" }));
    expect(writes()).toEqual([expect.objectContaining({ method: "POST", path: "/api/screens/bridge/duplicate" })]);
    expect(await screen.findByText("Created Bridge copy")).toBeInTheDocument();
  });

  it("creates a screen from a template and opens it", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "New screen" }));
    const dialog = within(screen.getByRole("dialog", { name: "New screen" }));
    await userEvent.type(dialog.getByLabelText("Name"), "Warp Core");
    expect(dialog.getByLabelText("Id")).toHaveValue("warp-core");
    await userEvent.type(dialog.getByLabelText("Section"), "Engineering");
    await userEvent.click(dialog.getByRole("radio", { name: /Dashboard/ }));
    await userEvent.click(dialog.getByRole("button", { name: "Create and edit" }));

    expect(await screen.findByText("Editing")).toBeInTheDocument();
    expect(writes()).toEqual([
      expect.objectContaining({
        method: "POST",
        path: "/api/screens",
        body: expect.objectContaining({
          id: "warp-core",
          name: "Warp Core",
          section: "engineering",
          root: expect.objectContaining({ layout: { kind: "frame", archetype: "dashboard" } }),
        }),
      }),
    ]);
  });

  it("generates a section screen from three takes and opens it", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    const dialog = within(screen.getByRole("dialog", { name: "Generate a screen" }));
    await userEvent.selectOptions(dialog.getByLabelText("Section"), "Tactical");
    await userEvent.clear(dialog.getByLabelText("Seed"));
    await userEvent.type(dialog.getByLabelText("Seed"), "1234");
    expect(dialog.getAllByRole("radio", { name: /Take/ })).toHaveLength(3);
    await userEvent.click(dialog.getByRole("radio", { name: /Take 2/ }));
    await userEvent.click(dialog.getByRole("button", { name: "Create and edit" }));

    expect(await screen.findByText("Editing")).toBeInTheDocument();
    expect(writes()).toEqual([
      expect.objectContaining({
        method: "POST",
        path: "/api/screens",
        body: expect.objectContaining({
          id: "tactical",
          section: "tactical",
          generator: { recipe: "trek/tactical", seed: 1235, density: "dense" },
        }),
      }),
    ]);
  });

  it("lists sections by content pack", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    const dialog = within(screen.getByRole("dialog", { name: "Generate a screen" }));
    const groups = [...dialog.getByLabelText("Section").querySelectorAll("optgroup")].map((group) => group.label);
    expect(groups).toEqual(["Starship", "Patrol corvette", "Deep-space freighter"]);
    await userEvent.selectOptions(dialog.getByLabelText("Section"), "Reactor room");
    expect(dialog.getAllByRole("radio", { name: /Take/ })).toHaveLength(3);
  });

  it("generates a linked suite of screens", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    const dialog = within(screen.getByRole("dialog", { name: "Generate a screen" }));
    await userEvent.selectOptions(dialog.getByLabelText("Section"), "Medical");
    await userEvent.click(dialog.getByRole("checkbox", { name: /screen for each system/ }));
    await userEvent.click(dialog.getByRole("button", { name: "Create 4 screens" }));

    expect(await screen.findByText("Editing")).toBeInTheDocument();
    expect(writes().map((call) => (call.body as { id: string }).id)).toEqual(["medical", "medical-vitals", "medical-biobed", "medical-quarantine"]);
  });

  it("will not reuse an existing screen id", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "New screen" }));
    const dialog = within(screen.getByRole("dialog", { name: "New screen" }));
    await userEvent.type(dialog.getByLabelText("Name"), "Bridge");
    expect(dialog.getByLabelText("Id")).toHaveValue("bridge-2");
    await userEvent.clear(dialog.getByLabelText("Id"));
    await userEvent.type(dialog.getByLabelText("Id"), "bridge");
    expect(dialog.getByText("A screen with this id exists")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Create and edit" })).toBeDisabled();
  });
});

describe("signals", () => {
  const dialog = () => within(screen.getByRole("dialog", { name: "Signals" }));

  it("adds a signal that wanders and saves the show's signals", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Signals" }));
    expect(dialog().getByText(/No signals yet/)).toBeInTheDocument();

    await userEvent.click(dialog().getByRole("button", { name: "Add signal" }));
    await userEvent.clear(dialog().getByLabelText("Name"));
    await userEvent.type(dialog().getByLabelText("Name"), "Core output");
    await userEvent.clear(dialog().getByLabelText("Id"));
    await userEvent.type(dialog().getByLabelText("Id"), "warp.output");
    await userEvent.type(dialog().getByLabelText("Unit"), "%");
    await userEvent.selectOptions(dialog().getByLabelText("Value"), "Wanders");
    await userEvent.click(dialog().getByRole("radio", { name: /Its own value/ }));
    await userEvent.clear(dialog().getByLabelText("Lowest"));
    await userEvent.type(dialog().getByLabelText("Lowest"), "88{Enter}");
    await userEvent.click(dialog().getByRole("button", { name: "Save signals" }));

    expect(writes()).toEqual([
      expect.objectContaining({
        method: "PUT",
        path: "/api/show/signals",
        body: {
          signals: [
            {
              id: "warp.output",
              label: "Core output",
              unit: "%",
              scope: "ambient",
              source: { kind: "walk", min: 88, max: 100, volatility: 0.3 },
            },
          ],
        },
      }),
    ]);
    expect(await screen.findByText("Saved signals")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("will not save signals that do not make sense", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Signals" }));
    await userEvent.click(dialog().getByRole("button", { name: "Add signal" }));
    await userEvent.clear(dialog().getByLabelText("Highest"));
    await userEvent.type(dialog().getByLabelText("Highest"), "-5{Enter}");
    expect(dialog().getByText(/min must be below max/)).toBeInTheDocument();
    expect(dialog().getByRole("button", { name: "Save signals" })).toBeDisabled();

    await userEvent.clear(dialog().getByLabelText("Highest"));
    await userEvent.type(dialog().getByLabelText("Highest"), "50{Enter}");
    await userEvent.click(dialog().getByRole("button", { name: "Add signal" }));
    await userEvent.clear(dialog().getByLabelText("Id"));
    await userEvent.type(dialog().getByLabelText("Id"), "signal");
    expect(dialog().getByText(/Signal ids must be unique/)).toBeInTheDocument();

    await userEvent.click(dialog().getByRole("button", { name: "Remove New signal" }));
    expect(dialog().getByRole("button", { name: "Save signals" })).toBeEnabled();
  });

  it("keeps a value the operator sets shared, and its start inside its range", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Signals" }));
    await userEvent.click(dialog().getByRole("button", { name: "Add signal" }));
    expect(dialog().getByRole("radio", { name: /Its own value/ })).toBeDisabled();

    await userEvent.clear(dialog().getByLabelText("Lowest"));
    await userEvent.type(dialog().getByLabelText("Lowest"), "20{Enter}");
    expect(dialog().getByLabelText("Starts at")).toHaveValue(20);

    await userEvent.clear(dialog().getByLabelText("Starts at"));
    await userEvent.type(dialog().getByLabelText("Starts at"), "500{Enter}");
    expect(dialog().getByText(/Starts at must be between Lowest and Highest/)).toBeInTheDocument();
    expect(dialog().getByRole("button", { name: "Save signals" })).toBeDisabled();
  });

  it("reads a fixed value when the field is left: decimals are numbers, codes stay text", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Signals" }));
    await userEvent.click(dialog().getByRole("button", { name: "Add signal" }));
    await userEvent.selectOptions(dialog().getByLabelText("Value"), "Fixed");
    await userEvent.clear(dialog().getByLabelText("Fixed value"));
    await userEvent.type(dialog().getByLabelText("Fixed value"), "6.2");
    expect(dialog().getByLabelText("Fixed value")).toHaveValue("6.2");
    await userEvent.click(dialog().getByRole("button", { name: "Save signals" }));
    expect(writes().at(-1)?.body).toMatchObject({ signals: [{ source: { kind: "static", value: 6.2 } }] });
  });

  it("keeps focus where someone is typing when the show changes", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Signals" }));
    await userEvent.click(dialog().getByRole("button", { name: "Add signal" }));
    await userEvent.click(dialog().getByLabelText("Name"));
    fakeServer.send("overview", sampleOverview());
    fakeServer.send("state", { state: "red-alert" });
    await waitFor(() => expect(dialog().getByLabelText("Name")).toHaveFocus());
  });
});
