# Requirements: DRS Simulation

## 1. Functional Requirements

### 1.1 Bowling Interface
- **Parameter Controls:** Sliders or input fields for:
  - Release Speed (80 - 160 km/h).
  - Spin RPM (0 - 3000).
  - Spin Axis (Off-spin, Leg-spin, Top-spin).
  - Pitching Target (Line and Length grid on the pitch).
- **Action Trigger:** A "Bowl" button to initiate the simulation.

### 1.2 Simulation Engine
- **Physics Solver:** Must handle Gravity, Drag, and Magnus Effect.
- **Bounce Model:** Realistic friction and restitution for pitch interaction.
- **Path Prediction:** Calculate the ball's path beyond impact with the batter's pad.

### 1.3 Analysis & Decisions
- **LBW Logic:** Implement ICC rules for Pitching (In Line, Outside Leg, etc.) and Impact.
- **Wicket Detection:** Accurate intersection with stumps (including bails).
- **Umpire's Call:** 50% margin-of-error logic for Impact and Wickets.

### 1.4 Visuals & UI
- **Trajectory Rendering:** Glow-shaded 3D lines with "growth" animation.
- **Broadcast HUD:** Scoreboard-style overlays for checkpoints (Pitching, Impact, Wickets).
- **Replay System:** Automated camera cuts (Release -> Pitch -> Stumps).

## 2. Technical Requirements

### 2.1 Graphics
- **Framework:** Three.js.
- **Post-Processing:** Bloom/Glow effects for that broadcast feel.
- **Assets:** Low-poly but high-texture-quality models for ball and stumps.

### 2.2 Performance
- **Target:** 60 FPS on modern browsers.
- **Optimization:** Pre-calculate physics paths to prevent frame drops during animation.

## 3. User Experience (UX)
- **Visual WOW:** The simulation should feel like watching a live TV review.
- **Clarity:** Decisions should be unambiguous (Big "OUT" or "NOT OUT" banners).
- **Responsiveness:** Immediate feedback when adjusting bowling parameters.
