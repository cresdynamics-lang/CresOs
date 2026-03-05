import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-syne)", "system-ui", "sans-serif"],
        body: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        label: ["var(--font-space-grotesk)", "system-ui", "sans-serif"]
      },
      colors: {
        brand: {
          DEFAULT: "#1F6FEB",
          dark: "#1749B3",
          light: "#E0ECFF"
        },
        // Cres Dynamics–inspired palette (landing & sign-in)
        cres: {
          bg: "#0a0a0c",
          surface: "#141416",
          card: "#1a1a1e",
          border: "#2a2a2e",
          muted: "#71717a",
          text: "#fafafa",
          "text-muted": "#a1a1aa",
          accent: "#d4a853",
          "accent-hover": "#e4b963"
        }
      },
      keyframes: {
        "slide-in-top": {
          "0%": { opacity: "0", transform: "translateY(-24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "slide-in-bottom": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        },
        "bounce-soft": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" }
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        }
      },
      animation: {
        "slide-in-top": "slide-in-top 0.6s ease-out forwards",
        "slide-in-bottom": "slide-in-bottom 0.6s ease-out forwards",
        "slide-in-left": "slide-in-left 0.6s ease-out forwards",
        "slide-in-right": "slide-in-right 0.6s ease-out forwards",
        "bounce-soft": "bounce-soft 2s ease-in-out infinite",
        "fade-in": "fade-in 0.5s ease-out forwards"
      }
    }
  },
  plugins: []
};

export default config;

