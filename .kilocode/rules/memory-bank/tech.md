# Technology Stack

## Frontend

### Core

- **React 19+** with **TypeScript 5.x**
- **Vite** - Build tool and dev server
- **Socket.io Client** - Real-time communication
- **IndexedDB** (idb wrapper) - Local video storage (up to 1GB files)

### Styling

- **CSS Modules** or **Styled Components** (TBD)
- **CSS Variables** for dynamic theming
- **SVG** for icons and graphics

### State Management

- **React Context API** + Custom Hooks
- Alternative: Zustand if needed

## Backend

### Core

- **Node.js 24 LTS**
- **fastify** - Web framework
- **Socket.io 4.x** - Real-time communication
- **TypeScript 5.x**

### File System

- Node.js native `fs/promises` for video file management

## Development Tools

- **pnpm** - Package manager (monorepo workspace support)
- **ESLint** + **Prettier** - Code quality
- **Docker** + **Docker Compose** - Containerization

## Browser Requirements

- Modern browsers only (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- IndexedDB support required
- WebSocket support required
- Touch Events API support required

## Network & Deployment

- **LAN-only deployment** (no internet required)
- **Port 3000** for server
- **Docker container** for server deployment
- 100 Mbps+ LAN recommended

## Performance Targets

- Video download should not block UI
- Synchronization latency < 100ms
- UI animations at 60fps
- Touch response < 50ms
