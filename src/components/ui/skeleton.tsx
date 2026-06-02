import React from "react";

export const Skeleton = ({
  width = "100%",
  height = "20px",
  borderRadius = "8px",
}: {
  width?: string;
  height?: string;
  borderRadius?: string;
}) => (
  <div
    style={{
      width,
      height,
      borderRadius,
      background:
        "linear-gradient(90deg, var(--card, rgba(255,255,255,0.04)) 25%, var(--card-hover, rgba(255,255,255,0.08)) 50%, var(--card, rgba(255,255,255,0.04)) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
    }}
  />
);

export default Skeleton;
