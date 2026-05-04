# Roadmap: DRS Simulation

## Overview
Building a high-fidelity, broadcast-quality Decision Review System (DRS) simulation for cricket.

## Phases

- [x] **Phase 1: Environment and Physics** - Set up the 3D pitch and core ballistics engine.
- [ ] **Phase 2: Advanced Ballistics** - Implement spin (Magnus Effect) and refined pitch interaction.

## Phase Details

### Phase 1: Environment and Physics
**Goal**: A working 3D pitch environment with basic ballistics (Gravity + Drag).
**Depends on**: Nothing
**Requirements**: REQ-01, REQ-02, REQ-03
**Success Criteria**:
  1. User can see a 3D cricket pitch with regulation stumps.
  2. User can "bowl" a ball with a specified speed.
  3. Ball follows a realistic parabolic path with drag.
**Plans**: 3 plans

Plans:
- [ ] 01-01: Initialize Three.js scene and load pitch/stumps assets.
- [ ] 01-02: Implement core physics solver with Gravity and Drag.
- [ ] 01-03: Add basic UI controls for Speed and Line/Length.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1 | 3/3 | Complete | 2026-05-04 |
| 2 | 0/0 | Not started | - |
