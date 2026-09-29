"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function Asset3DCanvas({
  kind = "vault",
  height = 220,
}: {
  kind?: "car" | "gold" | "vault" | "other";
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let animationFrameId: number;

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup
    const width = container.clientWidth || 300;
    const heightPx = height;
    const camera = new THREE.PerspectiveCamera(38, width / heightPx, 0.1, 100);
    camera.position.set(2.8, 2.0, 3.2);

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // 4. Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minPolarAngle = Math.PI / 4;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.8);
    mainLight.position.set(4, 7, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.bias = -0.0005;
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0xeaf3ef, 0.8);
    rimLight.position.set(-4, 3, -4);
    scene.add(rimLight);

    const floorLight = new THREE.PointLight(0xfffbeb, 0.4, 10);
    floorLight.position.set(0, 1, 2);
    scene.add(floorLight);

    // 6. Asset Models Group
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    // Sub-model specifics
    let rotatingDial: THREE.Mesh | null = null;

    if (kind === "gold") {
      // ── Gold Bullion Model ──────────────────────────────────────────
      // Main Ingot Body
      const bodyGeo = new THREE.BoxGeometry(2.2, 0.55, 1.15);
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xffb800,
        metalness: 0.96,
        roughness: 0.16,
        envMapIntensity: 1.5,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, goldMat);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      modelGroup.add(bodyMesh);

      // Top Ingot Plate
      const plateGeo = new THREE.BoxGeometry(1.85, 0.04, 0.85);
      const plateMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.98,
        roughness: 0.12,
      });
      const plateMesh = new THREE.Mesh(plateGeo, plateMat);
      plateMesh.position.y = 0.29;
      plateMesh.castShadow = true;
      modelGroup.add(plateMesh);

      // Stamped serial hallmark lines
      const stampGeo = new THREE.BoxGeometry(1.4, 0.02, 0.1);
      const stampMat = new THREE.MeshStandardMaterial({
        color: 0xb45309,
        metalness: 0.9,
        roughness: 0.35,
      });
      const stampMesh = new THREE.Mesh(stampGeo, stampMat);
      stampMesh.position.y = 0.31;
      modelGroup.add(stampMesh);
    } else if (kind === "car") {
      // ── Automotive Vehicle Chassis ──────────────────────────────────
      modelGroup.position.y = -0.15;

      // Lower body / chassis in deep green metallic
      const chassisGeo = new THREE.BoxGeometry(2.8, 0.42, 1.35);
      const paintMat = new THREE.MeshStandardMaterial({
        color: 0x0f4c3a,
        metalness: 0.92,
        roughness: 0.18,
      });
      const chassisMesh = new THREE.Mesh(chassisGeo, paintMat);
      chassisMesh.position.y = 0.28;
      chassisMesh.castShadow = true;
      chassisMesh.receiveShadow = true;
      modelGroup.add(chassisMesh);

      // Cabin / Glass canopy
      const cabinGeo = new THREE.BoxGeometry(1.55, 0.38, 1.1);
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.85,
      });
      const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
      cabinMesh.position.set(-0.1, 0.62, 0);
      cabinMesh.castShadow = true;
      modelGroup.add(cabinMesh);

      // Headlights
      const lightGeo = new THREE.BoxGeometry(0.04, 0.12, 0.22);
      const lightMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfef08a,
        emissiveIntensity: 1.5,
      });
      const leftLight = new THREE.Mesh(lightGeo, lightMat);
      leftLight.position.set(1.41, 0.3, 0.42);
      modelGroup.add(leftLight);

      const rightLight = new THREE.Mesh(lightGeo, lightMat);
      rightLight.position.set(1.41, 0.3, -0.42);
      modelGroup.add(rightLight);

      // Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.18, 24);
      const wheelMat = new THREE.MeshStandardMaterial({
        color: 0x111418,
        metalness: 0.7,
        roughness: 0.5,
      });

      const wheelPositions = [
        [-0.8, 0.14, 0.7],
        [0.8, 0.14, 0.7],
        [-0.8, 0.14, -0.7],
        [0.8, 0.14, -0.7],
      ];

      wheelPositions.forEach(([x, y, z]) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, y, z);
        wheel.castShadow = true;
        modelGroup.add(wheel);
      });
    } else {
      // ── Swiss Bank Vault Door ─────────────────────────────────────────
      const vaultMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.9,
        roughness: 0.22,
      });
      const ringGeo = new THREE.CylinderGeometry(1.15, 1.15, 0.35, 36);
      const ringMesh = new THREE.Mesh(ringGeo, vaultMat);
      ringMesh.castShadow = true;
      ringMesh.receiveShadow = true;
      modelGroup.add(ringMesh);

      const centerMat = new THREE.MeshStandardMaterial({
        color: 0x0f4c3a,
        metalness: 0.85,
        roughness: 0.25,
      });
      const centerGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.08, 36);
      const centerMesh = new THREE.Mesh(centerGeo, centerMat);
      centerMesh.position.y = 0.2;
      modelGroup.add(centerMesh);

      const dialMat = new THREE.MeshStandardMaterial({
        color: 0xffb800,
        metalness: 0.98,
        roughness: 0.14,
      });
      const dialGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.1, 8);
      rotatingDial = new THREE.Mesh(dialGeo, dialMat);
      rotatingDial.position.y = 0.26;
      rotatingDial.castShadow = true;
      modelGroup.add(rotatingDial);
    }

    // Soft contact shadow circle on the ground
    const shadowGeo = new THREE.PlaneGeometry(3.5, 3.5);
    const canvasShadow = document.createElement("canvas");
    canvasShadow.width = 128;
    canvasShadow.height = 128;
    const ctx = canvasShadow.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, "rgba(17, 20, 24, 0.28)");
      grad.addColorStop(0.5, "rgba(17, 20, 24, 0.12)");
      grad.addColorStop(1, "rgba(17, 20, 24, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(canvasShadow);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.45;
    scene.add(shadowPlane);

    // 7. Animation Loop with micro-float and rotation
    let clock = new THREE.Clock();
    let isUserInteracting = false;

    controls.addEventListener("start", () => {
      isUserInteracting = true;
    });
    controls.addEventListener("end", () => {
      isUserInteracting = false;
    });

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Gentle floating animation
      modelGroup.position.y = (kind === "car" ? -0.15 : 0) + Math.sin(elapsedTime * 1.8) * 0.05;

      // Gentle auto-rotation when user is not dragging
      if (!isUserInteracting) {
        modelGroup.rotation.y += 0.006;
      }

      if (rotatingDial) {
        rotatingDial.rotation.y += 0.015;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // 8. Responsive Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const newWidth = container.clientWidth;
      camera.aspect = newWidth / heightPx;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, heightPx);
    });
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
    };
  }, [kind, height]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height,
        position: "relative",
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "#F7F8FA",
        border: "1px solid #E5E7EB",
      }}
    >
      {/* Canvas Label Header */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 12,
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#0F4C3A",
            margin: 0,
          }}
        >
          {kind === "gold"
            ? "3D Physical Ingot"
            : kind === "car"
            ? "3D Automotive Asset"
            : "Asset Vault Model"}
        </p>
        <p style={{ fontSize: 10, color: "#8A9099", margin: "2px 0 0" }}>
          Drag to rotate 360° · Real-time WebGL
        </p>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          outline: "none",
          cursor: "grab",
        }}
      />
    </div>
  );
}
