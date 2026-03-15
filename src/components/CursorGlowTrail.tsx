import { useEffect, useRef } from "react";

const CursorGlowTrail = () => {
  const coreRef = useRef<HTMLDivElement | null>(null);
  const trailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let animationFrame = 0;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let coreX = targetX;
    let coreY = targetY;
    let trailX = targetX;
    let trailY = targetY;

    const onMove = (event: MouseEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
    };

    const loop = () => {
      coreX += (targetX - coreX) * 0.28;
      coreY += (targetY - coreY) * 0.28;
      trailX += (coreX - trailX) * 0.12;
      trailY += (coreY - trailY) * 0.12;

      if (coreRef.current) coreRef.current.style.transform = `translate3d(${coreX - 14}px, ${coreY - 14}px, 0)`;
      if (trailRef.current) trailRef.current.style.transform = `translate3d(${trailX - 48}px, ${trailY - 48}px, 0)`;

      animationFrame = window.requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    animationFrame = window.requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <>
      <div className="cursor-trail" ref={trailRef} aria-hidden="true" />
      <div className="cursor-core" ref={coreRef} aria-hidden="true" />
    </>
  );
};

export default CursorGlowTrail;
