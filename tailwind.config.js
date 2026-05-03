/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07091a",
          900: "#0b0f1f",
          800: "#121632",
          700: "#1a1f42",
          600: "#252c57",
        },
        neon: {
          violet: "#a78bfa",
          pink: "#f472b6",
          emerald: "#34d399",
          amber: "#fbbf24",
          rose: "#fb7185",
          sky: "#60a5fa",
        },
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', "system-ui", "sans-serif"],
        display: ['"Fredoka"', '"PingFang SC"', "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 22px -4px rgba(167,139,250,0.55), 0 0 40px -10px rgba(244,114,182,0.45)",
        "glow-emerald": "0 0 24px -4px rgba(52,211,153,0.65)",
        "glow-rose": "0 0 22px -6px rgba(251,113,133,0.7)",
        "glow-amber": "0 0 22px -4px rgba(251,191,36,0.7)",
      },
      keyframes: {
        shake: {
          "0%,100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-8px)" },
          "40%": { transform: "translateX(8px)" },
          "60%": { transform: "translateX(-6px)" },
          "80%": { transform: "translateX(6px)" },
        },
        pop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "50%": { transform: "scale(1.2)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        floatUp: {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "100%": { transform: "translateY(-120px)", opacity: "0" },
        },
        xpFly: {
          "0%": { transform: "translate(0,0) scale(1)", opacity: "1" },
          "80%": { opacity: "1" },
          "100%": { transform: "translate(var(--fx), var(--fy)) scale(0.4)", opacity: "0" },
        },
        comboPop: {
          "0%": { transform: "scale(1)" },
          "30%": { transform: "scale(1.45) rotate(-4deg)" },
          "100%": { transform: "scale(1) rotate(0)" },
        },
        flash: {
          "0%": { opacity: "0" },
          "50%": { opacity: "0.9" },
          "100%": { opacity: "0" },
        },
        goNumber: {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "40%": { transform: "scale(1.1)", opacity: "1" },
          "80%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        chestBob: {
          "0%,100%": { transform: "translateY(0) rotate(-2deg)" },
          "50%": { transform: "translateY(-10px) rotate(2deg)" },
        },
        burst: {
          "0%": { transform: "scale(0.4)", opacity: "1" },
          "100%": { transform: "scale(2.5)", opacity: "0" },
        },
        slideUp: {
          "0%": { transform: "translateY(30px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseBar: {
          "0%,100%": { filter: "brightness(1)" },
          "50%": { filter: "brightness(1.6)" },
        },
        sparkle: {
          "0%,100%": { opacity: "0.2", transform: "scale(0.8)" },
          "50%": { opacity: "1", transform: "scale(1.3)" },
        },
      },
      animation: {
        shake: "shake 0.45s ease-in-out",
        pop: "pop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards",
        "float-up": "floatUp 0.9s ease-out forwards",
        "xp-fly": "xpFly 0.85s cubic-bezier(0.5,0,0.75,0) forwards",
        "combo-pop": "comboPop 0.5s ease-out",
        flash: "flash 0.5s ease-out",
        "go-number": "goNumber 1s ease-out forwards",
        "chest-bob": "chestBob 2.5s ease-in-out infinite",
        burst: "burst 0.6s ease-out forwards",
        "slide-up": "slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards",
        "pulse-bar": "pulseBar 0.6s ease-in-out infinite",
        sparkle: "sparkle 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
