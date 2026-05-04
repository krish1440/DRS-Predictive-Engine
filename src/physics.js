import * as THREE from 'three';

export class BallisticsSolver {
  constructor() {
    this.gravity = 9.81;
    this.airDensity = 1.225;
    this.dragCoefficient = 0.45;
    this.ballRadius = 0.036;
    this.ballMass = 0.163;
    this.crossSectionalArea = Math.PI * Math.pow(this.ballRadius, 2);
    
    // Stump dimensions for LBW
    this.stumpHeight = 0.711;
    this.stumpWidth = 0.228; // Total width of 3 stumps + gaps
  }

  solveTrajectory(initialPos, initialVel, swing = 0, turn = 0, timeStep = 0.005, maxTime = 4.0) {
    const trajectory = [];
    let pos = initialPos.clone();
    let vel = initialVel.clone();
    let time = 0;
    let hasBounced = false;

    trajectory.push({ position: pos.clone(), time: time, hasBounced: false });

    while (time < maxTime) {
      const Fg = new THREE.Vector3(0, -this.gravity * this.ballMass, 0);
      const speed = vel.length();
      const dragMagnitude = 0.5 * this.airDensity * Math.pow(speed, 2) * this.dragCoefficient * this.crossSectionalArea;
      const Fd = vel.clone().normalize().multiplyScalar(-dragMagnitude);
      const swingMagnitude = 0.5 * this.airDensity * Math.pow(speed, 2) * (swing * 0.15) * this.crossSectionalArea;
      const Fswing = new THREE.Vector3(swingMagnitude, 0, 0);

      const Ftotal = Fg.clone().add(Fd).add(Fswing);
      const accel = Ftotal.divideScalar(this.ballMass);
      
      vel.add(accel.clone().multiplyScalar(timeStep));
      pos.add(vel.clone().multiplyScalar(timeStep));
      time += timeStep;

      // Bounce Detection
      if (pos.y <= 0 && vel.y < 0) {
        const ratio = Math.abs(pos.y / (vel.y * timeStep));
        pos.sub(vel.clone().multiplyScalar(ratio * timeStep));
        pos.y = 0;
        vel.y = -vel.y * 0.65;
        vel.x += turn * 1.8; 
        vel.z *= 0.94;
        vel.x *= 0.94;
        hasBounced = true;
        trajectory.push({ position: pos.clone(), time: time, hasBounced: true });
      } else {
        trajectory.push({ position: pos.clone(), time: time, hasBounced: false });
      }

      if (pos.z > 12 || pos.y < -1 || speed < 1) break;
    }

    return trajectory;
  }

  findVelocityToHitTarget(startPos, targetPos, speedMs, swing) {
    let dir = targetPos.clone().sub(startPos).normalize();
    let bestVel = dir.clone().multiplyScalar(speedMs);
    for (let i = 0; i < 15; i++) {
      const traj = this.solveTrajectory(startPos, bestVel, swing, 0, 0.005);
      const bouncePoint = traj.find(p => p.hasBounced) || traj[traj.length - 1];
      const error = targetPos.clone().sub(bouncePoint.position);
      if (error.length() < 0.005) break;
      const adj = Math.min(0.5, error.length());
      dir.x += error.x * 0.2 * adj;
      dir.y += error.y * 0.8 * adj;
      dir.z += error.z * 0.1 * adj;
      dir.normalize();
      bestVel = dir.clone().multiplyScalar(speedMs);
    }
    return bestVel;
  }

  /**
   * Evaluates LBW based on trajectory
   * @returns {Object} - { pitching, impact, wickets, isOut }
   */
  calculateLBW(trajectory) {
    const ballRadius = 0.0355; // Exact ICC Standard
    const stumpWidth = 0.228; // 9 Inches
    const halfStumpWidth = stumpWidth / 2;
    const stumpHeight = 0.711; // 28 Inches
    
    const pitch = trajectory.find(p => p.hasBounced);
    const impact = trajectory.find(p => p.position.z >= 8.4);
    const wicketHit = trajectory.find(p => p.position.z >= 10.06);

    if (!pitch && !impact) return null;

    // 1. PITCHING
    let pitching = 'OUTSIDE OFF';
    if (pitch) {
      const x = pitch.position.x;
      if (Math.abs(x) <= halfStumpWidth) pitching = 'IN LINE';
      else if (x < -halfStumpWidth) pitching = 'OUTSIDE LEG';
      else pitching = 'OUTSIDE OFF';
    }

    // 2. IMPACT
    let impactResult = 'OUTSIDE';
    if (impact) {
      const dist = Math.abs(impact.position.x);
      if (dist <= halfStumpWidth) impactResult = 'IN LINE';
      else if (dist <= halfStumpWidth + ballRadius) impactResult = "UMPIRE'S CALL";
      else impactResult = 'OUTSIDE';
    }

    // 3. WICKETS
    let wicketsResult = 'MISSING';
    if (wicketHit) {
      const hitX = Math.abs(wicketHit.position.x);
      const hitY = wicketHit.position.y;
      
      const inX = hitX <= halfStumpWidth + ballRadius;
      const inY = hitY <= stumpHeight + ballRadius && hitY >= 0;
      
      if (inX && inY) {
        if (hitX <= halfStumpWidth && hitY <= stumpHeight) wicketsResult = 'HITTING';
        else wicketsResult = "UMPIRE'S CALL";
      }
    }

    // Official Out/Not Out Result Logic
    const isOut = pitching !== 'OUTSIDE LEG' && impactResult === 'IN LINE' && wicketsResult === 'HITTING';
    
    return {
      pitching,
      impact: impactResult,
      wickets: wicketsResult,
      isOut
    };
  }
}
