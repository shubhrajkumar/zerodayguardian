import { type Variants } from "framer-motion";

// ── Duration / Easing presets ──
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;
export const easeOutCubic = [0.33, 1, 0.68, 1] as const;
export const easeInOutCubic = [0.65, 0, 0.35, 1] as const;
export const springBounce = { type: "spring" as const, stiffness: 400, damping: 25 };
export const springGentle = { type: "spring" as const, stiffness: 300, damping: 20 };
export const springSnap = { type: "spring" as const, stiffness: 500, damping: 30 };
export const springCyber = { type: "spring" as const, stiffness: 350, damping: 15, mass: 0.8 };

// ── Page / Route Transitions — Cyber Ops feel ──
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.98, filter: "blur(4px)" },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    filter: "blur(4px)",
    transition: { duration: 0.2, ease: easeOutCubic },
  },
};

export const pageTransitionFast: Variants = {
  initial: { opacity: 0, filter: "blur(2px)" },
  animate: {
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.25, ease: easeOutCubic },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

// ── Terminal / Typewriter ──
export const typewriter: Variants = {
  hidden: { width: "0%" },
  visible: {
    width: "100%",
    transition: { duration: 1.5, ease: "easeInOut" },
  },
};

export const terminalLine: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i = 0) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.15, duration: 0.4, ease: easeOutCubic },
  }),
};

// ── Rank Up ──
export const rankUpReveal: Variants = {
  hidden: { scale: 0, rotate: -20, opacity: 0 },
  visible: {
    scale: 1,
    rotate: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 12, mass: 0.6 },
  },
};

export const xpFloat: Variants = {
  initial: { opacity: 1, y: 0, scale: 1 },
  animate: {
    opacity: 0,
    y: -30,
    scale: 0.8,
    transition: { duration: 0.8, ease: "easeOut" },
  },
};

// ── Mission Pulse ──
export const missionPulse: Variants = {
  initial: { boxShadow: "0 0 0 0 rgba(52, 211, 153, 0)" },
  animate: {
    boxShadow: ["0 0 0 0 rgba(52, 211, 153, 0.4)", "0 0 0 12px rgba(52, 211, 153, 0)", "0 0 0 0 rgba(52, 211, 153, 0)"],
    transition: { duration: 1.5, repeat: Infinity, ease: "easeOut" },
  },
};

// ── Fade + Slide ──
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay, ease: easeOutExpo },
  }),
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeOutCubic },
  },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: easeOutExpo },
  },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: easeOutExpo },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: easeOutExpo },
  },
};

// ── Stagger ──
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeOutExpo },
  },
};

export const staggerItemLeft: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: easeOutExpo },
  },
};

// ── Hover / Tap (for `whileHover` / `whileTap`) ──
export const hoverScale = {
  scale: 1.02,
  transition: springGentle,
};

export const hoverLift = {
  y: -4,
  boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
  transition: springGentle,
};

export const hoverGlow = {
  scale: 1.03,
  boxShadow: "0 0 24px rgba(34, 211, 238, 0.15)",
  transition: springGentle,
};

export const tapScale = {
  scale: 0.97,
  transition: springSnap,
};

// ── Card / List item variants ──
export const cardHover = {
  y: -4,
  transition: springGentle,
};

export const cardTap = {
  scale: 0.98,
  transition: springSnap,
};

// ── Staggered list (for dashboard activity log, etc.) ──
export const listContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

export const listItem: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: easeOutCubic },
  },
};

// ── Counting number animation ──
export const countUp = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOutExpo },
  },
};

// ── Status dot pulse ──
export const pulseDot = {
  animate: {
    scale: [1, 1.3, 1],
    opacity: [0.7, 1, 0.7],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
};

// ── Section header (badge + title + description) ──
export const sectionHeader: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

export const sectionHeaderItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeOutExpo },
  },
};

// ── Navbar ──
export const navbarReveal: Variants = {
  hidden: { y: -20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: easeOutExpo },
  },
};
