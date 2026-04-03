import { CSSProperties, useMemo } from "react";

const AnimatedCyberBackground = () => {
  const particles = useMemo(
    () =>
      Array.from({ length: 22 }, (_, index) => ({
        id: index,
        left: `${Math.round(Math.random() * 100)}%`,
        top: `${Math.round(Math.random() * 100)}%`,
        size: `${Math.max(2, Math.round(Math.random() * 4))}px`,
        duration: `${14 + Math.round(Math.random() * 18)}s`,
        delay: `${Math.round(Math.random() * 8)}s`,
      })),
    []
  );

  return (
    <>
      <div className="cyber-mesh-layer" aria-hidden="true" />
      <div className="cyber-particles-field" aria-hidden="true">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="cyber-particle"
            style={
              {
                left: particle.left,
                top: particle.top,
                width: particle.size,
                height: particle.size,
                animationDuration: particle.duration,
                animationDelay: particle.delay,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </>
  );
};

export default AnimatedCyberBackground;
