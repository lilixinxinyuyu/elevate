/**
 * v0.35.96 — Sprint C3: 🐉 病句龙训 (Sentence Dragon) Chinese cluster prototype.
 *
 * Chinese Cluster 3/7. 覆盖 病句修改 / 句子重组 题型.
 *
 * 核心洞察: G4B 期中考第 5 题型 "找语序颠倒, 用修改符号修改" 抽象难懂.
 * 把 "病句修改" → "训龙师把混乱的龙鳞重新排好" — 中国龙 visual metaphor 让
 * 句法语序具象化.
 *
 * 设计 DNA (中国龙训龙师主题, 翠绿+金, 跟 math/chinese 全部 cluster 区别):
 * - 翠绿 + 金 + 深墨绿 + 云雾灰 (龙鳞 / 古卷)
 * - 巨龙剪影 SVG 盘绕 (S 形曲线) + 龙鳞细节 + 云雾飘
 * - 山顶 + 古卷 + 龙焰光 装饰
 * - Mascot 🐼 戴 ⛑ 训龙师 头巾 (左下)
 * - 助手 = 🐉 巨龙 (右上, 友善, 答对喷云)
 * - 中央: 题面卷轴 (病句原文) + 字词 token slot 顺序栏
 * - 字词 pool 底部 (打乱顺序)
 * - 答对 → 龙身翻腾 + "句通气顺!" + 喷云 + 2s 切下题
 * - 答错 → 龙身颤抖 + 鼓励 "再调一调, 主语在哪?"
 *
 * 3 mock cases (覆盖期中考典型语序错):
 * - 案一: "在公园里" + "我" + "看到了" 拼 "我 在公园里 看到了"
 * - 案二: 减字版 (删冗余) "通过 + 让" 形 → 选哪种最对
 * - 案三: "几乎" 修复"全班都/小明没" 矛盾
 *
 * 入口: `/chinese/sentence-dragon-preview`
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { awardClusterXp } from "../lib/clusterXp";
import { awardMascotXp } from "../lib/mascotProgress";
import { Link } from "react-router-dom";
import type { Question } from "../core/types";
import { db } from "../db/dexie";
import { submitChineseAttempt, getChineseMistakeQuestionIds } from "../subjects/chinese/service";
import {
  pickNextClusterIndex,
  advanceClusterSession,
  emptyClusterSession,
  buildCandidates,
  type ClusterSessionState,
} from "../lib/clusterSelect";
import { SEED_QUESTIONS_CHINESE_V3 } from "../subjects/chinese/questionPack3";

type DragonCase = {
  id: string;
  scrollLabel: string;
  badSentence: string; // 病句原文 (read-only) 或 排序指令
  diagnosis: string; // 病因提示 / 结构提示
  tokens: string[]; // 字词块 (shuffle后给用户)
  correctOrder: string[]; // 正确顺序
  /** false → 中性"龙师出题"卷轴样式 (真题排序/组句); 其余 → 红色病句 line-through 样式 (DEMO 病句) */
  showAsError?: boolean;
  sourceQuestion?: Question; // 真题/db题携带原始 Question, 用于记录学习数据 (DEMO 不带)
};

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i]!, out[j]!] = [out[j]!, out[i]!];
  }
  return out;
}

const DEMO_CASES: DragonCase[] = [
  {
    id: "d1",
    scrollLabel: "案一 · 语序倒置",
    badSentence: "在公园里我看到了一只蜻蜓。",
    diagnosis: "主语 (我) 应该放在前面",
    tokens: ["我", "在公园里", "看到了", "一只", "蜻蜓。"],
    correctOrder: ["我", "在公园里", "看到了", "一只", "蜻蜓。"],
  },
  {
    id: "d2",
    scrollLabel: "案二 · 病句重写",
    badSentence: "通过老师讲解, 让我明白了道理。",
    diagnosis: "通过 + 让 缺主语, 删 '通过' 或删 '让'",
    tokens: ["老师讲解,", "让", "我", "明白了", "道理。"],
    correctOrder: ["老师讲解,", "让", "我", "明白了", "道理。"],
  },
  {
    id: "d3",
    scrollLabel: "案三 · 调整顺序",
    badSentence: "蹑手蹑脚地小猫朝鸟笼走过去。",
    diagnosis: "主语 (小猫) 应该在状语 (蹑手蹑脚地) 前",
    tokens: ["小猫", "蹑手蹑脚地", "朝", "鸟笼", "走过去。"],
    correctOrder: ["小猫", "蹑手蹑脚地", "朝", "鸟笼", "走过去。"],
  },
  {
    id: "d4",
    scrollLabel: "案四 · 状语归位",
    badSentence: "快乐地同学们在操场上做游戏。",
    diagnosis: "状语'快乐地'应紧挨动词'做'",
    tokens: ["同学们", "在操场上", "快乐地", "做", "游戏。"],
    correctOrder: ["同学们", "在操场上", "快乐地", "做", "游戏。"],
  },
  {
    id: "d5",
    scrollLabel: "案五 · 把字句",
    badSentence: "干干净净我把房间打扫得。",
    diagnosis: "'把'字句结构: 谁 + 把 + 什么 + 怎么样",
    tokens: ["我", "把", "房间", "打扫得", "干干净净。"],
    correctOrder: ["我", "把", "房间", "打扫得", "干干净净。"],
  },
  {
    id: "d6",
    scrollLabel: "案六 · 关联词序",
    badSentence: "他努力因为, 所以取得了好成绩。",
    diagnosis: "'因为'应在第一个分句开头",
    tokens: ["因为", "他努力,", "所以", "取得了", "好成绩。"],
    correctOrder: ["因为", "他努力,", "所以", "取得了", "好成绩。"],
  },
  {
    id: "d7",
    scrollLabel: "案七 · 被字句",
    badSentence: "小树苗被风吹得摇摇晃晃地。",
    diagnosis: "'摇摇晃晃地'是状语, 应在动词'吹'前",
    tokens: ["小树苗", "被风", "摇摇晃晃地", "吹得", "弯下了腰。"],
    correctOrder: ["小树苗", "被风", "摇摇晃晃地", "吹得", "弯下了腰。"],
  },
];

const ENCOURAGE_PHRASES = [
  "再调一调, 主语在哪?",
  "龙鳞顺序: 谁 + 在哪里 + 怎么样",
  "训龙师, 慢慢理理思路",
  "主谓宾, 一气呵成",
];

// ── 真题库接入: questionPack3 的 sentence_shuffle 题 (古诗排序/句子重排/关联词组句) ──
// 机制上 = 龙训重组 (把打乱词块拼成正确顺序), 直接复用统一题库, 无需另造 pack.
function adaptShuffle(q: Question): DragonCase | null {
  const gd = q.game_data;
  if (!gd || gd.kind !== "sentence_shuffle") return null;
  const order = gd.tokens;
  if (!Array.isArray(order) || order.length < 3) return null;
  return {
    id: q.question_id,
    scrollLabel: q.skill_name || "句子重排",
    badSentence: q.stem.replace(/[:：]\s*$/, ""), // 排序指令做题面
    diagnosis: q.feedback_wrong || "按 主语 + 状语 + 谓语 + 宾语 顺序拼一拼",
    tokens: order,
    correctOrder: order,
    showAsError: false, // 真题是"排正确顺序", 用中性卷轴样式 (非病句 line-through)
    sourceQuestion: q,
  };
}
const REAL_DRAGON_CASES: DragonCase[] = SEED_QUESTIONS_CHINESE_V3
  .filter((q) => q.game_type === "sentence_shuffle")
  .map(adaptShuffle)
  .filter((c): c is DragonCase => c !== null);
// 静态 pack 已有的 question_id，用于 db 去重（pack 也可能被 seed 进 db）
const STATIC_DRAGON_IDS = new Set(REAL_DRAGON_CASES.map((c) => c.id));

export function SentenceDragonPreviewPage() {
  const [caseIdx, setCaseIdx] = useState(0);
  const [pool, setPool] = useState<string[]>([]);
  const [filled, setFilled] = useState<(string | null)[]>([]);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [encouragePhrase, setEncouragePhrase] = useState<string | null>(null);
  // AI 补题: 从 db.questions 拉 chinese sentence_shuffle 题, 过掉静态已有的, adapt 后 merge
  const [dbCases, setDbCases] = useState<DragonCase[]>([]);
  // ── 学习数据记录 (统一走 submitChineseAttempt, 跟 ChineseTrain 一致) ──
  const student = useLiveQuery(async () => (await db.students.toArray())[0]);
  const [sessionId] = useState(() => "cluster-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  const [comboBefore, setComboBefore] = useState(0);
  const questionStartRef = useRef(Date.now());
  // ── Phase 2 流式选题: 局内 session 状态 + 到期错题 id + 首答是否错 (难度爬升信号) ──
  const sessionRef = useRef<ClusterSessionState>(emptyClusterSession(2));
  const wrongThisCaseRef = useRef(false);
  const lastPickWasReviewRef = useRef(false);
  const [dueIds, setDueIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!student?.id) return;
    let cancelled = false;
    getChineseMistakeQuestionIds(student.id)
      .then((ids) => { if (!cancelled) setDueIds(new Set(ids)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [student?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dbQs = (await db.questions.where("subjectId").equals("chinese").toArray()) as unknown as Question[];
        const adapted = dbQs
          .filter((q) => q.game_type === "sentence_shuffle" && !STATIC_DRAGON_IDS.has(q.question_id))
          .map(adaptShuffle)
          .filter((c): c is DragonCase => c !== null);
        if (!cancelled) setDbCases(adapted);
      } catch (e) {
        console.error("[SentenceDragon] 加载 db 题失败", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 静态真题 + db AI 题合并去重; 不足 4 道回退 DEMO (DEMO 是病句语序题, showAsError 默认开)
  const CASES = useMemo<DragonCase[]>(() => {
    const seen = new Set<string>();
    const merged: DragonCase[] = [];
    for (const c of [...REAL_DRAGON_CASES, ...dbCases]) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      merged.push(c);
    }
    return merged.length >= 4 ? merged : DEMO_CASES;
  }, [dbCases]);

  const cur = CASES[caseIdx] ?? DEMO_CASES[0]!;

  // 重置 case
  useEffect(() => {
    setPool(shuffle(cur.tokens));
    setFilled(Array.from({ length: cur.correctOrder.length }, () => null));
    setResult("idle");
    setEncouragePhrase(null);
    questionStartRef.current = Date.now(); // 重置答题计时
    wrongThisCaseRef.current = false; // 本题首答错标记复位
  }, [caseIdx, cur.tokens, cur.correctOrder.length]);

  // Phase 2: 选下一题 (流式自适应 — 局内去重 + 难度爬升 + 错题插入), 取代 (i+1)%len
  function advanceToNext() {
    const sq = cur.sourceQuestion;
    const qid = sq?.question_id ?? cur.id;
    const diff = typeof sq?.difficulty === "number" ? sq.difficulty : 2;
    // 首答对(没出过错)= true → 连对加难; 出过错 = false → 难度不升
    sessionRef.current = advanceClusterSession(sessionRef.current, {
      questionId: qid,
      isCorrect: !wrongThisCaseRef.current,
      difficulty: diff,
      wasReview: lastPickWasReviewRef.current,
    });
    const pick = pickNextClusterIndex(buildCandidates(CASES), sessionRef.current, {
      baseDifficulty: 2,
      dueMistakeIds: dueIds,
      reviewEveryN: 4,
    });
    lastPickWasReviewRef.current = pick.reason === "review";
    setCaseIdx(pick.index);
  }

  // 首题也自适应挑 (不再永远 case 0)
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current || CASES.length === 0) return;
    didInitRef.current = true;
    const pick = pickNextClusterIndex(buildCandidates(CASES), sessionRef.current, {
      baseDifficulty: 2,
      dueMistakeIds: dueIds,
      reviewEveryN: 4,
    });
    lastPickWasReviewRef.current = pick.reason === "review";
    setCaseIdx(pick.index);
  }, [CASES, dueIds]);

  useEffect(() => {
    if (result === "correct") {
      const t = setTimeout(() => {
        advanceToNext();
      }, 2200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  async function handlePoolClick(token: string, poolIdx: number) {
    if (result === "correct") return;
    const firstEmpty = filled.findIndex((f) => f === null);
    if (firstEmpty === -1) return;
    const newFilled = [...filled];
    newFilled[firstEmpty] = token;
    setFilled(newFilled);
    const newPool = [...pool];
    newPool.splice(poolIdx, 1);
    setPool(newPool);

    // Auto-judge 当 filled 全部填好时
    if (newFilled.every((f) => f !== null)) {
      const isCorrect = newFilled.every((f, i) => f === cur.correctOrder[i]);
      if (isCorrect) {
        setResult("correct");
      } else {
        wrongThisCaseRef.current = true; // 本题出过错 → 难度不升
        setResult("wrong");
        // 真题(showAsError===false)的 diagnosis 来自 feedback_wrong, 平时藏起 (有的会剧透答案),
        // 答错时才给出当提示; DEMO 病句用随机鼓励语.
        setEncouragePhrase(
          cur.showAsError === false && cur.diagnosis
            ? cur.diagnosis
            : (ENCOURAGE_PHRASES[Math.floor(Math.random() * ENCOURAGE_PHRASES.length)] ?? null),
        );
        setTimeout(() => {
          setPool(shuffle(cur.tokens));
          setFilled(Array.from({ length: cur.correctOrder.length }, () => null));
          setResult("idle");
        }, 1500);
      }
      // 记录学习数据 (对/错都记). 真题/db题走 submitChineseAttempt; DEMO 回退老 XP path.
      await recordAttempt(isCorrect);
    }
  }

  // 统一作答记录: 真题携带 sourceQuestion → submitChineseAttempt (attempts/mistakes/mastery);
  // DEMO/fallback 无 Question → 保留老 awardClusterXp path. 对/错都调用.
  async function recordAttempt(isCorrect: boolean) {
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - questionStartRef.current) / 1000));
    if (cur.sourceQuestion && student?.id) {
      try {
        const r = await submitChineseAttempt({
          studentId: student.id,
          sessionId,
          question: cur.sourceQuestion,
          isCorrect,
          chosenOptionId: isCorrect ? "__game_correct__" : "__game_wrong__",
          elapsedSeconds,
          comboBefore,
        });
        setComboBefore(r.comboAfter);
        if (isCorrect) void awardMascotXp(student.id, "session_complete").catch(() => {});
      } catch (e) {
        console.error("[cluster submit]", e);
      }
    } else if (isCorrect) {
      void awardClusterXp(1); // DEMO/fallback case (no real Question) keeps old path
    }
  }

  function handleSlotClick(idx: number) {
    if (result === "correct") return;
    if (filled[idx] === null) return;
    const token = filled[idx]!;
    const newFilled = [...filled];
    newFilled[idx] = null;
    setFilled(newFilled);
    setPool([...pool, token]);
    setResult("idle");
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden text-emerald-50"
      style={{
        height: "100dvh",
        background: "radial-gradient(ellipse at top, #064e3b 0%, #022c22 50%, #02100a 100%)",
      }}
    >
      {/* 翠绿 ambience */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-emerald-600/30 blur-[120px] pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-amber-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-teal-600/20 blur-[120px] pointer-events-none" />

      {/* 巨龙剪影 + 山 + 云雾 */}
      <svg className="absolute inset-0 w-full h-full opacity-35 pointer-events-none" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice">
        {/* 远山 */}
        <path d="M 0 540 L 150 380 L 320 460 L 480 360 L 620 460 L 780 400 L 920 480 L 1000 440 L 1000 800 L 0 800 Z" fill="#022c22" stroke="#10b981" strokeWidth="1" opacity="0.6" />
        <path d="M 0 620 L 200 520 L 400 580 L 600 500 L 800 560 L 1000 520 L 1000 800 L 0 800 Z" fill="#02100a" opacity="0.7" />

        {/* 月亮 (top-right) */}
        <circle cx="850" cy="120" r="38" fill="#fef3c7" opacity="0.8" />
        <circle cx="860" cy="115" r="6" fill="#fcd34d" opacity="0.4" />

        {/* 巨龙 S 形曲线 (盘绕) */}
        <g opacity="0.45" className="animate-dragon-pulse">
          {/* 龙身 main curve */}
          <path
            d="M 100 280 Q 250 200 400 300 Q 550 400 700 280 Q 850 180 950 320"
            stroke="#10b981"
            strokeWidth="40"
            fill="none"
            strokeLinecap="round"
            opacity="0.7"
          />
          {/* 龙鳞 (small circles 沿曲线) */}
          {Array.from({ length: 20 }).map((_, i) => {
            const t = i / 19;
            // approximate curve interpolation
            const x = 100 + t * 850;
            const y = 280 + Math.sin(t * Math.PI * 2.5) * 70;
            return <circle key={i} cx={x} cy={y} r="6" fill="#fcd34d" opacity="0.7" />;
          })}
          {/* 龙头 (left, 圆 + 角 + 眼) */}
          <circle cx="100" cy="280" r="32" fill="#065f46" stroke="#10b981" strokeWidth="2" />
          <path d="M 78 252 L 70 232 L 88 246 Z" fill="#fcd34d" />
          <path d="M 95 247 L 88 227 L 105 240 Z" fill="#fcd34d" />
          <circle cx="92" cy="278" r="4" fill="#fef3c7" />
          <circle cx="92" cy="278" r="2" fill="#000" />
          {/* 龙尾 (right) */}
          <path d="M 950 320 Q 985 330 985 290 Q 985 320 970 340 Z" fill="#065f46" stroke="#10b981" strokeWidth="2" />
        </g>

        {/* 云雾 (背景层) */}
        {Array.from({ length: 6 }).map((_, i) => {
          const x = (i * 173) % 100;
          const y = ((i * 47) % 25) + 5;
          return (
            <g key={i} className="animate-cloud-drift" style={{ animationDelay: `${i * 1.5}s` } as React.CSSProperties}>
              <ellipse cx={`${x}%`} cy={`${y}%`} rx="40" ry="12" fill="#e5e7eb" opacity="0.15" />
            </g>
          );
        })}

        {/* 古卷山顶 */}
        <g transform="translate(490, 540)">
          <rect x="-30" y="-10" width="60" height="20" rx="3" fill="#92400e" opacity="0.6" />
          <line x1="-25" y1="0" x2="25" y2="0" stroke="#fcd34d" strokeWidth="0.5" />
        </g>
      </svg>

      {/* 角落装饰 emoji */}
      <div className="absolute top-16 left-6 text-3xl opacity-50 select-none">🐲</div>
      <div className="absolute top-16 right-6 text-3xl opacity-50 select-none">⛰️</div>
      <div className="absolute bottom-44 left-6 text-3xl opacity-50 select-none">🔥</div>
      <div className="absolute bottom-44 right-6 text-3xl opacity-50 select-none">☁️</div>

      {/* ─── 顶部 HUD ─── */}
      <div className="absolute top-3 left-0 right-0 px-4 z-20 flex items-center justify-between">
        <Link to="/chinese" className="px-3 py-1.5 rounded-xl bg-emerald-900/85 backdrop-blur-md border border-amber-400/40 text-xs font-bold text-amber-100">
          ← 离开龙窟
        </Link>
        <div className="px-4 py-1.5 rounded-xl bg-emerald-900/85 backdrop-blur-md border border-amber-400/40 text-center">
          <div className="text-[10px] text-amber-300 uppercase tracking-widest">🐉 病句龙训堂</div>
          <div className="text-sm font-display font-bold text-amber-100">{cur.scrollLabel}</div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-emerald-900/85 backdrop-blur-md border border-amber-400/40 text-xs font-bold text-amber-100 tabular-nums">
          {caseIdx + 1} / {CASES.length}
        </div>
      </div>

      {/* ─── 中央 病句 + 重组 slot ─── */}
      <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 z-10 w-full max-w-3xl px-4">
        {/* 题面: 病句原文 (DEMO) 或 排序指令 (真题) */}
        <div className="text-center mb-3">
          {cur.showAsError === false ? (
            <>
              <div className="text-[10px] text-amber-300 uppercase tracking-widest">📜 龙师出题 · 排好龙鳞</div>
              <div className="mt-1 px-4 py-2 bg-emerald-950/60 backdrop-blur-md rounded-xl border border-amber-300/40 text-amber-50 text-base sm:text-lg font-display inline-block">
                {cur.badSentence}
              </div>
            </>
          ) : (
            <>
              <div className="text-[10px] text-amber-300 uppercase tracking-widest">⚠️ 龙鳞乱了, 病句</div>
              <div className="mt-1 px-4 py-2 bg-rose-950/60 backdrop-blur-md rounded-xl border border-rose-400/40 text-rose-100 text-base sm:text-lg font-display line-through opacity-80 inline-block">
                {cur.badSentence}
              </div>
            </>
          )}
          {/* 病句(DEMO)的 diagnosis 是结构提示, 持续显示; 真题排序的 diagnosis 可能剧透, 仅答错时弹 */}
          {cur.showAsError !== false && (
            <div className="text-[10px] text-amber-200/80 mt-1 italic">{cur.diagnosis}</div>
          )}
        </div>

        {/* 重组 slot 顺序栏 */}
        <div className="mb-3">
          <div className="text-center text-[10px] text-emerald-300 uppercase tracking-widest mb-1.5">✦ 按顺序拼好句子 ✦</div>
          <div className="flex flex-wrap justify-center gap-2 min-h-[60px] px-3 py-3 rounded-2xl bg-emerald-900/40 backdrop-blur-md border-2 border-dashed border-emerald-400/40">
            {filled.map((token, i) => (
              <button
                key={i}
                onClick={() => handleSlotClick(i)}
                disabled={result === "correct" || token === null}
                className={`px-3 py-2 rounded-lg font-display font-bold text-sm sm:text-base transition-all min-w-[60px] ${
                  token
                    ? result === "correct"
                      ? "bg-amber-400 border-2 border-amber-200 text-amber-950 scale-105 shadow-lg"
                      : "bg-emerald-700 border-2 border-amber-300 text-amber-100 shadow"
                    : "bg-black/30 border-2 border-dashed border-emerald-400/30 text-emerald-300/50"
                }`}
              >
                {token ?? `${i + 1}`}
              </button>
            ))}
          </div>
        </div>

        {result === "correct" && (
          <div className="text-center mt-4">
            <div className="inline-block px-4 py-2 bg-amber-500/80 backdrop-blur-md rounded-xl text-amber-950 text-xl font-display font-black" style={{ animation: "dragon-roar 1.2s ease-out" }}>
              🐉 句通气顺! 🎆
            </div>
          </div>
        )}
      </div>

      {/* ─── 左下 Mascot 戴 训龙师头巾 ─── */}
      <div className="absolute left-4 bottom-40 sm:left-8 sm:bottom-44 flex flex-col items-center gap-1 pointer-events-none z-10">
        <div className="relative">
          <div
            className="text-[72px] sm:text-[88px] leading-none"
            style={{
              animation: result === "correct" ? "dragon-celebrate 0.8s ease-in-out" : "dragon-float 3s ease-in-out infinite",
            }}
          >🐼</div>
          <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 text-3xl">⛑</div>
        </div>
        {encouragePhrase && (
          <div className="px-3 py-1.5 rounded-2xl bg-emerald-100/95 text-emerald-900 text-xs font-bold shadow-lg max-w-[180px] text-center" style={{ animation: "dragon-pop 0.4s ease-out" }}>
            {encouragePhrase}
          </div>
        )}
      </div>

      {/* ─── 右上 Dragon ─── */}
      <div className="absolute right-4 top-16 sm:right-8 sm:top-20 flex flex-col items-center pointer-events-none z-10">
        <div
          className="text-[64px] sm:text-[80px] leading-none"
          style={{
            animation: result === "correct" ? "dragon-fly 0.8s ease-in-out" : "dragon-float-slow 4s ease-in-out infinite",
          }}
        >🐉</div>
        <div className="text-[10px] text-amber-300/70 mt-1">龙师傅</div>
      </div>

      {/* ─── 字词 pool (底部) ─── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-[max(8px,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-[#02100a] via-[#02100a]/85 to-transparent">
        <div className="text-center mb-2 px-4">
          <div className="inline-block px-4 py-1.5 rounded-2xl bg-emerald-900/85 backdrop-blur-md border border-amber-300/40">
            <span className="text-amber-100 text-xs sm:text-sm font-display font-bold">
              🐉 点字词收回龙鳞
            </span>
          </div>
        </div>
        <div className="px-4 pb-2 flex flex-wrap justify-center gap-2 max-w-3xl mx-auto min-h-[60px]">
          {pool.map((token, i) => (
            <button
              key={`${token}-${i}`}
              onClick={() => handlePoolClick(token, i)}
              disabled={result === "correct"}
              className="px-3 py-2 rounded-xl border-2 font-display font-bold text-sm sm:text-base transition-all bg-amber-50 border-amber-300 text-emerald-900 hover:scale-110 active:scale-95 shadow-lg shadow-amber-500/30"
            >
              {token}
            </button>
          ))}
        </div>
      </div>

      {/* footer */}
      <div className="fixed bottom-1 left-2 text-[9px] text-amber-300/30 z-40 pointer-events-auto">
        Sprint C3 🐉 病句龙训 prototype · <Link className="underline" to="/chinese">语文 hub</Link> · <Link className="underline" to="/chinese/poem-lantern-preview">C1</Link> · <Link className="underline" to="/chinese/glyph-detective-preview">C2</Link>
      </div>

      <style>{`
        @keyframes dragon-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes dragon-float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes dragon-celebrate { 0%, 100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-12px) rotate(-12deg); } 75% { transform: translateY(-12px) rotate(12deg); } }
        @keyframes dragon-fly { 0%, 100% { transform: translateX(0) translateY(0); } 50% { transform: translateX(-30px) translateY(-20px) scale(1.4) rotate(20deg); } }
        @keyframes dragon-roar { 0% { transform: scale(0) rotate(-12deg); opacity: 0; } 60% { transform: scale(1.2) rotate(5deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
        @keyframes dragon-pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.65; } }
        @keyframes dragon-pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes cloud-drift { 0% { transform: translateX(0); } 100% { transform: translateX(50px); } }
        .animate-dragon-pulse { animation: dragon-pulse 4s ease-in-out infinite; }
        .animate-cloud-drift { animation: cloud-drift 15s linear infinite alternate; }
      `}</style>
    </div>
  );
}
