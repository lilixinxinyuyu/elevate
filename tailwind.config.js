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
        // v0.31.4：温和的脉动 — 比 pulseBar 慢且弱，给 Hero chip 用，
        // 避免老游戏感的快速闪烁。2.4s 循环 + 1.18 峰值 = 平稳的"呼吸"。
        pulseSoft: {
          "0%,100%": { filter: "brightness(1)", transform: "scale(1)" },
          "50%": { filter: "brightness(1.18)", transform: "scale(1.015)" },
        },
        sparkle: {
          "0%,100%": { opacity: "0.2", transform: "scale(0.8)" },
          "50%": { opacity: "1", transform: "scale(1.3)" },
        },
        // v0.29.1 钻档全息光晕——绕勋章慢速旋转一圈
        shimmer: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        // v0.30.11 钻档"光带扫过"——叠在 shimmer 上，3.5s 一道斜光带从 -100% 扫到 100%
        shimmerSweep: {
          "0%": { transform: "translateX(-100%) rotate(15deg)", opacity: "0" },
          "30%": { opacity: "0.85" },
          "70%": { opacity: "0.85" },
          "100%": { transform: "translateX(150%) rotate(15deg)", opacity: "0" },
        },
        // v0.30.11 钻档径向脉冲——内层亮度 0.92 → 1.05 → 0.92，呼吸节律
        shimmerPulse: {
          "0%,100%": { filter: "brightness(0.95) saturate(1)" },
          "50%": { filter: "brightness(1.12) saturate(1.15)" },
        },
        // v0.30.2 hero 校徽进场：fade in + slight scale + tiny rotate
        badgeEnter: {
          "0%": { transform: "scale(0.55) rotate(-12deg)", opacity: "0" },
          "60%": { transform: "scale(1.08) rotate(4deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        // hover 时绕轴轻摆，做"被吹气"的小动作
        badgeHoverWiggle: {
          "0%,100%": { transform: "rotate(0deg) scale(1.08)" },
          "30%": { transform: "rotate(-6deg) scale(1.12)" },
          "70%": { transform: "rotate(6deg) scale(1.12)" },
        },
        // hero score 进场：从下方滑入 + fade
        scoreSlideIn: {
          "0%": { transform: "translateY(14px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
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
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
        sparkle: "sparkle 1.2s ease-in-out infinite",
        // 钻档：v0.30.11 减速到 8 秒 1 圈（之前 4s 太快会眼花），更"慢慢转动的传家宝"
        shimmer: "shimmer 8s linear infinite",
        "shimmer-sweep": "shimmerSweep 3.5s ease-in-out infinite",
        "shimmer-pulse": "shimmerPulse 2.6s ease-in-out infinite",
        "badge-enter": "badgeEnter 720ms cubic-bezier(0.34,1.56,0.64,1) both",
        "badge-wiggle": "badgeHoverWiggle 0.7s ease-in-out",
        "score-slide-in": "scoreSlideIn 480ms cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};
