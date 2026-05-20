/**
 * v0.36.21 — Sprint C5: 🎨 仿写画师 (Imitate Painter) Chinese cluster prototype.
 *
 * Chinese Cluster 5/7. 覆盖 仿写句子 (比喻/拟人/排比/颜色描写).
 *
 * 核心洞察: G4B 期中第 16-17 题 "用调动颜色/拟人/比喻仿写句子" 失分多 —
 * 难辨"合格仿写". 把 "仿写" → "在美术馆当画师, 临摹大师的笔法画一幅新画".
 * 仿写 = 临摹结构 + 换内容 (像画师学构图换题材).
 *
 * 难度梯度 (Selena 反馈 "题太简单要挑战"):
 *  - 🖼️ 临摹模式 (基础): 4 选 1 选合格仿写 (跟其他 cluster 一致)
 *  - 🎨 创作模式 (进阶挑战): 自由仿写一句 → 小进 AI 点评 (用对修辞? 有创意?)
 *
 * 设计 DNA (美术馆 / 油画画室主题, 区别于 C4 墨黑山水):
 * - 暖油画色: 赭石 amber + 群青 indigo + 藤黄, 画布米白
 * - 画框 + 调色板 🎨 + 颜料管 装饰
 * - Mascot 🐼 戴 🎨 贝雷帽 (左下画师), 助手 🦜 鹦鹉 (右上, 评画)
 * - framer-motion: 画框 spring 入场, 颜料 wiggle, 答对画框金光
 *
 * 入口: `/chinese/imitate-painter-preview`
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { awardClusterXp } from "../lib/clusterXp";
import { awardMascotXp } from "../lib/mascotProgress";
import { submitChineseAttempt } from "../subjects/chinese/service";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { explainQuestion } from "../lib/tutor";
import type { Question } from "../core/types";
import { db } from "../db/dexie";
import { SEED_QUESTIONS_CHINESE_IMITATE } from "../subjects/chinese/imitatePack";

type ImitateCase = {
  id: string;
  frameLabel: string;
  example: string;
  rhetoric: string; // 修辞类型中文
  question: string;
  options: { text: string; emoji?: string }[];
  correctIdx: number;
  solution: string;
  /** Phase1: 真题/db 来源 Question (临摹模式用于记录学习数据; DEMO 留空) */
  sourceQuestion?: Question;
};

const DEMO_CASES: ImitateCase[] = [
  {
    id: "p1",
    frameLabel: "画一 · 比喻",
    example: "弯弯的月亮像一只小船。",
    rhetoric: "比喻",
    question: "下面哪句是这句的合格仿写 (同样用比喻)?",
    options: [
      { text: "圆圆的太阳像一个大火球。", emoji: "☀️" },
      { text: "月亮挂在天上很亮。", emoji: "🌙" },
      { text: "我喜欢看弯弯的月亮。", emoji: "👀" },
      { text: "小船在河里慢慢地划。", emoji: "⛵" },
    ],
    correctIdx: 0,
    solution: "比喻要有本体+喻体+相似点。「太阳像火球」(圆+热)结构和例句一致。其他句没有「像」的比喻关系。",
  },
  {
    id: "p2",
    frameLabel: "画二 · 拟人",
    example: "春风轻轻地抚摸着大地。",
    rhetoric: "拟人",
    question: "哪句和例句一样用了拟人 (物当人写)?",
    options: [
      { text: "柳树在风中摇来摇去。", emoji: "🌿" },
      { text: "小溪唱着歌儿向前跑。", emoji: "💧" },
      { text: "春天的花很美丽。", emoji: "🌸" },
      { text: "风吹得很大很大。", emoji: "💨" },
    ],
    correctIdx: 1,
    solution: "拟人 = 给物加人的动作/情感。「小溪唱歌、跑」是人的动作。「柳树摇」只是客观描写不算拟人。",
  },
  {
    id: "p3",
    frameLabel: "画三 · 排比",
    example: "校园里有红的花, 绿的草, 高的树。",
    rhetoric: "排比",
    question: "哪句是合格的排比仿写 (3+ 同结构)?",
    options: [
      { text: "公园里有花和树。", emoji: "🌳" },
      { text: "天空很蓝, 白云很白。", emoji: "☁️" },
      { text: "操场上有跑步的, 跳绳的, 打球的。", emoji: "🏃" },
      { text: "我家有爸爸妈妈和我。", emoji: "👨‍👩‍👧" },
    ],
    correctIdx: 2,
    solution: "排比要 3 个以上结构相似的短句。「跑步的、跳绳的、打球的」3 个「V 的」结构。前两句只有 1-2 个不够。",
  },
  {
    id: "p4",
    frameLabel: "画四 · 颜色描写",
    example: "金黄的稻田一望无边, 火红的枫叶铺满山坡。",
    rhetoric: "颜色描写",
    question: "哪句最好地调动了颜色来描写秋天?",
    options: [
      { text: "秋天到了, 天气变凉了。", emoji: "🍂" },
      { text: "橙红的柿子挂满枝头, 雪白的棉花绽开笑脸。", emoji: "🎨" },
      { text: "秋天有很多水果可以吃。", emoji: "🍎" },
      { text: "我很喜欢秋天这个季节。", emoji: "💛" },
    ],
    correctIdx: 1,
    solution: "颜色描写要用具体颜色词 + 画面。「橙红的柿子、雪白的棉花」既有颜色又有画面，跟例句「金黄、火红」一样。",
  },
];

const FREE_PROMPTS = [
  { rhetoric: "比喻", example: "白云像一群绵羊。", hint: "用「像 / 仿佛」, 本体和喻体要有相似点" },
  { rhetoric: "拟人", example: "小鸟在枝头唱歌。", hint: "给物加人的动作 (笑/唱/招手/跳舞)" },
  { rhetoric: "排比", example: "山在动, 海在笑, 森林在歌唱。", hint: "写 3 个以上结构相似的短句" },
];

const ENCOURAGE = ["再看大师笔法: 结构换内容", "色彩还能更鲜活!", "鹦鹉提示: 修辞对不对?", "画师慢慢来, 临摹要细"];

// v0.36.31 (爸爸: cluster 接真题库): imitatePack 真题 (SEED_QUESTIONS_CHINESE_IMITATE,
// 50 题内存 pack, 不经 db — chinese 题没 seed 到 db). adapter parse stem 出 example/rhetoric.
function adaptImitate(q: Question): ImitateCase | null {
  const opts = q.options ?? [];
  if (opts.length < 2) return null;
  const correctVal = q.answer?.type === "choice" ? q.answer.value : undefined;
  const correctIdx = opts.findIndex((o) => o.id === correctVal);
  if (correctIdx < 0) return null;
  // parse stem: 例句 (拟人): "春风..." \n\n 下面哪句...?
  const m = q.stem.match(/例句\s*[(（]?\s*([^)）:：]*?)\s*[)）]?\s*[:：]\s*["「"']?([^"」"'\n]+)/);
  const rhetoric = (m?.[1] || "").trim() || "仿写";
  const example = (m?.[2] || "").trim() || q.stem.split(/\n/)[0]!.replace(/^例句.*?[:：]/, "").trim();
  const parts = q.stem.split(/\n\n|\n/).filter(Boolean);
  const question = parts.length > 1 ? parts[parts.length - 1]! : "下面哪句是合格仿写?";
  const sol = Array.isArray(q.solution_steps) ? q.solution_steps.join(" ") : "";
  return {
    id: q.question_id,
    frameLabel: rhetoric,
    example,
    rhetoric,
    question,
    options: opts.map((o) => ({ text: o.text })),
    correctIdx,
    solution: sol || "仿写要学例句的结构 + 修辞, 换新内容.",
    sourceQuestion: q,
  };
}

type Mode = "trace" | "create";

// v0.36.31: imitatePack 真题 → ImitateCase (module-level, 内存 pack 直接 adapt).
const REAL_CASES: ImitateCase[] = SEED_QUESTIONS_CHINESE_IMITATE
  .map(adaptImitate)
  .filter((c): c is ImitateCase => c !== null);
// 静态 pack 已有的 question_id，用于 db 去重（pack 也可能被 seed 进 db）
const STATIC_IMITATE_IDS = new Set(REAL_CASES.map((c) => c.id));

export function ImitatePainterPreviewPage() {
  const [mode, setMode] = useState<Mode>("trace");
  // AI 补题: 从 db.questions 拉 chinese 仿写题 (skill_id 含 _IMITATE), 过掉静态已有的, adapt 后 merge
  const [dbCases, setDbCases] = useState<ImitateCase[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dbQs = (await db.questions.where("subjectId").equals("chinese").toArray()) as unknown as Question[];
        const adapted = dbQs
          .filter((q) => q.skill_id?.endsWith("_IMITATE") && !STATIC_IMITATE_IDS.has(q.question_id))
          .map(adaptImitate)
          .filter((c): c is ImitateCase => c !== null);
        if (!cancelled) setDbCases(adapted);
      } catch (e) {
        console.error("[ImitatePainter] 加载 db 题失败", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 静态真题 + db AI 题合并去重; 不足 3 道回退 DEMO
  const cases = useMemo<ImitateCase[]>(() => {
    const seen = new Set<string>();
    const merged: ImitateCase[] = [];
    for (const c of [...REAL_CASES, ...dbCases]) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      merged.push(c);
    }
    return merged.length >= 3 ? merged : DEMO_CASES;
  }, [dbCases]);

  // 临摹模式 state
  const [caseIdx, setCaseIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [encourage, setEncourage] = useState<string | null>(null);
  // Phase1: 记录学习数据 (临摹模式 4 选 1 是 judged; 创作模式开放写作不记). 不改题序.
  const student = useLiveQuery(async () => (await db.students.toArray())[0]);
  const [sessionId] = useState(() => "cluster-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  const [comboBefore, setComboBefore] = useState(0);
  const questionStartRef = useRef(Date.now());
  // 创作模式 state
  const [freeIdx, setFreeIdx] = useState(0);
  const [draft, setDraft] = useState("");
  const [judging, setJudging] = useState(false);
  const [critique, setCritique] = useState<string | null>(null);
  const [judgeErr, setJudgeErr] = useState<string | null>(null);

  const cur = cases[caseIdx] ?? DEMO_CASES[0]!;
  const free = FREE_PROMPTS[freeIdx]!;

  // Phase1: 题目/模式切换时重置计时
  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [caseIdx, cur.id, mode]);

  useEffect(() => {
    if (result === "correct") {
      const t = setTimeout(() => {
        setCaseIdx((i) => (i + 1) % cases.length);
        setSelectedIdx(null);
        setResult("idle");
        setEncourage(null);
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [result]);

  async function handleChoice(idx: number) {
    if (result === "correct") return;
    setSelectedIdx(idx);
    const isCorrect = idx === cur.correctIdx;
    if (isCorrect) {
      setResult("correct");
      setEncourage(null);
    } else {
      setResult("wrong");
      setEncourage(ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)] ?? null);
      setTimeout(() => setResult("idle"), 700);
    }
    // Phase1: 临摹模式是 judged 4 选 1 — 对 & 错都记录学习数据. 不改题序.
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - questionStartRef.current) / 1000));
    const srcQ = cur.sourceQuestion;
    if (srcQ && student?.id) {
      try {
        const r = await submitChineseAttempt({
          studentId: student.id, sessionId, question: srcQ,
          isCorrect, chosenOptionId: isCorrect ? "__game_correct__" : "__game_wrong__",
          elapsedSeconds, comboBefore,
        });
        setComboBefore(r.comboAfter);
        if (isCorrect) void awardMascotXp(student.id, "session_complete").catch(() => {});
      } catch (e) { console.error("[cluster submit]", e); }
    } else if (isCorrect) {
      void awardClusterXp(1);
    }
  }
  // Phase1: 创作模式 (handleJudge) 是开放写作, AI 点评是定性反馈而非 binary 对/错信号,
  // 无明确 judged correct/wrong → 不调 submitChineseAttempt, 保持原样.

  async function handleJudge() {
    const text = draft.trim();
    if (!text || judging) return;
    setJudging(true);
    setCritique(null);
    setJudgeErr(null);
    try {
      const r = await explainQuestion({
        subjectId: "chinese",
        stem: `仿写练习。例句(${free.rhetoric}): "${free.example}"。要求: 仿照例句, 用${free.rhetoric}写一句话。`,
        correctAnswer: `合格的${free.rhetoric}仿写 (结构像例句, 内容换新, 修辞用对)`,
        studentAnswer: text,
        skillName: "仿写句子",
        hint: `请点评这个 4 年级学生的仿写: 1) 有没有用对${free.rhetoric}? 2) 结构是否像例句? 3) 给一句鼓励 + 一个具体改进建议。语气亲切, 不超过 60 字。`,
      });
      setCritique(r.explanation);
    } catch (e) {
      setJudgeErr((e as Error).message || "点评失败, 小进可能在休息");
    } finally {
      setJudging(false);
    }
  }

  function nextFree() {
    setFreeIdx((i) => (i + 1) % FREE_PROMPTS.length);
    setDraft("");
    setCritique(null);
    setJudgeErr(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden text-amber-50"
      style={{
        height: "100dvh",
        background: "radial-gradient(ellipse at top, #44403c 0%, #292524 55%, #1c1917 100%)",
      }}
    >
      {/* 油画暖色 ambience */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-amber-600/15 blur-[120px] pointer-events-none" />
      <div className="absolute -top-24 -right-32 w-[420px] h-[420px] rounded-full bg-indigo-600/15 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-[420px] h-[420px] rounded-full bg-yellow-600/10 blur-[120px] pointer-events-none" />

      {/* 美术馆墙 + 画框装饰 */}
      <div className="absolute top-16 left-6 text-3xl opacity-60 select-none">🖼️</div>
      <div className="absolute top-16 right-6 text-3xl opacity-60 select-none">🦜</div>
      <div className="absolute bottom-44 left-6 text-3xl opacity-50 select-none">🖌️</div>
      <div className="absolute bottom-44 right-6 text-3xl opacity-50 select-none">🎨</div>
      {/* 调色板颜料点 */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 opacity-70">
        {["#dc2626", "#ea580c", "#eab308", "#16a34a", "#2563eb", "#7c3aed"].map((c, i) => (
          <motion.div
            key={c}
            className="w-4 h-4 rounded-full"
            style={{ background: c }}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>

      {/* ─── 顶部 HUD ─── */}
      <div className="absolute top-3 left-0 right-0 px-4 z-20 flex items-center justify-between">
        <Link to="/chinese" className="px-3 py-1.5 rounded-xl bg-stone-800/85 backdrop-blur-md border border-amber-500/50 text-xs font-bold text-amber-100">
          ← 离开画室
        </Link>
        <div className="px-4 py-1.5 rounded-xl bg-stone-800/85 backdrop-blur-md border border-amber-500/50 text-center">
          <div className="text-[10px] text-amber-400 uppercase tracking-widest">🎨 仿写画师工坊</div>
          <div className="text-sm font-display font-bold text-amber-100">
            {mode === "trace" ? cur.frameLabel : `创作 · ${free.rhetoric}`}
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-stone-800/85 backdrop-blur-md border border-amber-500/50 text-xs font-bold text-amber-100 tabular-nums">
          {mode === "trace" ? `${caseIdx + 1} / ${cases.length}` : "✨"}
        </div>
      </div>

      {/* ─── 模式切换 ─── */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        <button
          onClick={() => setMode("trace")}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${mode === "trace" ? "bg-amber-500 text-stone-900" : "bg-stone-800/80 text-amber-200 border border-amber-500/40"}`}
        >
          🖼️ 临摹
        </button>
        <button
          onClick={() => setMode("create")}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${mode === "create" ? "bg-amber-500 text-stone-900" : "bg-stone-800/80 text-amber-200 border border-amber-500/40"}`}
        >
          🎨 创作挑战
        </button>
      </div>

      {/* ─── 中央: 画框 ─── */}
      <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 z-10 w-full max-w-2xl px-4">
        <AnimatePresence mode="wait">
          {mode === "trace" ? (
            <motion.div
              key={`trace-${cur.id}`}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
            >
              {/* 画框 */}
              <div className={`relative rounded-lg border-[10px] border-amber-700/80 shadow-2xl bg-stone-100 px-6 py-6 ${result === "wrong" ? "animate-rhetoric-shake" : ""}`}
                style={{ boxShadow: result === "correct" ? "0 0 40px rgba(234,179,8,0.6)" : undefined }}>
                <div className="text-[10px] text-stone-500 mb-1 uppercase tracking-wider">🖼️ 大师原作 ({cur.rhetoric})</div>
                <div className="text-stone-800 font-display text-lg leading-relaxed mb-3">「{cur.example}」</div>
                <div className="text-sm font-bold text-stone-700">{cur.question}</div>
              </div>

              {/* 选项 */}
              <div className="grid grid-cols-1 gap-2 mt-3">
                {cur.options.map((opt, idx) => {
                  const picked = selectedIdx === idx;
                  const showCorrect = result !== "idle" && idx === cur.correctIdx;
                  const showWrong = picked && result === "wrong";
                  return (
                    <motion.button
                      key={idx}
                      onClick={() => handleChoice(idx)}
                      whileTap={{ scale: 0.97 }}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + idx * 0.06 }}
                      className={`text-left px-4 py-2.5 rounded-xl border-2 text-sm transition ${
                        showCorrect ? "bg-emerald-500/30 border-emerald-400 text-emerald-50" :
                        showWrong ? "bg-rose-500/25 border-rose-400 text-rose-50" :
                        "bg-stone-800/70 border-amber-600/30 text-amber-50 hover:bg-stone-700/70"
                      }`}
                    >
                      <span className="mr-2">{opt.emoji}</span>{opt.text}
                    </motion.button>
                  );
                })}
              </div>

              {result === "correct" && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-3 rounded-xl bg-emerald-900/40 border border-emerald-500/40 px-4 py-2.5 text-sm text-emerald-100">
                  🦜 妙笔! {cur.solution}
                </motion.div>
              )}
              {result === "wrong" && encourage && (
                <div className="mt-3 text-center text-sm text-amber-300">{encourage}</div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="create"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
            >
              {/* 创作画框 */}
              <div className="rounded-lg border-[10px] border-indigo-700/70 shadow-2xl bg-stone-100 px-6 py-5">
                <div className="text-[10px] text-stone-500 mb-1 uppercase tracking-wider">🎨 临摹这幅 ({free.rhetoric})</div>
                <div className="text-stone-800 font-display text-lg leading-relaxed mb-2">「{free.example}」</div>
                <div className="text-xs text-indigo-700/80 mb-3">💡 {free.hint}</div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`用${free.rhetoric}写一句你自己的...`}
                  rows={2}
                  className="w-full rounded-lg border-2 border-indigo-300 bg-white px-3 py-2 text-stone-800 text-base focus:outline-none focus:border-indigo-500 resize-none"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={handleJudge}
                    disabled={!draft.trim() || judging}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold disabled:opacity-40 hover:bg-indigo-500 transition"
                  >
                    {judging ? "🦜 小进品画中..." : "🦜 让小进点评"}
                  </button>
                  <button onClick={nextFree} className="px-3 py-2 rounded-lg bg-stone-700 text-amber-100 text-sm hover:bg-stone-600 transition">
                    换一幅 →
                  </button>
                </div>
              </div>

              {critique && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-3 rounded-xl bg-indigo-900/40 border border-indigo-400/40 px-4 py-3 text-sm text-indigo-50 leading-relaxed">
                  <span className="font-bold text-indigo-200">🦜 小进点评:</span> {critique}
                </motion.div>
              )}
              {judgeErr && (
                <div className="mt-3 rounded-xl bg-rose-900/30 border border-rose-500/30 px-4 py-2 text-sm text-rose-200">
                  {judgeErr}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mascot 画师 (左下) */}
      <motion.div
        className="absolute bottom-6 left-4 text-5xl select-none z-10"
        animate={{ rotate: [0, -4, 4, 0] }}
        transition={{ duration: 3.5, repeat: Infinity }}
      >
        🐼
      </motion.div>
    </div>
  );
}
