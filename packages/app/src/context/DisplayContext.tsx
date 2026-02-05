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
  VideoCommand,
  VideoStateUpdate,
} from "@interactive-displays/shared";

const SERVER_URL =
  (import.meta.env["VITE_SERVER_URL"] as string | undefined) ||
  "http://localhost:3010";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface DisplayContextValue {
  globalState: GlobalState;
  layout: Layout | null;
  isConnected: boolean;
  setGlobalState: (state: GlobalState) => void;
  saveLayout: (layout: Layout) => void;
  identify: (screenId: string) => void;
  sendVideoCommand: (command: VideoCommand) => void;
  sendVideoState: (state: VideoStateUpdate) => void;
  subscribeToVideoCommands: (handler: (command: VideoCommand) => void) => () => void;
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

  const sendVideoCommand = useCallback((command: VideoCommand) => {
    socketRef.current?.emit("videoCommand", command);
  }, []);

  const sendVideoState = useCallback((state: VideoStateUpdate) => {
    socketRef.current?.emit("videoState", state);
  }, []);

  const subscribeToVideoCommands = useCallback(
    (handler: (command: VideoCommand) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      socket.on("videoCommand", handler);
      return () => {
        socket.off("videoCommand", handler);
      };
    },
    []
  );

  const value = useMemo<DisplayContextValue>(
    () => ({
      globalState,
      layout,
      isConnected,
      setGlobalState,
      saveLayout,
      identify,
      sendVideoCommand,
      sendVideoState,
      subscribeToVideoCommands,
    }),
    [globalState, layout, isConnected, setGlobalState, saveLayout, identify, sendVideoCommand, sendVideoState, subscribeToVideoCommands]
  );

  return (
    <DisplayContext.Provider value={value}>{children}</DisplayContext.Provider>
  );
}
