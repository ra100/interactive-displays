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
