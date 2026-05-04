# Research: Architecture for DRS Simulation

## Component Boundaries

### 1. Simulation Engine (The Brain)
- **State Manager:** Holds the ball's current position, velocity, spin, and state (Released, Pitched, Impacted, Final).
- **Physics Solver:** Incremental solver ($dt$) that updates velocity based on air resistance and spin, then updates position.
- **Collision Detector:** Raycasting or geometric intersection tests against the Pitch (Y=0) and the Stumps/Batter.

### 2. Rendering Engine (The Beauty)
- **Scene Manager:** Sets up Three.js scene, lighting (Stadium floodlights style), and camera.
- **Trajectory Manager:** Takes an array of XYZ points from the Solver and generates the volumetric "glow" lines using `TubeGeometry` and custom shaders.
- **Asset Loader:** Loads 3D models for Stumps, Ball, and Pitch textures.

### 3. UI Overlay (The Broadcast)
- **Controller:** Maps user inputs (sliders/gestures) to physics parameters.
- **HUD:** Renders the "Pitching / Impact / Wickets" labels and the final "OUT/NOT OUT" graphics.

## Data Flow
1. **Input:** User sets (Speed, Spin, Target).
2. **Solver:** Generates a full path (Array of Vec3) from Release to Boundary/Stumps.
3. **Analyzer:** Scans the path for "Pitching Point" and "Impact Point" relative to stumps.
4. **Renderer:** Animates the ball along the path and draws the trajectory lines sequentially.
5. **UI:** Displays labels as the ball reaches each checkpoint.

## Suggested Build Order
1. **Base Scene:** Pitch, Stumps, Camera.
2. **Basic Physics:** Gravity + Bounce (No drag/spin yet).
3. **Advanced Physics:** Drag + Magnus Effect + Spin deviation.
4. **Trajectory Rendering:** Glow shaders and post-processing.
5. **Interactive UI:** Bowling controls and decision overlays.
