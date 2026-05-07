import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { BallisticsSolver } from './physics.js';

class DRSSimulation {
  constructor() {
    this.container = document.getElementById('app');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050505);

    this.ballType = 'fast';
    this.handedness = 'rhb'; // rhb or lhb
    this.bowlerHand = 'right'; // right or left
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
    this.updateUILabels();
    
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
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }

  initLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.2));
    
    // Main stadium floodlights
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(10, 15, -5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.left = -10;
    mainLight.shadow.camera.right = 10;
    mainLight.shadow.camera.top = 10;
    mainLight.shadow.camera.bottom = -10;
    this.scene.add(mainLight);

    // Rim light for Batsman
    const rimLight = new THREE.SpotLight(0x00ffff, 4);
    rimLight.position.set(0, 5, 15);
    rimLight.target.position.set(0, 0, 8.5);
    rimLight.angle = Math.PI / 6;
    rimLight.penumbra = 0.5;
    this.scene.add(rimLight);
    this.scene.add(rimLight.target);

    // Spotlight on the Pitch
    const pitchLight = new THREE.SpotLight(0xffffff, 2);
    pitchLight.position.set(0, 15, 0);
    pitchLight.angle = Math.PI / 4;
    pitchLight.penumbra = 0.3;
    pitchLight.castShadow = true;
    this.scene.add(pitchLight);
  }

  initEnvironment() {
    // 1. Realistic Pitch
    // Using a group to add more detail (crease lines, etc.)
    const pitchGroup = new THREE.Group();
    
    // Main Pitch Body (Grass/Dirt blend look)
    const pitchGeometry = new THREE.BoxGeometry(3.05, 0.1, 22);
    const pitchMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x967969,
      roughness: 0.8,
      metalness: 0.1
    });
    this.pitch = new THREE.Mesh(pitchGeometry, pitchMaterial);
    this.pitch.position.y = -0.05;
    pitchGroup.add(this.pitch);

    // Crease Lines (Popping Crease, Bowling Crease)
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 });
    const createLine = (z, width, depth) => {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.002, z);
      pitchGroup.add(line);
    };

    // Crease lines for both ends
    [10.06, -10.06].forEach(z => {
      createLine(z, 3.05, 0.05); // Bowling Crease
      const sign = z > 0 ? 1 : -1;
      createLine(z - (sign * 1.22), 3.05, 0.05); // Popping Crease
    });

    this.scene.add(pitchGroup);

    this.initStumps(10.06);
    this.initStumps(-10.06);
    
    // Wicket Plane (Impact visualization)
    const wicketPlaneGeo = new THREE.PlaneGeometry(0.228, 0.711);
    const wicketPlaneMat = new THREE.MeshBasicMaterial({ 
      color: 0x00ffff, 
      transparent: true, 
      opacity: 0.05, 
      side: THREE.DoubleSide 
    });
    this.wicketPlane = new THREE.Mesh(wicketPlaneGeo, wicketPlaneMat);
    this.wicketPlane.position.set(0, 0.355, 10.06);
    this.scene.add(this.wicketPlane);

    this.initCenterLine();
  }

  getReleasePos() {
    // Right hand bowler releases from the right side of the stumps (Negative X in our +Z view)
    // Left hand bowler releases from the left side (Positive X in our +Z view)
    const x = this.bowlerHand === 'right' ? -0.55 : 0.55;
    return new THREE.Vector3(x, 2.2, -10);
  }

  initStumps(zPos) {
    const stumpHeight = 0.711;
    const stumpRadius = 0.019;
    const group = new THREE.Group();
    
    // Metallic/Modern Stumps
    const stumpGeo = new THREE.CylinderGeometry(stumpRadius, stumpRadius, stumpHeight, 24);
    const stumpMat = new THREE.MeshStandardMaterial({ 
      color: 0xffffff, 
      metalness: 0.6, 
      roughness: 0.1,
      emissive: 0x222222 
    });
    
    const bailGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.1, 12);
    const bailMat = new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0x440000 });

    for (let i = -1; i <= 1; i++) {
      const s = new THREE.Mesh(stumpGeo, stumpMat);
      s.position.set(i * 0.095, stumpHeight / 2, zPos);
      group.add(s);
      
      // Top LEDs (Modern DRS style)
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      led.position.set(i * 0.095, stumpHeight + 0.01, zPos);
      group.add(led);
    }
    
    // Bails
    const bail1 = new THREE.Mesh(bailGeo, bailMat);
    bail1.rotation.z = Math.PI / 2;
    bail1.position.set(-0.0475, stumpHeight + 0.015, zPos);
    group.add(bail1);
    
    const bail2 = new THREE.Mesh(bailGeo, bailMat);
    bail2.rotation.z = Math.PI / 2;
    bail2.position.set(0.0475, stumpHeight + 0.015, zPos);
    group.add(bail2);

    this.scene.add(group);
  }

  updateUILabels() {
    const swingLabel = document.getElementById('swingLabel');
    const turnLabel = document.getElementById('turnLabel');
    const isCutter = this.ballType === 'cutter' || this.ballType === 'slower';
    const mainLabel = isCutter ? 'CUT' : 'TURN';
    
    if (this.handedness === 'rhb') {
      if (swingLabel) swingLabel.innerHTML = 'SWING: <span class="dir-hint"> - LEFT [IN]</span> / <span class="dir-hint">+ RIGHT [OUT]</span>';
      if (turnLabel) turnLabel.innerHTML = `${mainLabel}: <span class="dir-hint"> - LEFT [OFF]</span> / <span class="dir-hint">+ RIGHT [LEG]</span>`;
    } else {
      if (swingLabel) swingLabel.innerHTML = 'SWING: <span class="dir-hint"> - LEFT [OUT]</span> / <span class="dir-hint">+ RIGHT [IN]</span>';
      if (turnLabel) turnLabel.innerHTML = `${mainLabel}: <span class="dir-hint"> - LEFT [LEG]</span> / <span class="dir-hint">+ RIGHT [OFF]</span>`;
    }
  }

  resetBatsman() {
    if (this.batsman) this.scene.remove(this.batsman);
    this.initBatsman();
    this.updateUILabels();
  }

  initBatsman() {
    const group = new THREE.Group();
    
    // Premium Materials
    const whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.1 });
    const skinMat = new THREE.MeshPhysicalMaterial({ color: 0xffdbac, roughness: 0.7, clearcoat: 0.1 });
    const helmetMat = new THREE.MeshPhysicalMaterial({ color: 0x001a4d, metalness: 0.7, roughness: 0.2, clearcoat: 1.0 });
    const gloveMat = new THREE.MeshPhysicalMaterial({ color: 0xeeeeee, roughness: 0.4 });
    const batMat = new THREE.MeshPhysicalMaterial({ color: 0xccaa88, roughness: 0.6, metalness: 0.0 });
    const padMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.6, clearcoat: 0.2 });

    const applyShadows = (mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    // 1. Lower Body & Pads
    const createPad = (xOffset) => {
      const padGroup = new THREE.Group();
      // Main Pad Body (Rounded)
      const body = applyShadows(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 4, 16), padMat));
      padGroup.add(body);
      
      // Pad Ribs
      for (let i = -2; i <= 2; i++) {
        const rib = applyShadows(new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.45, 2, 8), padMat));
        rib.position.set(i * 0.04, 0, 0.08);
        padGroup.add(rib);
      }
      
      padGroup.position.set(xOffset, 0.325, 0);
      return padGroup;
    };

    group.add(createPad(-0.16));
    group.add(createPad(0.16));

    // 2. Torso (Capsule based for organic look)
    const torso = applyShadows(new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.4, 4, 16), whiteMat));
    torso.position.y = 0.95;
    group.add(torso);
    
    // Shoulders
    const shoulderGeo = new THREE.SphereGeometry(0.09, 16, 16);
    const leftShoulder = applyShadows(new THREE.Mesh(shoulderGeo, whiteMat));
    leftShoulder.position.set(-0.22, 1.15, 0);
    group.add(leftShoulder);
    const rightShoulder = applyShadows(new THREE.Mesh(shoulderGeo, whiteMat));
    rightShoulder.position.set(0.22, 1.15, 0);
    group.add(rightShoulder);

    // 3. Arms (Articulated Capsules)
    const armGeo = new THREE.CapsuleGeometry(0.05, 0.25, 4, 12);
    const rightArm = applyShadows(new THREE.Mesh(armGeo, whiteMat));
    rightArm.position.set(0.32, 0.95, 0);
    rightArm.rotation.z = -Math.PI / 8;
    group.add(rightArm);
    
    const leftArm = applyShadows(new THREE.Mesh(armGeo, whiteMat));
    leftArm.position.set(-0.32, 0.95, 0.15);
    leftArm.rotation.x = -Math.PI / 3;
    group.add(leftArm);

    // 4. Head & Helmet
    const head = applyShadows(new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 24), skinMat));
    head.position.y = 1.4;
    group.add(head);

    const helmet = applyShadows(new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 24, 0, Math.PI * 2, 0, Math.PI / 1.8), helmetMat));
    helmet.position.y = 1.41;
    group.add(helmet);
    
    // Detailed Helmet Grill
    const grillGroup = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const g = applyShadows(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.005, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 1 })));
      g.position.y = 1.35 + (i * 0.03);
      g.position.z = 0.05;
      g.rotation.x = Math.PI / 2.2;
      grillGroup.add(g);
    }
    group.add(grillGroup);

    // 5. Cricket Bat (Refined)
    const batGroup = new THREE.Group();
    const batBlade = applyShadows(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.82, 0.05), batMat));
    batBlade.position.y = -0.41;
    batGroup.add(batBlade);
    
    const batHandle = applyShadows(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.35), new THREE.MeshStandardMaterial({ color: 0x111111 })));
    batHandle.position.y = 0.175;
    batGroup.add(batHandle);
    
    batGroup.position.set(0.35, 0.6, 0.35); // Positive X is Left side (where RHB stands)
    batGroup.rotation.set(-Math.PI / 3.5, 0, -Math.PI / 7);
    group.add(batGroup);

    // Gloves
    const glove = applyShadows(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.05, 4, 12), gloveMat));
    glove.position.set(0.32, 0.72, 0.3);
    group.add(glove);

    // Final Positioning and Scale
    group.rotation.y = Math.PI;
    if (this.handedness === 'lhb') group.scale.x = -1; // Flipping to Negative X for LHB (Right side)
    group.position.set(0, 0, 9.2); 
    this.batsman = group;
    this.scene.add(this.batsman);
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
    // Outer Ring
    const geo = new THREE.TorusGeometry(0.2, 0.015, 16, 100);
    const mat = new THREE.MeshBasicMaterial({ color: 0xe63946 });
    this.targetMarker = new THREE.Mesh(geo, mat);
    this.targetMarker.rotation.x = -Math.PI / 2;
    this.targetMarker.position.set(0, 0.01, 4);
    this.scene.add(this.targetMarker);

    // Inner Hemisphere (Semisphere) instead of a flat circle
    const innerGeo = new THREE.SphereGeometry(0.18, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const innerMat = new THREE.MeshBasicMaterial({ 
      color: 0xe63946, 
      transparent: true, 
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    this.targetTip = new THREE.Mesh(innerGeo, innerMat);
    // Note: SphereGeometry with phiLength is already "standing up", 
    // but our targetMarker parent is rotated -PI/2. 
    // So we need to rotate the pulse to point "up" relative to the world.
    this.targetTip.rotation.x = Math.PI / 2; 
    this.targetMarker.add(this.targetTip);

    // Ball Tip Indicator (Animated Ping Ring)
    const pingGeo = new THREE.TorusGeometry(0.19, 0.008, 16, 64);
    const pingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    this.targetPing = new THREE.Mesh(pingGeo, pingMat);
    this.targetMarker.add(this.targetPing);
  }

  initTrajectoryLine() {
    const material = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.2 });
    this.drsTrail = null;
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

  initControls() {
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;

    document.querySelectorAll('.bowler-hand-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.bowler-hand-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.bowlerHand = e.target.dataset.hand;
        this.updateTrajectoryPreview();
      });
    });

    document.querySelectorAll('.hand-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.hand-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.handedness = e.target.dataset.hand;
        this.resetBatsman();
        this.updateTrajectoryPreview();
      });
    });

    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.ballType = e.target.dataset.type;
        this.applyBallTypePresets();
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

  applyBallTypePresets() {
    const speedEl = document.getElementById('speed');
    const swingEl = document.getElementById('swing');
    const turnEl = document.getElementById('turn');

    switch(this.ballType) {
      case 'fast':
        speedEl.value = 148;
        swingEl.value = 0;
        turnEl.value = 0;
        this.ball.material.color.set(0xee0000); // Bright Metallic Red
        this.ball.material.metalness = 0.9;
        this.ball.material.roughness = 0.1;
        break;
      case 'swing':
        speedEl.value = 128;
        swingEl.value = 4;
        turnEl.value = 0;
        this.ball.material.color.set(0x990000); // Deep Leather Red
        this.ball.material.metalness = 0.3;
        this.ball.material.roughness = 0.4;
        break;
      case 'spin':
        speedEl.value = 85;
        swingEl.value = 0;
        turnEl.value = 0; // Let user decide direction
        this.ball.material.color.set(0xaa2222); // Neutral Spin Red
        this.ball.material.metalness = 0.1;
        break;
      case 'topspin':
        speedEl.value = 92;
        swingEl.value = 0;
        turnEl.value = 0;
        this.ball.material.color.set(0xff4400); // Orange-Red for visibility
        this.ball.material.metalness = 0.5;
        break;
      case 'cutter':
        speedEl.value = 132;
        swingEl.value = 0;
        turnEl.value = -0.5; // Off-cutter by default
        this.ball.material.color.set(0xaa4444);
        this.ball.material.metalness = 0.4;
        break;
      case 'slower':
        speedEl.value = 112;
        swingEl.value = 0.5;
        turnEl.value = 0;
        this.ball.material.color.set(0x882222);
        this.ball.material.metalness = 0.0; // Rough old ball
        break;
      case 'bouncer':
        speedEl.value = 145;
        swingEl.value = 0;
        turnEl.value = 0;
        this.ball.material.color.set(0xff0000); // Aggressive Red
        this.ball.material.metalness = 0.9;
        break;
      case 'knuckle':
        speedEl.value = 118;
        swingEl.value = 0;
        turnEl.value = 0;
        this.ball.material.color.set(0xdddddd); // Scuffed white-red ball
        this.ball.material.metalness = 0.2;
        break;
    }

    this.updateUIPanels(); // Sync panel visibility
    
    // Update displays
    ['speed', 'swing', 'turn'].forEach(id => {
      const el = document.getElementById(id);
      const display = document.getElementById(id + 'Val');
      if (display) display.textContent = id === 'speed' ? `${el.value} km/h` : el.value;
    });

    this.updateTrajectoryPreview();
  }

  updateUIPanels() {
    const swingCtrl = document.getElementById('swingControl');
    const spinCtrl = document.getElementById('spinControl');
    const type = this.ballType;

    // Show Swing control ONLY for SWING ball type (Traditional seam movement)
    swingCtrl.style.display = (type === 'swing') ? 'block' : 'none';
    
    // Show Turn/Cut control for SPIN, TOPSPIN, CUTTER and SLOWER (Off-the-pitch movement)
    spinCtrl.style.display = (type === 'spin' || type === 'topspin' || type === 'cutter' || type === 'slower') ? 'block' : 'none';
    
    this.updateUILabels();
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
    const initialPos = this.getReleasePos();
    const initialVel = this.solver.findVelocityToHitTarget(initialPos, this.targetPos, speedMs, swing, this.ballType);
    this.currentTrajectory = this.solver.solveTrajectory(initialPos, initialVel, swing, turn, this.ballType);
    
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
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const apiUrl = isLocal 
        ? 'http://127.0.0.1:8000/predict' 
        : 'https://krish1440-drs-predictive-engine.hf.space/predict';

      const response = await fetch(apiUrl, {
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
      const decision = this.solver.calculateLBW(this.aiTrajectory, this.handedness);
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

    if (this.targetTip) {
      const s = 1 + Math.sin(Date.now() * 0.004) * 0.05;
      this.targetTip.scale.set(s, s, s);
    }

    if (this.targetPing) {
      const time = Date.now() * 0.002;
      const cycle = (time % 1); // 0 to 1 linear
      this.targetPing.scale.set(cycle, cycle, 1);
      this.targetPing.material.opacity = (1 - cycle) * 0.6;
    }

    if (this.isAnimating) {
      const idx = Math.floor(this.animProgress);
      if (idx < this.currentTrajectory.length) {
        const nextPos = this.currentTrajectory[idx].position;
        
        // Collision detection with Batsman (Updated for new Z=9.2 position)
        if (nextPos.z > 9.0 && nextPos.z < 9.4 && Math.abs(nextPos.x) < 0.4 && nextPos.y < 0.8) {
          this.isAnimating = false;
          this.impactFrame = idx;
          document.getElementById('reviewBtn').style.display = 'block';
          return;
        }

        this.ball.position.copy(nextPos);
        this.animProgress += 2.4; // Minor reduction from 3.0
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
        if (p && p.position.z > 9.2) document.getElementById('rowImpact').style.opacity = 1;
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
