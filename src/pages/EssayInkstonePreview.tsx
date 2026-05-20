/**
 * v0.36.27 — Sprint C7: ✏️ 自由作文 (Essay Inkstone) Chinese cluster prototype.
 *
 * Chinese Cluster 7/7 (最后一个). 覆盖 看图写话 / 题目作文 / 续写 / 片段描写.
 *
 * 核心洞察: G4B 期末作文占分大, Selena 写作最怕"不知道写什么 / 写不长".
 * 把"写作文" → "在书房砚台边研墨, 用毛笔写一段". 文人书房 metaphor +
 * AI 即时点评 (扣题 / 结构 / 用词 / 修辞 / 字数), 降低写作恐惧.
 *
 * 难度梯度 (回应 Selena "要挑战"):
 *  - 🖋️ 片段 (基础): 写 2-3 句描写 (景/物/人)
 *  - 📜 成篇 (进阶): 看题/看图写一小段 (50-100 字) → 小进点评
 *
 * 设计 DNA (文人书房 / 砚台书法主题, 墨黑 + 朱砂 + 宣纸暖白):
 * - 墨黑书房 + 砚台 + 毛笔 + 宣纸卷轴 + 朱砂印章
 * - Mascot 🐼 戴书生巾持 ✒ 毛笔 (左下), 助手 🐦‍⬛ 喜鹊 (右上, 报喜)
 * - framer-motion: 宣纸 spring 展开, 墨滴 wiggle, 点评朱砂印章落
 *
 * 入口: `/chinese/essay-inkstone-preview`
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { explainQuestion, generateEssayPrompt } from "../lib/tutor";
import { awardClusterXp } from "../lib/clusterXp";
import { ESSAY_PROMPTS, type EssayPrompt, type EssayTier } from "../subjects/chinese/essayPrompts";

const PROMPTS = ESSAY_PROMPTS;

/** 把 AI 返回的 "题目｜提示｜难度" 解析成 EssayPrompt (容错: 全角/半角竖线 + 去标签) */
function parseAiPrompt(raw: string): EssayPrompt | null {
  const cleaned = raw.replace(/[|│]/g, "｜").trim();
  const parts = cleaned.split("｜").map((s) => s.replace(/^(题目|提示|写作提示|难度)[:：]?\s*/, "").trim());
  const title = parts[0];
  if (!title || title.length < 3) return null;
  const guide = parts[1] || "大胆下笔，写清楚你想表达的意思。";
  const tier: EssayTier = (parts[2] || "").includes("成篇") ? "成篇" : "片段";
  return {
    id: `ai-${Date.now()}`,
    label: tier === "成篇" ? "成篇 · 小进出题" : "片段 · 小进出题",
    title,
    guide,
    minChars: tier === "成篇" ? 50 : 20,
    tier,
    category: "小进AI出题",
  };
}

export function EssayInkstonePreviewPage() {
  const [promptIdx, setPromptIdx] = useState(0);
  const [draft, setDraft] = useState("");
  const [judging, setJudging] = useState(false);
  const [critique, setCritique] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // AI 即时出题: 非 null 时覆盖题库当前题
  const [aiPrompt, setAiPrompt] = useState<EssayPrompt | null>(null);
  const [genLoading, setGenLoading] = useState(false);

  const cur = aiPrompt ?? PROMPTS[promptIdx]!;
  const charCount = draft.trim().length;
  const enough = charCount >= cur.minChars;

  async function handleJudge() {
    const text = draft.trim();
    if (!text || judging) return;
    setJudging(true);
    setCritique(null);
    setErr(null);
    try {
      const r = await explainQuestion({
        subjectId: "chinese",
        stem: `作文练习。题目: "${cur.title}"。要求: ${cur.guide}`,
        correctAnswer: "一篇扣题、有条理、用词生动的小学生作文片段",
        studentAnswer: text,
        skillName: "写作 / 作文",
        hint: `请点评这个 4 年级学生的作文(${charCount}字): 1) 扣题吗? 2) 有没有用上修辞/好词? 3) 结构清楚吗? 给一句鼓励 + 一个具体改进建议。语气亲切, 不超过 70 字。`,
      });
      setCritique(r.explanation);
      void awardClusterXp(1); // 写了作文 + 拿到点评 → 加 XP (鼓励动笔)
    } catch (e) {
      setErr((e as Error).message || "点评失败, 小进可能在研墨");
    } finally {
      setJudging(false);
    }
  }

  function nextPrompt() {
    setAiPrompt(null); // 回到题库
    setPromptIdx((i) => (i + 1) % PROMPTS.length);
    setDraft("");
    setCritique(null);
    setErr(null);
  }

  // AI 即时出题 — 复用 tutor explain 端点, 让小进出一道新作文题
  async function handleGeneratePrompt() {
    if (genLoading) return;
    setGenLoading(true);
    setErr(null);
    try {
      // 随机给个写作角度, 逼模型分散题材 (否则 temperature 高也老往同一主题跑)
      const ANGLES = [
        "写人(同学/家人/老师)", "写一件难忘的事", "写景(季节/天气/地点)",
        "状物(植物/物品/美食)", "写小动物", "想象作文", "看图写话",
        "续写故事", "我的爱好", "校园生活", "一次有趣的活动", "成长的瞬间",
      ];
      const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)];
      const r = await generateEssayPrompt({ grade: 4, theme: angle });
      const p = parseAiPrompt(r.prompt);
      if (!p) {
        setErr("小进出的题没看懂, 再点一次试试");
        return;
      }
      setAiPrompt(p);
      setDraft("");
      setCritique(null);
    } catch (e) {
      setErr((e as Error).message || "出题失败, 小进可能在研墨");
    } finally {
      setGenLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden text-stone-100"
      style={{
        height: "100dvh",
        background: "radial-gradient(ellipse at top, #1c1917 0%, #0c0a09 60%, #000 100%)",
      }}
    >
      {/* 墨黑书房 ambience */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-amber-800/12 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full bg-rose-900/12 blur-[120px] pointer-events-none" />

      {/* 书房装饰 */}
      <div className="absolute top-16 left-6 text-3xl opacity-50 select-none">📜</div>
      <div className="absolute top-16 right-6 text-3xl opacity-50 select-none">🐦‍⬛</div>
      <div className="absolute bottom-44 left-6 text-3xl opacity-40 select-none">🖋️</div>
      <div className="absolute bottom-44 right-6 text-3xl opacity-40 select-none">🏮</div>
      {/* 砚台墨滴 */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 opacity-60">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-3 h-3 rounded-full bg-stone-700"
            animate={{ y: [0, -3, 0], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
          />
        ))}
      </div>

      {/* ─── 顶部 HUD ─── */}
      <div className="absolute top-3 left-0 right-0 px-4 z-20 flex items-center justify-between">
        <Link to="/chinese" className="px-3 py-1.5 rounded-xl bg-stone-800/85 backdrop-blur-md border border-amber-700/50 text-xs font-bold text-amber-100">
          ← 离开书房
        </Link>
        <div className="px-4 py-1.5 rounded-xl bg-stone-800/85 backdrop-blur-md border border-amber-700/50 text-center">
          <div className="text-[10px] text-amber-400 uppercase tracking-widest">✏️ 自由作文砚台</div>
          <div className="text-sm font-display font-bold text-amber-100">{cur.label}</div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-stone-800/85 backdrop-blur-md border border-amber-700/50 text-xs font-bold text-amber-100 tabular-nums">
          {aiPrompt ? "✨ AI 题" : `${promptIdx + 1} / ${PROMPTS.length}`}
        </div>
      </div>

      {/* ─── 中央: 宣纸卷轴 ─── */}
      <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 z-10 w-full max-w-2xl px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={cur.id}
            initial={{ opacity: 0, scaleY: 0.7, y: 20 }}
            animate={{ opacity: 1, scaleY: 1, y: 0 }}
            exit={{ opacity: 0, scaleY: 0.8 }}
            transition={{ type: "spring", stiffness: 200, damping: 22 }}
          >
            {/* 宣纸 */}
            <div className="rounded-lg border-4 border-amber-900/70 shadow-2xl px-6 py-5"
              style={{ background: "linear-gradient(135deg, #faf8f3 0%, #f5f0e6 100%)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider">📜 题</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${cur.tier === "成篇" ? "bg-rose-200 text-rose-800" : "bg-amber-200 text-amber-800"}`}>
                  {cur.tier}
                </span>
              </div>
              <div className="text-stone-800 font-display text-lg leading-relaxed mb-1.5">{cur.title}</div>
              <div className="text-xs text-amber-800/80 mb-3 leading-relaxed">💡 {cur.guide}</div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="在这里下笔..."
                rows={cur.tier === "成篇" ? 5 : 3}
                className="w-full rounded-lg border-2 border-amber-300 bg-white/80 px-3 py-2 text-stone-800 text-base leading-relaxed focus:outline-none focus:border-amber-600 resize-none"
                style={{ fontFamily: "'KaiTi', 'STKaiti', serif" }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs ${enough ? "text-emerald-600" : "text-stone-400"}`}>
                  {charCount} 字 {enough ? "✓" : `(至少 ${cur.minChars})`}
                </span>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button onClick={nextPrompt} className="px-3 py-1.5 rounded-lg bg-stone-200 text-stone-700 text-sm hover:bg-stone-300 transition">
                    换一题 →
                  </button>
                  <button
                    onClick={handleGeneratePrompt}
                    disabled={genLoading}
                    className="px-3 py-1.5 rounded-lg bg-rose-800 text-white text-sm font-bold disabled:opacity-40 hover:bg-rose-700 transition"
                  >
                    {genLoading ? "🖌️ 研墨中..." : "🎲 小进出新题"}
                  </button>
                  <button
                    onClick={handleJudge}
                    disabled={!enough || judging}
                    className="px-4 py-1.5 rounded-lg bg-amber-700 text-white text-sm font-bold disabled:opacity-40 hover:bg-amber-600 transition"
                  >
                    {judging ? "🐦‍⬛ 小进品读中..." : "🐦‍⬛ 让小进点评"}
                  </button>
                </div>
              </div>
            </div>

            {critique && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="mt-3 rounded-xl bg-amber-950/50 border border-amber-500/40 px-4 py-3 text-sm text-amber-50 leading-relaxed">
                <span className="font-bold text-amber-200">🐦‍⬛ 小进点评:</span> {critique}
              </motion.div>
            )}
            {err && (
              <div className="mt-3 rounded-xl bg-rose-900/30 border border-rose-500/30 px-4 py-2 text-sm text-rose-200">{err}</div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Mascot 书生 (左下) */}
      <motion.div
        className="absolute bottom-6 left-4 text-5xl select-none z-10"
        animate={{ rotate: [0, -3, 3, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        🐼
      </motion.div>
    </div>
  );
}
