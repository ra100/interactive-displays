import { act } from "@testing-library/react";

type Handler = (payload?: unknown) => void;

// A stand-in for socket.io-client in tests: records what the page emits and lets the test play the server.
// Use with: vi.mock("socket.io-client", async () => ({ io: (await import("../testing/fakeSocket.ts")).fakeIo }));
const handlers = new Map<string, Handler[]>();
const emitted: Array<{ event: string; payload: unknown }> = [];

const socket = {
  on: (event: string, handler: Handler) => {
    handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    return socket;
  },
  off: () => socket,
  emit: (event: string, payload?: unknown) => {
    emitted.push({ event, payload });
    return socket;
  },
  connect: () => socket,
  disconnect: () => socket,
};

export const fakeIo = () => socket;

export const fakeServer = {
  emitted,
  reset: () => {
    handlers.clear();
    emitted.length = 0;
  },
  // Delivers an event to every handler the page registered, as the server would.
  send: (event: string, payload?: unknown) => {
    act(() => {
      for (const handler of handlers.get(event) ?? []) handler(payload);
    });
  },
};
