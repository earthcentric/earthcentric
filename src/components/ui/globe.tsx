"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

// Converts Lat/Lng coordinates to a 3D Cartesian vector on a sphere of specified radius
const convertLatLngToVector3 = (lat: number, lng: number, radius: number) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.cos(theta)
  );
};

// Draws a dotted line with small circles at the ends on a 2D canvas overlay (HUD connector)
const drawDottedHUDLine = (
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => {
  ctx.strokeStyle = "rgba(16, 185, 129, 0.45)"; // Soft emerald green
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]); // Dotted pattern
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]); // Reset dash pattern
  
  // Draw endpoint node circles
  ctx.fillStyle = "rgba(16, 185, 129, 0.75)";
  ctx.beginPath();
  ctx.arc(x1, y1, 2, 0, 2 * Math.PI);
  ctx.fill();
};

export default function Globe({ scrollProgress = 0, sellerCount = 1 }: { scrollProgress?: number, sellerCount?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const scrollProgressRef = useRef(scrollProgress);
  useEffect(() => {
    scrollProgressRef.current = scrollProgress;
  }, [scrollProgress]);
  
  // References for HTML pins and cards to direct-manipulate style variables for 60fps performance
  const indiaPinRef = useRef<HTMLDivElement>(null);
  const indiaCardRef = useRef<HTMLDivElement>(null);

  // Rotation values and mouse tracking references
  const targetRotationX = useRef(0.2);
  const targetRotationY = useRef(0);
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });

  // Drag interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;
    
    targetRotationY.current += deltaX * 0.005;
    targetRotationX.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotationX.current + deltaY * 0.005));

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 4.5;

    // 3. WebGL Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(500, 500);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 4. Earth Group container (allows rotating Earth + Clouds + Pins together)
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    // 5. Textures loading
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");
    
    // Day marble texture map
    const dayTexture = textureLoader.load(
      "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg",
      () => renderer.render(scene, camera)
    );
    // Specular shine map
    const specularTexture = textureLoader.load(
      "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-water.png",
      () => renderer.render(scene, camera)
    );
    // Cloud layer map
    const cloudsTexture = textureLoader.load(
      "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-clouds.png",
      () => renderer.render(scene, camera)
    );

    // 6. Earth Mesh setup (radius 1.6, 64 segments)
    const earthGeo = new THREE.SphereGeometry(1.6, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: dayTexture,
      specularMap: specularTexture,
      shininess: 18,
      specular: new THREE.Color(0x4488aa),
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // 7. Cloud Layer Mesh setup (radius 1.615, slightly larger)
    const cloudsGeo = new THREE.SphereGeometry(1.615, 64, 64);
    const cloudsMat = new THREE.MeshPhongMaterial({
      map: cloudsTexture,
      transparent: true,
      opacity: 0.28,
      blending: THREE.NormalBlending
    });
    const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    earthGroup.add(cloudsMesh);

    // 8. Thin Atmosphere Limb Glow (radius 1.66)
    const glowGeo = new THREE.SphereGeometry(1.66, 64, 64);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x4fc3f7,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.08
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glowMesh);

    // 9. Cinematic Lighting setup
    // DirectionalLight (Simulated sunlight)
    const sunLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // Cool backfill light (Simulated dark side reflection)
    const fillLight = new THREE.DirectionalLight(0x6699cc, 0.4);
    fillLight.position.set(-4, 0, -2);
    scene.add(fillLight);

    // Ambient light (Shadow floor lifter)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);

    // 10. Spherical Coordinates for verified country pins
    const pins = {
      india: convertLatLngToVector3(20, 78, 1.6)
    };

    // HUD 2D Canvas configuration
    const hudCanvas = hudCanvasRef.current;
    const hudCtx = hudCanvas?.getContext("2d");

    let animationId: number;

    const renderLoop = () => {
      // Slow auto-rotation on Y axis when not active dragging
      if (!isDragging.current) {
        targetRotationY.current += 0.0022;
      }

      // Smooth interpolation for dragging + scroll coordinate rotation offset
      const scrollRotation = scrollProgressRef.current * Math.PI * 2.2;
      earthGroup.rotation.y += (targetRotationY.current + scrollRotation - earthGroup.rotation.y) * 0.08;
      earthGroup.rotation.x += (targetRotationX.current - earthGroup.rotation.x) * 0.08;

      // Rotate clouds slightly faster for dynamic feel
      cloudsMesh.rotation.y += 0.0003;

      // WebGL Frame Render
      renderer.render(scene, camera);

      // HUD overlay vectors drawing
      if (hudCanvas && hudCtx) {
        hudCtx.clearRect(0, 0, 500, 500);

        const cx = 250;
        const cy = 250;
        const screenRadius = 185;

        // Draw HUD tech circle
        hudCtx.strokeStyle = "rgba(79, 195, 247, 0.12)";
        hudCtx.lineWidth = 1;
        hudCtx.beginPath();
        hudCtx.arc(cx, cy, screenRadius * 1.15, 0, 2 * Math.PI);
        hudCtx.stroke();

        // Draw rotating scanner tick
        const tickAngle = (Date.now() * 0.00035) % (Math.PI * 2);
        hudCtx.strokeStyle = "rgba(79, 195, 247, 0.4)";
        hudCtx.lineWidth = 2.5;
        hudCtx.beginPath();
        hudCtx.arc(cx, cy, screenRadius * 1.15, tickAngle, tickAngle + 0.18);
        hudCtx.stroke();

        // Draw HUD status display text
        hudCtx.fillStyle = "rgba(79, 195, 247, 0.45)";
        hudCtx.font = "bold 7px monospace";
        hudCtx.fillText("TELEMETRY: ONLINE", cx - 40, cy - screenRadius * 1.25);
        hudCtx.fillText("NODE TRACKER ACTIVE", cx - 44, cy + screenRadius * 1.28);

        // Fixed screen anchor coordinates for matching absolute HTML labels
        const labelPositions = {
          india: { x: 388, y: 395 }    // Right side bottom label target
        };

        // Projects a 3D pin vector onto the 2D canvas surface and detects backface occlusion
        const projectPin = (pinVec: THREE.Vector3) => {
          const tempV = pinVec.clone();
          tempV.applyQuaternion(earthGroup.quaternion);

          // Facing front if Z coordinate is positive (closest to camera in z axis)
          const isFront = tempV.z > 0;

          tempV.project(camera);
          const px = (tempV.x * 0.5 + 0.5) * 500;
          const py = (tempV.y * -0.5 + 0.5) * 500;

          return { x: px, y: py, isFront };
        };



        // Project and connect India Pin
        const pInd = projectPin(pins.india);
        if (indiaPinRef.current && indiaCardRef.current) {
          if (pInd.isFront) {
            indiaPinRef.current.style.display = "block";
            indiaPinRef.current.style.transform = `translate3d(${pInd.x}px, ${pInd.y}px, 0) translate3d(-50%, -50%, 0)`;
            indiaCardRef.current.style.opacity = "1";
            drawDottedHUDLine(hudCtx, pInd.x, pInd.y, labelPositions.india.x, labelPositions.india.y);
          } else {
            indiaPinRef.current.style.display = "none";
            indiaCardRef.current.style.opacity = "0.35";
          }
        }
      }

      animationId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    // Clean mount connections on component destruction
    return () => {
      cancelAnimationFrame(animationId);
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-[500px] h-[500px] flex items-center justify-center select-none">
      
      {/* Self-contained CSS keys inject for Antigravity & Pulse Animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes antigravity {
          0%   { transform: translateY(0px) rotate3d(1, 0, 0, 0deg); }
          25%  { transform: translateY(-18px) rotate3d(1, 0, 0, 1.5deg); }
          50%  { transform: translateY(-28px) rotate3d(1, 0, 0, 0deg); }
          75%  { transform: translateY(-14px) rotate3d(1, 0, 0, -1deg); }
          100% { transform: translateY(0px) rotate3d(1, 0, 0, 0deg); }
        }
        @keyframes shadow-pulse {
          0%, 100% { transform: translateX(-50%) scaleX(1);   opacity: 0.18; }
          50%       { transform: translateX(-50%) scaleX(0.7); opacity: 0.08; }
        }
        .animate-antigravity {
          animation: antigravity 7s ease-in-out infinite;
        }
        .animate-shadow-pulse {
          animation: shadow-pulse 7s ease-in-out infinite;
        }
      `}} />

      {/* 4. Shadow Pulse Ellipse underneath the floating globe container */}
      <div 
        className="absolute bottom-[-5px] left-1/2 w-44 h-4 bg-[#0a2a1a] rounded-full filter blur-[18px] pointer-events-none animate-shadow-pulse"
        style={{ transformOrigin: "center center" }}
      />

      {/* Floating interactive wrapper div */}
      <div 
        className="relative w-full h-full flex items-center justify-center animate-antigravity cursor-grab active:cursor-grabbing z-20"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      >
        
        {/* Three.js canvas mount wrapper */}
        <div ref={mountRef} className="w-[500px] h-[500px]" />

        {/* 5. 2D HUD Canvas overlay */}
        <canvas
          ref={hudCanvasRef}
          width={500}
          height={500}
          className="absolute inset-0 pointer-events-none z-10 w-[500px] h-[500px]"
        />

        {/* HTML overlay pins */}

        <div 
          ref={indiaPinRef}
          className="absolute top-0 left-0 w-2.5 h-2.5 rounded-full bg-emerald-500 pointer-events-none z-30"
          style={{ display: "none" }}
        >
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        </div>



        {/* Floating country info card - India */}
        <div 
          ref={indiaCardRef}
          className="absolute bottom-[20%] right-[-2%] flex items-center space-x-1.5 z-20 transition-opacity duration-300"
        >
          <div className="glass-panel rounded-xl p-2 text-[9px] pointer-events-none shadow-md">
            <div className="flex items-center space-x-1 font-bold text-foreground">
              <span>🇮🇳</span>
              <span>India</span>
            </div>
            <p className="text-[8px] text-muted-foreground font-semibold">{sellerCount} Verified Sellers</p>
          </div>
        </div>

      </div>
    </div>
  );
}
