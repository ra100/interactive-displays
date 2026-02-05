import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoElement } from "./VideoElement";

// Mock the DisplayContext
vi.mock("../context/DisplayContext", () => ({
  useDisplay: () => ({
    subscribeToVideoCommands: () => () => {}, // Returns unsubscribe function
    sendVideoState: () => {},
  }),
}));

describe("VideoElement", () => {
  const defaultProps = {
    id: "video-1",
    src: "https://example.com/video.mp4",
    col: 0,
    row: 0,
    colSpan: 4,
    rowSpan: 3,
    color: "#333333",
    globalState: "normal" as const,
  };

  it("renders with lcars-video class", () => {
    render(<VideoElement {...defaultProps} />);
    const video = document.querySelector(".lcars-video");
    expect(video).toBeInTheDocument();
  });

  it("shows placeholder when no src", () => {
    render(<VideoElement {...defaultProps} src="" />);
    expect(screen.getByText("NO VIDEO")).toBeInTheDocument();
  });

  it("renders video element when src is provided", () => {
    render(<VideoElement {...defaultProps} />);
    const videoEl = document.querySelector("video");
    expect(videoEl).toBeInTheDocument();
    expect(videoEl).toHaveAttribute("src", "https://example.com/video.mp4");
  });

  it("applies grid positioning", () => {
    render(<VideoElement {...defaultProps} col={1} row={2} colSpan={3} rowSpan={4} />);
    const container = document.querySelector(".lcars-video");
    expect(container).toHaveStyle({
      gridColumn: "2 / span 3",
      gridRow: "3 / span 4",
    });
  });

  it("applies state class for alert state", () => {
    render(<VideoElement {...defaultProps} globalState="alert" />);
    const container = document.querySelector(".lcars-video");
    expect(container).toHaveClass("state--alert");
  });

  it("sets muted property by default", () => {
    render(<VideoElement {...defaultProps} />);
    const videoEl = document.querySelector("video") as HTMLVideoElement;
    // muted is a property, not necessarily an attribute in jsdom
    expect(videoEl.muted).toBe(true);
  });

  it("sets loop property when loop prop is true", () => {
    render(<VideoElement {...defaultProps} loop />);
    const videoEl = document.querySelector("video") as HTMLVideoElement;
    expect(videoEl.loop).toBe(true);
  });

  it("sets playsInline attribute for mobile compatibility", () => {
    render(<VideoElement {...defaultProps} />);
    const videoEl = document.querySelector("video");
    expect(videoEl).toHaveAttribute("playsinline");
  });

  it("applies object-fit style based on fit prop", () => {
    render(<VideoElement {...defaultProps} fit="cover" />);
    const videoEl = document.querySelector("video");
    expect(videoEl).toHaveStyle({ objectFit: "cover" });
  });

  it("renders with empty class when no src", () => {
    render(<VideoElement {...defaultProps} src="" />);
    const container = document.querySelector(".lcars-video--empty");
    expect(container).toBeInTheDocument();
  });
});
