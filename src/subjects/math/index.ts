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

// Phase 2 Axis 3：feature flag on 时插入"口算"tab，否则保持原 6 项不变。
// nav 是个 getter 而不是常量——保证 isPhase2Live() 切换 localStorage 后下次刷新生效。
function buildMathNavItems(): SubjectNavItem[] {
  const base: SubjectNavItem[] = [
    { to: "", label: "首页", exact: true },
    { to: "train", label: "今日挑战" },
    { to: "free-practice", label: "自由练" },
    { to: "skills", label: "技能地图" },
    { to: "mistakes", label: "错题复活" },
  ];
  if (isPhase2Live()) {
    base.push({ to: "fluency", label: "口算" });
  }
  base.push({ to: "report", label: "周报", subtle: true });
  base.push({ to: "admin", label: "管理", subtle: true });
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
