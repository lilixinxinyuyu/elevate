/**
 * v0.35.4 (iter 38 P1-3): 进制小课堂 — 微课内容硬编码.
 *
 * Selena 43% master plan P1-3. 4 节微课讲清"进制" 概念:
 *   1. 10 进制家族 (长度/重量/容量/钱)
 *   2. 60 进制家族 (时间/角度)
 *   3. 特殊进制 (天/周/月/年)
 *   4. 常错对照 ("分"在不同上下文意思不同)
 *
 * 评审共识: 不要做太重 — 卡片纯文本 + emoji + 2-3 题练习 即可. v1 教育效率优先.
 */

export type ExerciseKind = "numeric" | "judgment" | "choice";

export interface LessonExercise {
  prompt: string;
  /** 类型: numeric (输入数字) / judgment (对错按钮) / choice (多选) */
  kind?: ExerciseKind;
  /** 数字答案 (numeric/judgment 用; judgment 时 1=对 / 0=错) */
  answer: number;
  /** choice 题的选项 (A/B/C/D) */
  choices?: { label: string; value: number }[];
  /** 答案 unit (例 "厘米") */
  unit?: string;
  /** 一句话解释 (答错时显示) */
  explanation: string;
  /** 提示 (按 💡 时显示) */
  hint?: string;
}

export interface Lesson {
  id: string;
  title: string;
  icon: string;
  /** 卡片正面 — 概念讲解 (纯文本, 支持简单 markdown like **bold**) */
  conceptCard: string;
  /** 这一节的核心金句 (在卡片顶部加粗显示) */
  punchline: string;
  /** 练习题 (2-3 题) */
  exercises: LessonExercise[];
}

export const BASE_SYSTEM_LESSONS: Lesson[] = [
  {
    id: "decimal_family",
    title: "10 进制大家族 (进率 = 10)",
    icon: "🏠",
    punchline: "长度 / 重量 / 容量 / 钱 — 都按 10、100、1000 倍换!",
    conceptCard: `📏 **长度阶梯** (每级 10 倍):
1 米 ──10──→ 10 分米 ──10──→ 100 厘米 ──10──→ 1000 毫米

⚖️ **重量**: 1 吨 = 1000 千克, 1 千克 = 1000 克
🥛 **容量**: 1 升 = 1000 毫升
💰 **钱**: 1 元 = 10 角, 1 角 = 10 分 (1 元 = 100 分)

✨ **怎么换**:
- 大单位 → 小单位: 乘 10 / 100 / 1000
- 小单位 → 大单位: 除 10 / 100 / 1000

💡 数学里把这个 "10 倍" 也叫做 **进率** = **10**

⚠️ **小提醒**: 面积 / 体积 有例外!
- 1 平方米 = 100 平方分米 (不是 10)
- 1 立方米 = 1000 立方分米 (不是 10)
后面学到再讲, 现在知道一下就行.`,
    exercises: [
      {
        prompt: "5 米 = ? 厘米",
        answer: 500,
        unit: "厘米",
        explanation: "米→厘米 降两级, 乘 100. 5 × 100 = 500",
        hint: "米到厘米隔几级? 每级 10 倍",
      },
      {
        prompt: "2 千克 = ? 克",
        answer: 2000,
        unit: "克",
        explanation: "千克→克 降一级, 乘 1000. 2 × 1000 = 2000",
        hint: "千 = 1000",
      },
      {
        prompt: "30 角 = ? 元",
        answer: 3,
        unit: "元",
        explanation: "角→元 升一级, 除 10. 30 ÷ 10 = 3",
        hint: "小单位 → 大单位 用除",
      },
      {
        prompt: "1 千米 = ? 米",
        kind: "choice",
        answer: 1000,
        choices: [
          { label: "100 米", value: 100 },
          { label: "1000 米", value: 1000 },
          { label: "10 米", value: 10 },
        ],
        explanation: "1 千米 = 1000 米. '千' 字本身就 = 1000 (跟千克 = 1000 克一个道理)",
        hint: "'千' = 1000, 不管跟在啥单位后面",
      },
    ],
  },

  {
    id: "sexagesimal_family",
    title: "60 进制特殊家族 (进率 = 60)",
    icon: "⏰",
    punchline: "时间 / 角度 按 60 倍, 不是 100! 别写 1 小时 = 100 分钟!",
    conceptCard: `🕐 **时间**: 1 小时 = 60 分钟, 1 分钟 = 60 秒
📐 **角度** (五年级学): 1 度 = 60 分, 1 分 = 60 秒

⚠️ **最常错**: 1 小时 ≠ 100 分钟 (是 **60** 分钟!)

🕐 **看钟表想一想**:
\`\`\`
   12
 11    1
10  ●  2     12 个大格, 每个大格里 5 个小格
 9     3
 8     4     大 12 × 小 5 = 60 个小格 = 60 分钟
   6
\`\`\`

✨ **进率 = 60 怎么记**:
- 钟表 1 圈 = 60 个小格 = 60 分钟
- 古时候人喜欢 60 (能被 2/3/4/5/6 整除, 好算)
- 跟"我们数数用 10 进制" 是两套独立系统`,
    exercises: [
      {
        prompt: "2 小时 = ? 分钟",
        answer: 120,
        unit: "分钟",
        explanation: "时间是 60 进制! 2 × 60 = 120 分钟",
        hint: "1 小时 = 60 分钟",
      },
      {
        prompt: "180 秒 = ? 分钟",
        answer: 3,
        unit: "分钟",
        explanation: "60 进制! 180 ÷ 60 = 3 分钟",
        hint: "60 秒 = 1 分钟, 180 里有几个 60?",
      },
      {
        prompt: "1 小时 30 分钟 = ? 分钟",
        answer: 90,
        unit: "分钟",
        explanation: "1 小时 = 60 分钟, + 30 分钟 = 90 分钟",
        hint: "先把 1 小时换成分钟, 再加",
      },
      {
        prompt: "判断: 1 小时 = 100 分钟 对吗?",
        kind: "judgment",
        answer: 0, // 0 = 错
        explanation: "❌ 错的! 时间是 60 进制, 1 小时 = 60 分钟. 钟表 60 个小格不是 100",
        hint: "想想钟表 — 是 60 还是 100 个小格?",
      },
    ],
  },

  {
    id: "special_systems",
    title: "特殊进率 (天/周/月/年)",
    icon: "📅",
    punchline: "时间的'大尺度' — 进率各不同, 不是 60 也不是 10",
    conceptCard: `📅 **天/周/月/年** 进率不一样:

- 1 天 = **24** 小时 (进率 24, 钟表转两圈)
- 1 周 = **7** 天 (进率 7)
- 1 月: **大月 31 天 / 小月 30 天 / 2 月 28-29 天** (不固定!)
- 1 年 = **12** 个月, 平年 **365** 天, 闰年 **366** 天

⚠️ **注意**: 月/年的天数**不是固定**进率! 不同月份不一样.
- 大月 (31 天): 1, 3, 5, 7, 8, 10, 12 月 (七大月)
- 小月 (30 天): 4, 6, 9, 11 月
- 2 月: 平年 28, 闰年 29

✨ **怎么记**:
- 一天 = 早+晚, 钟表转两圈 (12+12)
- 一周 7 天 = 一/二/三/四/五/六/日
- 一年 12 月跟手指数关联 (拇指 + 4 指 × 3 = 12)`,
    exercises: [
      {
        prompt: "1 天 = ? 小时",
        answer: 24,
        unit: "小时",
        explanation: "1 天 = 24 小时 (上午 12 + 下午 12)",
        hint: "钟表转两圈 = 一天",
      },
      {
        prompt: "2 周 = ? 天",
        answer: 14,
        unit: "天",
        explanation: "1 周 = 7 天, 2 × 7 = 14",
        hint: "一周 7 天",
      },
    ],
  },

  {
    id: "confusing_units",
    title: "常错对照 — 三个 '分' 不一样",
    icon: "🚨",
    punchline: "时间的'分钟' / 长度的'分米' / 钱的'分' — 进制完全不同!",
    conceptCard: `🚨 **同一个"分"字, 意思完全不同!**

- 时间的 **"分钟"** — 60 进制 (1 小时 = 60 分钟)
- 长度的 **"分米"** — 10 进制 (1 米 = 10 分米)
- 钱的 **"分"** — 10 进制 (1 角 = 10 分, 1 元 = 100 分)

✨ **怎么判**: 看上下文!
- "1 元 = ? 分" → 钱的 "分", 答 **100**
- "1 小时 = ? 分" → 时间的 "分钟", 答 **60**
- "1 米 = ? 分" → 长度的 "分米", 答 **10**`,
    exercises: [
      {
        prompt: "1 元 = ? 分 (钱的分)",
        answer: 100,
        unit: "分",
        explanation: "钱: 1 元 = 10 角 = 100 分 (10 进制)",
        hint: "钱是 10 进制, 1 元 = 10 角, 1 角 = 10 分",
      },
      {
        prompt: "1 小时 = ? 分 (时间的分钟)",
        answer: 60,
        unit: "分钟",
        explanation: "时间 60 进制! 1 小时 = 60 分钟",
        hint: "看钟表, 60 个小格",
      },
      {
        prompt: "1 米 = ? 分 (长度的分米)",
        answer: 10,
        unit: "分米",
        explanation: "长度 10 进制, 1 米 = 10 分米",
        hint: "米 → 分米 只差一级, 乘 10",
      },
    ],
  },
];

export interface LessonProgress {
  lessonId: string;
  completedExercises: number;
  totalExercises: number;
  /** 完成时间戳 */
  completedAt?: number;
}

const PROGRESS_LS_KEY = "base_system_lesson_progress";

export function loadLessonProgress(): Record<string, LessonProgress> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PROGRESS_LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLessonProgress(lessonId: string, completed: number, total: number): void {
  if (typeof window === "undefined") return;
  try {
    const all = loadLessonProgress();
    all[lessonId] = {
      lessonId,
      completedExercises: completed,
      totalExercises: total,
      completedAt: completed >= total ? Date.now() : undefined,
    };
    localStorage.setItem(PROGRESS_LS_KEY, JSON.stringify(all));
  } catch { /* noop */ }
}

export function isLessonComplete(lessonId: string): boolean {
  const all = loadLessonProgress();
  const p = all[lessonId];
  return !!p && p.completedExercises >= p.totalExercises;
}

export function areAllLessonsComplete(): boolean {
  return BASE_SYSTEM_LESSONS.every((l) => isLessonComplete(l.id));
}

/** XP 奖励常量 */
export const BASE_SYSTEM_XP = {
  EXERCISE_CORRECT: 3,         // 单题对 +3
  LESSON_COMPLETE: 10,          // 完成一节练习 (全对) +10
  ALL_LESSONS_COMPLETE: 20,     // 全部 4 节完成 +20 trophy bonus
} as const;
