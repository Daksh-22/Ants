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
        display: ["36px", { lineHeight: "1", letterSpacing: "-1px", fontWeight: "800" }],
        heading: ["18px", { lineHeight: "1.3", fontWeight: "600" }],
        body: ["15px", { lineHeight: "1.65", fontWeight: "400" }],
        label: ["11px", { lineHeight: "1.2", letterSpacing: "0.8px", fontWeight: "600" }],
      },
      maxWidth: {
        app: "430px",
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
      },
      animation: {
        "gold-pulse": "gold-pulse 1.4s ease-out 1",
        "fade-in": "fade-in 0.4s ease-out 1",
        "upload-breathe": "upload-breathe 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
