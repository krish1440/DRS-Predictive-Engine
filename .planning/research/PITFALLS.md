# Research: Pitfalls in DRS Simulation

## Common Mistakes

### 1. Incorrect Spatial Calibration
- **The Pitfall:** Making the pitch too short or the stumps too large. Even 5% error makes the physics feel "wrong."
- **Prevention:** Use absolute SI units (meters). Pitch length = 20.12m. Stumps height = 0.711m.

### 2. "Linear" Trajectories
- **The Pitfall:** Drawing a straight line for the ball path. Real cricket balls curve in the air (Swing/Spin).
- **Prevention:** Always solve the differential equations of motion; never use simple linear interpolation ($lerp$) for the whole path.

### 3. Lack of "Umpire's Call" Logic
- **The Pitfall:** Making the decision binary (Hit or Miss).
- **Prevention:** Implement the 50% rule. If the ball's center is not hitting the stumps but the edge is, or if the impact point is on the margin, mark as "Umpire's Call." This is essential for the "Real DRS" feel.

### 4. Poor Post-Bounce Physics
- **The Pitfall:** The ball bouncing like a rubber ball (no speed loss or spin-based deviation).
- **Prevention:** Apply friction ($\mu$) and coefficient of restitution ($e$) based on pitch type (Dry, Green, Dusty).

### 5. Performance Jitter
- **The Pitfall:** Calculating physics on every frame can lead to jitter if the CPU spikes.
- **Prevention:** Pre-calculate the entire trajectory on "Bowl" click, then animate the ball along the pre-baked path. This ensures 60FPS visuals even on weaker devices.
