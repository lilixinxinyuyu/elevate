/** 极简 Web Audio 音效 —— 无外部依赖 */
let ctx: AudioContext | null = null;
let visibilityHooked = false;

function hookVisibility() {
  if (visibilityHooked) return;
  visibilityHooked = true;
  if (typeof document === "undefined") return;
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) {
      // 页面切到后台 → 静音 audio context（修 "切 tab 后还在响" bug）
      ctx.suspend().catch(() => void 0);
    } else {
      ctx.resume().catch(() => void 0);
    }
  });
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      ctx = null;
    }
  }
  hookVisibility();
  return ctx;
}

function beep(freqs: number[], duration = 0.16, type: OscillatorType = "sine", volume = 0.15) {
  const c = getCtx();
  if (!c) return;
  // 允许浏览器在用户交互后解锁
  if (c.state === "suspended") c.resume().catch(() => void 0);
  const now = c.currentTime;
  freqs.forEach((f, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = f;
    const start = now + i * duration * 0.9;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(g).connect(c.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  });
}

export const sfx = {
  correct: () => beep([523, 784, 988], 0.14, "triangle", 0.16), // C5 G5 B5
  wrong: () => beep([220, 180], 0.18, "sawtooth", 0.1),
  hint: () => beep([392], 0.12, "square", 0.08),
  combo: () => beep([523, 659, 784, 1047], 0.12, "triangle", 0.13),
  levelUp: () => beep([523, 659, 784, 1047, 1319], 0.18, "triangle", 0.17),
  chest: () => beep([659, 988, 1319], 0.18, "triangle", 0.2),
  go: () => beep([660], 0.1, "sine", 0.12),
  tick: () => beep([880], 0.06, "sine", 0.06),
};
