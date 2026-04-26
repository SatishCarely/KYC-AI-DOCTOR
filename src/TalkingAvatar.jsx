import { useEffect, useRef, useState, useCallback } from "react";
import baseSrc from "./avatar/base.png";
import mouthOpenSrc from "./avatar/mouth-open.png";
import mouthWideSrc from "./avatar/mouth-wide.png";
import mouthOSrc from "./avatar/mouth-o.png";
import eyesClosedSrc from "./avatar/eyes-closed.png";

/*
 * ───────────────────────────────────────────────────
 *  REGION CONFIG  (fractions of the 1024×1536 image)
 *
 *  Adjust if the blend doesn't align with your photos.
 * ───────────────────────────────────────────────────
 */
const MOUTH_REGION = {
  top: 0.34,
  bottom: 0.51,
  left: 0.22,
  right: 0.78,
  feather: 30,   // CSS pixels (doubled for retina internally)
};

const EYE_REGION = {
  top: 0.25,
  bottom: 0.365,
  left: 0.18,
  right: 0.82,
  feather: 24,
};

/*
 * ───────────────────────────────────────────────────
 *  SPEECH PATTERNS
 *
 *  0 = closed (base)
 *  1 = mouth-open  (slight — most natural)
 *  2 = mouth-wide  (talking emphasis)
 *  3 = mouth-o     (used SPARINGLY — you hate it)
 *
 *  Heavily weighted toward 0 and 1 so she mostly
 *  does subtle movements with occasional wider opens.
 * ───────────────────────────────────────────────────
 */
const PATTERNS = [
  [0, 1, 2, 1, 0, 1, 0, 1, 1, 0],
  [1, 0, 1, 2, 1, 0, 0, 1, 0, 1],
  [0, 1, 0, 1, 2, 0, 1, 0, 1, 0],
  [1, 2, 1, 0, 1, 0, 1, 1, 0, 0],
  [0, 1, 1, 0, 2, 1, 0, 1, 0, 1],
  [1, 0, 2, 1, 0, 0, 1, 0, 1, 0],
  [0, 0, 1, 2, 1, 0, 1, 0, 0, 1],
  [1, 1, 0, 1, 0, 2, 0, 1, 1, 0],
  // These two include a single "O" for rare variety
  [0, 1, 2, 1, 0, 3, 0, 1, 0, 1],
  [1, 0, 1, 0, 2, 1, 3, 0, 1, 0],
];

const FRAME_MIN_MS = 110;
const FRAME_MAX_MS = 210;
const randomDelay = () => FRAME_MIN_MS + Math.random() * (FRAME_MAX_MS - FRAME_MIN_MS);
const pickPattern = () => PATTERNS[Math.floor(Math.random() * PATTERNS.length)];

const DISPLAY_W = 300;
const DISPLAY_H = 450;
const CANVAS_W = DISPLAY_W * 2; // retina
const CANVAS_H = DISPLAY_H * 2;

/* ─────────────────────────────────────────────────── */

export default function TalkingAvatar({ speaking, thinking, listening }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Pre-rendered assets (created once at init)
  const assetsRef = useRef(null);
  // {
  //   base:            HTMLImageElement,
  //   mouthMasked:     [null, canvas, canvas, canvas],  // index 1–3
  //   eyeClosedMasked: canvas,
  // }

  // Animation refs
  const frameRef = useRef(0);
  const blinkRef = useRef(false);
  const patternRef = useRef(pickPattern());
  const patIdxRef = useRef(0);
  const speakTimerRef = useRef(null);
  const rafRef = useRef(null);
  const mountedRef = useRef(true);

  // ── Load images + pre-render masked regions ─────────
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const load = (src) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    Promise.all([
      load(baseSrc),
      load(mouthOpenSrc),
      load(mouthWideSrc),
      load(mouthOSrc),
      load(eyesClosedSrc),
    ]).then(([base, mOpen, mWide, mO, eClosed]) => {
      if (cancelled) return;

      // Pre-render: for each mouth frame, create a canvas that
      // contains ONLY the feathered mouth region (rest is transparent).
      const mouthMask = buildFeatheredMask(MOUTH_REGION, CANVAS_W, CANVAS_H);
      const eyeMask = buildFeatheredMask(EYE_REGION, CANVAS_W, CANVAS_H);

      const mouthMasked = [
        null, // index 0 = base (no overlay needed)
        applyMask(mOpen, mouthMask, CANVAS_W, CANVAS_H),
        applyMask(mWide, mouthMask, CANVAS_W, CANVAS_H),
        applyMask(mO, mouthMask, CANVAS_W, CANVAS_H),
      ];

      const eyeClosedMasked = applyMask(eClosed, eyeMask, CANVAS_W, CANVAS_H);

      assetsRef.current = { base, mouthMasked, eyeClosedMasked };
      setReady(true);
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  // ── Speaking frame loop ─────────────────────────────
  const advanceFrame = useCallback(() => {
    if (!mountedRef.current) return;
    const pat = patternRef.current;
    let idx = patIdxRef.current;
    frameRef.current = pat[idx];
    idx += 1;
    if (idx >= pat.length) {
      patternRef.current = pickPattern();
      idx = 0;
    }
    patIdxRef.current = idx;
    speakTimerRef.current = setTimeout(advanceFrame, randomDelay());
  }, []);

  useEffect(() => {
    if (speaking) {
      patternRef.current = pickPattern();
      patIdxRef.current = 0;
      advanceFrame();
    } else {
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
      speakTimerRef.current = null;
      frameRef.current = 0;
    }
    return () => {
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    };
  }, [speaking, advanceFrame]);

  // ── Blink loop ──────────────────────────────────────
  useEffect(() => {
    let bt, ot, off = false;
    const go = () => {
      bt = setTimeout(() => {
        if (off) return;
        blinkRef.current = true;
        ot = setTimeout(() => {
          if (off) return;
          blinkRef.current = false;
          go();
        }, 95 + Math.random() * 70);
      }, 2200 + Math.random() * 3500);
    };
    go();
    return () => { off = true; clearTimeout(bt); clearTimeout(ot); };
  }, []);

  // ── Render loop ─────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const a = assetsRef.current;

    const draw = () => {
      // 1) Base image (always)
      ctx.drawImage(a.base, 0, 0, CANVAS_W, CANVAS_H);

      // 2) Mouth overlay (pre-masked — just one drawImage!)
      const fi = frameRef.current;
      if (fi > 0 && a.mouthMasked[fi]) {
        ctx.drawImage(a.mouthMasked[fi], 0, 0);
      }

      // 3) Blink overlay (pre-masked)
      if (blinkRef.current) {
        ctx.drawImage(a.eyeClosedMasked, 0, 0);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [ready]);

  // ── Visual styling ──────────────────────────────────
  const glow = thinking
    ? "0 0 30px 8px rgba(167,139,250,0.28)"
    : listening
      ? "0 0 24px 6px rgba(59,130,246,0.22)"
      : speaking
        ? "0 0 20px 5px rgba(16,185,129,0.20)"
        : "0 10px 30px rgba(15,23,42,0.12)";

  const border = thinking
    ? "rgba(167,139,250,0.45)"
    : listening
      ? "rgba(59,130,246,0.35)"
      : speaking
        ? "rgba(16,185,129,0.35)"
        : "rgba(255,255,255,0.06)";

  return (
    <div style={{ width: DISPLAY_W, maxWidth: "100%", margin: "0 auto" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "2 / 3",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: glow,
          border: `2px solid ${border}`,
          transition: "box-shadow 0.4s ease, border-color 0.4s ease",
          background: "#0a0a14",
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ width: "100%", height: "100%", display: "block" }}
        />

        {!ready && (
          <div style={loaderWrap}>
            <div style={loaderDot} />
          </div>
        )}

        {(speaking || listening || thinking) && (
          <div
            style={{
              position: "absolute",
              bottom: 10,
              left: "50%",
              transform: "translateX(-50%)",
              padding: "4px 14px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.5,
              pointerEvents: "none",
              color: "#fff",
              background: speaking
                ? "rgba(16,185,129,0.85)"
                : listening
                  ? "rgba(59,130,246,0.85)"
                  : "rgba(139,92,246,0.85)",
              animation: listening || thinking ? "taPulse 2s ease-in-out infinite" : "none",
            }}
          >
            {speaking ? "SPEAKING" : listening ? "LISTENING" : "THINKING"}
          </div>
        )}
      </div>
      <style>{`@keyframes taPulse{0%,100%{opacity:.6}50%{opacity:1}}`}</style>
    </div>
  );
}

/*
 * ───────────────────────────────────────────────────
 *  MASK HELPERS (run once at init, not per frame)
 * ───────────────────────────────────────────────────
 */

/** Create a canvas with a white rect + feathered edges (alpha mask). */
function buildFeatheredMask(region, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");

  const rx = region.left * w;
  const ry = region.top * h;
  const rw = (region.right - region.left) * w;
  const rh = (region.bottom - region.top) * h;
  const f = region.feather * 2; // retina

  ctx.fillStyle = "#fff";
  ctx.fillRect(rx, ry, rw, rh);

  ctx.globalCompositeOperation = "destination-out";

  // Top feather
  let g = ctx.createLinearGradient(0, ry, 0, ry + f);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(rx, ry, rw, f);

  // Bottom feather
  g = ctx.createLinearGradient(0, ry + rh - f, 0, ry + rh);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = g;
  ctx.fillRect(rx, ry + rh - f, rw, f);

  // Left feather
  g = ctx.createLinearGradient(rx, 0, rx + f, 0);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(rx, ry, f, rh);

  // Right feather
  g = ctx.createLinearGradient(rx + rw - f, 0, rx + rw, 0);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = g;
  ctx.fillRect(rx + rw - f, ry, f, rh);

  ctx.globalCompositeOperation = "source-over";
  return c;
}

/** Draw srcImg into a new canvas, then mask it — returns the masked canvas. */
function applyMask(srcImg, maskCanvas, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(srcImg, 0, 0, w, h);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return c;
}

const loaderWrap = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0a0a14",
};

const loaderDot = {
  width: 36,
  height: 36,
  border: "3px solid rgba(139,92,246,0.3)",
  borderTopColor: "#a78bfa",
  borderRadius: "50%",
  animation: "spin .8s linear infinite",
};
