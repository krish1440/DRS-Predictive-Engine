import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { BallisticsSolver } from './physics.js';

class DRSSimulation {
  constructor() {
    this.container = document.getElementById('app');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050505);

    this.initCamera();
    this.initRenderer();
    this.initLights();
    this.initEnvironment();
    this.initBall();
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
    // Position behind the stumps at the bowling end
    this.camera.position.set(0, 1.8, -10); 
    this.camera.lookAt(0, 0, 10);
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(5, 10, 5);
    mainLight.castShadow = true;
    this.scene.add(mainLight);

    // Add some spotlighting for the "stadium" feel
    const spotLight = new THREE.SpotLight(0xffffff, 1);
    spotLight.position.set(0, 15, 0);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.1;
    this.scene.add(spotLight);
  }

  initEnvironment() {
    // Pitch dimensions: 20.12m x 3.05m
    const pitchGeometry = new THREE.BoxGeometry(3.05, 0.1, 20.12);
    const pitchMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x8b7355, // Earthy brown
      roughness: 0.8,
      metalness: 0.1
    });
    this.pitch = new THREE.Mesh(pitchGeometry, pitchMaterial);
    this.pitch.position.y = -0.05; // Surface at Y=0
    this.scene.add(this.pitch);

    // Crease markings
    const creaseGeometry = new THREE.PlaneGeometry(3.05, 0.05);
    const creaseMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    const poppingCrease = new THREE.Mesh(creaseGeometry, creaseMaterial);
    poppingCrease.rotation.x = -Math.PI / 2;
    poppingCrease.position.set(0, 0.001, 8.8); // pooping crease at batting end
    this.scene.add(poppingCrease);

    // Stumps at the batting end (Z approx 10m from center of pitch)
    this.initStumps(10.06);
    // Stumps at the bowling end (Z approx -10m)
    this.initStumps(-10.06);
  }

  initStumps(zPos) {
    const stumpRadius = 0.019;
    const stumpHeight = 0.711;
    const stumpGeometry = new THREE.CylinderGeometry(stumpRadius, stumpRadius, stumpHeight, 16);
    const stumpMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

    // Middle stump
    const middle = new THREE.Mesh(stumpGeometry, stumpMaterial);
    middle.position.set(0, stumpHeight / 2, zPos);
    this.scene.add(middle);

    // Off stump
    const off = new THREE.Mesh(stumpGeometry, stumpMaterial);
    off.position.set(0.04, stumpHeight / 2, zPos);
    this.scene.add(off);

    // Leg stump
    const leg = new THREE.Mesh(stumpGeometry, stumpMaterial);
    leg.position.set(-0.04, stumpHeight / 2, zPos);
    this.scene.add(leg);

    // Bails
    const bailGeometry = new THREE.CylinderGeometry(0.005, 0.005, 0.1, 8);
    const bailMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const bail1 = new THREE.Mesh(bailGeometry, bailMaterial);
    bail1.rotation.z = Math.PI / 2;
    bail1.position.set(0.02, stumpHeight + 0.005, zPos);
    this.scene.add(bail1);

    const bail2 = new THREE.Mesh(bailGeometry, bailMaterial);
    bail2.rotation.z = Math.PI / 2;
    bail2.position.set(-0.02, stumpHeight + 0.005, zPos);
    this.scene.add(bail2);
  }

  initBall() {
    const ballGeometry = new THREE.SphereGeometry(0.036, 32, 32);
    const ballMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xcc0000, 
      roughness: 0.2,
      metalness: 0.1 
    });
    this.ball = new THREE.Mesh(ballGeometry, ballMaterial);
    this.ball.position.set(0, 2, -10); // Release point
    this.scene.add(this.ball);
    this.ball.visible = false;
  }

  initControls() {
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    
    document.getElementById('bowlBtn').addEventListener('click', () => {
      this.startSimulation();
    });
  }

  startSimulation() {
    const speedKph = parseFloat(document.getElementById('speed').value);
    const line = parseFloat(document.getElementById('line').value);
    const length = parseFloat(document.getElementById('length').value);

    const speedMs = speedKph / 3.6;
    const initialPos = new THREE.Vector3(0, 2.2, -10); // Approx release height
    
    // Calculate initial velocity to hit the length
    // For simplicity in Phase 1, we'll just aim directly at the pitch target
    const targetPos = new THREE.Vector3(line, 0, -10 + length * 2); // simplistic mapping
    const direction = targetPos.clone().sub(initialPos).normalize();
    const initialVel = direction.multiplyScalar(speedMs);

    this.currentTrajectory = this.solver.solveTrajectory(initialPos, initialVel);
    this.animProgress = 0;
    this.isAnimating = true;
    this.ball.visible = true;
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.orbitControls.update();

    if (this.isAnimating && this.currentTrajectory.length > 0) {
      if (this.animProgress < this.currentTrajectory.length) {
        const point = this.currentTrajectory[this.animProgress];
        this.ball.position.copy(point.position);
        this.animProgress++;
      } else {
        this.isAnimating = false;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

new DRSSimulation();
