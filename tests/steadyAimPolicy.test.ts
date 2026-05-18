import { describe, expect, it } from "vitest";
import {
  STEADY_AIM_XP,
  activateSteadyAim,
  deactivateSteadyAim,
  getSteadyAimDailyCounters,
  getSteadyAimXp,
  isSteadyAimActive,
} from "../src/core/steadyAimPolicy";

describe("isSteadyAimActive / activate / deactivate", () => {
  it("node env 默认 inactive", () => {
    expect(isSteadyAimActive()).toBe(false);
  });
  it("activate / deactivate 不 throw", () => {
    expect(() => activateSteadyAim()).not.toThrow();
    expect(() => deactivateSteadyAim()).not.toThrow();
  });
});

describe("getSteadyAimXp", () => {
  it("答错 → 0", () => {
    const r = getSteadyAimXp(10, 30, false);
    expect(r.bonus).toBe(0);
  });
  it("答对 + ratio 1.0 (中性) → 0", () => {
    const r = getSteadyAimXp(30, 30, true);
    expect(r.bonus).toBe(0);
    expect(r.tier).toBe("deliberate");
  });
  it("答对 + ratio 0.3 (太快) 首次 → 0 + warning (评审 B 共识首罚免扣)", () => {
    // node 没 localStorage, fastCount 永远 0 → 总是 warning
    const r = getSteadyAimXp(9, 30, true);
    expect(r.tier).toBe("too_fast");
    expect(r.bonus).toBe(0);
    expect(r.warning).toContain("免费警告");
  });
  it("答对 + ratio > 4 → 0 (AFK)", () => {
    const r = getSteadyAimXp(200, 30, true);
    expect(r.bonus).toBe(0);
    expect(r.tier).toBe("afk");
  });
  it("答对 + ratio 2.0 → +15 deep_think", () => {
    const r = getSteadyAimXp(60, 30, true);
    expect(r.bonus).toBe(STEADY_AIM_XP.DEEP_THINK_BONUS);
    expect(r.tier).toBe("deep_think");
  });
});

describe("STEADY_AIM_XP constants", () => {
  it("XP 值跟评审共识对齐", () => {
    expect(STEADY_AIM_XP.TOO_FAST_PENALTY).toBe(-5);
    expect(STEADY_AIM_XP.DEEP_THINK_BONUS).toBe(15);
    expect(STEADY_AIM_XP.DAILY_BONUS_CAP).toBe(5);
  });
});

describe("getSteadyAimDailyCounters", () => {
  it("node env 默认 0/0", () => {
    const c = getSteadyAimDailyCounters();
    expect(c.fast).toBe(0);
    expect(c.bonus).toBe(0);
    expect(c.bonusCap).toBe(5);
  });
});
