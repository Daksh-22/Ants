import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // backgrounds
        base: "var(--bg-base)",
        // dark "ink" for text/icons placed ON gold or other light fills
        // (separate name avoids the text-base color/font-size collision)
        ink: "var(--bg-base)",
        surface: "var(--bg-surface)",
        elevated: "var(--bg-elevated)",
        pressed: "var(--bg-pressed)",
        // accents — these never cross roles
        gold: "var(--accent-gold)",
        "gold-bright": "var(--accent-gold-bright)",
        "gold-dim": "var(--accent-gold-dim)",
        "gold-soft": "var(--accent-gold-soft)",
        "gold-faint": "var(--accent-gold-faint)",
        teal: "var(--accent-teal)",
        "teal-dim": "var(--accent-teal-dim)",
        red: "var(--accent-red)",
        "red-dim": "var(--accent-red-dim)",
        purple: "var(--accent-purple)",
        "purple-dim": "var(--accent-purple-dim)",
        amber: "var(--accent-amber)",
        "amber-dim": "var(--accent-amber-dim)",
        // text
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
      },
      borderColor: {
        subtle: "var(--border-subtle)",
        strong: "var(--border-strong)",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        display: ["40px", { lineHeight: "1", letterSpacing: "-1.5px", fontWeight: "800" }],
        title: ["24px", { lineHeight: "1.15", letterSpacing: "-0.5px", fontWeight: "700" }],
        heading: ["18px", { lineHeight: "1.3", letterSpacing: "-0.2px", fontWeight: "600" }],
        body: ["15px", { lineHeight: "1.65", fontWeight: "400" }],
        label: ["11px", { lineHeight: "1.2", letterSpacing: "0.8px", fontWeight: "600" }],
      },
      maxWidth: {
        app: "430px",
      },
      boxShadow: {
        // colored glows — reserved for meaningful moments, never decoration
        "glow-gold": "0 0 24px -6px rgba(232,160,32,0.5)",
        "glow-gold-lg": "0 0 48px -8px rgba(232,160,32,0.55)",
        "glow-teal": "0 0 20px -6px rgba(0,214,158,0.4)",
        "glow-purple": "0 0 20px -6px rgba(139,92,246,0.4)",
        // gold CTA lift — gradient buttons sit slightly off the page
        cta: "0 4px 16px -4px rgba(232,160,32,0.45), inset 0 1px 0 rgba(255,255,255,0.25)",
      },
      keyframes: {
        // gold heartbeat — fires once on mount for milestones / rank improvements
        "gold-pulse": {
          "0%": { boxShadow: "0 0 0 0 rgba(232,160,32,0)" },
          "45%": { boxShadow: "0 0 0 8px rgba(232,160,32,0.30)" },
          "100%": { boxShadow: "0 0 0 0 rgba(232,160,32,0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // the upload zone "breathes" — inviting the tap
        "upload-breathe": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(232,160,32,0)" },
          "50%": { boxShadow: "0 0 0 6px rgba(232,160,32,0.15)" },
        },
        // streak flame flicker — alive, not annoying
        flicker: {
          "0%, 100%": { transform: "scale(1) rotate(-1deg)" },
          "30%": { transform: "scale(1.08) rotate(1.5deg)" },
          "60%": { transform: "scale(0.96) rotate(-0.5deg)" },
        },
        // slow float for decorative elements
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        "gold-pulse": "gold-pulse 1.4s ease-out 1",
        "fade-in": "fade-in 0.4s ease-out 1",
        "upload-breathe": "upload-breathe 2.5s ease-in-out infinite",
        flicker: "flicker 1.8s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
