/**
 * mathSubject：数学学科的 Subject 注册项。
 *
 * Phase 1 是薄包装——内容、resolveGameTemplate 全部从现有 src/content/*、
 * src/components/game/templates/resolve.ts 拿。这样数学行为零回归。
 *
 * Phase 2 会把数学专属的 grader（coerceNumber 元角分、normalizeText × ÷）、
 * scheduler（buildMidterm/buildMockExam）、trophies（decimal_x / equation_x
 * 前缀过滤）从 src/core/ 搬到这里来，让 core/ 真正学科无关。
 */

import { resolveTemplate } from "../../components/game/templates/resolve";
import { SKILLS } from "../../content/skills";
import { UNITS } from "../../content/units";
import { SEED_QUESTIONS } from "../../content/questions";
import { FINAL_SPRINT_G4B } from "../../content/examPriorities";
import { MIDTERM, FINAL } from "../../core/examDates";
import { isPhase2Live } from "../../lib/featureFlags";
import type {
  Subject,
  SubjectAbilityDef,
  SubjectNavItem,
  SubjectErrorTagDef,
} from "../types";

const MATH_ABILITIES: SubjectAbilityDef[] = [
  { id: "calculation", label: "计算力" },
  { id: "concept", label: "概念力" },
  { id: "reasoning", label: "推理力" },
  { id: "modeling", label: "建模力" },
  { id: "spatial", label: "空间力" },
  { id: "data", label: "数据力" },
  { id: "strategy", label: "策略力" },
  { id: "habit", label: "坚持力" },
];

// Phase 2 Axis 3：feature flag on 时插入"闪电口算"+"闯关"，否则保持原 5 项主 + 2
// subtle 不变。
//
// v0.31.1 命名重置（校园探险世界观）：
//   - "自由练" → "专项练"（实际就是挑薄弱 skill 集训）
//   - "技能地图" → "技能树"
//   - "口算" → "闪电口算"
//   - "大题营" → "闯关"（landing 大标题"大题闯关"，nav 用短的"闯关"）
//
// 移动底部 nav 压到 5 项（非 desktopOnly + 非 subtle）：
//   首页 / 闪电口算 / 今日挑战 / 闯关 / 错题复活
// 桌面 nav 全显示。专项练 + 技能树 移到首页 CTA 卡片让移动端可达。
// v0.31.88 / v0.31.89：nav 精简
//   - 删 "首页"（左上 logo / 学科切换器都能回首页，重复入口浪费一格）
//   - "周报" 和 "试玩台" 移到 admin tab，不在 nav 露面
//   - v0.31.89：合并 "专项练" + "技能树" → 单一 "技能图" 入口（路由仍是 /skills）
//     原 /free-practice 路由保留并 redirect 到 /skills（老链接兜底）
function buildMathNavItems(): SubjectNavItem[] {
  const base: SubjectNavItem[] = [];
  // v0.35.65 (User Flow Review P0-3 step 1, Gemini + GPT 共识):
  // 前台 mode 入口 9 → 3 (今日练 / 错题补 / 模拟考). 1 个 nav 不放 4+ tab.
  // 闯关 (big-problems) 仍可通过路由 /math/big-problems 访问 + 今日 tab 卡片入口, 但不占主 nav.
  // 闪电口算 (fluency) 保留 — 每日 60s 暖身, 跟主练分功能区分.
  if (isPhase2Live()) {
    base.push({ to: "fluency", label: "闪电口算" });
  }
  base.push({ to: "train", label: "今日挑战" });
  // 技能图 — 桌面 nav 显示；mobile 不显示（首页 CTA 接走）
  base.push({ to: "skills", label: "技能图", desktopOnly: true });
  // v0.31.91: "错题驯服" → "驯龙营"
  base.push({ to: "mistakes", label: "驯龙营" });
  return base;
}

/**
 * 错题标签字典占位。Phase 2 会把 service.ts 里的 errorTagLabel 表整张搬过来。
 * 现在留空让 Subject 接口闭合；service 那边继续走自己的字典，不读这里。
 */
const MATH_ERROR_TAGS: SubjectErrorTagDef[] = [];

export const mathSubject: Subject = {
  id: "math",
  label: "数学",
  shortLabel: "数",
  homeTagline: "和平街小学四年级 · 期中冲刺",
  themeColor: "from-violet-500 to-pink-500",
  status: { available: true },

  units: UNITS,
  skills: SKILLS,
  seedQuestions: SEED_QUESTIONS,

  abilities: MATH_ABILITIES,
  errorTags: MATH_ERROR_TAGS,
  examPriorities: FINAL_SPRINT_G4B,

  navItems: buildMathNavItems(),

  examDates: {
    midtermAt: MIDTERM.date.getTime(),
    finalAt: FINAL.date.getTime(),
  },

  resolveGameTemplate: (q) => resolveTemplate(q),
};
