/**
 * v0.35.76 — Battle Preview (Sprint 5, Number Arena cluster).
 *
 * Bruce 反复问 "minigame 你怎么想的". 我之前只给了 cluster 名字 list, 没具体 visual.
 * 这是第 1 个具体 minigame prototype — 数字竞技场 (Number Arena cluster).
 *
 * 覆盖现行 4 个 game template: SpeedMatch / PlainNumeric / DecimalShifter / VerticalRepair.
 *
 * 设计 DNA (来自 Bruce 给的 hamster 战斗游戏 + Ring Fit Adventure + peer review 共识):
 *
 *   - **战场**: Mascot 🐼 左, 怪兽 (Number Gremlin 红 bug) 右
 *   - **HP**: ❤❤❤ Mascot + ❤❤❤ 怪兽 (顶部)
 *   - **题目卡**: 中央大字 "15 + ___ = 22" / "27 × 3 = ?" 等
 *   - **数字 tile bank**: 2×7 grid 14 个 tile (bottom)
 *   - **交互**:
 *     - 选对 → tile 飞向怪兽 + 怪兽 ❤-1 + Mascot 跳一下 + sound (TODO)
 *     - 选错 → tile shake + Mascot 鼓励 "再看看, 怪兽护盾还在!" (不扣 Mascot HP, 不羞辱)
 *   - **胜利**: 怪兽 HP=0 → "怪兽逃了!" + Celebration
 *   - **失败 (理论上很难发生因为不扣 HP)**: 仅时间结束 / 跳过过多
 *
 * 不需要 canvas / Three.js — 纯 SVG + Tailwind + CSS transforms.
 *
 * 入口: `/math/battle-preview` (mock 3 题 demo, 不写 db).
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

type Question = {
  id: string;
  prompt: string;  // e.g. "15 + ___ = 22"
  answer: number;
};

type Tile = { id: string; value: number };

const DEMO_QUESTIONS: Question[] = [
  { id: "q1", prompt: "15 + ___ = 22", answer: 7 },
  { id: "q2", prompt: "9 × 4 = ___", answer: 36 },
  { id: "q3", prompt: "28 − ___ = 19", answer: 9 },
  { id: "q4", prompt: "___ ÷ 6 = 5", answer: 30 },
  { id: "q5", prompt: "12 + 8 − ___ = 11", answer: 9 },
];

const ENCOURAGE_PHRASES = [
  "怪兽护盾还在! 再看看",
  "Panda 跟你一起想",
  "差一点点!",
  "再读一遍题",
];

export function BattlePreviewPage() {
  const [qIdx, setQIdx] = useState(0);
  const [enemyHp, setEnemyHp] = useState(3);
  const [mascotHp] = useState(3); // never decrement, just visual
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [flying, setFlying] = useState<{ tileId: string; value: number } | null>(null);
  const [shakeTileId, setShakeTileId] = useState<string | null>(null);
  const [mascotEmotion, setMascotEmotion] = useState<"idle" | "happy" | "encourage">("idle");
  const [enemyShake, setEnemyShake] = useState(false);
  const [won, setWon] = useState(false);
  const [encourageMsg, setEncourageMsg] = useState<string | null>(null);

  const currentQ = DEMO_QUESTIONS[qIdx]!;

  // Generate fresh tiles for current question (correct answer + 13 distractors)
  useEffect(() => {
    const correct = currentQ.answer;
    // 13 distractors close to correct
    const distractors = new Set<number>();
    while (distractors.size < 13) {
      const delta = Math.floor(Math.random() * 20) - 10;
      const cand = correct + delta;
      if (cand !== correct && cand > 0 && cand < 100) distractors.add(cand);
    }
    const arr = [correct, ...distractors];
    // shuffle
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    setTiles(arr.map((v, i) => ({ id: `t-${qIdx}-${i}`, value: v })));
    setFlying(null);
    setShakeTileId(null);
    setMascotEmotion("idle");
    setEncourageMsg(null);
  }, [qIdx, currentQ.answer]);

  function handleTileClick(tile: Tile) {
    if (flying || won) return;
    if (tile.value === currentQ.answer) {
      // Correct: tile flies to enemy, enemy takes damage
      setFlying({ tileId: tile.id, value: tile.value });
      setMascotEmotion("happy");
      setTimeout(() => {
        setEnemyShake(true);
        setEnemyHp((h) => Math.max(0, h - 1));
        setTimeout(() => setEnemyShake(false), 300);
      }, 500);
      setTimeout(() => {
        setFlying(null);
        if (enemyHp - 1 <= 0) {
          setWon(true);
        } else {
          setQIdx((i) => Math.min(DEMO_QUESTIONS.length - 1, i + 1));
        }
      }, 800);
    } else {
      // Wrong: tile shake, encourage Mascot
      setShakeTileId(tile.id);
      setMascotEmotion("encourage");
      const phrase = ENCOURAGE_PHRASES[Math.floor(Math.random() * ENCOURAGE_PHRASES.length)] ?? "再看看";
      setEncourageMsg(phrase);
      setTimeout(() => {
        setShakeTileId(null);
        setMascotEmotion("idle");
        setEncourageMsg(null);
      }, 1200);
    }
  }

  function handleReset() {
    setQIdx(0);
    setEnemyHp(3);
    setWon(false);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-gradient-to-b from-indigo-950 via-violet-900 to-emerald-950 text-white" style={{ height: "100dvh" }}>

      {/* 战场背景 — 远处森林 (SVG) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-50" preserveAspectRatio="none" viewBox="0 0 600 800">
        {/* 月亮 / 星空 */}
        <circle cx="500" cy="80" r="35" fill="#fef3c7" opacity="0.8" />
        <circle cx="500" cy="80" r="35" fill="#fde68a" opacity="0.3" />
        {[...Array(40)].map((_, i) => {
          const x = (i * 73) % 600;
          const y = (i * 37) % 400;
          const r = (i % 3) * 0.5 + 0.6;
          return <circle key={i} cx={x} cy={y} r={r} fill="white" opacity="0.7" />;
        })}
        {/* 树影 */}
        {[...Array(8)].map((_, i) => {
          const x = (i * 80) + 20;
          return (
            <g key={`tree-${i}`} opacity="0.5">
              <polygon points={`${x},580 ${x - 30},700 ${x + 30},700`} fill="#1e293b" />
              <polygon points={`${x},540 ${x - 35},650 ${x + 35},650`} fill="#0f172a" />
            </g>
          );
        })}
        {/* 地面 */}
        <ellipse cx="300" cy="780" rx="320" ry="30" fill="#1e293b" />
      </svg>

      <div className="relative h-full max-w-3xl mx-auto px-3 py-3 flex flex-col">

        {/* ─── 顶部 HUD: HP 双方 ─── */}
        <div className="flex items-center gap-3 mb-2 shrink-0">
          {/* Mascot HP (左) */}
          <div className="flex-1 bg-emerald-900/60 border-2 border-emerald-400/40 rounded-2xl px-3 py-1.5 flex items-center gap-2">
            <span className="text-xl">🐼</span>
            <span className="font-display font-bold text-sm flex-1 truncate">Selena</span>
            <span className="text-lg whitespace-nowrap">
              {[...Array(3)].map((_, i) => (
                <span key={i} className={i < mascotHp ? "text-rose-400" : "text-slate-600"}>❤</span>
              ))}
            </span>
          </div>

          {/* VS */}
          <div className="font-display font-black text-2xl text-amber-300">VS</div>

          {/* 怪兽 HP (右) */}
          <div className="flex-1 bg-rose-900/60 border-2 border-rose-400/40 rounded-2xl px-3 py-1.5 flex items-center gap-2">
            <span className="text-lg whitespace-nowrap">
              {[...Array(3)].map((_, i) => (
                <span key={i} className={i < enemyHp ? "text-rose-400" : "text-slate-600"}>❤</span>
              ))}
            </span>
            <span className="font-display font-bold text-sm flex-1 truncate text-right">数字小怪</span>
            <span className="text-xl">👹</span>
          </div>
        </div>

        {/* Progress mini bar */}
        <div className="flex items-center gap-2 px-2 mb-3 shrink-0">
          <span className="text-[10px] text-amber-200/80">题 {Math.min(qIdx + 1, DEMO_QUESTIONS.length)} / {DEMO_QUESTIONS.length}</span>
          <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-400 to-rose-400" style={{ width: `${((3 - enemyHp) / 3) * 100}%` }} />
          </div>
          <span className="text-[10px] text-rose-300/80">伤害 {3 - enemyHp} / 3</span>
        </div>

        {/* ─── 战场区: Mascot 左 + 题目中 + 怪兽右 ─── */}
        <div className="flex-1 flex items-center min-h-0 relative">

          {/* Mascot 左 */}
          <div className="flex-shrink-0 relative flex flex-col items-center">
            <div className={`text-[clamp(80px,14vh,180px)] leading-none ${mascotEmotion === "happy" ? "animate-bounce" : mascotEmotion === "encourage" ? "animate-pulse" : "animate-float"}`}>
              🐼
            </div>
            {/* Mascot 鼓励气泡 */}
            {encourageMsg && (
              <div className="absolute -top-4 left-full ml-2 bg-white text-slate-900 px-3 py-1.5 rounded-2xl rounded-bl-none shadow-lg text-xs font-bold whitespace-nowrap animate-fade-in">
                {encourageMsg}
              </div>
            )}
          </div>

          {/* 题目卡 中央 */}
          <div className="flex-1 mx-4">
            <div className="bg-slate-900/70 border-2 border-amber-400/40 rounded-3xl px-4 py-6 text-center shadow-2xl backdrop-blur">
              <div className="text-[11px] text-amber-200/80 uppercase tracking-widest mb-2">攻击咒语</div>
              <div className="font-display font-black text-[clamp(28px,4.5vw,52px)] text-amber-50 tabular-nums leading-none">
                {currentQ.prompt}
              </div>
              {won && (
                <div className="mt-4 text-emerald-300 font-display font-bold text-xl animate-bounce">
                  🎉 怪兽被赶跑了!
                </div>
              )}
            </div>
          </div>

          {/* 怪兽 右 */}
          <div className={`flex-shrink-0 relative ${enemyShake ? "animate-shake" : ""}`}>
            <div className={`text-[clamp(80px,14vh,180px)] leading-none ${won ? "opacity-0 scale-0 transition-all duration-700" : "animate-float-slow"}`}>
              👹
            </div>
            {/* 飞行 tile */}
            {flying && (
              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-4 animate-fly-to-enemy">
                <div className="bg-amber-400 text-slate-900 font-display font-black text-2xl px-4 py-2 rounded-xl border-2 border-amber-200 shadow-2xl">
                  {flying.value}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── 底部: 数字 tile bank ─── */}
        <div className="shrink-0 pt-2">
          {!won ? (
            <div className="grid grid-cols-7 gap-1.5">
              {tiles.map((tile) => (
                <button
                  key={tile.id}
                  onClick={() => handleTileClick(tile)}
                  disabled={!!flying}
                  className={`aspect-square rounded-xl bg-white text-slate-900 font-display font-bold text-xl shadow-lg border-2 border-slate-200 hover:scale-105 active:scale-95 transition-transform ${shakeTileId === tile.id ? "animate-shake bg-rose-200" : ""} ${flying?.tileId === tile.id ? "opacity-0" : ""} ${flying ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  {tile.value}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-3 justify-center">
              <button onClick={handleReset} className="btn-primary px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-500 text-slate-900 font-display font-black text-lg">
                ▶ 再战一次
              </button>
              <Link to="/math/hub-v4" className="px-6 py-3 rounded-2xl bg-slate-800 border-2 border-slate-600 text-slate-100 font-display font-bold text-base">
                ← 回 Hub
              </Link>
            </div>
          )}
        </div>

        {/* 评审 tag */}
        <div className="text-center text-[10px] text-violet-300/40 pt-2 shrink-0">
          ⚔️ 数字竞技场 (Number Arena) — Sprint 5 prototype ·{" "}
          <Link className="underline" to="/math/hub-v4">→ Hub v4</Link> ·{" "}
          <Link className="underline" to="/math">老首页</Link>
        </div>
      </div>

      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
        @keyframes fly-to-enemy {
          0% { transform: translateX(-300px) scale(1.2); opacity: 1; }
          100% { transform: translateX(0) scale(0.6); opacity: 0; }
        }
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        .animate-fly-to-enemy { animation: fly-to-enemy 0.6s ease-out forwards; }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}
