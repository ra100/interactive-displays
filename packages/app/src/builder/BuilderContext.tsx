import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { Layout, LayoutElement, ElementType } from "@interactive-displays/shared";

const MAX_HISTORY = 10;

interface BuilderContextValue {
  layout: Layout;
  selectedElementId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  selectElement: (id: string | null) => void;
  addElement: (element: LayoutElement) => void;
  updateElement: (id: string, updates: Partial<LayoutElement>) => void;
  deleteElement: (id: string) => void;
  moveElement: (id: string, col: number, row: number) => void;
  undo: () => void;
  redo: () => void;
  setLayout: (layout: Layout) => void;
  getSelectedElement: () => LayoutElement | null;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

export function useBuilder(): BuilderContextValue {
  const context = useContext(BuilderContext);
  if (!context) {
    throw new Error("useBuilder must be used within a BuilderProvider");
  }
  return context;
}

interface BuilderProviderProps {
  children: ReactNode;
  initialLayout?: Layout;
}

const DEFAULT_LAYOUT: Layout = {
  id: "new",
  name: "New Layout",
  elements: [],
};

export function BuilderProvider({
  children,
  initialLayout,
}: BuilderProviderProps) {
  const [layout, setLayoutState] = useState<Layout>(
    initialLayout ?? DEFAULT_LAYOUT
  );
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null
  );
  const [history, setHistory] = useState<Layout[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const pushHistory = useCallback((newLayout: Layout) => {
    setHistory((h) => {
      const newHistory = [...h.slice(0, historyIndex + 1), newLayout].slice(
        -MAX_HISTORY
      );
      return newHistory;
    });
    setHistoryIndex((i) => Math.min(i + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  const selectElement = useCallback((id: string | null) => {
    setSelectedElementId(id);
  }, []);

  const addElement = useCallback(
    (element: LayoutElement) => {
      const newLayout = {
        ...layout,
        elements: [...layout.elements, element],
      };
      pushHistory(layout);
      setLayoutState(newLayout);
      setSelectedElementId(element.id);
    },
    [layout, pushHistory]
  );

  const updateElement = useCallback(
    (id: string, updates: Partial<LayoutElement>) => {
      const newLayout = {
        ...layout,
        elements: layout.elements.map((el) =>
          el.id === id ? { ...el, ...updates } : el
        ),
      };
      pushHistory(layout);
      setLayoutState(newLayout);
    },
    [layout, pushHistory]
  );

  const deleteElement = useCallback(
    (id: string) => {
      const newLayout = {
        ...layout,
        elements: layout.elements.filter((el) => el.id !== id),
      };
      pushHistory(layout);
      setLayoutState(newLayout);
      if (selectedElementId === id) {
        setSelectedElementId(null);
      }
    },
    [layout, pushHistory, selectedElementId]
  );

  const moveElement = useCallback(
    (id: string, col: number, row: number) => {
      const newLayout = {
        ...layout,
        elements: layout.elements.map((el) =>
          el.id === id ? { ...el, col, row } : el
        ),
      };
      pushHistory(layout);
      setLayoutState(newLayout);
    },
    [layout, pushHistory]
  );

  const undo = useCallback(() => {
    if (historyIndex >= 0) {
      const previousLayout = history[historyIndex];
      if (previousLayout) {
        setLayoutState(previousLayout);
        setHistoryIndex((i) => i - 1);
      }
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextLayout = history[historyIndex + 1];
      if (nextLayout) {
        setLayoutState(nextLayout);
        setHistoryIndex((i) => i + 1);
      }
    }
  }, [history, historyIndex]);

  const setLayout = useCallback(
    (newLayout: Layout) => {
      pushHistory(layout);
      setLayoutState(newLayout);
      setSelectedElementId(null);
    },
    [layout, pushHistory]
  );

  const getSelectedElement = useCallback((): LayoutElement | null => {
    if (!selectedElementId) return null;
    return layout.elements.find((el) => el.id === selectedElementId) ?? null;
  }, [layout.elements, selectedElementId]);

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  const value = useMemo<BuilderContextValue>(
    () => ({
      layout,
      selectedElementId,
      canUndo,
      canRedo,
      selectElement,
      addElement,
      updateElement,
      deleteElement,
      moveElement,
      undo,
      redo,
      setLayout,
      getSelectedElement,
    }),
    [
      layout,
      selectedElementId,
      canUndo,
      canRedo,
      selectElement,
      addElement,
      updateElement,
      deleteElement,
      moveElement,
      undo,
      redo,
      setLayout,
      getSelectedElement,
    ]
  );

  return (
    <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>
  );
}

// Helper to generate unique element IDs
export function generateElementId(type: ElementType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
