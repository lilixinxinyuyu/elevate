import { db } from "./dexie";
import { UNITS } from "../content/units";
import { SKILLS } from "../content/skills";
import { SEED_QUESTIONS } from "../content/questions";
import { validateQuestion } from "../core/validateQuestion";
import type { Question, StudentProfile } from "../core/types";

// v0.31.68 (SEED_VERSION 23)：之前几次往 SEED_QUESTIONS 加 pack（GAP_FILL_PACK_G4B_V2/V3
// + AI_GEN_G4B_PACK 等）+ genQuickSet 扩充时漏 bump。已有设备 (Bruce) 的 Dexie 仍是 v22 数据
// → admin UI "题量" 比 audit 少很多。bump 到 23 让所有设备 boot 时 bulkPut 重 upsert
// 全量 SEED（不影响 ai_questions / mistakes / attempts）。
//
// v0.30.14 (SEED_VERSION 21)：v0.30.12 加了 aiGenG4B_U14_Pack（60 道 G4B U1-U4
// 弱 skill 题）进 SEED_QUESTIONS，但忘了 bump SEED_VERSION，导致已有 IndexedDB
// 的现有设备 ensureSeeded() early-return，新题永远进不来。现在 bump 到 21 让
// 现有设备重新跑一遍 bulkPut，60 道新题 upsert 进库。
// 同时 v0.30.14 加 orphan-mistakes cleanup：清掉 questionId 已不存在的错题记录
// （之前 admin 删题没同步删 mistake 行，导致错题列表大量 [题目已移除]）。
//
// 历史：v0.28.3 (SEED_VERSION 20)：重写 7 道用 "输 N" 指令式说法的题改成自然
// 中文 "答 N"，同时补 8 道 decimal_compare 高质量题。
// v0.31.0 Phase 2 Axis 2：加 DOT_GRID_DEMO_PACK 5 道点子图画图题，bump 版本让现有
// 用户也下载到（5/8 道画图题型起步）。
// v0.35.26 (爸爸第 2 次反馈 reflective): 强制再 reload 一次, 让所有老 IndexedDB
// 拿到最新的 metadata + 新加的 admin nav 删除. SEED 仅 questions 相关, 但 bump
// 也确保用户拿到新构建 (浏览器 cache + service worker 都不会 stale 太久).
const SEED_VERSION = 25;
const SEED_KEY = "seedVersion";
const AGENT_PULL_KEY = "agentQuestionsPulledAt";
const AGENT_PULL_INTERVAL = 60 * 60 * 1000; // 每小时最多拉一次 agent 题

/**
 * v0.29.4 题清理跨设备同步机制
 *
 * 问题：seed.ts 每次启动都 bulkPut(SEED_QUESTIONS)，把 720 道 seed 全部 upsert 回来。
 * 用户在 admin 删的题下次开 app 自动复活。导致：
 *   - 设备 A 清到 431 → 下次开 app 又回到 720
 *   - 即使 push 到云，B 设备拉下来也是 720（因为同样的 seed 重塞）
 *
 * 修法：用 meta:deletedQuestionIds 记录被删的 question_id 列表。
 *   - admin 清理时：append 删除 ID 到这个列表
 *   - seed.ts bulkPut：filter 掉列表里的 ID（不再复活）
 *   - agent pull：同 filter
 *   - app boot：把 db 里仍存在但属于 deletedQuestionIds 的删掉（B 设备同步后立刻生效）
 *   - meta 已经被 cloudSync 同步 → 删除列表自动跨设备
 */
const DELETED_QIDS_KEY = "deletedQuestionIds";

export async function getDeletedQuestionIds(): Promise<Set<string>> {
  const meta = await db.meta.get(DELETED_QIDS_KEY);
  const arr = Array.isArray(meta?.value) ? (meta.value as string[]) : [];
  return new Set(arr);
}

/** 添加 IDs 到删除列表。同时立刻从 db.questions 删掉（如果还在），
 *  并删掉 db.mistakes 里引用这些题的所有错题行（避免变孤儿） */
export async function recordDeletedQuestionIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const cur = await getDeletedQuestionIds();
  for (const id of ids) cur.add(id);
  await db.meta.put({ key: DELETED_QIDS_KEY, value: Array.from(cur) });
  // 真删掉（如果还在）
  await db.questions.bulkDelete(ids);
  // v0.31.16: 同步删掉引用这些题的错题行，否则会变孤儿（错题复活页 "[题目已移除]"）
  const idSet = new Set(ids);
  const orphanMistakeIds = (await db.mistakes.toArray())
    .filter((m) => idSet.has(m.questionId))
    .map((m) => m.id);
  if (orphanMistakeIds.length > 0) {
    await db.mistakes.bulkDelete(orphanMistakeIds);
  }
}

/** seed/agent pull 用：从一组 questions 里过滤掉已删除的 */
function filterDeleted<T extends { question_id?: string }>(qs: T[], deletedIds: Set<string>): T[] {
  if (deletedIds.size === 0) return qs;
  return qs.filter((q) => !deletedIds.has(q.question_id ?? ""));
}

/** app boot：把 db 里仍存在但属于 deletedQuestionIds 的删掉（同步后 B 设备立刻生效） */
async function applyPendingDeletions(): Promise<void> {
  const deleted = await getDeletedQuestionIds();
  if (deleted.size === 0) return;
  const all = await db.questions.toCollection().primaryKeys() as string[];
  const toDelete = all.filter((id) => deleted.has(id));
  if (toDelete.length > 0) {
    await db.questions.bulkDelete(toDelete);
    console.log(`[deletedQuestionIds] applied ${toDelete.length} pending deletion(s)`);
  }
}

/**
 * v0.29.6 一次性回填：v0.29.4 之前的清理操作没记进 deletedQuestionIds，
 * 导致 A 设备清的题不能跨设备同步。
 *
 * 推断方法：
 *   - SEED_QUESTIONS 是代码里硬编码的全部静态题
 *   - 任何 SEED 题如果在本地 db.questions 里没有，**只能是被 admin 删掉了**
 *     （seed 启动时 bulkPut 是 upsert，否则它一定会塞回来）
 *   - 所以：SEED 在代码里 \\ 本地缺失的 = 历史删除集合
 *
 * 把这些 ID 补进 deletedQuestionIds，下次 sync push 就能传给其他设备。
 *
 * 用 meta:deletedQuestionIdsBackfilledAt 标记防重复执行。
 *
 * 注意：这个 backfill 只识别 SEED 题；本地 AI 生成的题如果被删了，
 * 现在没法回溯（因为不知道哪些 AI 题"应该存在"）。但 v0.29.4 起新的 admin 删
 * 都会正确记录，所以这是一次性补丁。
 */
const DELETED_BACKFILL_KEY = "deletedQuestionIdsBackfilledAt";
async function backfillDeletedQuestionIdsFromSeed(): Promise<void> {
  const meta = await db.meta.get(DELETED_BACKFILL_KEY);
  if (meta?.value) return; // 已经做过

  const localKeys = (await db.questions.toCollection().primaryKeys()) as string[];
  const localSet = new Set(localKeys);

  // v0.31.0 修：localSet 完全空意味着是新装设备/preview 环境，不是"删过题"——
  // 这种情况下不应该把整个 SEED 都打成"已删除"。直接 stamp 一下标记跳过。
  if (localSet.size === 0) {
    await db.meta.put({ key: DELETED_BACKFILL_KEY, value: Date.now() });
    return;
  }

  const seedIdsMissing: string[] = [];
  for (const q of SEED_QUESTIONS) {
    if (q.question_id && !localSet.has(q.question_id)) {
      seedIdsMissing.push(q.question_id);
    }
  }

  if (seedIdsMissing.length === 0) {
    // 本地有所有 SEED → 用户没删过，纯 sync 上来的 deletedQuestionIds 已经覆盖
    await db.meta.put({ key: DELETED_BACKFILL_KEY, value: Date.now() });
    return;
  }

  // 与现有 deletedQuestionIds 合并
  const cur = await getDeletedQuestionIds();
  for (const id of seedIdsMissing) cur.add(id);
  await db.meta.put({ key: DELETED_QIDS_KEY, value: Array.from(cur) });
  await db.meta.put({ key: DELETED_BACKFILL_KEY, value: Date.now() });
  console.log(
    `[deletedQuestionIds backfill] inferred ${seedIdsMissing.length} historical deletions from SEED diff (总表 ${cur.size})`,
  );
}

/**
 * v0.26.3 起 seed 题统一 stamp subjectId="math"。
 * UNITS / SKILLS 也同样 stamp（之前 schema 加了字段但没填值）。
 */
function stampMathSubject<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((r) => ({ ...r, subjectId: r.subjectId ?? "math" }));
}

/**
 * 清掉 questionId 已不存在于 questions 表的孤儿 mistake 行。
 *
 * 背景：admin 清理 / seed 改版把题删了，但 mistakes 表里的 questionId 还引用
 * 着旧 ID。错题复活页面渲染时找不到题，统一显示 "[题目已移除]"。
 *
 * v0.31.16 升级：取消 meta 一次性 gate，改成每次启动 + 每次 pull 后都跑。
 * 原因：cloudSync.applyPayloadMerged 对 mistakes 走 union-by-id 合并，
 * 已清掉的孤儿会被云端旧快照重新合回本地（甚至跨设备 ping-pong）。
 * 一次性 cleanup 只能挡住单次启动，挡不住 pull-merge 把它们再拉回来。
 *
 * 性能：O(N) 集合差集，Selena ≈ 100 行级别，每次启动跑一次零成本。
 *
 * 安全性：只删 questionId 不在 questions 表的 mistakes 行，已有题的全保留。
 *
 * @returns 删掉的孤儿数（用于决定要不要 push 回云端）
 */
export async function cleanupOrphanMistakes(): Promise<number> {
  try {
    const allQids = (await db.questions.toCollection().primaryKeys()) as string[];
    if (allQids.length === 0) {
      // questions 表还没 seed，跳过——否则会把全部 mistakes 当孤儿删掉
      return 0;
    }
    const qidSet = new Set(allQids);
    const allMistakes = await db.mistakes.toArray();
    const orphanIds = allMistakes
      .filter((m) => !qidSet.has(m.questionId))
      .map((m) => m.id);

    if (orphanIds.length > 0) {
      await db.mistakes.bulkDelete(orphanIds);
      console.log(`[orphanMistakes] cleaned ${orphanIds.length} mistake row(s) with missing question`);
    }
    return orphanIds.length;
  } catch (e) {
    console.warn("[cleanupOrphanMistakes] failed:", e);
    return 0;
  }
}

export async function ensureSeeded(): Promise<void> {
  const existing = await db.meta.get(SEED_KEY);
  const hasQuestions = await db.questions.count();

  // v0.29.4: 先把 deletedQuestionIds 里仍存在的题再删一遍（B 设备同步后立刻生效）
  await applyPendingDeletions().catch((e) => console.warn("[applyPendingDeletions]", e));

  // v0.29.6: 回填历史 admin 清理（v0.29.4 前的清理没记进 deletedQuestionIds，
  // 推断为 "SEED 在代码里 \\ 本地缺失" 的差集，让老删除可以跨设备同步）
  await backfillDeletedQuestionIdsFromSeed().catch((e) =>
    console.warn("[backfillDeletedQuestionIdsFromSeed]", e),
  );

  // v0.29.5: 一次性把过大的勋章图压缩（之前 ~7MB/张 → ~50KB/张，让 sync 不爆）
  void (async () => {
    try {
      const { migrateCompressOversizedTrophyImages } = await import("../lib/trophyImages");
      const r = await migrateCompressOversizedTrophyImages();
      if (r && r.processed > 0) {
        console.log(`[trophyImages] compressed ${r.processed} oversized image(s), freed ~${r.freedMb.toFixed(1)} MB`);
      }
    } catch (e) {
      console.warn("[trophyImages compress migration] failed:", e);
    }
  })();

  // 即使 seed 已最新，也要跑 v7 迁移（一次性，幂等）
  if (existing?.value === SEED_VERSION && hasQuestions > 0) {
    pullAgentQuestionsIfStale().catch(() => {});
    migrateAttemptScoresV7().catch((e) => console.warn("[migrate v7] failed:", e));
    // v19 一次性补 stamp（即使 seed 没动也跑）
    void backfillMissingSubjectIds().catch(() => {});
    // v0.31.16: 每次启动都清孤儿（幂等，O(N)）。
    // 原因：cloud sync union-merge 会把别处仍存在的孤儿合回来。
    void cleanupOrphanMistakes();
    // v0.31.32: 应用 admin 用 AI 修过的 question patches（meta::questionPatches，跨设备同步）
    void (async () => {
      try {
        const { applyPendingQuestionPatches } = await import("../lib/qualityJudge");
        const n = await applyPendingQuestionPatches();
        if (n > 0) console.log(`[questionPatches] applied ${n} fix(es) from meta`);
      } catch (e) {
        console.warn("[applyPendingQuestionPatches] failed:", e);
      }
    })();
    return;
  }

  // v0.29.4: 拿到当前删除列表，bulkPut 时跳过这些 id（不让被删的题复活）
  const deletedIds = await getDeletedQuestionIds();

  await db.transaction("rw", [db.units, db.skills, db.questions, db.students, db.meta], async () => {
    // v19: stamp subjectId="math" on all seed rows（之前没 stamp 导致 admin 诊断
    // 显示 720/720 都是 undef）
    await db.units.bulkPut(stampMathSubject(UNITS as unknown as Record<string, unknown>[]) as never);
    await db.skills.bulkPut(stampMathSubject(SKILLS as unknown as Record<string, unknown>[]) as never);

    const ok: typeof SEED_QUESTIONS = [];
    const bad: { id: string; issues: string[] }[] = [];
    for (const q of SEED_QUESTIONS) {
      const r = validateQuestion(q);
      if (r.ok && r.question) ok.push(r.question);
      else bad.push({ id: q.question_id, issues: r.issues.map((i) => `${i.severity}: ${i.path} ${i.message}`) });
    }
    if (bad.length > 0) {
      console.warn("[seed] 以下题目校验失败，未导入：", bad);
    }
    // v0.29.4: 过滤掉 deletedQuestionIds 里的（不复活已删除的题）
    const filtered = filterDeleted(ok as unknown as Array<{ question_id?: string }>, deletedIds);
    await db.questions.bulkPut(stampMathSubject(filtered as Record<string, unknown>[]) as never);

    const existing = await db.students.get("default-student");
    const now = Date.now();
    if (!existing) {
      const defaultStudent: StudentProfile = {
        id: "default-student",
        name: "Selena",
        grade: 4,
        textbook: "BNU_2013_G4",
        currentTerm: "下册",
        currentUnitId: "G4B_U3_DECIMAL_MULTIPLY",
        dailyLimitMin: 15,
        createdAt: now,
        updatedAt: now,
      };
      await db.students.put(defaultStudent);
    } else if (existing.name === "小禾") {
      // 升级到 v2 后默认名改为 Selena
      await db.students.put({ ...existing, name: "Selena", updatedAt: now });
    }

    await db.meta.put({ key: SEED_KEY, value: SEED_VERSION });
  });

  // seed 完后顺手拉一次 agent 题（不阻塞首屏）
  pullAgentQuestionsIfStale().catch(() => {/* 网络问题 / 后端没启都不报 */});

  // v7：检查是否需要按新规则迁移历史 attempts 的 XP（一次性）
  migrateAttemptScoresV7().catch((e) => console.warn("[migrate v7] failed:", e));

  // v19: backfill subjectId
  void backfillMissingSubjectIds().catch(() => {});

  // v0.30.14: 清孤儿 mistake（在 seed bulkPut 之后跑，让新加进来的题
  // 能 "救活" 一些旧 mistake 行）
  void cleanupOrphanMistakes();

  // v0.31.32: 应用 admin 用 AI 修过的 question patches —— 必须在 SEED bulkPut 之后跑，
  // 否则会被 SEED 原版盖回去
  void (async () => {
    try {
      const { applyPendingQuestionPatches } = await import("../lib/qualityJudge");
      const n = await applyPendingQuestionPatches();
      if (n > 0) console.log(`[questionPatches] applied ${n} fix(es) from meta`);
    } catch (e) {
      console.warn("[applyPendingQuestionPatches] failed:", e);
    }
  })();

  // v0.31.35: 一次性 migration —— 修 v0.31.33 那批 fill_blank 重分类后 game_type
  // 还指向 "plain_choice" 导致 admin 判损坏的题（约 42 道）。
  // 找有 "format_reclassified" tag + question_format=="fill_blank" + game_type
  // 仍是 plain_choice/single_choice 等 option-based 的，把 play_as / game_type
  // 改成 plain_numeric / speed_calc，让 admin 正确识别。
  void fixFillBlankGameType();
}

/**
 * v0.31.37: 不再用 meta key gating + tag 过滤 —— 每次 boot 扫一遍 db.questions，
 * 任何 fill_blank 题但 play_as/game_type 还指向 option-based 模板的统统修。
 *
 * 之前 v0.31.35 加的 `format_reclassified` tag 过滤导致跨设备同步过来没 tag 的题
 * 修不到（用户看到 42 道仍判损坏）。现在直接按"症状"扫，谁坏修谁，O(n) 就过一遍
 * 没坏的早 continue。
 */
async function fixFillBlankGameType(): Promise<void> {
  try {
    const optionBased = new Set([
      "plain_choice", "single_choice", "multi_choice",
      "true_false_swipe", "true_false", "clue_finder", "plain_choice_visual",
    ]);
    const isBroken = (fmt: string, pa: string, gt: string): boolean => {
      if (fmt !== "fill_blank") return false;
      // play_as 或 game_type 在 option-based 集合里 → 损坏
      if (optionBased.has(pa)) return true;
      if (optionBased.has(gt)) return true;
      return false;
    };

    // 1. 修 db.questions
    const allQs = await db.questions.toArray();
    const toUpdate: typeof allQs = [];
    for (const q of allQs) {
      const fmt = (q.question_format ?? "") as string;
      const pa = (q.play_as ?? "") as string;
      const gt = (q.game_type ?? "") as string;
      if (isBroken(fmt, pa, gt)) {
        toUpdate.push({ ...q, play_as: "plain_numeric", game_type: "speed_calc" });
      }
    }
    if (toUpdate.length > 0) {
      await db.questions.bulkPut(toUpdate);
    }

    // 2. 修 meta::questionPatches（跨设备同步源头）
    const patchesRow = await db.meta.get("questionPatches");
    if (patchesRow && typeof patchesRow.value === "object" && patchesRow.value !== null) {
      const map = patchesRow.value as Record<string, { question_format?: string; play_as?: string; game_type?: string; [k: string]: unknown }>;
      let touched = false;
      for (const [qid, q] of Object.entries(map)) {
        const fmt = (q.question_format ?? "") as string;
        const pa = (q.play_as ?? "") as string;
        const gt = (q.game_type ?? "") as string;
        if (isBroken(fmt, pa, gt)) {
          map[qid] = { ...q, play_as: "plain_numeric", game_type: "speed_calc" };
          touched = true;
        }
      }
      if (touched) {
        await db.meta.put({ key: "questionPatches", value: map });
      }
    }

    if (toUpdate.length > 0) {
      console.log(`[fillBlankGameTypeFix] 修了 ${toUpdate.length} 道 fill_blank 题`);
    }
  } catch (e) {
    console.warn("[fillBlankGameTypeFix] failed:", e);
  }
}

/**
 * v19 一次性补 stamp：把所有 subjectId=null/undef 的题/skill/unit 标成 "math"。
 *
 * 背景：seed.ts v7-v18 期间 db.questions.bulkPut(SEED_QUESTIONS) 没填 subjectId，
 * 而 dexie v2 migration 只在升级时跑一次。如果用户先升级、后从 cloud 拉新 seed，
 * 这些 row 就永远 undef。诊断面板显示 720/720 都是 undef 就是这个 bug。
 */
const BACKFILL_KEY = "subjectIdBackfill_v19";
async function backfillMissingSubjectIds(): Promise<void> {
  const meta = await db.meta.get(BACKFILL_KEY);
  if (meta?.value === true) return;
  let touched = 0;
  const stamp = (row: { subjectId?: string }) => {
    if (!row.subjectId) {
      row.subjectId = "math";
      touched++;
    }
  };
  await db.transaction("rw", [db.questions, db.skills, db.units, db.meta], async () => {
    await db.questions.toCollection().modify(stamp);
    await db.skills.toCollection().modify(stamp);
    await db.units.toCollection().modify(stamp);
    await db.meta.put({ key: BACKFILL_KEY, value: true });
  });
  if (touched > 0) {
    console.log(`[backfill v19] stamped subjectId=math on ${touched} rows`);
  }
}

/**
 * v7 计分规则迁移：把历史 attempts 的 scoreDelta.total 按新规则重算。
 * - 重做递减：每个 questionId 第 N 次答对乘 [1.0, 0.5, 0.2, 0.1, 0]
 * - 新 skill 首次答对 +5
 *
 * 用 meta.scoreVersion 标记，跑过一次就不再跑。
 */
const SCORE_VERSION_KEY = "scoreVersion";
const SCORE_VERSION_V7 = "v7-repeat-decay-new-skill-bonus";
const MIGRATION_NOTICE_KEY = "v7MigrationNoticeAcked";

export async function migrateAttemptScoresV7(): Promise<{ migrated: number; oldTotalXp: number; newTotalXp: number } | null> {
  const meta = await db.meta.get(SCORE_VERSION_KEY);
  if (meta?.value === SCORE_VERSION_V7) return null;

  const REPEAT_DECAY = [1.0, 0.5, 0.2, 0.1];
  const NEW_SKILL_BONUS = 5;

  const allAttempts = (await db.attempts.toArray()).sort((a, b) => a.createdAt - b.createdAt);
  if (allAttempts.length === 0) {
    await db.meta.put({ key: SCORE_VERSION_KEY, value: SCORE_VERSION_V7 });
    return { migrated: 0, oldTotalXp: 0, newTotalXp: 0 };
  }

  const correctOnQuestion = new Map<string, number>();
  const correctOnSkill = new Set<string>();
  let oldTotalXp = 0;
  let newTotalXp = 0;

  for (const attempt of allAttempts) {
    oldTotalXp += attempt.scoreDelta?.total ?? 0;
    if (attempt.isCorrect) {
      const studentSkillKey = `${attempt.studentId}::${attempt.skillId}`;
      const studentQKey = `${attempt.studentId}::${attempt.questionId}`;
      const priorCorrect = correctOnQuestion.get(studentQKey) ?? 0;
      const decay = priorCorrect >= REPEAT_DECAY.length ? 0 : REPEAT_DECAY[priorCorrect] ?? 0;

      const isFirstSkillCorrect = !correctOnSkill.has(studentSkillKey);

      // 把原 total 乘 decay（原始公式没有 decay，所以原 total 就是"无 decay 的全分"）
      const decayed = Math.max(0, Math.round((attempt.scoreDelta?.total ?? 0) * decay));
      const bonus = isFirstSkillCorrect ? NEW_SKILL_BONUS : 0;
      const newTotal = decayed + bonus;

      attempt.scoreDelta = { ...attempt.scoreDelta, total: newTotal };
      newTotalXp += newTotal;

      correctOnQuestion.set(studentQKey, priorCorrect + 1);
      if (isFirstSkillCorrect) correctOnSkill.add(studentSkillKey);
    } else {
      // 错答不变
      newTotalXp += attempt.scoreDelta?.total ?? 0;
    }
  }

  // bulk update
  await db.transaction("rw", [db.attempts, db.meta, db.students], async () => {
    for (const a of allAttempts) {
      await db.attempts.put(a);
    }
    await db.meta.put({ key: SCORE_VERSION_KEY, value: SCORE_VERSION_V7 });
    await db.meta.put({ key: MIGRATION_NOTICE_KEY, value: false });
    // 更新所有学生的 totalXp
    const students = await db.students.toArray();
    for (const stu of students) {
      const studentXp = allAttempts
        .filter((a) => a.studentId === stu.id)
        .reduce((s, a) => s + (a.scoreDelta?.total ?? 0), 0);
      await db.meta.put({ key: `totalXp::${stu.id}`, value: studentXp });
    }
  });

  console.log(`[migrate v7] ${allAttempts.length} attempts: ${oldTotalXp} → ${newTotalXp} XP`);
  return { migrated: allAttempts.length, oldTotalXp, newTotalXp };
}

export async function getMigrationNoticeUnacked(): Promise<boolean> {
  const r = await db.meta.get(MIGRATION_NOTICE_KEY);
  return r?.value === false;
}

export async function ackMigrationNotice(): Promise<void> {
  await db.meta.put({ key: MIGRATION_NOTICE_KEY, value: true });
}

/**
 * 拉 agent 出的题（/api/agent/questions）合并到本地题库。
 * 每小时拉一次。失败静默：app 主体不依赖这个。
 */
export async function pullAgentQuestionsIfStale(force = false): Promise<{ added: number; skipped: number } | null> {
  try {
    const last = await db.meta.get(AGENT_PULL_KEY);
    const lastTs = typeof last?.value === "number" ? (last.value as number) : 0;
    if (!force && Date.now() - lastTs < AGENT_PULL_INTERVAL) return null;

    const resp = await fetch("/api/agent/questions");
    if (!resp.ok) return null;
    const data = (await resp.json()) as { ok: boolean; questions?: Question[] };
    if (!data.ok || !Array.isArray(data.questions)) return null;

    // v0.29.4: 过滤掉已删除的题（A 设备 admin 删的题不应被 agent pull 复活）
    const deletedIds = await getDeletedQuestionIds();

    let added = 0;
    let skipped = 0;
    const accepted: Question[] = [];
    for (const q of data.questions) {
      if (deletedIds.has(q.question_id)) {
        skipped += 1;
        continue;
      }
      const r = validateQuestion(q);
      if (r.ok && r.question) {
        accepted.push(r.question);
        added += 1;
      } else {
        skipped += 1;
      }
    }
    if (accepted.length > 0) {
      await db.questions.bulkPut(accepted);
    }
    await db.meta.put({ key: AGENT_PULL_KEY, value: Date.now() });
    if (added > 0) {
      console.log(`[seed] pulled ${added} agent question(s); skipped ${skipped}`);
    }
    return { added, skipped };
  } catch (e) {
    console.warn("[seed] agent question pull failed", e);
    return null;
  }
}

export async function resetAllData(): Promise<void> {
  await db.delete();
  window.location.reload();
}

/**
 * 只清空"进度数据"：sessions / attempts / mastery / mistakes / trophies / xp meta
 * 题库（units / skills / questions）和学生档案保留不动。
 * 用于一键擦掉测试时积累的脏数据，重新开始挑战。
 */
export async function resetProgressOnly(): Promise<void> {
  await db.transaction(
    "rw",
    [db.sessions, db.attempts, db.mastery, db.mistakes, db.trophies, db.meta],
    async () => {
      await db.sessions.clear();
      await db.attempts.clear();
      await db.mastery.clear();
      await db.mistakes.clear();
      await db.trophies.clear();
      // 把所有 totalXp:: 开头的 meta 也清掉
      const metaRows = await db.meta.toArray();
      const xpKeys = metaRows.filter((r) => r.key.startsWith("totalXp::")).map((r) => r.key);
      if (xpKeys.length > 0) await db.meta.bulkDelete(xpKeys);
    },
  );
}
