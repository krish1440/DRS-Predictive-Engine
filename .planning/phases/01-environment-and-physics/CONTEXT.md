# Phase 1 Context: Environment and Physics

## Goal
A working 3D pitch environment with basic ballistics (Gravity + Drag).

## Requirements
- **3D Pitch Environment:** High-quality rendering of the cricket pitch, stumps, and crease.
- **Interactive Bowling Engine (Basic):** Controls for Speed and Pitching Point.
- **Trajectory Prediction (Basic):** Physics-based calculation of ball path from hand to pitch and pitch to stumps.

## Success Criteria
1. User can see a 3D cricket pitch with regulation stumps.
2. User can "bowl" a ball with a specified speed.
3. Ball follows a realistic parabolic path with drag.

## Out of Scope
- Spin and Magnus effect (Phase 2).
- Glow shaders and bloom (Phase 3).
- LBW detection logic (Phase 4).

## Tech Decisions
- Use **Three.js** for 3D rendering.
- Use **SI Units** (meters, seconds) for all physics calculations.
- Use **Custom Physics Solver** (Euler or Runge-Kutta) for trajectory calculation.
