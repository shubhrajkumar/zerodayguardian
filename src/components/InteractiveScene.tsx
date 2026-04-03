import { useEffect, useRef, useState } from "react";

type Particle = {
  left: string;
  size: number;
  duration: number;
  delay: number;
};

const particles: Particle[] = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 7.1 + 6) % 100}%`,
  size: 2 + (i % 3),
  duration: 16 + (i % 5) * 3,
  delay: i * 0.55,
}));

const InteractiveScene = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const [cursorEnabled, setCursorEnabled] = useState(false);
  const [backgroundEnabled, setBackgroundEnabled] = useState(true);

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointerQuery = window.matchMedia("(pointer: fine)");

    const updateCapabilities = () => {
      const reduced = reducedMotionQuery.matches;
      setBackgroundEnabled(!reduced);
      setCursorEnabled(!reduced && finePointerQuery.matches);
    };

    updateCapabilities();
    reducedMotionQuery.addEventListener("change", updateCapabilities);
    finePointerQuery.addEventListener("change", updateCapabilities);

    return () => {
      reducedMotionQuery.removeEventListener("change", updateCapabilities);
      finePointerQuery.removeEventListener("change", updateCapabilities);
    };
  }, []);

  useEffect(() => {
    if (!cursorEnabled || !cursorRef.current) return;

    const cursorEl = cursorRef.current;
    let visible = false;

    const animate = () => {
      const current = currentRef.current;
      const target = targetRef.current;
      current.x += (target.x - current.x) * 0.14;
      current.y += (target.y - current.y) * 0.14;

      cursorEl.style.setProperty("--cursor-x", `${current.x}px`);
      cursorEl.style.setProperty("--cursor-y", `${current.y}px`);

      rafRef.current = window.requestAnimationFrame(animate);
    };

    const showCursor = () => {
      if (!visible) {
        visible = true;
        cursorEl.classList.add("is-visible");
      }
    };

    const hideCursor = () => {
      visible = false;
      cursorEl.classList.remove("is-visible");
    };

    const onPointerMove = (event: PointerEvent) => {
      targetRef.current = { x: event.clientX, y: event.clientY };
      if (currentRef.current.x === 0 && currentRef.current.y === 0) {
        currentRef.current = { x: event.clientX, y: event.clientY };
      }
      showCursor();
    };

    const onPointerDown = () => cursorEl.classList.add("is-active");
    const onPointerUp = () => cursorEl.classList.remove("is-active");

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", hideCursor);
    window.addEventListener("blur", hideCursor);
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });

    rafRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", hideCursor);
      window.removeEventListener("blur", hideCursor);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [cursorEnabled]);

  return (
    <>
      <div className={`live-scene ${backgroundEnabled ? "" : "reduced"}`} aria-hidden="true">
        <div className="live-gradient-layer" />
        <div className="live-flow live-flow-a" />
        <div className="live-flow live-flow-b" />
        <div className="cyber-grid" />
        <div className="live-particles">
          {particles.map((particle, i) => (
            <span
              key={i}
              className="live-particle"
              style={{
                left: particle.left,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                animationDuration: `${particle.duration}s`,
                animationDelay: `${particle.delay}s`,
              }}
            />
          ))}
        </div>
      </div>
      {cursorEnabled ? <div ref={cursorRef} className="cursor-aura" aria-hidden="true" /> : null}
    </>
  );
};

export default InteractiveScene;
