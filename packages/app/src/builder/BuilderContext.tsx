import {
  createContext,
  useContext,
  useReducer,
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
  selectedElement: LayoutElement | null;
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

// State managed by reducer
interface BuilderState {
  layout: Layout;
  selectedElementId: string | null;
  // History contains past states (before current)
  past: Layout[];
  // Future contains states after current (for redo)
  future: Layout[];
}

type BuilderAction =
  | { type: "SELECT_ELEMENT"; id: string | null }
  | { type: "ADD_ELEMENT"; element: LayoutElement }
  | { type: "UPDATE_ELEMENT"; id: string; updates: Partial<LayoutElement> }
  | { type: "DELETE_ELEMENT"; id: string }
  | { type: "MOVE_ELEMENT"; id: string; col: number; row: number }
  | { type: "SET_LAYOUT"; layout: Layout }
  | { type: "UNDO" }
  | { type: "REDO" };

function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "SELECT_ELEMENT":
      return { ...state, selectedElementId: action.id };

    case "ADD_ELEMENT": {
      const newLayout = {
        ...state.layout,
        elements: [...state.layout.elements, action.element],
      };
      return {
        ...state,
        layout: newLayout,
        selectedElementId: action.element.id,
        past: [...state.past, state.layout].slice(-MAX_HISTORY),
        future: [], // Clear redo stack on new action
      };
    }

    case "UPDATE_ELEMENT": {
      const newLayout = {
        ...state.layout,
        elements: state.layout.elements.map((el) =>
          el.id === action.id ? { ...el, ...action.updates } : el
        ),
      };
      return {
        ...state,
        layout: newLayout,
        past: [...state.past, state.layout].slice(-MAX_HISTORY),
        future: [],
      };
    }

    case "DELETE_ELEMENT": {
      const newLayout = {
        ...state.layout,
        elements: state.layout.elements.filter((el) => el.id !== action.id),
      };
      return {
        ...state,
        layout: newLayout,
        selectedElementId: state.selectedElementId === action.id ? null : state.selectedElementId,
        past: [...state.past, state.layout].slice(-MAX_HISTORY),
        future: [],
      };
    }

    case "MOVE_ELEMENT": {
      const newLayout = {
        ...state.layout,
        elements: state.layout.elements.map((el) =>
          el.id === action.id ? { ...el, col: action.col, row: action.row } : el
        ),
      };
      return {
        ...state,
        layout: newLayout,
        past: [...state.past, state.layout].slice(-MAX_HISTORY),
        future: [],
      };
    }

    case "SET_LAYOUT":
      return {
        ...state,
        layout: action.layout,
        selectedElementId: null,
        past: [...state.past, state.layout].slice(-MAX_HISTORY),
        future: [],
      };

    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1]!;
      return {
        ...state,
        layout: previous,
        past: state.past.slice(0, -1),
        future: [state.layout, ...state.future].slice(0, MAX_HISTORY),
      };
    }

    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0]!;
      return {
        ...state,
        layout: next,
        past: [...state.past, state.layout].slice(-MAX_HISTORY),
        future: state.future.slice(1),
      };
    }

    default:
      return state;
  }
}

export function BuilderProvider({
  children,
  initialLayout,
}: BuilderProviderProps) {
  const [state, dispatch] = useReducer(builderReducer, {
    layout: initialLayout ?? DEFAULT_LAYOUT,
    selectedElementId: null,
    past: [],
    future: [],
  });

  const selectElement = useCallback((id: string | null) => {
    dispatch({ type: "SELECT_ELEMENT", id });
  }, []);

  const addElement = useCallback((element: LayoutElement) => {
    dispatch({ type: "ADD_ELEMENT", element });
  }, []);

  const updateElement = useCallback((id: string, updates: Partial<LayoutElement>) => {
    dispatch({ type: "UPDATE_ELEMENT", id, updates });
  }, []);

  const deleteElement = useCallback((id: string) => {
    dispatch({ type: "DELETE_ELEMENT", id });
  }, []);

  const moveElement = useCallback((id: string, col: number, row: number) => {
    dispatch({ type: "MOVE_ELEMENT", id, col, row });
  }, []);

  const setLayout = useCallback((layout: Layout) => {
    dispatch({ type: "SET_LAYOUT", layout });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "REDO" });
  }, []);

  // Compute selected element directly instead of returning a function
  const selectedElement = useMemo(() => {
    if (!state.selectedElementId) return null;
    return state.layout.elements.find((el) => el.id === state.selectedElementId) ?? null;
  }, [state.layout.elements, state.selectedElementId]);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const value = useMemo<BuilderContextValue>(
    () => ({
      layout: state.layout,
      selectedElementId: state.selectedElementId,
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
      selectedElement,
    }),
    [
      state.layout,
      state.selectedElementId,
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
      selectedElement,
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
