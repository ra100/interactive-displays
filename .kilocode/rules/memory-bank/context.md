# Context

## Current State
Project initialization phase - no code written yet. Memory bank being established.

## Project Stage
Greenfield project - starting from scratch with technology stack and architecture decisions finalized.

## Recent Activities
- 2025-01-18: Memory bank initialization
- Technology stack selected: React + TypeScript, Node.js + Express, Socket.io
- Architecture design completed
- Requirements gathered from user
- Design references identified: PNG files of Star Trek LCARS interfaces

## Design Resources Location
- PNG reference files of Star Trek LCARS designs (to be placed in `/design` folder)
- See [`design.md`](.kilocode/rules/memory-bank/design.md) for design system documentation

## Next Steps
1. Set up project structure (monorepo with client and server)
2. Initialize Docker configuration
3. Create basic React client application
4. Implement Node.js server with Socket.io
5. Build core UI components with LCARS styling
6. Implement video synchronization system
7. Add theme system for customizable aesthetics

## Key Decisions Made
- **Browser-only clients**: No native apps, pure web application
- **LAN deployment**: No internet connectivity required
- **Peer-to-peer control**: Any client can control the system
- **Pre-download strategy**: Large video files (up to 1GB) downloaded before playback
- **Docker deployment**: Server runs in container for easy deployment
- **Flexible theming**: LCARS as primary, but system must support other sci-fi aesthetics

## Known Constraints
- Videos up to 1GB size
- 4-5 simultaneous clients
- LAN-only network
- Touch screen support required
- Must support various sci-fi themes beyond Star Trek