# Research: Technical Stack for DRS Simulation

## Recommended Stack (2025)

### Core 3D Engine
- **Three.js:** The industry standard for high-performance web 3D.
- **Rationale:** Excellent support for custom shaders, post-processing (Bloom), and complex curve interpolation needed for trajectories.

### Physics Engine
- **Custom Physics Module (JS):** For DRS, a general-purpose physics engine (like Cannon.js) might be overkill or too "bouncy." A custom module solving ballistic equations is better for precision.
- **Key Equations:**
  - **Ballistics:** $\mathbf{F} = m\mathbf{g} - \frac{1}{2} C_d \rho A v^2 \mathbf{\hat{v}} + \mathbf{F}_M$ (Gravity + Drag + Magnus Force).
  - **Pitch Interaction:** Coefficient of Restitution (e) for bounce height and friction ($\mu$) for speed loss and spin deviation.

### Rendering & Shaders
- **GLSL Shaders:** For the "glowing" trajectory lines.
- **Three.js Post-Processing:** `UnrealBloomPass` is essential for the broadcast "glow" effect.
- **TubeGeometry / MeshLine:** To create the volumetric path lines rather than simple 1px lines.

### UI / Controls
- **React or Vanilla JS:** For the overlay UI (Scoreboard style).
- **Hammer.js (optional):** For smooth swipe/gesture controls for bowling.

## Confidence Levels
- **Three.js for Graphics:** 100% (Proven for high-end web visuals)
- **Custom Physics for Precision:** 90% (Requires careful tuning to match "real" cricket feel)
- **Shader-based Trajectories:** 95% (Standard practice in broadcast-style web apps)

## What NOT to use
- **Unity/Unreal:** Unless a full standalone game is needed. For a "simulation tool" or "web demo," they add too much overhead and friction for the user.
- **Simple CSS 3D:** Not performant or flexible enough for complex trajectories and lighting.
