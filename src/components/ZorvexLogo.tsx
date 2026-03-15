import { memo } from "react";

interface ZorvexLogoProps {
  className?: string;
  compact?: boolean;
}

const ZorvexLogo = ({ className = "", compact = false }: ZorvexLogoProps) => {
  if (compact) {
    return (
      <svg
        viewBox="0 0 220 64"
        role="img"
        aria-label="ZORVEX logo"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="zorvexStrokeCompact" x1="20" y1="8" x2="200" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#B7C4D6" />
            <stop offset="0.52" stopColor="#EAF2FF" />
            <stop offset="1" stopColor="#5EC7FF" />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="217" height="61" rx="14" fill="#0A0F16" stroke="#1E2B3B" />
        <g stroke="url(#zorvexStrokeCompact)" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 16H70L40 33H73L95 16" />
          <path d="M96 16A17 17 0 1 1 96 48" />
          <path d="M131 16V48M131 16H151C160 16 164 20 164 26C164 33 159 37 151 37H131" />
          <path d="M171 16L183 48L195 16" />
          <path d="M203 16L186 48M186 16L203 48" />
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 1400 360"
      role="img"
      aria-label="ZORVEX logo"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="zorvexStroke" x1="70" y1="48" x2="1300" y2="308" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#B4C1D0" />
          <stop offset="0.45" stopColor="#E9F0FA" />
          <stop offset="1" stopColor="#5BC5FF" />
        </linearGradient>
        <filter id="zorvexGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.3" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.14  0 0 0 0 0.66  0 0 0 0 0.96  0 0 0 0.34 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="4" y="4" width="1392" height="352" rx="28" fill="#090E15" stroke="#1A2432" strokeWidth="8" />
      <g filter="url(#zorvexGlow)">
        <g stroke="url(#zorvexStroke)" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round">
          <path d="M90 82H370L196 180H382L488 82" />
          <path d="M500 82A102 102 0 1 1 500 278" />
          <path d="M682 82V278M682 82H804C850 82 874 104 874 140C874 180 848 206 804 206H682" />
          <path d="M932 82L1016 278L1100 82" />
          <path d="M1160 82H1296M1160 180H1270M1160 278H1296" />
          <path d="M1326 62L1210 298M1210 62L1326 298" />
        </g>
      </g>

      <g stroke="#66CFFF" strokeWidth="5.5" strokeLinecap="round" opacity="0.55">
        <path d="M260 117L292 85M536 262L572 284M1288 124L1320 96M1226 248L1255 276" />
      </g>
    </svg>
  );
};

export default memo(ZorvexLogo);
