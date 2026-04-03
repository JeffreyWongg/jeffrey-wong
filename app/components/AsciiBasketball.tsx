"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Density ramp: sparse (dark/background) → dense (bright/surface)
const CHARS = "  ..::--==++**##%%@@$$";

// Grid size — COLS/ROWS ≈ 1.9 compensates for char height > width
const COLS = 90;
const ROWS = 48;

// Render canvas: taller-than-wide to match char aspect, sampling is 1 pixel per cell
const RENDER_W = COLS * 5;  // 450
const RENDER_H = ROWS * 9;  // 432  (≈ 1:1 mapping to char grid)

export default function AsciiBasketball() {
  const preRef = useRef<HTMLPreElement>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const rafRef = useRef<number>(0);
  const dragging = useRef(false);
  const lastXY = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(
      50,
      RENDER_W / RENDER_H,
      0.1,
      100
    );
    camera.position.z = 2.8;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(RENDER_W, RENDER_H);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Lighting — strong key for clear shading gradients in ASCII
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4, 5, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-4, -2, 2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.25);
    rim.position.set(0, 0, -6);
    scene.add(rim);

    // Load GLB
    const loader = new GLTFLoader();
    loader.load(
      "/basketball.glb",
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        model.position.sub(center);
        model.scale.setScalar(1.85 / Math.max(size.x, size.y, size.z));
        scene.add(model);
        modelRef.current = model;
      },
      undefined,
      (err) => {
        console.error("Basketball load error:", err);
        if (preRef.current) {
          preRef.current.textContent = "[ ERROR: basketball.glb not found ]";
        }
      }
    );

    // Offscreen 2D canvas for pixel sampling (willReadFrequently = faster getImageData)
    const readCanvas = document.createElement("canvas");
    readCanvas.width = RENDER_W;
    readCanvas.height = RENDER_H;
    const ctx2d = readCanvas.getContext("2d", { willReadFrequently: true })!;

    const cw = RENDER_W / COLS;
    const ch = RENDER_H / ROWS;

    function renderAscii(): string {
      renderer.render(scene, camera);
      ctx2d.drawImage(renderer.domElement, 0, 0);
      const img = ctx2d.getImageData(0, 0, RENDER_W, RENDER_H);
      const d = img.data;

      const rows: string[] = [];

      for (let row = 0; row < ROWS; row++) {
        let line = "";
        const y0 = Math.floor(row * ch);
        const y1 = Math.min(Math.floor((row + 1) * ch), RENDER_H - 1);

        for (let col = 0; col < COLS; col++) {
          const x0 = Math.floor(col * cw);
          const x1 = Math.min(Math.floor((col + 1) * cw), RENDER_W - 1);

          let lum = 0;
          let n = 0;
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              const i = (y * RENDER_W + x) * 4;
              lum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
              n++;
            }
          }

          const brightness = n > 0 ? lum / n / 255 : 0;
          const idx = Math.min(
            Math.floor(brightness * CHARS.length),
            CHARS.length - 1
          );
          line += CHARS[idx];
        }
        rows.push(line);
      }

      return rows.join("\n");
    }

    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      if (modelRef.current && !dragging.current) {
        modelRef.current.rotation.y += 0.007;
      }
      const ascii = renderAscii();
      if (preRef.current) preRef.current.textContent = ascii;
    }

    loop();

    return () => {
      cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      scene.clear();
    };
  }, []);

  const onDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    lastXY.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !modelRef.current) return;
    const dx = (e.clientX - lastXY.current.x) * 0.012;
    const dy = (e.clientY - lastXY.current.y) * 0.012;
    modelRef.current.rotation.y += dx;
    modelRef.current.rotation.x += dy;
    lastXY.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-full gap-3 sm:gap-4">
      <div
        className="flex justify-center touch-none cursor-grab active:cursor-grabbing select-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <pre
          ref={preRef}
          className="font-mono text-[#c8ffc8] text-[4.5px] sm:text-[5.5px] md:text-[6px] leading-[1.08] whitespace-pre pointer-events-none overflow-hidden mx-auto"
          aria-label="Interactive ASCII basketball — drag to rotate"
        >
          {"\n".repeat(ROWS / 2)}
        </pre>
      </div>
      <p className="text-center font-mono text-[10px] sm:text-xs text-[#c8ffc8]/55 max-w-md px-4 leading-relaxed">
        Live 3D scan → ASCII frame buffer. Drag or swipe to spin the ball.
        <span className="text-[#c8ffc8]/35"> Ask the terminal below if you want the longer story.</span>
      </p>
    </div>
  );
}
