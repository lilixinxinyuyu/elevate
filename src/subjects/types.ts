/**
 * 多学科架构 Phase 1：学科注册表的类型定义。
 *
 * 一个 Subject = 一门学科的所有静态配置（内容包、ability 维度、错题标签字典、
 * 导航项、主题色、状态等）。运行期通过 useSubject() 注入；服务层 / DB 写入时
 * 用 subject.id 给数据打标。
 *
 * 本阶段（Phase 1）：math 是 thin wrapper（re-export src/content/*）；chinese
 * 是 skeleton（content 全空，状态卡 "建设中"）。深度去耦合（搬 grader/scheduler
 * 等数学味道的代码进 subjects/math/）排到 Phase 2 期中后做。
 */

import type {
  CurriculumUnit,
  ExamPriorityItem,
  GameTemplate,
  Question,
  Skill,
  SubjectId,
} from "../core/types";

/**
 * SubjectId 现在定义在 core/types.ts，从这里 re-export 方便 subjects/* 内部使用。
 * 为什么放 core/：避免 subjects/ 和 core/ 互相 import（subjects/ 已经依赖 core/）。
 */
export type { SubjectId };

export interface SubjectStatus {
  /** 是否允许进入。false 时 SubjectShell 会强制 ComingSoon。 */
  available: boolean;
  /** 卡片角标 / ComingSoon 顶上的提示。 */
  comingSoonLabel?: string;
  /** 预计开放时间，epoch ms；ComingSoon 倒计时用。 */
  releaseAt?: number;
}

export interface SubjectNavItem {
  /** 相对路径，挂在 /:subject/ 下面。空串 = 学科首页。 */
  to: string;
  label: string;
  /** 等同 NavLink 的 end 属性 */
  exact?: boolean;
  /** 暗色弱化（管理之类） */
  subtle?: boolean;
}

export interface SubjectAbilityDef {
  id: string;
  label: string;
}

export interface SubjectErrorTagDef {
  tag: string;
  label: string;
  remediationHint?: string;
}

export interface SubjectExamDates {
  midtermAt?: number;
  finalAt?: number;
}

export interface Subject {
  id: SubjectId;
  /** 中文显示名 "数学" "语文" */
  label: string;
  /** 单字胶囊 "数" "语" */
  shortLabel: string;
  /** 一句标语，picker 卡片上 */
  homeTagline: string;
  /** Tailwind 渐变 class，例如 "from-violet-500 to-pink-500" */
  themeColor: string;
  status: SubjectStatus;

  // 内容（静态导入；空数组也合法）
  units: CurriculumUnit[];
  skills: Skill[];
  seedQuestions: Question[];

  // 维度 / 标签
  abilities: SubjectAbilityDef[];
  errorTags: SubjectErrorTagDef[];
  examPriorities: ExamPriorityItem[];

  // 导航
  navItems: SubjectNavItem[];

  // 日历
  examDates?: SubjectExamDates;

  // 渲染策略：题 → 模板。Phase 1 math 复用现有 resolveTemplate；chinese 暂回 plain_choice。
  resolveGameTemplate: (q: Question) => GameTemplate;
}
