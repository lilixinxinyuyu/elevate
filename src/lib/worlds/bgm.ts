/**
 * v0.32.21: 奇遇乐园 BGM 系统（Web Audio 合成，零外部资源）。
 *
 * 双 CLI Ep6 一致建议 P1：音乐对情绪/沉浸感是降维打击，加上 BGM 后
 * 产品气质会瞬间蜕变。本模块实现：
 *
 *   - Ambient drone chord（3 音叠加 + 慢呼吸 LFO）作为底色
 *   - Sparkle melody（每 ~1s 弹一个高音点缀）让背景活起来
 *   - 4 店主题：store 暖 / bank 冷 / bakery 甜 / airport 现代
 *   - 渐入渐出 1.5s，避免突兀
 *   - localStorage `selena.bgm.muted` 持久化静音偏好
 *   - 跟 sfx.ts 一样，document.visibilitychange 切后台自动 suspend
 *
 * 设计哲学：极轻量"环境感"，不抢戏 — Toca/Stardew 风格 ambient，
 * 不是 EDM 节奏曲。volume 上限 0.08 防干扰口算。
 */

export interface BgmTheme {
  /** 区分主题用，相同 key 不重启 */
  key: "store" | "bank" | "bakery" | "airport";
  /** 和弦 3 音叠加（Hz） */
  padFreqs: [number, number, number];
  padType?: OscillatorType;
  /** sparkle 音符池（每 interval 随机弹一个） */
  sparkleFreqs: number[];
  sparkleType?: OscillatorType;
  /** sparkle 节奏 ms */
  sparkleIntervalMs: number;
  /** 整体音量 0..1 */
  volume?: number;
}

export const BGM_THEMES: Record<BgmTheme["key"], BgmTheme> = {
  // 小卖部：暖色 C major chord + 高音 sparkle
  store: {
    key: "store",
    padFreqs: [261.63, 329.63, 392.0], // C4 E4 G4
    padType: "sine",
    sparkleFreqs: [783.99, 880.0, 987.77, 1046.5], // G5 A5 B5 C6
    sparkleType: "triangle",
    sparkleIntervalMs: 1100,
    volume: 0.07,
  },
  // 银行：冷色 A minor + 低音 sparkle
  bank: {
    key: "bank",
    padFreqs: [220.0, 261.63, 329.63], // A3 C4 E4
    padType: "triangle",
    sparkleFreqs: [523.25, 622.25, 659.25, 784.0], // C5 D#5 E5 G5
    sparkleType: "sine",
    sparkleIntervalMs: 1400,
    volume: 0.06,
  },
  // 面包店：甜美 F major + 高甜音 sparkle
  bakery: {
    key: "bakery",
    padFreqs: [349.23, 440.0, 523.25], // F4 A4 C5
    padType: "sine",
    sparkleFreqs: [1046.5, 1174.66, 1318.51, 1396.91, 1567.98], // C6 D6 E6 F6 G6
    sparkleType: "triangle",
    sparkleIntervalMs: 900,
    volume: 0.07,
  },
  // 登机口：现代 D suspended + airy sparkle
  airport: {
    key: "airport",
    padFreqs: [293.66, 392.0, 440.0], // D4 G4 A4
    padType: "sine",
    sparkleFreqs: [587.33, 783.99, 880.0, 1046.5, 1318.51], // D5 G5 A5 C6 E6
    sparkleType: "sine",
    sparkleIntervalMs: 1000,
    volume: 0.065,
  },
};

const MUTE_KEY = "selena.bgm.muted";

interface BgmState {
  ctx: AudioContext;
  master: GainNode;
  pads: { osc: OscillatorNode; gain: GainNode }[];
  lfo: OscillatorNode | null;
  lfoGain: GainNode | null;
  intervalId: number;
  themeKey: BgmTheme["key"];
}

let state: BgmState | null = null;
let visibilityHooked = false;
let userUnlockHooked = false;

function hookVisibility() {
  if (visibilityHooked) return;
  visibilityHooked = true;
  if (typeof document === "undefined") return;
  document.addEventListener("visibilitychange", () => {
    if (!state) return;
    if (document.hidden) state.ctx.suspend().catch(() => void 0);
    else state.ctx.resume().catch(() => void 0);
  });
}

/**
 * v0.32.22（Codex Ep7 P0 fix）：浏览器 autoplay policy 限制 AudioContext
 * 必须在 user gesture（pointerdown / keydown / touchend）之后才能 resume。
 * React mount 不算 gesture — 直达 URL /worlds/baibao/store 时 BGM ctx 会
 * 一直 suspended，oscillator 不响。
 * 这里 hook 全局首次 user gesture，触发 ctx.resume()。
 */
function hookUserUnlock() {
  if (userUnlockHooked) return;
  userUnlockHooked = true;
  if (typeof document === "undefined") return;
  const unlock = () => {
    if (state && state.ctx.state === "suspended") {
      state.ctx.resume().catch(() => void 0);
    }
  };
  // passive=true 避免阻塞滚动
  document.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("touchend", unlock, { passive: true });
  document.addEventListener("keydown", unlock, { passive: true });
}

function makeCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    return new Ctor();
  } catch {
    return null;
  }
}

export function isBgmMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MUTE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setBgmMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "true" : "false");
  } catch {
    /* */
  }
  if (state) {
    state.master.gain.cancelScheduledValues(state.ctx.currentTime);
    state.master.gain.setTargetAtTime(
      muted ? 0 : 1,
      state.ctx.currentTime,
      0.2,
    );
  }
}

export function startBgm(theme: BgmTheme): void {
  if (state?.themeKey === theme.key) return; // 已是同一首
  stopBgm();

  const ctx = makeCtx();
  if (!ctx) return;
  hookVisibility();
  hookUserUnlock();
  // iOS Safari 需要 user gesture 后 resume — 若已在 gesture 内调（如 intro click）
  // 这里直接 resume；否则 hookUserUnlock 会兜底
  if (ctx.state === "suspended") ctx.resume().catch(() => void 0);

  const muted = isBgmMuted();
  const master = ctx.createGain();
  master.gain.value = muted ? 0 : 0; // 0 起步，下面 ramp 进
  master.connect(ctx.destination);

  const baseVolume = theme.volume ?? 0.07;
  // 1.5s fade in
  if (!muted) {
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
  }

  // Pad chord (3 oscillators)
  const pads = theme.padFreqs.map((freq) => {
    const osc = ctx.createOscillator();
    osc.type = theme.padType ?? "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = baseVolume;
    osc.connect(gain).connect(master);
    osc.start();
    return { osc, gain };
  });

  // LFO: 慢呼吸 (0.18 Hz) modulate pad gain ±25%
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.18;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = baseVolume * 0.25;
  lfo.connect(lfoGain);
  for (const p of pads) lfoGain.connect(p.gain.gain);
  lfo.start();

  // Sparkle interval — 每 N ms 弹一个高音点缀
  const sparkleFreqs = theme.sparkleFreqs;
  const sparkleType = theme.sparkleType ?? "triangle";
  let lastIdx = -1;
  const intervalId = window.setInterval(() => {
    if (!state) return;
    const c = state.ctx;
    if (c.state !== "running") return;
    // 不重复刚弹过的音
    let idx = Math.floor(Math.random() * sparkleFreqs.length);
    if (sparkleFreqs.length > 1 && idx === lastIdx) {
      idx = (idx + 1) % sparkleFreqs.length;
    }
    lastIdx = idx;
    const f = sparkleFreqs[idx]!;
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = sparkleType;
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(baseVolume * 0.6, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc.connect(g).connect(master);
    osc.start(now);
    osc.stop(now + 0.6);
  }, theme.sparkleIntervalMs);

  state = {
    ctx,
    master,
    pads,
    lfo,
    lfoGain,
    intervalId,
    themeKey: theme.key,
  };
}

export function stopBgm(): void {
  if (!state) return;
  const s = state;
  state = null;
  // fade out 0.8s 再停
  try {
    const now = s.ctx.currentTime;
    s.master.gain.cancelScheduledValues(now);
    s.master.gain.linearRampToValueAtTime(0, now + 0.8);
    window.clearInterval(s.intervalId);
    window.setTimeout(() => {
      try {
        for (const p of s.pads) {
          p.osc.stop();
          p.osc.disconnect();
        }
        if (s.lfo) s.lfo.stop();
        s.master.disconnect();
        s.ctx.close().catch(() => void 0);
      } catch {
        /* */
      }
    }, 900);
  } catch {
    /* */
  }
}
