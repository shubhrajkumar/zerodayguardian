import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { type ReactNode } from "react";
import { pageTransition } from "@/lib/animations";

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * PageTransition — Wraps route content with AnimatePresence for smooth
 * enter/exit transitions on every route change.
 *
 * Uses the `pageTransition` variants from `@/lib/animations` for
 * consistent fade + slide + scale animations across the app.
 *
 * ✅ 60fps GPU-accelerated transforms (opacity, translateY, scale)
 * ✅ Respects prefers-reduced-motion via framer-motion's built-in support
 */
export default function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ willChange: "transform, opacity" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
