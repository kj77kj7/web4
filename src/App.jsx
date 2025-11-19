import React, { useState, useEffect, useRef } from "react";
import FXOverlay from "./FXOverlay";
import "./index.css";

import Preloader from "./Preloader.jsx";

// --- 설정 ---
const TOTAL_FRAMES = 1132;
const getImagePath = (frame) => `/web4/frames/(${frame + 1}).jpg`;
const REDIRECT_URL = "https://kj77kj7.github.io/WEB5/";
// ---

export default function App() {
  /* ============================================================
      ★★★ web5식 프리로더 적용 (전체 1132장 로딩)
  ============================================================ */
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadImage = (src) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = src;
      });

    // ◆ 전체 프레임 로딩
    const frameList = Array.from(
      { length: TOTAL_FRAMES },
      (_, i) => getImagePath(i)
    );

    const total = frameList.length;
    let done = 0;

    const bump = () => {
      done += 1;
      if (!cancelled) {
        setLoadProgress(Math.min(100, (done / total) * 100));
      }
    };

    Promise.all(frameList.map((src) => loadImage(src).then(bump))).then(() => {
      if (cancelled) return;

      setLoadProgress(100);

      setTimeout(() => {
        if (!cancelled) setLoading(false);
      }, 450);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /* ============================================================
      기존 web4 코드 유지
  ============================================================ */

  const [currentFrame, setCurrentFrame] = useState(0);
  const [effectsOn, setEffectsOn] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const [scrollPos, setScrollPos] = useState(0);

  const scrollContainerRef = useRef(null);
  const sceneRef = useRef(null);
  const hasRedirected = useRef(false);

  // 스크롤 → 프레임
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let ticking = false;

    const updateFrame = () => {
      const maxScrollTop = container.scrollHeight - container.clientHeight;
      const scrollTop = container.scrollTop;
      const scrollFraction = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;

      const frameIndex = Math.min(
        TOTAL_FRAMES - 1,
        Math.floor(scrollFraction * TOTAL_FRAMES)
      );

      setCurrentFrame((prev) => (prev !== frameIndex ? frameIndex : prev));
      setScrollPos(scrollTop.toFixed(0));

      const distanceFromBottom = maxScrollTop - scrollTop;
      if (distanceFromBottom < 300 && !hasRedirected.current) {
        hasRedirected.current = true;
        setIsFading(true);

        setTimeout(() => {
          window.location.href = REDIRECT_URL;
        }, 1500);
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        updateFrame();
        ticking = false;
      });
    };

    updateFrame();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  // 프레임 선로드
  useEffect(() => {
    if (!effectsOn) return;
    const preloadCount = 5;

    for (let i = 1; i <= preloadCount; i++) {
      const next = currentFrame + i;
      if (next < TOTAL_FRAMES) {
        const img = new Image();
        img.src = getImagePath(next);
      }
    }
  }, [currentFrame, effectsOn]);

  // 마지막 프레임에서 효과 종료
  useEffect(() => {
    const atEnd = currentFrame >= TOTAL_FRAMES - 1;
    setEffectsOn(!atEnd);
  }, [currentFrame]);

  // 마우스 팬 효과
  useEffect(() => {
    if (!effectsOn) return;

    const CAM_W = 2100,
      CAM_H = 1200;
    const SCENE_W = 1920,
      SCENE_H = 1080;
    const MAX_X = CAM_W - SCENE_W;
    const MAX_Y = CAM_H - SCENE_H;

    const PAN_STRENGTH = 0.7;
    const LERP_ALPHA = 0.05;
    const IDLE_DELAY = 1500;

    const baseX = (CAM_W - SCENE_W) / 2;
    const baseY = (CAM_H - SCENE_H) / 2;

    let targetX = 0,
      targetY = 0;
    let curX = 0,
      curY = 0;

    let lastMove = performance.now();
    let lastTick = performance.now();

    const invCurve = (() => {
      const k = 0.75;
      const norm = 1 - 1 / (1 + (1 / k) ** 2);
      return (v) => {
        const a = Math.max(-1, Math.min(1, v));
        const s = Math.sign(a);
        const x = Math.abs(a);
        const y = (1 - 1 / (1 + (x / k) ** 2)) / norm;
        return s * y;
      };
    })();

    if (sceneRef.current) {
      sceneRef.current.style.transform = `translate3d(${baseX}px, ${baseY}px, 0)`;
    }

    const onMove = (e) => {
      const w = window.innerWidth,
        h = window.innerHeight;

      const cx = e.clientX ?? e.touches?.[0]?.clientX ?? w / 2;
      const cy = e.clientY ?? e.touches?.[0]?.clientY ?? h / 2;

      const nx = invCurve(((cx / w) - 0.5) * 2);
      const ny = invCurve(((cy / h) - 0.5) * 2);

      targetX = (MAX_X / 2) * -nx * PAN_STRENGTH;
      targetY = (MAX_Y / 2) * -ny * PAN_STRENGTH;
      lastMove = performance.now();
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      lastMove = -Infinity;
    };

    let raf = 0;
    const tick = (now = performance.now()) => {
      lastTick = now;

      if (now - lastMove > IDLE_DELAY) {
        targetX = 0;
        targetY = 0;
      }

      curX += (targetX - curX) * LERP_ALPHA;
      curY += (targetY - curY) * LERP_ALPHA;

      if (sceneRef.current) {
        sceneRef.current.style.transform = `translate3d(${
          baseX + curX
        }px, ${baseY + curY}px, 0)`;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("mouseout", onLeave, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, [effectsOn]);

  /* ============================================================
      렌더
  ============================================================ */
  return (
    <>
      {/* ★★★ 프리로더 표시 ★★★ */}
      <Preloader visible={loading} progress={loadProgress} />

      {/* ---------- 기존 web4 UI ---------- */}
      <div className="page-1920">
        <div ref={scrollContainerRef} className="scroll-container">
          <div className="scroll-content">
            <img
              src={getImagePath(currentFrame)}
              alt=""
              className="sticky-image"
              style={{ opacity: 0, pointerEvents: "none" }}
            />
            <div style={{ height: "300vh" }} />
          </div>
        </div>
      </div>

      <div
        className="camera-space"
        style={{
          width: "2100px",
          height: "1200px",
          visibility: effectsOn ? "visible" : "hidden",
          opacity: effectsOn ? 1 : 0,
          transition: "opacity 200ms linear",
        }}
      >
        <div ref={sceneRef} className="camera-scene">
          <img src={getImagePath(currentFrame)} alt="Scene" />
        </div>
      </div>

      {effectsOn && <FXOverlay />}

      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          padding: "8px 14px",
          background: "rgba(0,0,0,0.6)",
          color: "#0f0",
          fontFamily: "monospace",
          zIndex: 99999,
          pointerEvents: "none",
        }}
      >
        scrollTop: {scrollPos}px
      </div>

      {isFading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "#000",
            opacity: 0,
            animation: "fadeOutOverlay 1.2s forwards",
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: "28px",
          }}
        >
          사이트로 이동중...
        </div>
      )}

      <style>{`
        @keyframes fadeOutOverlay {
          0% { opacity: 0; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </>
  );
}
