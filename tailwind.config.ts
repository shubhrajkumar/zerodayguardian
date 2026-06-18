import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["class", '[data-theme="dark"]', '[data-theme="night"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        display: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        "bg-primary": "var(--color-bg-primary)",
        "bg-secondary": "var(--color-bg-secondary)",
        "bg-card": "var(--color-bg-card)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        accent: "var(--color-accent)",
        "accent-green": "var(--color-accent-green)",
        cyber: {
          bg: "#050508",
          surface: "#0a0a12",
          card: "#0f0f1a",
          border: "#1a1a2e",
          blue: "#22d3ee",
          green: "#34d399",
          purple: "#a78bfa",
          red: "#fb7185",
          amber: "#fbbf24",
          text: "#e2e8f0",
          muted: "#64748b",
          dim: "#475569",
          "blue-glow": "rgba(34, 211, 238, 0.15)",
          "green-glow": "rgba(52, 211, 153, 0.15)",
          "purple-glow": "rgba(167, 139, 250, 0.15)",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      spacing: {
        section: "6rem",
        "section-lg": "8rem",
      },
      maxWidth: {
        container: "80rem",
      },
      keyframes: {
        // ── Ambient / Background ──
        "orb-float": {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-20px) scale(1.02)" },
        },
        "grid-pan": {
          "0%": { transform: "translate(0, 0)" },
          "100%": { transform: "translate(64px, 64px)" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100vh)" },
          "100%": { transform: "translateY(100vh)" },
        },
        "particle-drift": {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg)", opacity: "0" },
          "10%": { opacity: "0.6" },
          "90%": { opacity: "0.6" },
          "100%": { transform: "translate(40px, -60px) rotate(180deg)", opacity: "0" },
        },
        "data-stream": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "10%": { opacity: "0.8" },
          "90%": { opacity: "0.8" },
          "100%": { transform: "translateY(100vh)", opacity: "0" },
        },
        "crt-scan": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "0 100%" },
        },

        // ── Cyber Ops: Holographic / Terminal ──
        "terminal-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "typing-cursor": {
          "0%, 100%": { borderRightColor: "rgba(52, 211, 153, 1)" },
          "50%": { borderRightColor: "transparent" },
        },
        "hologram-flicker": {
          "0%, 100%": { opacity: "1", filter: "brightness(1)" },
          "3%": { opacity: "0.85", filter: "brightness(1.1)" },
          "6%": { opacity: "1", filter: "brightness(1)" },
          "25%": { opacity: "0.95", filter: "brightness(0.95)" },
          "28%": { opacity: "1", filter: "brightness(1)" },
          "75%": { opacity: "0.97", filter: "brightness(1.03)" },
          "78%": { opacity: "1", filter: "brightness(1)" },
        },
        "scan-line-fade": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "10%": { opacity: "0.04" },
          "90%": { opacity: "0.04" },
          "100%": { transform: "translateY(100vh)", opacity: "0" },
        },
        "glitch-text": {
          "0%, 90%, 100%": { transform: "translate(0)" },
          "92%": { transform: "translate(-2px, 1px)" },
          "94%": { transform: "translate(1px, -1px)" },
          "96%": { transform: "translate(-1px, 2px)" },
          "98%": { transform: "translate(0)" },
        },
        "radar-sweep": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "matrix-fall": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "5%": { opacity: "0.6" },
          "95%": { opacity: "0.6" },
          "100%": { transform: "translateY(100vh)", opacity: "0" },
        },
        "signal-pulse": {
          "0%": { boxShadow: "0 0 0 0 rgba(52, 211, 153, 0.4)" },
          "70%": { boxShadow: "0 0 0 8px rgba(52, 211, 153, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(52, 211, 153, 0)" },
        },
        
        // ── Entry Animations ──
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-down": {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(30px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },

        // ── Rank-Up Celebration ──
        "rank-up-badge": {
          "0%": { transform: "scale(0) rotate(-15deg)", opacity: "0" },
          "50%": { transform: "scale(1.3) rotate(5deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        "xp-float-up": {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "100%": { transform: "translateY(-40px)", opacity: "0" },
        },
        "mission-complete": {
          "0%": { transform: "scale(1)", filter: "brightness(1)" },
          "50%": { transform: "scale(1.05)", filter: "brightness(1.3)" },
          "100%": { transform: "scale(1)", filter: "brightness(1)" },
        },

        // ── Interactive / UI ──
        "pulse-glow": {
          "0%, 100%": {
            boxShadow: "0 0 8px var(--theme-glow-cyan, rgba(34,211,238,0.15)), 0 0 16px var(--theme-glow-cyan, rgba(34,211,238,0.08))",
          },
          "50%": {
            boxShadow: "0 0 20px var(--theme-glow-cyan, rgba(34,211,238,0.3)), 0 0 40px var(--theme-glow-cyan, rgba(34,211,238,0.15))",
          },
        },
        "pulse-green": {
          "0%, 100%": { boxShadow: "0 0 8px rgba(52, 211, 153, 0.2), 0 0 16px rgba(52, 211, 153, 0.1)" },
          "50%": { boxShadow: "0 0 20px rgba(52, 211, 153, 0.4), 0 0 40px rgba(52, 211, 153, 0.2)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        "bounce-glow": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.8" },
          "50%": { transform: "scale(1.06)", opacity: "1" },
        },
        "hacker-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.4", boxShadow: "0 0 4px rgba(52, 211, 153, 0.4)" },
          "50%": { transform: "scale(1.3)", opacity: "1", boxShadow: "0 0 12px rgba(52, 211, 153, 0.8)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "typing-dot": {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "30%": { transform: "translateY(-4px)", opacity: "1" },
        },

        // ── Toast ──
        "toast-in": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "toast-out": {
          "0%": { transform: "translateX(0)", opacity: "1" },
          "100%": { transform: "translateX(100%)", opacity: "0" },
        },

        // ── Dashboard / Data ──
        "path-draw": {
          "0%": { strokeDashoffset: "100%" },
          "100%": { strokeDashoffset: "0%" },
        },
        "meter-fill": {
          "0%": { width: "0%" },
          "100%": { width: "var(--meter-value, 0%)" },
        },
        "count-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },

        // ── Ping variants ──
        "ping-slow": {
          "75%, 100%": { transform: "scale(1.5)", opacity: "0" },
        },
        "ping-slower": {
          "75%, 100%": { transform: "scale(2)", opacity: "0" },
        },

        // ── Program Tech-Tree ──
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "10%": { transform: "translateX(-3px) rotate(-0.5deg)" },
          "20%": { transform: "translateX(3px) rotate(0.5deg)" },
          "30%": { transform: "translateX(-2px)" },
          "40%": { transform: "translateX(2px)" },
          "50%": { transform: "translateX(-3px) rotate(-0.5deg)" },
          "60%": { transform: "translateX(1px)" },
          "70%": { transform: "translateX(-1px)" },
          "80%": { transform: "translateX(2px)" },
          "90%": { transform: "translateX(0)" },
        },
        "glitch-scan": {
          "0%": { transform: "translate(0) skewX(0deg)", filter: "brightness(1)" },
          "2%": { transform: "translate(-1px, 1px) skewX(-1deg)", filter: "brightness(1.2) hue-rotate(30deg)" },
          "4%": { transform: "translate(1px, -1px) skewX(1deg)", filter: "brightness(0.8) hue-rotate(-30deg)" },
          "6%": { transform: "translate(-2px, 0) skewX(0deg)", filter: "brightness(1.4) " },
          "8%": { transform: "translate(2px, 1px) skewX(-1deg)", filter: "brightness(0.9)" },
          "10%": { transform: "translate(0) skewX(0deg)", filter: "brightness(1)" },
          "100%": { transform: "translate(0) skewX(0deg)", filter: "brightness(1)" },
        },
        "buzz-green": {
          "0%, 100%": { boxShadow: "0 0 8px rgba(0, 255, 102, 0.3), 0 0 16px rgba(0, 255, 102, 0.15)" },
          "50%": { boxShadow: "0 0 20px rgba(0, 255, 102, 0.6), 0 0 40px rgba(0, 255, 102, 0.3)" },
        },
        "glitch-shake": {
          "0%": { transform: "translateX(0)" },
          "10%": { transform: "translateX(-2px) skewX(-1deg)" },
          "20%": { transform: "translateX(2px) skewX(1deg)" },
          "30%": { transform: "translateX(-1px) skewX(-0.5deg)" },
          "40%": { transform: "translateX(3px) skewX(0.5deg)" },
          "50%": { transform: "translateX(-2px) skewX(-1deg)" },
          "60%": { transform: "translateX(1px) skewX(0deg)" },
          "70%": { transform: "translateX(-1px) skewX(0deg)" },
          "80%": { transform: "translateX(0)" },
        },
        "glow-trail": {
          "0%": { transform: "scale(0.5)", opacity: "0.6" },
          "50%": { opacity: "0.3" },
          "100%": { transform: "scale(2.5)", opacity: "0" },
        },
      },
      animation: {
        // Ambient
        "orb-float": "orb-float 8s ease-in-out infinite",
        "grid-pan": "grid-pan 24s linear infinite",
        "scan-line": "scan-line 6s linear infinite",
        "particle-drift": "particle-drift 6s ease-in-out infinite",
        "data-stream": "data-stream 4s linear infinite",
        "crt-scan": "crt-scan 6s linear infinite",

        // Cyber Ops
        "terminal-blink": "terminal-blink 1s step-end infinite",
        "typing-cursor": "typing-cursor 1s step-end infinite",
        "hologram-flicker": "hologram-flicker 8s ease-in-out infinite",
        "scan-line-fade": "scan-line-fade 4s linear infinite",
        "glitch-text": "glitch-text 4s ease-in-out infinite",
        "radar-sweep": "radar-sweep 4s linear infinite",
        "matrix-fall": "matrix-fall 6s linear infinite",
        "signal-pulse": "signal-pulse 2s ease-out infinite",

        // Entry
        "fade-in": "fade-in 0.5s ease-out",
        "fade-in-up": "fade-in-up 0.6s ease-out",
        "fade-in-down": "fade-in-down 0.4s ease-out",
        "scale-in": "scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-right": "slide-in-right 0.4s ease-out",

        // Rank-Up
        "rank-up-badge": "rank-up-badge 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        "xp-float-up": "xp-float-up 1s ease-out forwards",
        "mission-complete": "mission-complete 0.5s ease-in-out",

        // Interactive
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "pulse-green": "pulse-green 2s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "bounce-glow": "bounce-glow 2s ease-in-out infinite",
        "hacker-pulse": "hacker-pulse 1.2s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "typing-dot": "typing-dot 1.4s ease-in-out infinite",

        // Toast
        "toast-in": "toast-in 0.3s ease-out",
        "toast-out": "toast-out 0.3s ease-in forwards",

        // Dashboard
        "path-draw": "path-draw 2s ease-out forwards",
        "meter-fill": "meter-fill 1.2s ease-out forwards",
        "count-up": "count-up 0.4s ease-out",

        // Ping
        "ping-slow": "ping-slow 3s cubic-bezier(0, 0, 0.2, 1) infinite",
        "ping-slower": "ping-slower 4s cubic-bezier(0, 0, 0.2, 1) infinite",

        // Program Tech-Tree
        shake: "shake 0.5s ease-in-out",
        "glitch-scan": "glitch-scan 3s ease-in-out infinite",
        "buzz-green": "buzz-green 2s ease-in-out infinite",
        "glitch-shake": "glitch-shake 0.35s ease-in-out",
        "glow-trail": "glow-trail 1.5s ease-out infinite",
      },
    },
  },
  plugins: [
    // Theme-aware touch targets for mobile accessibility
    function touchTargetPlugin({ addUtilities }) {
      addUtilities({
        ".touch-target": {
          "@media (max-width: 768px)": {
            "min-height": "48px",
            "min-width": "48px",
          },
        },
      });
    },
    // Premium glassmorphism utilities
    function glassPlugin({ addUtilities }) {
      addUtilities({
        ".glass-premium": {
          background: "rgba(10, 10, 18, 0.6)",
          "backdrop-filter": "blur(24px) saturate(1.4)",
          "-webkit-backdrop-filter": "blur(24px) saturate(1.4)",
          border: "1px solid rgba(30, 41, 59, 0.6)",
        },
        ".glass-premium-hover": {
          background: "rgba(10, 10, 18, 0.6)",
          "backdrop-filter": "blur(24px) saturate(1.4)",
          "-webkit-backdrop-filter": "blur(24px) saturate(1.4)",
          border: "1px solid rgba(30, 41, 59, 0.6)",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        },
        ".glass-premium-hover:hover": {
          "border-color": "rgba(34, 211, 238, 0.4)",
          "box-shadow": "0 0 24px rgba(34, 211, 238, 0.08), 0 0 48px rgba(34, 211, 238, 0.04)",
          transform: "translateY(-2px)",
        },
        ".glass-card-cyber": {
          background: "rgba(15, 15, 26, 0.7)",
          "backdrop-filter": "blur(16px) saturate(1.2)",
          "-webkit-backdrop-filter": "blur(16px) saturate(1.2)",
          border: "1px solid rgba(26, 26, 46, 0.8)",
          "border-radius": "0.75rem",
        },
        ".glass-nav": {
          background: "rgba(5, 5, 8, 0.75)",
          "backdrop-filter": "blur(20px) saturate(1.5)",
          "-webkit-backdrop-filter": "blur(20px) saturate(1.5)",
          "border-bottom": "1px solid rgba(30, 41, 59, 0.5)",
        },
      });
    },
    // Text glow and neon utilities
    function textGlowPlugin({ addUtilities }) {
      addUtilities({
        ".text-neon-cyan": {
          color: "#22d3ee",
          "text-shadow": "0 0 7px rgba(34, 211, 238, 0.3), 0 0 14px rgba(34, 211, 238, 0.15)",
        },
        ".text-neon-green": {
          color: "#34d399",
          "text-shadow": "0 0 7px rgba(52, 211, 153, 0.3), 0 0 14px rgba(52, 211, 153, 0.15)",
        },
        ".text-neon-purple": {
          color: "#a78bfa",
          "text-shadow": "0 0 7px rgba(167, 139, 250, 0.3), 0 0 14px rgba(167, 139, 250, 0.15)",
        },
        ".text-gradient-cyan": {
          background: "linear-gradient(135deg, #22d3ee, #34d399)",
          "-webkit-background-clip": "text",
          "-webkit-text-fill-color": "transparent",
          "background-clip": "text",
        },
        ".text-gradient-purple": {
          background: "linear-gradient(135deg, #a78bfa, #22d3ee)",
          "-webkit-background-clip": "text",
          "-webkit-text-fill-color": "transparent",
          "background-clip": "text",
        },
        ".text-gradient-emerald": {
          background: "linear-gradient(135deg, #34d399, #22d3ee)",
          "-webkit-background-clip": "text",
          "-webkit-text-fill-color": "transparent",
          "background-clip": "text",
        },
        ".text-gradient-fire": {
          background: "linear-gradient(135deg, #fb7185, #fbbf24)",
          "-webkit-background-clip": "text",
          "-webkit-text-fill-color": "transparent",
          "background-clip": "text",
        },
      });
    },
    // Cyber grid and pattern utilities
    function cyberGridPlugin({ addUtilities }) {
      addUtilities({
        ".cyber-grid-bg": {
          "background-image": `
            linear-gradient(rgba(34, 211, 238, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 211, 238, 0.04) 1px, transparent 1px)
          `,
          "background-size": "64px 64px",
        },
        ".cyber-grid-sm": {
          "background-image": `
            linear-gradient(rgba(34, 211, 238, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 211, 238, 0.03) 1px, transparent 1px)
          `,
          "background-size": "32px 32px",
        },
      });
    },
  ],
} satisfies Config;
