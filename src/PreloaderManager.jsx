import React, { useEffect, useState } from "react";
import Preloader from "./Preloader.jsx";

/**
 * PreloaderManager
 * ----------------
 * - assets: 미리 불러올 이미지 배열
 * - video: 비디오 URL (선택)
 * - minDuration: 최소 로딩 시간(ms)
 *
 * 이 컴포넌트는 progress 계산 + visible 상태를 관리하고
 * 너가 만든 Preloader(LERP+fade-out)를 제어한다.
 */
export default function PreloaderManager({
  assets = [],
  video = null,
  minDuration = 1000
}) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadImage = (src) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = src;
      });

    const loadVideo = (src) =>
      new Promise((resolve) => {
        if (!src) return resolve();
        const v = document.createElement("video");
        v.preload = "metadata";
        v.src = src;
        v.onloadedmetadata = resolve;
        v.onerror = resolve;
      });

    const waitFonts = document.fonts
      ? document.fonts.ready.catch(() => {})
      : Promise.resolve();

    const total = assets.length + 2; // 이미지들 + 폰트 + 비디오
    let done = 0;

    const bump = () => {
      done += 1;
      const percent = (done / total) * 100;
      if (!cancelled) setProgress(percent);
    };

    Promise.all([
      ...assets.map((a) => loadImage(a).then(bump)),
      waitFonts.then(bump),
      loadVideo(video).then(bump),
      new Promise((r) => setTimeout(r, minDuration)), // 최소 로딩 유지
    ]).then(() => {
      if (cancelled) return;
      setProgress(100);
      // 0.35초 뒤 Preloader에게 visible=false 전달 → fade-out 진행
      setTimeout(() => setVisible(false), 350);
    });

    return () => {
      cancelled = true;
    };
  }, [assets, video, minDuration]);

  return <Preloader visible={visible} progress={progress} />;
}
