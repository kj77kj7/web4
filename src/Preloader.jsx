    import React, { useEffect, useRef, useState } from "react";

    /**
     * 부드러운 진행률(LERP) + 페이드 아웃을 자체 처리하는 Preloader
     * - props.visible: 부모에서 켜고/끄는 플래그
     * - props.progress: 0~100의 타깃 진행률
     *
     * 기존 App.jsx 로직은 그대로 두고,
     * 여기에서 진행률을 부드럽게 보간하고,
     * visible=false가 되어도 자연스럽게 페이드 아웃 후 언마운트한다.
     */
    export default function Preloader({ visible, progress }) {
    // 화면에 남겨 둘지(페이드 중에도 렌더 유지)
    const [mounted, setMounted] = useState(visible);
    // 시각적으로 표시할 보간된 퍼센트
    const [displayProgress, setDisplayProgress] = useState(0);
    // 현재 표시 상태 클래스
    const [showClass, setShowClass] = useState(visible ? "is-visible" : "");

    const rafRef = useRef(null);
    const targetRef = useRef(progress);

    // 타깃 진행률 업데이트
    useEffect(() => {
        targetRef.current = Math.max(0, Math.min(100, progress));
    }, [progress]);

    // 보간 루프(부드러운 증가)
    useEffect(() => {
        let running = true;
        const step = () => {
        if (!running) return;

        const current = displayProgress;
        const target = targetRef.current;

        // 100% 가까울수록 더욱 부드럽게 감속
        const ease = target >= 99 ? 0.06 : 0.12; // 가속/감속 계수
        const next = current + (target - current) * ease;

        // 99.8 이상이면 100으로 스냅
        const snapped = target >= 100 && next > 99.8 ? 100 : next;

        setDisplayProgress(snapped);
        rafRef.current = requestAnimationFrame(step);
        };
        rafRef.current = requestAnimationFrame(step);
        return () => {
        running = false;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
        // displayProgress는 내부에서 set하므로 의존성 제외
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 표시/비표시 전환 (페이드 인/아웃)
    useEffect(() => {
        if (visible) {
        setMounted(true);               // 마운트 유지
        // 다음 프레임에 클래스를 켜서 CSS 트랜지션 발동
        requestAnimationFrame(() => setShowClass("is-visible"));
        } else {
        // 페이드 아웃 클래스
        setShowClass("");               // opacity 0으로
        // CSS 트랜지션(420ms)이 끝난 뒤 언마운트
        const t = setTimeout(() => setMounted(false), 440);
        return () => clearTimeout(t);
        }
    }, [visible]);

    if (!mounted) return null;

    return (
        <div className={`preloader ${showClass}`}>
        <div className="preloader-inner">
            <div className="preloader-title">Loading</div>

            <div className="preloader-bar" aria-label="loading progress">
            <div
                className="preloader-bar-fill"
                style={{ width: `${Math.min(100, displayProgress).toFixed(1)}%` }}
            />
            </div>

            <div className="preloader-sub">
            {Math.floor(displayProgress)}%
            </div>
        </div>
        </div>
    );
    }
