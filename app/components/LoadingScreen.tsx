"use client";

import { useState, useEffect, useRef } from "react";

// ─── ASCII grid ───────────────────────────────────────────────────────────────
const COLS = 110;
const ROWS = 55;
const RENDER_W = COLS * 5;   // 550
const RENDER_H = ROWS * 9;   // 495

const ASCII_CHARS =
  "      ....::::----====++++****####%%%%@@@@$$$$";

const RAIN_CHARS = "0123456789ABCDEF!@#$%^&*:;|/\\=-+<>[]{}~?";

// CRT region on the source photo (normalized 0–1 within the bitmap).
// Tuned for front-on vintage PC — black screen area.
const CRT = { l: 0.30, t: 0.11, w: 0.40, h: 0.24 };

// ─── Timing (ms) ─────────────────────────────────────────────────────────────
const LOAD_DURATION   = 2800;
const COMPLETE_PAUSE  = 550;
const DIVE_DURATION   = 1600;
const RAIN_DURATION   = 1000;
const RAIN_FREEZE     = 250;
const FADE_DURATION   = 450;

const DIVE_ZOOM_MAX = 2.45;

// ─── Bar canvas (drawn into CRT rect before ASCII sampling) ───────────────────
const TEX_W = 512;
const TEX_H = 256;

function drawBar(ctx: CanvasRenderingContext2D, progress: number, done: boolean) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  const cx = TEX_W / 2;
  ctx.textAlign = "center";
  ctx.fillStyle = "#c8ffc8";
  ctx.font = "bold 17px monospace";
  ctx.fillText("JEFFREY WONG . DEV", cx, 34);
  ctx.fillStyle = "rgba(200,255,200,0.35)";
  ctx.font = "13px monospace";
  ctx.fillText("──────────────────────────────────", cx, 52);
  ctx.fillStyle = "rgba(200,255,200,0.8)";
  ctx.font = "12px monospace";
  ctx.fillText(done ? "> SYSTEM READY." : "> LOADING PORTFOLIO v1.0...", cx, 70);
  const bx = 50, by = 92, bw = TEX_W - 100, bh = 22;
  ctx.strokeStyle = "rgba(200,255,200,0.55)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx, by, bw, bh);
  if (progress > 0) {
    const filled = Math.floor((bw - 4) * progress);
    const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, "rgba(200,255,200,0.7)");
    grad.addColorStop(1, "#c8ffc8");
    ctx.fillStyle = grad;
    ctx.fillRect(bx + 2, by + 2, filled, bh - 4);
  }
  ctx.fillStyle = "#c8ffc8";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`${Math.round(progress * 100)}%`, TEX_W - 46, by + 16);
  if (done) {
    ctx.fillStyle = "rgba(200,255,200,0.45)";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("PRESS ANY KEY TO CONTINUE", cx, by + bh + 22);
  }
}

// ─── Rain ────────────────────────────────────────────────────────────────────
type RainCols = Array<{ head: number; speed: number }>;

function makeRainCols(): RainCols {
  return Array.from({ length: COLS }, () => ({
    head: Math.random() * -ROWS,
    speed: 0.35 + Math.random() * 0.85,
  }));
}

function stepRain(cols: RainCols, frozen: boolean): string {
  const lines: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    let line = "";
    for (let c = 0; c < COLS; c++) {
      const dist = cols[c].head - r;
      if (dist >= 0 && dist < 1) {
        line += RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)];
      } else if (dist >= 1 && dist < 8) {
        line += RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)];
      } else {
        line += " ";
      }
    }
    lines.push(line);
  }
  if (!frozen) {
    for (let c = 0; c < COLS; c++) {
      cols[c].head += cols[c].speed;
      if (cols[c].head > ROWS + 12) cols[c].head = Math.random() * -8;
    }
  }
  return lines.join("\n");
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  onDone: () => void;
}

const IMG_SRC = "/loading-computer.png";

export default function LoadingScreen({ onDone }: Props) {
  const preRef     = useRef<HTMLPreElement>(null);
  const rainPreRef = useRef<HTMLPreElement>(null);
  const [showRain, setShowRain] = useState(false);
  const [opacity,  setOpacity]  = useState(1);
  const onDoneRef  = useRef(onDone);
  onDoneRef.current = onDone;

  const dragging   = useRef(false);
  const lastXY     = useRef({ x: 0, y: 0 });
  const panRef     = useRef({ x: 0, y: 0 });
  const phaseRef   = useRef("init");

  useEffect(() => {
    let phase      = "init";
    let phaseStart = Date.now();
    let mainRaf    = 0;
    let rainRaf    = 0;

    const work = document.createElement("canvas");
    work.width = RENDER_W;
    work.height = RENDER_H;
    const wctx = work.getContext("2d")!;

    const barCanvas = document.createElement("canvas");
    barCanvas.width = TEX_W;
    barCanvas.height = TEX_H;
    const barCtx = barCanvas.getContext("2d")!;

    const cw = RENDER_W / COLS;
    const ch = RENDER_H / ROWS;

    const img = new Image();
    let imgReady = false;

    function layoutContain() {
      if (!imgReady) return null;
      const s = Math.min(RENDER_W / img.width, RENDER_H / img.height);
      const iw = img.width * s;
      const ih = img.height * s;
      const ix = (RENDER_W - iw) / 2 + panRef.current.x;
      const iy = (RENDER_H - ih) / 2 + panRef.current.y;
      return { ix, iy, iw, ih, s };
    }

    /** Composite photo + bar into CRT, optional zoom around CRT centre. */
    function paintComposite(progress: number, done: boolean, zoom: number) {
      wctx.setTransform(1, 0, 0, 1, 0, 0);
      wctx.fillStyle = "#000000";
      wctx.fillRect(0, 0, RENDER_W, RENDER_H);

      const L = layoutContain();
      if (!L) return;

      const { ix, iy, iw, ih } = L;
      const sx = ix + iw * CRT.l;
      const sy = iy + ih * CRT.t;
      const sw = iw * CRT.w;
      const sh = ih * CRT.h;
      const pivotX = sx + sw / 2;
      const pivotY = sy + sh / 2;

      drawBar(barCtx, progress, done);

      wctx.save();
      wctx.translate(pivotX, pivotY);
      wctx.scale(zoom, zoom);
      wctx.translate(-pivotX, -pivotY);
      wctx.drawImage(img, ix, iy, iw, ih);
      wctx.drawImage(barCanvas, 0, 0, TEX_W, TEX_H, sx, sy, sw, sh);
      wctx.restore();
    }

    function toAscii(): string {
      const { data: d } = wctx.getImageData(0, 0, RENDER_W, RENDER_H);
      const rows: string[] = [];
      for (let row = 0; row < ROWS; row++) {
        let line = "";
        const y0 = Math.floor(row * ch);
        const y1 = Math.min(Math.floor((row + 1) * ch), RENDER_H - 1);
        for (let col = 0; col < COLS; col++) {
          const x0 = Math.floor(col * cw);
          const x1 = Math.min(Math.floor((col + 1) * cw), RENDER_W - 1);
          let lum = 0, n = 0;
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              const i = (y * RENDER_W + x) * 4;
              lum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
              n++;
            }
          }
          const b = n > 0 ? lum / n / 255 : 0;
          line +=
            ASCII_CHARS[
              Math.min(Math.floor(b * ASCII_CHARS.length), ASCII_CHARS.length - 1)
            ];
        }
        rows.push(line);
      }
      return rows.join("\n");
    }

    let zoomStart = 1;
    let zoomEnd   = DIVE_ZOOM_MAX;

    img.onload = () => {
      imgReady = true;
      phase = "loading";
      phaseRef.current = "loading";
      phaseStart = Date.now();
    };
    img.onerror = () => {
      console.error("loading-computer.png failed to load");
      if (preRef.current) {
        preRef.current.textContent = `[ ERROR: ${IMG_SRC} not found ]`;
      }
    };
    img.src = IMG_SRC;

    function loop() {
      mainRaf = requestAnimationFrame(loop);
      const now     = Date.now();
      const elapsed = now - phaseStart;

      if (phase === "init") {
        if (preRef.current) preRef.current.textContent = "\n\n  [ LOADING ASSET... ]";
        return;
      }

      if (phase === "loading") {
        const p = Math.min(elapsed / LOAD_DURATION, 1);
        paintComposite(p, false, 1);
        if (preRef.current) preRef.current.textContent = toAscii();
        if (p >= 1) {
          paintComposite(1, true, 1);
          phase = "complete";
          phaseRef.current = "complete";
          phaseStart = now;
        }
        return;
      }

      if (phase === "complete") {
        paintComposite(1, true, 1);
        if (preRef.current) preRef.current.textContent = toAscii();
        if (elapsed >= COMPLETE_PAUSE) {
          phase = "diving";
          phaseRef.current = "diving";
          phaseStart = now;
          zoomStart = 1;
          zoomEnd   = DIVE_ZOOM_MAX;
        }
        return;
      }

      if (phase === "diving") {
        const t    = Math.min(elapsed / DIVE_DURATION, 1);
        const ease = t * t * t;
        const z    = zoomStart + (zoomEnd - zoomStart) * ease;
        paintComposite(1, true, z);
        if (preRef.current) preRef.current.textContent = toAscii();
        if (t >= 1) {
          cancelAnimationFrame(mainRaf);
          phase = "raining";
          phaseRef.current = "raining";
          beginRain();
        }
        return;
      }
    }

    function beginRain() {
      const cols  = makeRainCols();
      let frozen  = false;
      const start = Date.now();
      setShowRain(true);

      function rainLoop() {
        rainRaf = requestAnimationFrame(rainLoop);
        const el = Date.now() - start;
        if (el >= RAIN_DURATION && !frozen) frozen = true;
        if (rainPreRef.current) rainPreRef.current.textContent = stepRain(cols, frozen);
        if (el >= RAIN_DURATION + RAIN_FREEZE) {
          cancelAnimationFrame(rainRaf);
          setOpacity(0);
          setTimeout(() => onDoneRef.current(), FADE_DURATION + 60);
        }
      }

      rainRaf = requestAnimationFrame(rainLoop);
    }

    loop();

    return () => {
      cancelAnimationFrame(mainRaf);
      cancelAnimationFrame(rainRaf);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current === "diving" || phaseRef.current === "raining") return;
    dragging.current = true;
    lastXY.current   = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastXY.current.x;
    const dy = e.clientY - lastXY.current.y;
    lastXY.current = { x: e.clientX, y: e.clientY };
    panRef.current.x += dx * 0.35;
    panRef.current.y += dy * 0.35;
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black overflow-hidden touch-none cursor-grab active:cursor-grabbing"
      style={{
        opacity,
        transition: opacity === 0 ? `opacity ${FADE_DURATION}ms ease-out` : "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.13) 3px,rgba(0,0,0,0.13) 4px)",
        }}
      />

      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        <pre
          ref={preRef}
          className="font-mono text-[#c8ffc8] text-[5.5px] sm:text-[6.5px] md:text-[8px] lg:text-[9px] leading-[1.2] whitespace-pre select-none"
          style={{ textShadow: "0 0 3px rgba(200,255,200,0.25)" }}
        >
          {Array(ROWS).fill("").join("\n")}
        </pre>
      </div>

      {showRain && (
        <div className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden">
          <pre
            ref={rainPreRef}
            className="font-mono text-[#c8ffc8] text-[5.5px] sm:text-[6.5px] md:text-[8px] lg:text-[9px] leading-[1.2] whitespace-pre select-none"
            style={{ textShadow: "0 0 8px rgba(200,255,200,0.75)" }}
          />
        </div>
      )}
    </div>
  );
}
