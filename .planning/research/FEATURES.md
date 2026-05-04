# Research: Features for DRS Simulation

## Table Stakes (Must Have)
- **3D Pitch & Stumps:** Accurate spatial model (22 yards pitch, regulation stumps).
- **Smooth Ball Tracking:** High-FPS animation of the ball following a calculated path.
- **Trajectory Visualizer:** 
  - Solid line for actual path (to impact).
  - Dashed/Ghosted line for predicted path (post-impact).
- **Impact Analysis:** Automatic calculation of:
  - **Pitching:** In line, Outside Leg, Outside Off.
  - **Impact:** In line, Umpire's Call, Outside.
  - **Wickets:** Hitting, Umpire's Call, Missing.
- **Broadcast Overlays:** Clean, geometric labels for the "Three Checkpoints."

## Differentiators (Advanced)
- **Interactive Bowling Console:** Sliders or gestures to control:
  - **Speed:** 120km/h to 150km/h.
  - **Spin:** Off-spin, Leg-spin, Top-spin (RPM control).
  - **Line/Length:** Precision targeting on the pitch.
- **"The Mat":** Visual overlay on the pitch showing the pitching zone.
- **Slow-Motion Replay:** Ability to scrub through the delivery.
- **Multi-Angle Cameras:** Switch between "Broadcast," "Side-On," and "Top-Down."

## Anti-Features (Will NOT Build)
- **Full 11-man Teams:** We only need the Bowler (visualized or implied), Batter (Pad/Bat), and Umpire.
- **Crowd Simulation:** Unnecessary for a technical DRS simulation.
- **Career Mode:** Too broad for this scope.

## Dependencies
- Trajectory prediction depends on the physics engine tuning.
- Impact analysis depends on accurate collision detection between Ball and Pad/Stumps meshes.
