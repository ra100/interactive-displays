import { ShowSchema } from "@interactive-displays/core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Call, fakeFetch } from "../testing/fakeFetch.ts";
import { fakeServer } from "../testing/fakeSocket.ts";
import { sampleOverview, sampleScreen } from "../testing/fixtures.ts";
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

const open = async (overview = sampleOverview()) => {
  render(
    <MemoryRouter>
      <OperatorPage />
    </MemoryRouter>,
  );
  await waitFor(() => expect(fakeServer.emitted.length).toBe(0));
  fakeServer.send("connect");
  fakeServer.send("overview", overview);
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
    expect(within(card).getByRole("combobox", { name: "Screen" })).toHaveValue("engineering");
    expect(within(screen.getByRole("listitem", { name: "lobby" })).getByText(/never connected/)).toBeInTheDocument();
  });

  it("assigns a screen, and goes back to the show default", async () => {
    await open();
    const select = within(screen.getByRole("listitem", { name: "Engineering 1" })).getByRole("combobox", { name: "Screen" });
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

describe("live values and display controls", () => {
  const base = sampleOverview();
  const liveOverview = sampleOverview({
    show: ShowSchema.parse({
      ...base.show,
      signals: [
        { id: "shields", label: "Shields", unit: "%", scope: "shared", source: { kind: "manual", initial: 0, step: 5 } },
        { id: "warp.output", label: "Warp output", scope: "shared", source: { kind: "walk", min: 88, max: 99 } },
        { id: "eps", label: "EPS", source: { kind: "walk", min: 0, max: 1 } },
      ],
    }),
    signals: { shields: 40, "warp.output": 92.46 },
    displays: base.displays.map((display) =>
      display.id === "eng-1" ? { ...display, showing: "bridge", navigated: "bridge", videos: ["feed"] } : display,
    ),
  });

  it("sets shared values with a slider or a step, and follows them as they change", async () => {
    await open(liveOverview);
    const slider = screen.getByRole("slider", { name: "Shields" });
    expect(slider).toHaveValue("40");
    expect(screen.getByText("40 %")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Raise Shields" }));
    fireEvent.change(slider, { target: { value: "70" } });
    expect(screen.getByText("70 %")).toBeInTheDocument();
    expect(writes().map((call) => [call.method, call.path, call.body])).toEqual([
      ["PUT", "/api/signals/shields/value", { delta: 5 }],
      ["PUT", "/api/signals/shields/value", { value: 70 }],
    ]);

    fakeServer.send("signals", { values: { shields: 70, "warp.output": 95.1 } });
    expect(screen.getByText("95.1")).toBeInTheDocument();
    fakeServer.send("signals", { values: { shields: 10 } });
    expect(slider).toHaveValue("10");
    // Ambient values are each display's own business.
    expect(screen.queryByText("EPS")).not.toBeInTheDocument();
  });

  it("explains where shared values come from when the show has none", async () => {
    await open();
    expect(screen.getByText(/no shared values/)).toBeInTheDocument();
  });

  it("switches display buttons and sounds for the whole show", async () => {
    await open();
    const sounds = screen.getByRole("switch", { name: /Sounds on displays/ });
    expect(sounds).not.toBeChecked();
    expect(screen.getByRole("switch", { name: /Display buttons run the show/ })).toBeChecked();

    await userEvent.click(sounds);
    await userEvent.click(screen.getByRole("switch", { name: /Display buttons run the show/ }));
    expect(writes().map((call) => [call.path, call.body])).toEqual([
      ["/api/show/settings", { sounds: true }],
      ["/api/show/settings", { displayGlobalActions: false }],
    ]);
  });

  it("re-skins the show in another theme and variant", async () => {
    await open();
    const theme = screen.getByRole("combobox", { name: "Theme" });
    expect(theme).toHaveValue("base");
    expect(screen.getByRole("combobox", { name: "Variant" })).toBeDisabled();
    await userEvent.selectOptions(theme, "Holo HUD");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Sounds" }), "LCARS");
    expect(writes().map((call) => [call.path, call.body])).toEqual([
      ["/api/show/theme", { id: "hud" }],
      ["/api/show/sound-pack", { pack: "lcars" }],
    ]);
  });

  it("sizes the show for its panels, and one display apart from the rest", async () => {
    await open();
    const look = screen.getByRole("region", { name: "Look" });
    expect(within(look).getByRole("combobox", { name: "Size" })).toHaveValue("0.7");
    await userEvent.selectOptions(within(look).getByRole("combobox", { name: "Size" }), "50%");
    const card = within(screen.getByRole("listitem", { name: "Engineering 1" })).getByRole("combobox", { name: "Size" });
    expect(card).toHaveValue("");
    await userEvent.selectOptions(card, "80%");
    await userEvent.selectOptions(card, "Show size (70%)");
    expect(writes().map((call) => [call.path, call.body])).toEqual([
      ["/api/show/scale", { scale: 0.5 }],
      ["/api/displays/eng-1", { scale: 0.8 }],
      ["/api/displays/eng-1", { scale: null }],
    ]);
  });

  describe("cues", () => {
    const withCues = (cue: string | null = null) =>
      sampleOverview({
        cue,
        show: ShowSchema.parse({
          ...sampleOverview().show,
          cues: [
            { id: "top", label: "Top of scene", state: "normal" },
            { id: "hit", label: "First hit", note: "On the impact", state: "red-alert" },
          ],
        }),
      });

    it("runs the next cue with GO or the space bar, and marks where the show is", async () => {
      await open(withCues("top"));
      expect(screen.getByText("First hit", { selector: "#go-next *, #go-next" })).toBeInTheDocument();
      expect(screen.getByRole("listitem", { name: "Top of scene" })).toHaveAttribute("data-current", "true");
      expect(screen.getByRole("listitem", { name: "First hit" })).toHaveAttribute("data-next", "true");
      await userEvent.click(screen.getByRole("button", { name: "GO" }));
      fireEvent.keyDown(window, { code: "Space" });
      await userEvent.click(within(screen.getByRole("listitem", { name: "Top of scene" })).getByRole("button", { name: "Run" }));
      await userEvent.click(screen.getByRole("button", { name: "Back to top" }));
      expect(writes().map((call) => [call.method, call.path])).toEqual([
        ["POST", "/api/cues/go"],
        ["POST", "/api/cues/go"],
        ["POST", "/api/cues/top/run"],
        ["POST", "/api/cues/reset"],
      ]);
    });

    it("does not press GO while someone types", async () => {
      await open(withCues());
      fireEvent.keyDown(screen.getByRole("textbox", { name: "New cue name" }), { code: "Space" });
      expect(writes()).toEqual([]);
    });

    it("records what is on air as a new cue, and reorders and deletes cues", async () => {
      await open(withCues());
      await userEvent.type(screen.getByRole("textbox", { name: "New cue name" }), "Breach");
      await userEvent.click(screen.getByRole("button", { name: "Record what is on air" }));
      await userEvent.click(screen.getByRole("button", { name: "Move First hit up" }));
      await userEvent.click(screen.getByRole("button", { name: "Delete Top of scene" }));
      const saved = writes().map((call) => (call.body as { cues: Array<{ id: string }> }).cues.map((cue) => cue.id));
      expect(saved).toEqual([["top", "hit", "breach"], ["hit", "top"], ["hit"]]);
      expect(writes()[0]?.body).toMatchObject({ cues: [{}, {}, { id: "breach", label: "Breach", state: "normal", screens: { "eng-1": "engineering" } }] });
    });

    it("says when the running order is over", async () => {
      await open(withCues("hit"));
      expect(screen.getByRole("button", { name: "GO" })).toBeDisabled();
      expect(screen.getByText("End of the running order")).toBeInTheDocument();
    });
  });

  it("keeps AI off the air until the crew lets it on", async () => {
    await open();
    const publish = screen.getByRole("switch", { name: /AI may publish/ });
    const control = screen.getByRole("switch", { name: /AI may run the show/ });
    expect(publish).not.toBeChecked();
    expect(control).not.toBeChecked();
    await userEvent.click(publish);
    await userEvent.click(control);
    expect(writes().map((call) => [call.path, call.body])).toEqual([
      ["/api/show/settings", { aiPublish: true }],
      ["/api/show/settings", { aiLiveControl: true }],
    ]);
  });

  it("plays, pauses and restarts the videos on a display", async () => {
    await open(liveOverview);
    const video = within(screen.getByRole("listitem", { name: "Engineering 1" })).getByRole("group", { name: "Video feed" });
    for (const name of ["Play", "Pause", "Restart"]) await userEvent.click(within(video).getByRole("button", { name }));

    expect(writes().map((call) => call.body)).toEqual([
      { target: "feed", command: "play" },
      { target: "feed", command: "pause" },
      { target: "feed", command: "restart" },
    ]);
    expect(writes()[0]?.path).toBe("/api/displays/eng-1/video");
  });

  it("says when a display's own buttons moved it, and sends it back", async () => {
    await open(liveOverview);
    const card = screen.getByRole("listitem", { name: "Engineering 1" });
    expect(within(card).getByText("On Bridge")).toBeInTheDocument();

    await userEvent.click(within(card).getByRole("button", { name: "Send back" }));
    expect(writes()).toEqual([expect.objectContaining({ method: "PUT", path: "/api/displays/eng-1", body: { screen: "engineering" } })]);
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
