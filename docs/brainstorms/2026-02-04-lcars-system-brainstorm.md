# LCARS Interactive Display System - Brainstorm

**Date:** 2026-02-04
**Status:** Ready for planning

## What We're Building

A client-server system for creating and displaying interactive LCARS-style sci-fi interfaces for video production use. The system enables:

- **6-15 simultaneous browser-based displays** running on set
- **Real-time coordination** via triggered events (red alert, damage states, etc.)
- **Non-technical crew operation** with simple trigger buttons
- **Actor interaction** with touchscreen displays using hybrid scripted/freeform UX
- **Visual drag-drop builder** for designing screen layouts

## Why This Approach

### Architecture: WebSocket-Based Real-Time System

Selected over peer-to-peer and static export options because:

1. **Triggered events demand reliable sync** - WebSockets provide <50ms latency to all 6-15 screens
2. **Non-technical crew need simple controls** - Web-based admin panel accessible from any device
3. **Visual builder needs live preview** - Same WebSocket connection previews changes instantly
4. **Offline fallback achievable** - Service Workers can cache screen configs for network failures

### Tech Stack

- **Server:** Node.js/Bun with WebSocket (ws or Socket.io)
- **Clients:** React (same codebase as builder for component sharing)
- **Builder:** React with grid-based drag-drop, snapping, resizable elements
- **State:** Server holds all screen configs + current global state
- **Offline:** Service Worker caches screen configs

## Key Decisions

### Screen States
Global states affect all elements on a screen:
- Normal/Idle
- Red Alert
- Active/Engaged
- Damaged
- Custom states definable per production

### UI Builder Features
- Grid-based layout with snapping
- Element resizing (entire element or parts)
- Color scheme selection + randomization option
- Random text generation for "technobabble" displays
- Live preview via WebSocket to actual client

### Operator Control Panel
Simple large trigger buttons for state changes:
- Prioritizes ease of use over flexibility
- Non-technical crew can operate during takes
- Single-tap state transitions

### Actor Interaction Model
Hybrid approach:
- Some elements are scripted sequences (tap triggers expected animation)
- Some elements are "safe freeform" (tap anywhere in zone, appropriate response)
- Large touch targets for forgiving interaction

## Element Library

### Priority 1: Core LCARS Shapes
| Element | Description |
|---------|-------------|
| Elbow | Curved corner piece (TL, TR, BL, BR variants) |
| Bar/Pill | Horizontal/vertical bar with rounded ends |
| Frame | Rectangular border with optional cutouts |
| Bracket | L-shaped or T-shaped connectors |
| Divider | Separator lines |

### Priority 2: Data Displays
| Element | Description |
|---------|-------------|
| Text Block | Static or scrolling text, LCARS fonts |
| Number Display | Animated counting, timestamps |
| Bar Graph | Horizontal/vertical with animated values |
| Status Indicator | Blinking lights, status dots |
| Data Grid | Tables of scrolling values |

### Priority 3: Interactive Elements
| Element | Description |
|---------|-------------|
| Button | Touchable with press feedback |
| Slider | Value control |
| Toggle | On/off switch |
| Input Zone | Large touch areas for actors |

### Priority 4: Composite Elements
| Element | Description |
|---------|-------------|
| Schematic Display | Image with callout lines |
| Graph/Chart | Line graphs, circular displays |
| Alert Banner | Full-width state indicators |

## Data/Animation Capabilities

Elements support all modes:
- **Static:** Fixed values and appearance
- **Animated:** Looping animations (scrolling, pulsing, blinking)
- **Live feeds:** Real time/date, random-but-realistic sensor values
- **Scripted sequences:** Pre-programmed changes for specific scenes

## Resolved Questions

1. **Persistence:** JSON files - simple, version-controllable, human-readable
2. **Screen identification:** Auto-discovery - server assigns/prompts screen ID on connect based on IP or operator selection

## Open Questions

1. **Asset management:** How to handle custom images, ship schematics, logos?
2. **Multi-production:** Should the system support multiple "shows" with different element libraries?
3. **Audio:** Should state changes trigger sound effects? (Red alert klaxon, etc.)

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        SERVER                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Screen      │  │ Global      │  │ WebSocket           │  │
│  │ Configs     │  │ State       │  │ Connections         │  │
│  │ (JSON)      │  │ (Current)   │  │ (All Clients)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
           │                    │
           │   WebSocket        │
           ▼                    ▼
┌──────────────────┐    ┌──────────────────┐
│  BUILDER/ADMIN   │    │  DISPLAY CLIENT  │
│  ┌────────────┐  │    │  ┌────────────┐  │
│  │ Drag-Drop  │  │    │  │ React      │  │
│  │ Editor     │  │    │  │ Components │  │
│  ├────────────┤  │    │  ├────────────┤  │
│  │ Operator   │  │    │  │ Service    │  │
│  │ Panel      │  │    │  │ Worker     │  │
│  │ (Triggers) │  │    │  │ (Offline)  │  │
│  └────────────┘  │    │  └────────────┘  │
└──────────────────┘    └──────────────────┘
                              × 6-15
```

## Next Steps

Run `/workflows:plan` to create implementation plan covering:
1. Project scaffolding (monorepo structure)
2. WebSocket server implementation
3. Core element component library
4. Visual builder with grid editor
5. Operator control panel
6. Service Worker offline support
