import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { BuilderProvider, useBuilder, generateElementId } from "./BuilderContext";
import type { LayoutElement } from "@interactive-displays/shared";

// Test component that exposes context for testing
const TestComponent = ({ onContext }: { onContext: (ctx: ReturnType<typeof useBuilder>) => void }) => {
  const ctx = useBuilder();
  onContext(ctx);
  return (
    <div>
      <span data-testid="element-count">{ctx.layout.elements.length}</span>
      <span data-testid="can-undo">{ctx.canUndo.toString()}</span>
      <span data-testid="can-redo">{ctx.canRedo.toString()}</span>
      <span data-testid="selected">{ctx.selectedElementId ?? "none"}</span>
    </div>
  );
};

describe("BuilderContext", () => {
  describe("generateElementId", () => {
    it("generates unique IDs with element type prefix", () => {
      const id1 = generateElementId("button");
      const id2 = generateElementId("button");
      expect(id1).toMatch(/^button-/);
      expect(id2).toMatch(/^button-/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("BuilderProvider", () => {
    it("initializes with empty layout", () => {
      let context: ReturnType<typeof useBuilder>;
      render(
        <BuilderProvider>
          <TestComponent onContext={(ctx) => (context = ctx)} />
        </BuilderProvider>
      );
      expect(screen.getByTestId("element-count")).toHaveTextContent("0");
      expect(context!.layout.name).toBe("New Layout");
    });

    it("initializes with provided layout", () => {
      const initialLayout = {
        id: "test",
        name: "Test Layout",
        elements: [
          { id: "el1", type: "button" as const, col: 0, row: 0, colSpan: 2, rowSpan: 1, color: "#ff0" },
        ],
      };
      render(
        <BuilderProvider initialLayout={initialLayout}>
          <TestComponent onContext={() => {}} />
        </BuilderProvider>
      );
      expect(screen.getByTestId("element-count")).toHaveTextContent("1");
    });
  });

  describe("addElement", () => {
    it("adds element and selects it", () => {
      let context: ReturnType<typeof useBuilder>;
      render(
        <BuilderProvider>
          <TestComponent onContext={(ctx) => (context = ctx)} />
        </BuilderProvider>
      );

      const newElement: LayoutElement = {
        id: "test-el",
        type: "button",
        col: 0,
        row: 0,
        colSpan: 2,
        rowSpan: 1,
        color: "#ff9900",
      };

      act(() => {
        context!.addElement(newElement);
      });

      expect(screen.getByTestId("element-count")).toHaveTextContent("1");
      expect(screen.getByTestId("selected")).toHaveTextContent("test-el");
    });

    it("enables undo after adding element", () => {
      let context: ReturnType<typeof useBuilder>;
      render(
        <BuilderProvider>
          <TestComponent onContext={(ctx) => (context = ctx)} />
        </BuilderProvider>
      );

      expect(screen.getByTestId("can-undo")).toHaveTextContent("false");

      act(() => {
        context!.addElement({
          id: "el1",
          type: "bar",
          col: 0,
          row: 0,
          colSpan: 4,
          rowSpan: 1,
          color: "#fff",
        });
      });

      expect(screen.getByTestId("can-undo")).toHaveTextContent("true");
    });
  });

  describe("undo/redo", () => {
    it("undoes element addition", () => {
      let context: ReturnType<typeof useBuilder>;
      render(
        <BuilderProvider>
          <TestComponent onContext={(ctx) => (context = ctx)} />
        </BuilderProvider>
      );

      act(() => {
        context!.addElement({
          id: "el1",
          type: "text",
          col: 0,
          row: 0,
          colSpan: 3,
          rowSpan: 1,
          color: "#fff",
        });
      });

      expect(screen.getByTestId("element-count")).toHaveTextContent("1");

      act(() => {
        context!.undo();
      });

      expect(screen.getByTestId("element-count")).toHaveTextContent("0");
      expect(screen.getByTestId("can-redo")).toHaveTextContent("true");
    });

    it("redoes undone action", () => {
      let context: ReturnType<typeof useBuilder>;
      render(
        <BuilderProvider>
          <TestComponent onContext={(ctx) => (context = ctx)} />
        </BuilderProvider>
      );

      act(() => {
        context!.addElement({
          id: "el1",
          type: "frame",
          col: 0,
          row: 0,
          colSpan: 2,
          rowSpan: 2,
          color: "#fff",
        });
      });

      act(() => {
        context!.undo();
      });

      act(() => {
        context!.redo();
      });

      expect(screen.getByTestId("element-count")).toHaveTextContent("1");
    });

    it("limits history to 10 items", () => {
      let context: ReturnType<typeof useBuilder>;
      render(
        <BuilderProvider>
          <TestComponent onContext={(ctx) => (context = ctx)} />
        </BuilderProvider>
      );

      // Add 12 elements
      for (let i = 0; i < 12; i++) {
        act(() => {
          context!.addElement({
            id: `el${i}`,
            type: "button",
            col: i,
            row: 0,
            colSpan: 1,
            rowSpan: 1,
            color: "#fff",
          });
        });
      }

      // Should have 12 elements
      expect(screen.getByTestId("element-count")).toHaveTextContent("12");

      // Undo 10 times (max history)
      for (let i = 0; i < 10; i++) {
        act(() => {
          context!.undo();
        });
      }

      // Should have 2 elements remaining (12 - 10)
      expect(screen.getByTestId("element-count")).toHaveTextContent("2");

      // 11th undo should do nothing
      act(() => {
        context!.undo();
      });
      expect(screen.getByTestId("element-count")).toHaveTextContent("2");
    });
  });

  describe("deleteElement", () => {
    it("removes element by id", () => {
      let context: ReturnType<typeof useBuilder>;
      const initialLayout = {
        id: "test",
        name: "Test",
        elements: [
          { id: "el1", type: "button" as const, col: 0, row: 0, colSpan: 2, rowSpan: 1, color: "#fff" },
          { id: "el2", type: "bar" as const, col: 2, row: 0, colSpan: 4, rowSpan: 1, color: "#fff" },
        ],
      };

      render(
        <BuilderProvider initialLayout={initialLayout}>
          <TestComponent onContext={(ctx) => (context = ctx)} />
        </BuilderProvider>
      );

      expect(screen.getByTestId("element-count")).toHaveTextContent("2");

      act(() => {
        context!.deleteElement("el1");
      });

      expect(screen.getByTestId("element-count")).toHaveTextContent("1");
      expect(context!.layout.elements[0]?.id).toBe("el2");
    });

    it("clears selection when selected element is deleted", () => {
      let context: ReturnType<typeof useBuilder>;
      const initialLayout = {
        id: "test",
        name: "Test",
        elements: [
          { id: "el1", type: "button" as const, col: 0, row: 0, colSpan: 2, rowSpan: 1, color: "#fff" },
        ],
      };

      render(
        <BuilderProvider initialLayout={initialLayout}>
          <TestComponent onContext={(ctx) => (context = ctx)} />
        </BuilderProvider>
      );

      act(() => {
        context!.selectElement("el1");
      });
      expect(screen.getByTestId("selected")).toHaveTextContent("el1");

      act(() => {
        context!.deleteElement("el1");
      });
      expect(screen.getByTestId("selected")).toHaveTextContent("none");
    });
  });

  describe("moveElement", () => {
    it("updates element position", () => {
      let context: ReturnType<typeof useBuilder>;
      const initialLayout = {
        id: "test",
        name: "Test",
        elements: [
          { id: "el1", type: "elbow" as const, col: 0, row: 0, colSpan: 2, rowSpan: 2, color: "#fff", direction: "TL" as const },
        ],
      };

      render(
        <BuilderProvider initialLayout={initialLayout}>
          <TestComponent onContext={(ctx) => (context = ctx)} />
        </BuilderProvider>
      );

      act(() => {
        context!.moveElement("el1", 5, 3);
      });

      expect(context!.layout.elements[0]?.col).toBe(5);
      expect(context!.layout.elements[0]?.row).toBe(3);
    });
  });
});
