# LCARS Interactive Display API

WebSocket-based API for controlling interactive displays in video production environments.

## Connection

Connect to the server via Socket.io:

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3010");
```

## Client → Server Events

### identify

Register a display client with the server.

```typescript
socket.emit("identify", screenId: string);
```

**Parameters:**
- `screenId`: Alphanumeric identifier with hyphens, underscores, and spaces (max 100 chars)

**Example:**
```javascript
socket.emit("identify", "display-main");
```

---

### stateChange

Change the global display state across all connected clients.

```typescript
socket.emit("stateChange", state: GlobalState);
```

**Parameters:**
- `state`: One of `"normal"`, `"alert"`, `"active"`, `"damaged"`

**Example:**
```javascript
socket.emit("stateChange", "alert");
```

---

### getLayout

Request a specific layout by ID.

```typescript
socket.emit("getLayout", layoutId: string);
```

**Parameters:**
- `layoutId`: Alphanumeric with hyphens/underscores only (max 100 chars)

**Example:**
```javascript
socket.emit("getLayout", "default");
```

---

### saveLayout

Save a layout to the server and broadcast to all clients.

```typescript
socket.emit("saveLayout", layout: Layout);
```

**Parameters:**
- `layout`: Layout object with id, name, and elements array

**Example:**
```javascript
socket.emit("saveLayout", {
  id: "my-layout",
  name: "My Custom Layout",
  elements: [
    { id: "elbow-1", type: "elbow", col: 0, row: 0, colSpan: 2, rowSpan: 2, color: "#ff9900", direction: "TL" }
  ]
});
```

---

### videoCommand

Control video playback on display clients.

```typescript
socket.emit("videoCommand", command: VideoCommand);
```

**Parameters:**
- `elementId`: Target video element ID (alphanumeric with hyphens/underscores)
- `command`: One of `"play"`, `"pause"`, `"seek"`, `"load"`
- `time`: (optional) Seek position in seconds (for `seek` command)
- `src`: (optional) Video URL (for `load` command, must use http/https/blob protocol)

**Examples:**
```javascript
// Play video
socket.emit("videoCommand", { elementId: "video-1", command: "play" });

// Pause video
socket.emit("videoCommand", { elementId: "video-1", command: "pause" });

// Seek to 30 seconds
socket.emit("videoCommand", { elementId: "video-1", command: "seek", time: 30 });

// Load new video source
socket.emit("videoCommand", { elementId: "video-1", command: "load", src: "https://example.com/video.mp4" });
```

---

### videoState

Report video playback state from display client (sent automatically by VideoElement).

```typescript
socket.emit("videoState", state: VideoStateUpdate);
```

**Parameters:**
- `elementId`: Video element ID
- `state`: One of `"playing"`, `"paused"`, `"ended"`
- `currentTime`: Current playback position in seconds

---

## Server → Client Events

### state

Broadcast global state change to all clients.

```typescript
socket.on("state", (state: GlobalState) => { ... });
```

---

### layout

Broadcast layout to clients (on connect, save, or getLayout).

```typescript
socket.on("layout", (layout: Layout) => { ... });
```

---

### videoCommand

Broadcast video command to all display clients.

```typescript
socket.on("videoCommand", (command: VideoCommand) => { ... });
```

---

### error

Error response with code and message.

```typescript
socket.on("error", (code: string, message: string) => { ... });
```

**Error Codes:**
- `INVALID_SCREEN_ID` - Screen ID validation failed
- `INVALID_STATE` - State value not recognized
- `INVALID_LAYOUT_ID` - Layout ID validation failed
- `INVALID_LAYOUT` - Layout object validation failed
- `INVALID_VIDEO_COMMAND` - Video command validation failed
- `LAYOUT_NOT_FOUND` - Requested layout does not exist
- `GET_LAYOUT_FAILED` - Server error fetching layout
- `SAVE_LAYOUT_FAILED` - Server error saving layout

---

## TypeScript Types

Types are available from `@interactive-displays/shared`:

```typescript
import type {
  GlobalState,
  Layout,
  LayoutElement,
  VideoCommand,
  VideoStateUpdate,
  ServerToClientEvents,
  ClientToServerEvents,
} from "@interactive-displays/shared";
```

---

## REST Endpoints

### GET /health

Health check endpoint.

```bash
curl http://localhost:3010/health
```

**Response:**
```json
{
  "status": "ok",
  "connectedScreens": 3
}
```
