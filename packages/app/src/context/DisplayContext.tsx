import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import type {
  GlobalState,
  Layout,
  ServerToClientEvents,
  ClientToServerEvents,
} from "../../../server/src/types.js";

const SERVER_URL =
  (import.meta.env["VITE_SERVER_URL"] as string | undefined) ||
  "http://localhost:3000";

interface DisplayContextValue {
  globalState: GlobalState;
  layout: Layout | null;
  connectedScreens: string[];
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
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [globalState, setGlobalStateLocal] = useState<GlobalState>("normal");
  const [layout, setLayout] = useState<Layout | null>(null);
  const [connectedScreens, setConnectedScreens] = useState<string[]>([]);

  // Initialize socket connection
  useEffect(() => {
    const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      SERVER_URL
    );

    newSocket.on("connect", () => {
      console.log("Connected to server");
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from server");
      setIsConnected(false);
    });

    newSocket.on("state", (state) => {
      console.log("State updated:", state);
      setGlobalStateLocal(state);
    });

    newSocket.on("layout", (newLayout) => {
      console.log("Layout received:", newLayout.name);
      setLayout(newLayout);
    });

    newSocket.on("connectedScreens", (screens) => {
      setConnectedScreens(screens);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const setGlobalState = useCallback(
    (state: GlobalState) => {
      socket?.emit("stateChange", state);
    },
    [socket]
  );

  const saveLayout = useCallback(
    (layoutToSave: Layout) => {
      socket?.emit("saveLayout", layoutToSave);
    },
    [socket]
  );

  const identify = useCallback(
    (screenId: string) => {
      socket?.emit("identify", screenId);
    },
    [socket]
  );

  const value: DisplayContextValue = {
    globalState,
    layout,
    connectedScreens,
    isConnected,
    setGlobalState,
    saveLayout,
    identify,
  };

  return (
    <DisplayContext.Provider value={value}>{children}</DisplayContext.Provider>
  );
}
