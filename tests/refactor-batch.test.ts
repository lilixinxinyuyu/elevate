/**
 * v0.35.60: 给 refactor batch (v0.35.32-59) 抽出的纯函数加单测.
 *
 * 之前各 iter 用 mcp Preview eval 手动验过 (e.g. feedbackLabels 9 cases /
 * routes 7 cases), 但没沉淀到 vitest → CI 没 coverage.
 *
 * 本测覆盖 3 个最关键的纯函数模块:
 *   - components/game/feedbackLabels.ts: buildFeedbackLabels
 *   - components/game/answerDescribe.ts: describeAnswer / describeUserAnswer
 *   - lib/routes.ts: TrainRoute build/parse + MockReportRoute
 */
import { describe, expect, it } from "vitest";
import { buildFeedbackLabels } from "../src/components/game/feedbackLabels";
import { describeAnswer, describeUserAnswer } from "../src/components/game/answerDescribe";
import { TrainRoute, MockReportRoute } from "../src/lib/routes";
import { getCapabilities, isWriteHeavyTemplate, suppressesExternalScratchTools } from "../src/core/templateCapabilities";
import { isWriteHeavyQuestion } from "../src/core/questionCapabilities";

// ─────────────────────────────────────────────────────────────────────
// feedbackLabels (P15)
// ─────────────────────────────────────────────────────────────────────

describe("buildFeedbackLabels (P15)", () => {
  it("countdown=true + lightning → ⚡⚡⚡ 闪电 +5", () => {
    const labels = buildFeedbackLabels({ isCorrect: true, speedTier: "lightning", countdownEnabled: true });
    expect(labels).toContain("⚡⚡⚡ 闪电 +5");
  });

  it("countdown=false 抑制所有 5 档速度", () => {
    for (const tier of ["lightning", "quick", "on_time", "overdue", "slow"] as const) {
      const labels = buildFeedbackLabels({ isCorrect: true, speedTier: tier, countdownEnabled: false });
      expect(labels.find((l) => l.includes("⚡") || l.includes("⏰") || l.includes("🐢"))).toBeUndefined();
    }
  });

  it("v0.35.64 P0-4: 删 overdue / slow 负反馈 (不显示 sad chip)", () => {
    const overdue = buildFeedbackLabels({ isCorrect: true, speedTier: "overdue", countdownEnabled: true });
    expect(overdue.find((l) => l.includes("⏰") || l.includes("超时"))).toBeUndefined();
    const slow = buildFeedbackLabels({ isCorrect: true, speedTier: "slow", countdownEnabled: true });
    expect(slow.find((l) => l.includes("🐢") || l.includes("拖拉"))).toBeUndefined();
  });

  it("v0.35.64 P0-4: 正向 lightning / quick / on_time 仍显示", () => {
    expect(buildFeedbackLabels({ isCorrect: true, speedTier: "lightning", countdownEnabled: true })).toContain("⚡⚡⚡ 闪电 +5");
    expect(buildFeedbackLabels({ isCorrect: true, speedTier: "quick", countdownEnabled: true })).toContain("⚡⚡ 迅速 +3");
    expect(buildFeedbackLabels({ isCorrect: true, speedTier: "on_time", countdownEnabled: true })).toContain("⚡ 及时 +2");
  });

  it("slowThink 优先于老 speedTier", () => {
    const labels = buildFeedbackLabels({ isCorrect: true, slowThink: true, speedTier: "lightning", countdownEnabled: true });
    expect(labels).toContain("🧠 深思 +5");
    expect(labels.find((l) => l.includes("⚡"))).toBeUndefined();
  });

  it("tooFast 软化文案 (不指责)", () => {
    const labels = buildFeedbackLabels({ isCorrect: true, tooFast: true, countdownEnabled: true });
    expect(labels.some((l) => l.includes("刚才很快") && l.includes("先估"))).toBe(true);
  });

  it("multi_combo (slowThink + newSkill + estimation) 顺序正确", () => {
    const labels = buildFeedbackLabels({
      isCorrect: true,
      slowThink: true,
      newSkillBonus: 5,
      estimationXp: 3,
      countdownEnabled: true,
    });
    expect(labels).toEqual([
      "🧠 深思 +5",
      "🎓 新知识点 +5",
      "🧠 估算 +3",
    ]);
  });

  it("insuredWrong → 🛡️ 草稿险 (即使答错也显示)", () => {
    const labels = buildFeedbackLabels({ isCorrect: false, insuredWrong: true, countdownEnabled: true });
    expect(labels).toContain("🛡️ 草稿险生效 — XP 不扣");
  });

  it("repeatDecay 0 → 已熟练 不再加分", () => {
    const labels = buildFeedbackLabels({ isCorrect: true, repeatDecay: 0, countdownEnabled: true });
    expect(labels).toContain("已熟练，不再加分");
  });

  it("repeatDecay 0.75 → 重做 ×75%", () => {
    const labels = buildFeedbackLabels({ isCorrect: true, repeatDecay: 0.75, countdownEnabled: true });
    expect(labels).toContain("重做 ×75%");
  });
});

// ─────────────────────────────────────────────────────────────────────
// answerDescribe (P16)
// ─────────────────────────────────────────────────────────────────────

describe("describeAnswer (P16)", () => {
  it("number → string", () => {
    expect(describeAnswer({ answer: { type: "number", value: 42 } } as never)).toBe("42");
  });

  it("choice value found → option text (no id prefix, v0.31.85 fix)", () => {
    const q = {
      answer: { type: "choice", value: "B" },
      options: [{ id: "A", text: "foo" }, { id: "B", text: "bar" }],
    } as never;
    expect(describeAnswer(q)).toBe("bar");
  });

  it("choice value not in options → fallback to value", () => {
    const q = {
      answer: { type: "choice", value: "X" },
      options: [{ id: "A", text: "foo" }],
    } as never;
    expect(describeAnswer(q)).toBe("X");
  });

  it("steps → joined string", () => {
    const q = {
      answer: { type: "steps", steps: [{ step_id: "a", expected: "1" }, { step_id: "b", expected: "2" }] },
    } as never;
    expect(describeAnswer(q)).toBe("a=1；b=2");
  });
});

describe("describeUserAnswer (P16)", () => {
  it("null → 未作答", () => {
    expect(describeUserAnswer({ options: [] } as never, null)).toBe("（未作答）");
  });
  it("undefined → 未作答", () => {
    expect(describeUserAnswer({ options: [] } as never, undefined)).toBe("（未作答）");
  });
  it("number → string", () => {
    expect(describeUserAnswer({ options: [] } as never, 7)).toBe("7");
  });
  it("string matching option.id → option text", () => {
    const q = { options: [{ id: "A", text: "apple" }] } as never;
    expect(describeUserAnswer(q, "A")).toBe("apple");
  });
  it("string not in options → raw string", () => {
    expect(describeUserAnswer({ options: [] } as never, "raw")).toBe("raw");
  });
  it("object → JSON (truncated 80)", () => {
    expect(describeUserAnswer({ options: [] } as never, { step: 1, val: 5 })).toBe('{"step":1,"val":5}');
  });
});

// ─────────────────────────────────────────────────────────────────────
// routes (P7/P13)
// ─────────────────────────────────────────────────────────────────────

describe("TrainRoute.build (P7)", () => {
  it("empty → /math/train (no garbage ?)", () => {
    expect(TrainRoute.build()).toBe("/math/train");
  });

  it("mock_exam hard=true → ?...&hard=1", () => {
    const url = TrainRoute.build({ mode: "mock_exam", fresh: 1779120000000, size: 30, hard: true });
    expect(url).toBe("/math/train?mode=mock_exam&fresh=1779120000000&size=30&hard=1");
  });

  it("mock_exam hard=false → ?...&hard=0 (explicit)", () => {
    const url = TrainRoute.build({ mode: "mock_exam", fresh: 1779120000000, size: 60, hard: false });
    expect(url).toBe("/math/train?mode=mock_exam&fresh=1779120000000&size=60&hard=0");
  });

  it("hard undefined → 不写 hard 参数", () => {
    const url = TrainRoute.build({ mode: "mock_exam", size: 30 });
    expect(url).not.toContain("hard");
  });

  it("skillIds csv encoded", () => {
    expect(TrainRoute.build({ skillIds: ["a", "b", "c"] })).toBe("/math/train?skillIds=a%2Cb%2Cc");
  });
});

describe("TrainRoute.parse (P13)", () => {
  it("valid mock_exam parses correct", () => {
    const parsed = TrainRoute.parse(new URLSearchParams("mode=mock_exam&fresh=1779120000000&size=30&hard=1"));
    expect(parsed).toEqual({ mode: "mock_exam", fresh: 1779120000000, size: 30, hard: true });
  });

  it("invalid mode (typo) → undefined", () => {
    expect(TrainRoute.parse(new URLSearchParams("mode=mocK_exaM")).mode).toBeUndefined();
  });

  it("invalid mode (invented) → undefined", () => {
    expect(TrainRoute.parse(new URLSearchParams("mode=nuke_database")).mode).toBeUndefined();
  });

  it("fractional size (30.5) → undefined (must be integer)", () => {
    expect(TrainRoute.parse(new URLSearchParams("size=30.5")).size).toBeUndefined();
  });

  it("negative size → undefined", () => {
    expect(TrainRoute.parse(new URLSearchParams("size=-10")).size).toBeUndefined();
  });

  it("zero size → undefined (must be > 0)", () => {
    expect(TrainRoute.parse(new URLSearchParams("size=0")).size).toBeUndefined();
  });

  it("non-numeric size → undefined", () => {
    expect(TrainRoute.parse(new URLSearchParams("size=30abc")).size).toBeUndefined();
  });

  it("negative fresh → undefined (must be > 0)", () => {
    expect(TrainRoute.parse(new URLSearchParams("fresh=-123")).fresh).toBeUndefined();
  });

  it("invalid fromAtelier → undefined", () => {
    expect(TrainRoute.parse(new URLSearchParams("fromAtelier=fake-realm")).fromAtelier).toBeUndefined();
  });

  it("valid fromAtelier", () => {
    expect(TrainRoute.parse(new URLSearchParams("fromAtelier=chrono-tower")).fromAtelier).toBe("chrono-tower");
  });
});

describe("MockReportRoute.build (P7)", () => {
  it("sessionId encoded", () => {
    expect(MockReportRoute.build({ sessionId: "s-abc-123" })).toBe("/math/mock-report?sessionId=s-abc-123");
  });
});

// ─────────────────────────────────────────────────────────────────────
// templateCapabilities + questionCapabilities (P1/P9/P10)
// ─────────────────────────────────────────────────────────────────────

describe("getCapabilities (P1)", () => {
  it("canvas_scratch: writeHeavy + suppressesExternalScratchTools", () => {
    const c = getCapabilities("canvas_scratch");
    expect(c.writeHeavy).toBe(true);
    expect(c.suppressesExternalScratchTools).toBe(true);
    expect(c.scoreByStepsNotSpeed).toBe(false);
  });

  it("multi_step_application: all 3 capabilities", () => {
    const c = getCapabilities("multi_step_application");
    expect(c.writeHeavy).toBe(true);
    expect(c.suppressesExternalScratchTools).toBe(true);
    expect(c.scoreByStepsNotSpeed).toBe(true);
  });

  it("plain_choice: all defaults false", () => {
    const c = getCapabilities("plain_choice");
    expect(c.writeHeavy).toBe(false);
    expect(c.suppressesExternalScratchTools).toBe(false);
    expect(c.scoreByStepsNotSpeed).toBe(false);
  });

  it("null/undefined → all defaults false", () => {
    expect(getCapabilities(null).writeHeavy).toBe(false);
    expect(getCapabilities(undefined).writeHeavy).toBe(false);
  });
});

describe("isWriteHeavyTemplate (P1)", () => {
  it("write-heavy templates", () => {
    expect(isWriteHeavyTemplate("canvas_scratch")).toBe(true);
    expect(isWriteHeavyTemplate("multi_step_application")).toBe(true);
  });
  it("default templates", () => {
    expect(isWriteHeavyTemplate("speed_match")).toBe(false);
    expect(isWriteHeavyTemplate("plain_choice")).toBe(false);
  });
});

describe("isWriteHeavyQuestion (P1)", () => {
  it("question with requiresScratch=true → write-heavy (即使 play_as=plain_numeric)", () => {
    expect(isWriteHeavyQuestion({ play_as: "plain_numeric", requiresScratch: true } as never)).toBe(true);
  });

  it("question with requiresMultiStep=true → write-heavy", () => {
    expect(isWriteHeavyQuestion({ play_as: "speed_match", requiresMultiStep: true } as never)).toBe(true);
  });

  it("play_as=canvas_scratch → write-heavy", () => {
    expect(isWriteHeavyQuestion({ play_as: "canvas_scratch" } as never)).toBe(true);
  });

  it("plain question → not write-heavy", () => {
    expect(isWriteHeavyQuestion({ play_as: "speed_match" } as never)).toBe(false);
  });
});

describe("suppressesExternalScratchTools (P9 renamed)", () => {
  it("matches getCapabilities result", () => {
    expect(suppressesExternalScratchTools("canvas_scratch")).toBe(true);
    expect(suppressesExternalScratchTools("multi_step_application")).toBe(true);
    expect(suppressesExternalScratchTools("plain_choice")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// GAME_TEMPLATE_IDS (P14 satisfies + 补 P2.5 漏的 case)
// 历史: pickPanel/templateTitle 漏 plain_numeric/dot_grid_draw/balance_lab 几个 case,
// fallback 到 "挑战" 默认值. P14 GAME_TEMPLATES satisfies + 补 case 修了.
// 这里 sanity test 防回归: 几个易漏 template 在 GAME_TEMPLATE_IDS 里.
// ─────────────────────────────────────────────────────────────────────

import { GAME_TEMPLATE_IDS, SESSION_MODE_IDS } from "../src/core/types";
import { ATELIER_REALM_IDS } from "../src/content/atelier/realms";

describe("GAME_TEMPLATE_IDS const list (P8 + P14)", () => {
  it("contains 23 templates", () => {
    expect(GAME_TEMPLATE_IDS.length).toBe(23);
  });

  it("contains previously missed templates (P2.5 fix)", () => {
    // 历史 templateTitle 漏 plain_numeric / dot_grid_draw → "挑战" 默认
    expect(GAME_TEMPLATE_IDS).toContain("plain_numeric");
    expect(GAME_TEMPLATE_IDS).toContain("dot_grid_draw");
    expect(GAME_TEMPLATE_IDS).toContain("balance_lab");
  });

  it("contains write-heavy templates", () => {
    expect(GAME_TEMPLATE_IDS).toContain("canvas_scratch");
    expect(GAME_TEMPLATE_IDS).toContain("multi_step_application");
  });
});

describe("SESSION_MODE_IDS const list (P13)", () => {
  it("contains 9 modes", () => {
    expect(SESSION_MODE_IDS.length).toBe(9);
  });

  it("contains all SessionMode union members", () => {
    for (const m of ["normal", "final_sprint", "midterm", "weak_skill", "review", "free", "skill", "mock_exam", "big_problems"]) {
      expect(SESSION_MODE_IDS).toContain(m);
    }
  });
});

describe("ATELIER_REALM_IDS const list (P13)", () => {
  it("contains 6 realms", () => {
    expect(ATELIER_REALM_IDS.length).toBe(6);
  });

  it("contains all AtelierRealmId union members", () => {
    for (const r of ["discount-street", "chrono-tower", "gem-grotto", "geo-forge", "equation-hall", "data-vault"]) {
      expect(ATELIER_REALM_IDS).toContain(r);
    }
  });
});
