import React, { useState, useEffect, useRef } from 'react';
import FXOverlay from './FXOverlay';
import './index.css';

import Preloader from "./Preloader.jsx";    // ★ 추가

// --- 설정 (유지) ---
const TOTAL_FRAMES = 1132;
const getImagePath = (frame) => `/web4/frames/(${frame + 1}).jpg`;
const REDIRECT_URL = 'https://www.naver.com';
// --- 

export default function App() {

  // ★ 프리로더 상태
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);

  // ★ 프리로더 로딩 로직
  useEffect(() => {
    let cancelled = false;

    const loadImage = (src) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = src;
      });

    // 프레임 40개만 샘플 프리로드 (전체 1132장 로딩 X)
    const sample = Array.from({ length: 40 }, (_, i) => getImagePath(i));

    const total = sample.length + 1;
    let done = 0;

    const bump = () => {
      done += 1;
      const percent = Math.min(100, (done / total) * 100);
      if (!cancelled) setLoadProgress(percent);
    };

    Promise.all([
      ...sample.map((s) => loadImage(s).then(bump)),
      new Promise((r) => setTimeout(r, 900)).then(bump),   // 최소 지속시간
    ]).then(() => {
      if (cancelled) return;
      setLoadProgress(100);
      setTimeout(() => setLoading(false), 350);
    });

    return () => { cancelled = true; };
  }, []);

  // ★ 기존 코드
  const [currentFrame, setCurrentFrame] = useState(0);
  const [effectsOn, setEffectsOn] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const [scrollPos, setScrollPos] = useState(0);
  const scrollContainerRef = useRef(null);
  const sceneRef = useRef(null);
  const hasRedirected = useRef(false);

  // 스크롤 → 프레임 계산 (기존 유지)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let ticking = false;

    const updateFrameFromScroll = () => {
      const maxScrollTop = container.scrollHeight - container.clientHeight;
      const scrollTop = container.scrollTop;
      const scrollFraction = maxScrollTop > 0 ? (scrollTop / maxScrollTop) : 0;
      const frameIndex = Math.min(TOTAL_FRAMES - 1, Math.floor(scrollFraction * TOTAL_FRAMES));

      setCurrentFrame((prev) => (prev !== frameIndex ? frameIndex : prev));
      setScrollPos(scrollTop.toFixed(0));

      const distanceFromBottom = maxScrollTop - scrollTop;
      if (distanceFromBottom < 300 && !hasRedirected.current) {
        hasRedirected.current = true;
        setIsFading(true);
        setTimeout(() => { window.location.href = REDIRECT_URL; }, 1500);
      }
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { updateFrameFromScroll(); ticking = false; });
    };

    updateFrameFromScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // 프리로드 (기존 유지)
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

  useEffect(() => {
    const END_BUFFER = 0; 
    const atEnd = currentFrame >= (TOTAL_FRAMES - 1 - END_BUFFER);
    setEffectsOn(!atEnd);
  }, [currentFrame]);

  // 카메라 팬 + 마우스 반응 (기존 유지)
  useEffect(() => {
    if (!effectsOn) return;

    const CAM_W = 2100, CAM_H = 1200;
    const SCENE_W = 1920, SCENE_H = 1080;
    const MAX_X = CAM_W - SCENE_W;
    const MAX_Y = CAM_H - SCENE_H;

    const PAN_STRENGTH = 0.70;
    const LERP_ALPHA = 0.05;
    const IDLE_DELAY_MS = 1500;

    const baseX = (CAM_W - SCENE_W) / 2;
    const baseY = (CAM_H - SCENE_H) / 2;

    let targetX = 0, targetY = 0;
    let curX = 0, curY = 0;

    let lastMoveT = performance.now();
    let lastTickT = performance.now();

    const invSqCurve = (() => {
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
      const w = window.innerWidth, h = window.innerHeight;
      const cx = e.clientX ?? e.touches?.[0]?.clientX ?? w / 2;
      const cy = e.clientY ?? e.touches?.[0]?.clientY ?? h / 2;

      const nxRaw = ((cx / w) - 0.5) * 2;
      const nyRaw = ((cy / h) - 0.5) * 2;

      const nx = invSqCurve(nxRaw);
      const ny = invSqCurve(nyRaw);

      targetX = (MAX_X / 2) * (-nx) * PAN_STRENGTH;
      targetY = (MAX_Y / 2) * (-ny) * PAN_STRENGTH;

      lastMoveT = performance.now();
    };

    const onLeave = () => {
      targetX = 0; targetY = 0;
      lastMoveT = -Infinity;
    };

    let raf = 0;
    const tick = (now = performance.now()) => {
      const dt = Math.min(50, now - lastTickT);
      lastTickT = now;
      const frames = dt / (1000 / 60);
      const alphaBase = 1 - Math.pow(1 - LERP_ALPHA, Math.max(1, frames));

      if (now - lastMoveT > IDLE_DELAY_MS) {
        targetX = 0; targetY = 0;
      }

      const errX = Math.abs(targetX - curX) / (MAX_X / 2);
      const errY = Math.abs(targetY - curY) / (MAX_Y / 2);
      const err = Math.min(1, Math.max(errX, errY));

      const k2 = 0.75;
      const norm2 = 1 - 1 / (1 + (1 / k2) ** 2);
      const invSq01 = (x) => (1 - 1 / (1 + (x / k2) ** 2)) / norm2;

      const w = 0.6 + 0.8 * invSq01(err);
      const alpha = Math.min(0.95, alphaBase * w);

      curX += (targetX - curX) * alpha;
      curY += (targetY - curY) * alpha;

      if (sceneRef.current) {
        sceneRef.current.style.transform =
          `translate3d(${baseX + curX}px, ${baseY + curY}px, 0)`;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseout', onLeave, { passive: true });
    window.addEventListener('blur', onLeave, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseout', onLeave);
      window.removeEventListener('blur', onLeave);
    };
  }, [effectsOn]);

  return (
    <>
      {/* ★★★ 여기 프리로더 추가 ★★★ */}
      <Preloader visible={loading} progress={loadProgress} />

      {/* 기존 구조 */}
      <div className="page-1920">
        <div ref={scrollContainerRef} className="scroll-container">
          <div className="scroll-content">
            <img
              src={getImagePath(currentFrame)}
              alt={`Frame ${currentFrame + 1}`}
              className="sticky-image"
              aria-hidden="true"
              style={{ opacity: 0, pointerEvents: 'none' }}
            />
            <div style={{ height: '300vh' }} />
          </div>
        </div>
      </div>

      <div
        className="camera-space"
        aria-hidden="true"
        style={{
          width: '2100px',
          height: '1200px',
          visibility: effectsOn ? 'visible' : 'hidden',
          opacity: effectsOn ? 1 : 0,
          transition: 'opacity 200ms linear',
        }}
      >
        <div ref={sceneRef} className="camera-scene">
          <img src={getImagePath(currentFrame)} alt="Scene" />
        </div>
      </div>

      {effectsOn ? <FXOverlay /> : null}

      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '8px 14px',
          background: 'rgba(0,0,0,0.6)',
          color: '#0f0',
          fontFamily: 'monospace',
          fontSize: '14px',
          borderRadius: '6px',
          zIndex: 99999,
          pointerEvents: 'none',
          boxShadow: '0 0 6px rgba(0,0,0,0.4)',
        }}
      >
        scrollTop: {scrollPos}px
      </div>

      {isFading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#000',
            opacity: 0,
            animation: 'fadeOutOverlay 1.2s forwards',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '28px',
            fontWeight: '500',
            letterSpacing: '0.02em',
          }}
        >
          사이트로 이동중...
        </div>
      )}

      <style>{`
        @keyframes fadeOutOverlay {
          0% { opacity: 0; }
          20% { opacity: 0.2; }
          50% { opacity: 0.6; }
          100% { opacity: 1; }
        }
      `}</style>
    </>
  );
}
