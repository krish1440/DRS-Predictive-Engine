import * as THREE from 'three';

export class BallisticsSolver {
  constructor() {
    this.gravity = 9.81;
    this.airDensity = 1.225;
    this.dragCoefficient = 0.35; // Reduced from 0.45 for more realistic high-speed carry
    this.ballRadius = 0.036;
    this.ballMass = 0.163;
    this.crossSectionalArea = Math.PI * Math.pow(this.ballRadius, 2);
    
    // Stump dimensions for LBW
    this.stumpHeight = 0.711;
    this.stumpWidth = 0.228; // Total width of 3 stumps + gaps
  }

  solveTrajectory(initialPos, initialVel, swing = 0, turn = 0, ballType = 'fast', timeStep = 0.005, maxTime = 4.0) {
    const trajectory = [];
    let pos = initialPos.clone();
    let vel = initialVel.clone();
    let time = 0;
    let hasBounced = false;

    trajectory.push({ position: pos.clone(), time: time, hasBounced: false });

    while (time < maxTime) {
      const Fg = new THREE.Vector3(0, -this.gravity * this.ballMass, 0);
      const speed = vel.length(); // speed in m/s
      
      // Dynamic Drag (Slower balls have much higher air resistance)
      let currentDragCoeff = this.dragCoefficient;
      if (ballType === 'slower') currentDragCoeff *= 2.2;
      if (ballType === 'knuckle') currentDragCoeff *= 1.4;

      const dragMagnitude = 0.5 * this.airDensity * Math.pow(speed, 2) * currentDragCoeff * this.crossSectionalArea;
      const Fd = vel.clone().normalize().multiplyScalar(-dragMagnitude);
      
      // Advanced Swing Model
      const forwardDir = vel.clone().normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const lateralDir = new THREE.Vector3().crossVectors(forwardDir, up).normalize();
      
      let totalSwingIntensity = 0;
      if (ballType === 'swing' || ballType === 'slower') {
        const conventionalFactor = Math.exp(-Math.pow(speed - 32, 2) / 120);
        totalSwingIntensity = (swing * 0.28) * conventionalFactor;
      } else if (ballType === 'fast' || ballType === 'bouncer') {
        const conv = Math.exp(-Math.pow(speed - 34, 2) / 60) * 0.2;
        const rev = speed > 38 ? Math.exp(-Math.pow(speed - 44, 2) / 50) : 0;
        totalSwingIntensity = (swing * 0.15) * (conv + rev * 2.0);
      }
      
      const swingMagnitude = 0.5 * this.airDensity * Math.pow(speed, 2) * totalSwingIntensity * this.crossSectionalArea;
      const swingMultiplier = hasBounced ? 0.05 : 1.0;
      const Fswing = lateralDir.multiplyScalar(swingMagnitude * swingMultiplier);

      // Magnus & Specialized Forces
      let Fextra = new THREE.Vector3(0, 0, 0);
      if (ballType === 'topspin' || ballType === 'slower') {
        // Slower balls "Dip" more in the air due to rotation/drag (Magnus effect)
        const dipFactor = ballType === 'topspin' ? 0.15 : 0.08;
        const dipForce = 0.5 * this.airDensity * Math.pow(speed, 2) * dipFactor * this.crossSectionalArea;
        Fextra.set(0, -dipForce, 0);
      }
      
      // Knuckle ball "Wobble" - Sinusoidal oscillation
      if (ballType === 'knuckle' && !hasBounced) {
        const wobble = Math.sin(time * 15) * 0.05;
        Fextra.add(lateralDir.clone().multiplyScalar(wobble));
      }

      const Ftotal = Fg.clone().add(Fd).add(Fswing).add(Fextra);
      const accel = Ftotal.divideScalar(this.ballMass);
      
      vel.add(accel.clone().multiplyScalar(timeStep));
      pos.add(vel.clone().multiplyScalar(timeStep));
      time += timeStep;

      // Bounce Detection
      if (pos.y <= 0 && vel.y < 0) {
        const ratio = Math.abs(pos.y / (vel.y * timeStep));
        pos.sub(vel.clone().multiplyScalar(ratio * timeStep));
        pos.y = 0;
        
        // Specialized Bounce Heights
        let restitution = 0.68;
        if (ballType === 'fast') restitution = 0.82; 
        if (ballType === 'topspin') restitution = 0.88; 
        if (ballType === 'off-spin') restitution = 0.62; 
        if (ballType === 'bouncer') restitution = 0.94; // Extreme height
        if (ballType === 'cutter') restitution = 0.78; 
        
        vel.y = -vel.y * restitution;
        
        // Turn Logic (Minor reduction for fine-tuned precision)
        let turnIntensity = ballType.includes('spin') ? 1.5 : 0.6;
        if (ballType === 'cutter' || ballType === 'slower') turnIntensity = 1.2; 
        vel.x -= turn * turnIntensity; // Flipped to match Positive = Right (Bowler's View)
        
        // Top-spin gains forward speed after bounce
        if (ballType === 'topspin') vel.z *= 1.02;
        else if (ballType === 'slower') vel.z *= 0.82; // Slower ball "Stops" on the pitch (High friction)
        else vel.z *= 0.95;

        vel.x *= 0.95;
        hasBounced = true;
        trajectory.push({ position: pos.clone(), time: time, hasBounced: true });
      } else {
        trajectory.push({ position: pos.clone(), time: time, hasBounced: false });
      }

      if (pos.z > 12 || pos.y < -1 || speed < 1) break;
    }

    return trajectory;
  }

  findVelocityToHitTarget(startPos, targetPos, speedMs, swing, ballType = 'fast') {
    let horizontalDir = new THREE.Vector2(targetPos.x - startPos.x, targetPos.z - startPos.z).normalize();
    let dist = new THREE.Vector2(targetPos.x - startPos.x, targetPos.z - startPos.z).length();
    
    // Initial guess for vertical angle based on projectile motion (simple)
    // h = v0*t*sin(a) - 0.5*g*t^2 -> approx a
    let angle = -0.1; // Default slightly downward
    if (speedMs < 30) angle = 0.15; // Loop for spinners
    if (speedMs < 20) angle = 0.3; // High loop for very slow balls
    
    let yaw = Math.atan2(targetPos.x - startPos.x, targetPos.z - startPos.z);
    
    for (let i = 0; i < 40; i++) {
      let vel = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(angle) * speedMs,
        Math.sin(angle) * speedMs,
        Math.cos(yaw) * Math.cos(angle) * speedMs
      );
      
      const traj = this.solveTrajectory(startPos, vel, swing, 0, ballType, 0.005);
      const bouncePoint = traj.find(p => p.hasBounced) || traj[traj.length - 1];
      
      const distError = dist - new THREE.Vector2(bouncePoint.position.x - startPos.x, bouncePoint.position.z - startPos.z).length();
      const latError = targetPos.x - bouncePoint.position.x;
      
      if (Math.abs(distError) < 0.001 && Math.abs(latError) < 0.001) break;
      
      // Adjust vertical angle for distance (more angle = more distance up to 45 deg)
      // Since we are usually bowling downward, increasing angle (towards positive Y) increases distance
      angle += distError * (speedMs < 30 ? 0.02 : 0.005);
      
      // Adjust yaw for lateral error
      yaw += latError * 0.01;
    }
    
    return new THREE.Vector3(
      Math.sin(yaw) * Math.cos(angle) * speedMs,
      Math.sin(angle) * speedMs,
      Math.cos(yaw) * Math.cos(angle) * speedMs
    );
  }

  /**
   * Evaluates LBW based on trajectory
   * @returns {Object} - { pitching, impact, wickets, isOut }
   */
  calculateLBW(trajectory, handedness = 'rhb') {
    const ballRadius = 0.0355; // Exact ICC Standard
    const halfStumpWidth = 0.228 / 2;
    const stumpHeight = 0.711;
    
    const pitch = trajectory.find(p => p.hasBounced);
    const impact = trajectory.find(p => p.position.z >= 8.4);
    const wicketHit = trajectory.find(p => p.position.z >= 10.06);

    if (!pitch && !impact) return null;

    // 1. PITCHING
    // For RHB: x < -halfStumpWidth is Outside Leg
    // For LHB: x > +halfStumpWidth is Outside Leg
    let pitching = 'OUTSIDE OFF';
    if (pitch) {
      const x = pitch.position.x;
      if (Math.abs(x) <= halfStumpWidth) pitching = 'IN LINE';
      else {
        const isLegSide = handedness === 'rhb' ? (x < -halfStumpWidth) : (x > halfStumpWidth);
        pitching = isLegSide ? 'OUTSIDE LEG' : 'OUTSIDE OFF';
      }
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
