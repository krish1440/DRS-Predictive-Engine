import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { BallisticsSolver } from './physics.js';

class DRSSimulation {
  constructor() {
    this.container = document.getElementById('app');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050505);

    this.ballType = 'fast';
    this.targetPos = new THREE.Vector3(0, 0, 4);
    this.isReviewing = false;
    this.currentCamMode = 0;

    this.initCamera();
    this.initRenderer();
    this.initLights();
    this.initEnvironment();
    this.initBall();
    this.initTargetMarker();
    this.initTrajectoryLine();
    this.initBatsman();
    this.initVirtualCameras();
    this.initControls();
    
    this.solver = new BallisticsSolver();
    this.isAnimating = false;
    this.currentTrajectory = [];
    this.animProgress = 0;

    window.addEventListener('resize', () => this.onWindowResize());
    this.animate();
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 2.5, -12); 
    this.camera.lookAt(0, 0, 5);
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }

  initLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(5, 10, 5);
    this.scene.add(mainLight);
  }

  initEnvironment() {
    // Pitch
    const pitchGeometry = new THREE.BoxGeometry(3.05, 0.1, 22);
    const pitchMaterial = new THREE.MeshStandardMaterial({ color: 0x967969 });
    this.pitch = new THREE.Mesh(pitchGeometry, pitchMaterial);
    this.pitch.position.y = -0.05;
    this.scene.add(this.pitch);

    this.initStumps(10.06);
    this.initStumps(-10.06);
    
    // Add Wicket Plane (for visual impact check)
    const wicketPlaneGeo = new THREE.PlaneGeometry(0.228, 0.711);
    const wicketPlaneMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.1, side: THREE.DoubleSide });
    this.wicketPlane = new THREE.Mesh(wicketPlaneGeo, wicketPlaneMat);
    this.wicketPlane.position.set(0, 0.355, 10.06);
    this.scene.add(this.wicketPlane);

    this.initCenterLine();
  }

  initStumps(zPos) {
    const stumpHeight = 0.711;
    const stumpRadius = 0.019; // ~1.5 inch diameter
    const group = new THREE.Group();
    const stumpGeo = new THREE.CylinderGeometry(stumpRadius, stumpRadius, stumpHeight, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    // Centers at -0.095, 0, 0.095 gives total width of 0.228m (9 inches)
    for (let i = -1; i <= 1; i++) {
      const s = new THREE.Mesh(stumpGeo, mat);
      s.position.set(i * 0.095, stumpHeight / 2, zPos);
      group.add(s);
    }
    this.scene.add(group);
  }

  initBatsman() {
    const group = new THREE.Group();
    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    torso.position.y = 1.0;
    group.add(torso);
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffdbac }));
    head.position.y = 1.45;
    group.add(head);
    // Pads (Left/Right)
    const padGeo = new THREE.BoxGeometry(0.18, 0.6, 0.2);
    const padMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    const leftPad = new THREE.Mesh(padGeo, padMat);
    leftPad.position.set(-0.15, 0.3, 0);
    group.add(leftPad);
    const rightPad = new THREE.Mesh(padGeo, padMat);
    rightPad.position.set(0.15, 0.3, 0);
    group.add(rightPad);
    
    group.position.set(0, 0, 8.5);
    this.batsman = group;
    this.scene.add(this.batsman);
    
    // Collision Box
    this.batsmanBox = new THREE.Box3().setFromObject(this.batsman);
  }

  initCenterLine() {
    // Width of 3 stumps = 0.228m
    const matGeo = new THREE.PlaneGeometry(0.228, 22);
    const matMat = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.1,
      side: THREE.DoubleSide
    });
    const mat = new THREE.Mesh(matGeo, matMat);
    mat.rotation.x = -Math.PI / 2;
    mat.position.y = 0.001; // Just above pitch
    mat.position.z = 0;
    this.scene.add(mat);
  }

  initVirtualCameras() {
    // Define 4 static virtual cameras for triangulation
    this.virtualCameras = [
      { pos: new THREE.Vector3(-10, 5, -10), target: new THREE.Vector3(0, 0, 5) },
      { pos: new THREE.Vector3(10, 5, -10), target: new THREE.Vector3(0, 0, 5) },
      { pos: new THREE.Vector3(-10, 5, 20), target: new THREE.Vector3(0, 0, 5) },
      { pos: new THREE.Vector3(10, 5, 20), target: new THREE.Vector3(0, 0, 5) }
    ].map(cfg => {
      const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      cam.position.copy(cfg.pos);
      cam.lookAt(cfg.target);
      cam.updateMatrixWorld();
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      return cam;
    });
  }

  get2DProjections(points) {
    // Project 3D points to 2D screen space for each virtual camera
    return points.map(p => {
      return this.virtualCameras.map(cam => {
        const v = p.clone().project(cam);
        // Add 0.5% sensor noise (Industrial Camera precision)
        v.x += (Math.random() - 0.5) * 0.005;
        v.y += (Math.random() - 0.5) * 0.005;
        return [v.x, v.y];
      });
    });
  }

  initBall() {
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.3 })
    );
    this.scene.add(this.ball);
    this.ball.visible = false;
  }

  initTargetMarker() {
    const geo = new THREE.TorusGeometry(0.2, 0.02, 16, 100);
    const mat = new THREE.MeshBasicMaterial({ color: 0xe63946 });
    this.targetMarker = new THREE.Mesh(geo, mat);
    this.targetMarker.rotation.x = -Math.PI / 2;
    this.targetMarker.position.set(0, 0.01, 4);
    this.scene.add(this.targetMarker);

    const innerGeo = new THREE.CircleGeometry(0.18, 32);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xe63946, transparent: true, opacity: 0.3 });
    this.targetPulse = new THREE.Mesh(innerGeo, innerMat);
    this.targetPulse.rotation.x = -Math.PI / 2;
    this.targetMarker.add(this.targetPulse);
  }

  initTrajectoryLine() {
    const material = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.2 });
    this.drsTrail = null;
  }

  initControls() {
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;

    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.ballType = e.target.dataset.type;
        this.updateUIPanels();
      });
    });

    ['speed', 'swing', 'turn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', (e) => {
          const val = e.target.value;
          const display = document.getElementById(id + 'Val');
          if (display) display.textContent = id === 'speed' ? `${val} km/h` : val;
          this.updateTrajectoryPreview();
        });
      }
    });

    this.renderer.domElement.addEventListener('mousedown', (e) => this.onPitchClick(e));
    document.getElementById('bowlBtn').addEventListener('click', () => this.startSimulation());
    document.getElementById('reviewBtn').addEventListener('click', () => this.startReview());
    document.getElementById('camBtn').addEventListener('click', () => this.switchCamera());
    document.getElementById('resetBtn').addEventListener('click', () => this.resetSystem());
    
    // UI Lock helper
    this.controlsPanel = document.querySelector('.side-panel');
  }

  setUILock(locked) {
    if (locked) {
      this.controlsPanel.classList.add('locked');
      // Disable all inputs except reset
      this.controlsPanel.querySelectorAll('input, button:not(#resetBtn)').forEach(el => el.disabled = true);
    } else {
      this.controlsPanel.classList.remove('locked');
      this.controlsPanel.querySelectorAll('input, button').forEach(el => el.disabled = false);
    }
  }

  resetSystem() {
    this.isAnimating = false;
    this.isReviewing = false;
    this.ball.visible = false;
    if (this.reviewTrail) this.scene.remove(this.reviewTrail);
    if (this.predictionTrail) this.scene.remove(this.predictionTrail);
    if (this.impactLine) this.scene.remove(this.impactLine);
    if (this.previewLine) this.previewLine.visible = false; 
    
    document.getElementById('drsDecision').style.display = 'none';
    document.getElementById('reviewBtn').style.display = 'none';
    
    // Unlock UI
    this.setUILock(false);
    this.impactFrame = null;
    this.aiTrajectory = null;
    
    // Reset to Main Camera
    this.currentCamMode = 0;
    this.camera.position.set(0, 2.5, -12);
    this.camera.lookAt(0, 0, 5);
    this.orbitControls.target.set(0, 0, 5);
    this.orbitControls.enabled = true;
    
    // Restore Environment
    this.scene.background = new THREE.Color(0x050505);
    this.pitch.material.color.set(0x967969);
    this.pitch.material.wireframe = false;
    
    this.updateTrajectoryPreview();
  }

  switchCamera() {
    this.currentCamMode = (this.currentCamMode + 1) % 3;
    switch(this.currentCamMode) {
      case 0: // Main
        this.camera.position.set(0, 2.5, -12);
        this.camera.lookAt(0, 0, 5);
        break;
      case 1: // Side
        this.camera.position.set(-8, 2, 0);
        this.camera.lookAt(0, 0, 5);
        break;
      case 2: // Top
        this.camera.position.set(0, 15, 5);
        this.camera.lookAt(0, 0, 5);
        break;
    }
  }

  updateUIPanels() {
    document.getElementById('swingControl').style.display = (this.ballType === 'swing') ? 'flex' : 'none';
    document.getElementById('spinControl').style.display = (this.ballType.includes('spin')) ? 'flex' : 'none';
  }

  onPitchClick(event) {
    if (this.isAnimating || this.isReviewing) return;

    // If we were reviewing, stop reviewing when moving target
    if (this.isReviewing) {
      this.isReviewing = false;
      if (this.reviewTrail) this.scene.remove(this.reviewTrail);
      document.getElementById('drsDecision').style.display = 'none';
      document.getElementById('reviewBtn').style.display = 'none';
    }

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.pitch);
    if (intersects.length > 0) {
      this.targetPos.copy(intersects[0].point).clamp(new THREE.Vector3(-1.5, 0, -10), new THREE.Vector3(1.5, 0.01, 10));
      this.targetMarker.position.copy(this.targetPos);
      this.updateTrajectoryPreview();
    }
  }

  updateTrajectoryPreview() {
    if (this.isAnimating) return;
    const speedMs = parseFloat(document.getElementById('speed').value) / 3.6;
    const swing = parseFloat(document.getElementById('swing').value);
    const turn = parseFloat(document.getElementById('turn').value);
    const initialPos = new THREE.Vector3(0, 2.2, -10);
    const initialVel = this.solver.findVelocityToHitTarget(initialPos, this.targetPos, speedMs, swing);
    this.currentTrajectory = this.solver.solveTrajectory(initialPos, initialVel, swing, turn);
    
    // Simple preview line - keep invisible by default as per request
    if (this.previewLine) this.scene.remove(this.previewLine);
    const geo = new THREE.BufferGeometry().setFromPoints(this.currentTrajectory.map(p => p.position));
    this.previewLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 }));
    this.previewLine.visible = false; 
    this.scene.add(this.previewLine);
  }

  startSimulation() {
    if (this.isAnimating) return;
    
    // Reset Review State
    this.isReviewing = false;
    if (this.reviewTrail) this.scene.remove(this.reviewTrail);
    document.getElementById('reviewBtn').style.display = 'none';
    document.getElementById('drsDecision').style.display = 'none';
    
    // Reset camera to Main if it was in review mode
    if (this.currentCamMode === 1) { // Side cam
      this.currentCamMode = 0;
      this.switchCamera();
    }

    this.updateTrajectoryPreview();
    this.animProgress = 0;
    this.isAnimating = true;
    this.ball.visible = true;
    this.previewLine.visible = false;
  }

  async startReview() {
    this.isReviewing = true;
    this.isAnimating = false;
    this.animProgress = 0;
    this.ball.visible = true;
    
    // Show AI Processing State
    const finalDecision = document.getElementById('finalDecision');
    finalDecision.textContent = 'RUNNING AI INFERENCE...';
    finalDecision.className = 'final-decision';
    finalDecision.style.background = '#444';
    document.getElementById('drsDecision').style.display = 'flex';

    // Lock UI and Controls
    this.setUILock(true);
    
    // 1. GENERATE 2D CAMERA OBSERVATIONS (The real way Hawk-Eye works)
    const impactIdx = this.impactFrame || this.currentTrajectory.length;
    const rawPoints = this.currentTrajectory
      .slice(0, impactIdx)
      .map(p => p.position);
    
    // Project 3D into 2D feeds for our 4 AI cameras
    const cameraFeeds = this.get2DProjections(rawPoints);
    
    // Get Projection Matrices for each cam
    const cameraMatrices = this.virtualCameras.map(cam => {
      const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      return m.elements; // 16 elements
    });

    // 2. CALL PYTHON AI BACKEND
    try {
      const response = await fetch('http://127.0.0.1:8000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          observations: cameraFeeds,
          camera_matrices: cameraMatrices
        })
      });
      
      if (!response.ok) throw new Error("Server error");
      const data = await response.json();
      
      // Part A: Triangulated Tracking (Reconstructed by AI from 2D)
      const trackingTrajectory = data.triangulated_points.map((p, i) => ({
        position: new THREE.Vector3(p[0], p[1], p[2]),
        hasBounced: this.currentTrajectory[i].hasBounced // Sync bounce metadata
      }));
      
      // Part B: AI Future Prediction (Post Impact)
      const futureTrajectory = data.predicted_path.map(p => ({
        position: new THREE.Vector3(p.position[0], p.position[1], p.position[2]),
        hasBounced: p.hasBounced
      }));
      
      this.aiTrajectory = [...trackingTrajectory, ...futureTrajectory];

      // Draw Impact Line (The vertical red line showing pad contact)
      if (this.impactLine) this.scene.remove(this.impactLine);
      const impactPoint = trackingTrajectory[trackingTrajectory.length - 1].position;
      const lineGeo = new THREE.CylinderGeometry(0.005, 0.005, 1.5, 8);
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      this.impactLine = new THREE.Mesh(lineGeo, lineMat);
      this.impactLine.position.set(impactPoint.x, 0.75, impactPoint.z);
      this.scene.add(this.impactLine);

      // Create Review Trails
      if (this.reviewTrail) this.scene.remove(this.reviewTrail);
      if (this.predictionTrail) this.scene.remove(this.predictionTrail);
      
      // 1. Render Triangulated Path (Cyan)
      if (trackingTrajectory.length > 1) {
        const curve = new THREE.CatmullRomCurve3(trackingTrajectory.map(p => p.position));
        const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.03, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 }); 
        this.reviewTrail = new THREE.Mesh(tubeGeo, tubeMat);
        this.scene.add(this.reviewTrail);
      }

      // 2. Render AI Prediction Path (Purple)
      if (futureTrajectory.length > 1) {
        const curve = new THREE.CatmullRomCurve3(futureTrajectory.map(p => p.position));
        const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.03, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({ color: 0xbc13fe, transparent: true, opacity: 0.6 }); 
        this.predictionTrail = new THREE.Mesh(tubeGeo, tubeMat);
        this.scene.add(this.predictionTrail);
      }

      // Show Decision Panel
      const decision = this.solver.calculateLBW(this.aiTrajectory);
      if (decision) {
        this.showDecision(decision);
        finalDecision.textContent = decision.isOut ? 'OUT' : 'NOT OUT';
        finalDecision.className = 'final-decision ' + (decision.isOut ? 'out' : 'not-out');
        finalDecision.style.background = '';
      } else {
        finalDecision.textContent = 'NO DECISION';
      }
      
    } catch (err) {
      console.error("AI Backend Error:", err);
      finalDecision.textContent = 'BACKEND OFFLINE';
      finalDecision.style.background = '#e63946';
    }

    // Virtual Camera at Batsman Side
    this.camera.position.set(0, 1.8, 14);
    this.orbitControls.target.set(0, 0, 5);
    this.orbitControls.update();

    // Virtual Environment Effect
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.pitch.material.color.set(0x222222);
    this.pitch.material.wireframe = true;
  }

  showDecision(d) {
    const panel = document.getElementById('drsDecision');
    panel.style.display = 'flex';

    const updateRow = (id, val) => {
      const el = document.getElementById(id).querySelector('.result');
      el.textContent = val;
      el.className = 'result ' + val.toLowerCase().replace(' ', '-').replace("'", "");
    };

    updateRow('rowPitching', d.pitching);
    updateRow('rowImpact', d.impact);
    updateRow('rowWickets', d.wickets);

    const final = document.getElementById('finalDecision');
    final.textContent = d.isOut ? 'OUT' : 'NOT OUT';
    final.className = 'final-decision ' + (d.isOut ? 'out' : 'not-out');
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.orbitControls.update();

    if (this.targetPulse) {
      const s = 1 + Math.sin(Date.now() * 0.005) * 0.2;
      this.targetPulse.scale.set(s, s, 1);
    }

    if (this.isAnimating) {
      if (this.animProgress < this.currentTrajectory.length) {
        const nextPos = this.currentTrajectory[this.animProgress].position;
        
        // Collision detection with Batsman
        if (nextPos.z > 8.3 && nextPos.z < 8.7 && Math.abs(nextPos.x) < 0.4 && nextPos.y < 0.8) {
          this.isAnimating = false;
          this.impactFrame = this.animProgress;
          document.getElementById('reviewBtn').style.display = 'block';
          return;
        }

        this.ball.position.copy(nextPos);
        this.animProgress += 2; // Fast play
      } else {
        this.isAnimating = false;
        document.getElementById('reviewBtn').style.display = 'block';
      }
    }

    if (this.isReviewing && this.aiTrajectory) {
      if (this.animProgress < this.aiTrajectory.length) {
        this.ball.position.copy(this.aiTrajectory[this.animProgress].position);
        this.animProgress += 1; // Slow motion
        
        // Update decision panel visibility
        const p = this.aiTrajectory[this.animProgress];
        if (p && p.hasBounced) document.getElementById('rowPitching').style.opacity = 1;
        if (p && p.position.z > 8.5) document.getElementById('rowImpact').style.opacity = 1;
        if (p && p.position.z > 10) document.getElementById('rowWickets').style.opacity = 1;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

new DRSSimulation();
