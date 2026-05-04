export class BallisticsSolver {
  constructor() {
    this.gravity = 9.81;
    this.airDensity = 1.225;
    this.dragCoefficient = 0.5; // Typical for a cricket ball
    this.ballRadius = 0.036; // meters
    this.ballMass = 0.163; // kg
    this.crossSectionalArea = Math.PI * Math.pow(this.ballRadius, 2);
  }

  /**
   * Solves the trajectory from release to final destination.
   * @param {Object} initial - { position: Vector3, velocity: Vector3 }
   * @returns {Array} - Array of { position: Vector3, time: number }
   */
  solveTrajectory(initialPosition, initialVelocity, timeStep = 0.01, maxTime = 3.0) {
    const trajectory = [];
    let pos = initialPosition.clone();
    let vel = initialVelocity.clone();
    let time = 0;

    trajectory.push({ position: pos.clone(), time: time });

    while (time < maxTime) {
      // 1. Calculate Forces
      // Gravity
      const Fg = new THREE.Vector3(0, -this.gravity * this.ballMass, 0);

      // Drag: Fd = -0.5 * rho * v^2 * Cd * A * v_unit
      const speed = vel.length();
      const dragMagnitude = 0.5 * this.airDensity * Math.pow(speed, 2) * this.dragCoefficient * this.crossSectionalArea;
      const Fd = vel.clone().normalize().multiplyScalar(-dragMagnitude);

      // Total Force
      const Ftotal = Fg.clone().add(Fd);

      // 2. Integration (Euler)
      const accel = Ftotal.divideScalar(this.ballMass);
      
      vel.add(accel.clone().multiplyScalar(timeStep));
      pos.add(vel.clone().multiplyScalar(timeStep));
      
      time += timeStep;

      // 3. Collision with pitch (Y=0)
      if (pos.y <= 0 && vel.y < 0) {
        // Simple bounce
        pos.y = 0;
        vel.y = -vel.y * 0.7; // 70% energy retention vertically
        vel.z *= 0.95; // Some friction speed loss horizontally
        vel.x *= 0.95;
      }

      trajectory.push({ position: pos.clone(), time: time });

      // Stop if it goes too far past the stumps or underground (safety)
      if (pos.z > 20 || pos.y < -0.5) break;
    }

    return trajectory;
  }
}
