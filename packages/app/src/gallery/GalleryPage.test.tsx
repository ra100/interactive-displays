import { ARCHETYPE_IDS, catalog, SLOTS } from "@interactive-displays/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { GalleryPage } from "./GalleryPage.tsx";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <GalleryPage />
    </MemoryRouter>,
  );

describe("gallery", () => {
  it("shows every frame, every widget in every slot, and the theme's decor", () => {
    const { container } = renderAt("/gallery");

    expect(container.querySelectorAll(".frame")).toHaveLength(ARCHETYPE_IDS.length);
    expect(container.querySelectorAll(".gallery__row")).toHaveLength(catalog.size);
    expect(container.querySelectorAll(".gallery__strip .gallery__tile")).toHaveLength(catalog.size * SLOTS.length);
    expect(container.querySelectorAll(".decor-slot")).toHaveLength(4);
    expect(container.querySelector(".widget-fallback")).toBeNull();
  });

  it("reads theme, variant and effect from the URL", () => {
    const { container } = renderAt("/gallery?theme=lcars&variant=picard&effect=alert");

    const root = container.querySelector(".screen");
    expect(root).toHaveAttribute("data-theme", "lcars");
    expect(root).toHaveAttribute("data-variant", "picard");
    expect(root).toHaveAttribute("data-effect", "alert");
  });

  it("switches theme from the picker", () => {
    const { container } = renderAt("/gallery");

    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "base" } });

    expect(container.querySelector(".screen")).toHaveAttribute("data-theme", "base");
    expect(screen.getByText("Base has no decor.")).toBeInTheDocument();
  });
});
