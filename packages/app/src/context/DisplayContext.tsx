import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import type {
  GlobalState,
  Layout,
  ServerToClientEvents,
  ClientToServerEvents,
} from "@interactive-displays/shared";

const SERVER_URL =
  (import.meta.env["VITE_SERVER_URL"] as string | undefined) ||
  "http://localhost:3010";

interface DisplayContextValue {
  globalState: GlobalState;
  layout: Layout | null;
  isConnected: boolean;
  setGlobalState: (state: GlobalState) => void;
  saveLayout: (layout: Layout) => void;
  identify: (screenId: string) => void;
}

const DisplayContext = createContext<DisplayContextValue | null>(null);

export function useDisplay(): DisplayContextValue {
  const context = useContext(DisplayContext);
  if (!context) {
    throw new Error("useDisplay must be used within a DisplayProvider");
  }
  return context;
}

interface DisplayProviderProps {
  children: ReactNode;
}

export function DisplayProvider({ children }: DisplayProviderProps) {
  const socketRef = useRef<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [globalState, setGlobalStateLocal] = useState<GlobalState>("normal");
  const [layout, setLayout] = useState<Layout | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      SERVER_URL
    );

    newSocket.on("connect", () => {
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    newSocket.on("state", (state) => {
      setGlobalStateLocal(state);
    });

    newSocket.on("layout", (newLayout) => {
      setLayout(newLayout);
    });

    socketRef.current = newSocket;

    return () => {
      newSocket.close();
    };
  }, []);

  const setGlobalState = useCallback((state: GlobalState) => {
    socketRef.current?.emit("stateChange", state);
  }, []);

  const saveLayout = useCallback((layoutToSave: Layout) => {
    socketRef.current?.emit("saveLayout", layoutToSave);
  }, []);

  const identify = useCallback((screenId: string) => {
    socketRef.current?.emit("identify", screenId);
  }, []);

  const value = useMemo<DisplayContextValue>(
    () => ({
      globalState,
      layout,
      isConnected,
      setGlobalState,
      saveLayout,
      identify,
    }),
    [globalState, layout, isConnected, setGlobalState, saveLayout, identify]
  );

  return (
    <DisplayContext.Provider value={value}>{children}</DisplayContext.Provider>
  );
}
