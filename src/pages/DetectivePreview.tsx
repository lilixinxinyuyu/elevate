/**
 * v0.35.77 — Sprint 6: 应用题侦探 (Word Problem Detective) cluster prototype.
 *
 * Cluster 涵盖现行 template: ShopCounter / MultiStepApplication (4-phase) / ClueFinder.
 *
 * 设计 DNA (peer review converge):
 * - **题目 = 案件**, 玩家 = 侦探, 答案 = 破案线索
 * - 视觉: 暗紫色雾 + 街灯 + 老式建筑剪影 (Sherlock Holmes 风)
 * - Mascot 🐼 + 🔍 放大镜 (侦探装扮)
 * - 怪兽 = 神秘"Trickster"窃案者 🦝 (raccoon emoji, 不恐怖)
 * - 题目卡 = 案件档案 (Manila folder 风, 黄色 paper texture)
 * - 选项 = 4 张证据卡 (悬浮 + 翻转动画)
 * - 答对 → 证据飞向案卷 + Trickster 露马脚 + "📁 案件已破!"
 * - 答错 → 证据 dim out + 鼓励气泡 "线索还不够"
 *
 * 入口: `/math/detective-preview` (mock 5 应用题 demo)
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

type DetectiveCase = {
  id: string;
  stem: string;
  caseLabel: string;
  options: { id: string; text: string }[];
  correctId: string;
};

const DEMO_CASES: DetectiveCase[] = [
  {
    id: "c1",
    caseLabel: "案件 #001 · 商店余款",
    stem: "Selena 有 20 元, 买 3 个 4.5 元的东西, 还剩多少?",
    options: [
      { id: "a", text: "6.5 元" },
      { id: "b", text: "7.5 元" },
      { id: "c", text: "8.5 元" },
      { id: "d", text: "13.5 元" },
    ],
    correctId: "a",
  },
  {
    id: "c2",
    caseLabel: "案件 #002 · 妈妈买鱼",
    stem: "妈妈买 3.2 千克鱼, 每千克 16.5 元, 付 50 元够吗? 算出鱼一共多少元.",
    options: [
      { id: "a", text: "52.8 元 · 不够" },
      { id: "b", text: "49.5 元 · 够" },
      { id: "c", text: "32.0 元 · 够" },
      { id: "d", text: "53.2 元 · 不够" },
    ],
    correctId: "a",
  },
  {
    id: "c3",
    caseLabel: "案件 #003 · 高铁速度",
    stem: "高铁每小时 320 千米, 跑 3 小时多远?",
    options: [
      { id: "a", text: "960 千米" },
      { id: "b", text: "320 千米" },
      { id: "c", text: "1080 千米" },
      { id: "d", text: "640 千米" },
    ],
    correctId: "a",
  },
];

const HINT_PHRASES = [
  "线索还不够, 再看看证据",
  "Panda 翻翻案卷, 这条不对",
  "再读一遍案件描述",
  "证据指向其他答案",
];

export function DetectivePreviewPage() {
  const [caseIdx, setCaseIdx] = useState(0);
  const [solvedCases, setSolvedCases] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showResult, setShowResult] = useState<"correct" | "wrong" | null>(null);
  const [hintMsg, setHintMsg] = useState<string | null>(null);
  const [won, setWon] = useState(false);

  const currentCase = DEMO_CASES[caseIdx]!;

  useEffect(() => {
    setSelectedId(null);
    setShowResult(null);
    setHintMsg(null);
  }, [caseIdx]);

  function handleOptionClick(opt: { id: string; text: string }) {
    if (showResult === "correct" || won) return;
    setSelectedId(opt.id);
    if (opt.id === currentCase.correctId) {
      setShowResult("correct");
      setHintMsg(null);
      setTimeout(() => {
        const newSolved = solvedCases + 1;
        setSolvedCases(newSolved);
        if (newSolved >= DEMO_CASES.length) {
          setWon(true);
        } else {
          setCaseIdx((i) => Math.min(DEMO_CASES.length - 1, i + 1));
        }
      }, 1800);
    } else {
      setShowResult("wrong");
      const phrase = HINT_PHRASES[Math.floor(Math.random() * HINT_PHRASES.length)] ?? "再看看";
      setHintMsg(phrase);
      setTimeout(() => {
        setShowResult(null);
        setSelectedId(null);
      }, 1500);
    }
  }

  function handleReset() {
    setCaseIdx(0);
    setSolvedCases(0);
    setWon(false);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden text-amber-50" style={{ height: "100dvh", background: "linear-gradient(180deg, #1a0d2e 0%, #2d1b3d 50%, #0f0820 100%)" }}>

      {/* 雾 + 街灯 + 老式建筑剪影 SVG */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-50" preserveAspectRatio="none" viewBox="0 0 600 800">
        {/* 月光 (微弱) */}
        <circle cx="500" cy="100" r="50" fill="#fef3c7" opacity="0.2" />
        <circle cx="500" cy="100" r="80" fill="#fef3c7" opacity="0.08" />
        {/* 雾 (4 层水平) */}
        {[200, 350, 500, 650].map((y, i) => (
          <ellipse key={`fog-${i}`} cx="300" cy={y} rx="320" ry="20" fill="#9333ea" opacity={0.1 - i * 0.02} />
        ))}
        {/* 城市建筑剪影 */}
        {[60, 180, 320, 470].map((x, i) => {
          const w = 60 + (i % 3) * 20;
          const h = 200 + (i * 30) % 100;
          return (
            <rect key={`bldg-${i}`} x={x} y={800 - h - 40} width={w} height={h} fill="#0a0418" opacity="0.8" />
          );
        })}
        {/* 街灯 (3 盏) */}
        {[80, 280, 520].map((x, i) => (
          <g key={`lamp-${i}`}>
            <rect x={x - 1} y="620" width="2" height="80" fill="#3d2c1a" />
            <circle cx={x} cy="615" r="6" fill="#fde68a" opacity="0.9" />
            <circle cx={x} cy="615" r="20" fill="#fde68a" opacity="0.2" />
          </g>
        ))}
      </svg>

      <div className="relative h-full max-w-3xl mx-auto px-4 py-4 flex flex-col">

        {/* ─── 顶 HUD: 案件进度 ─── */}
        <div className="flex items-center gap-3 mb-3 shrink-0">
          <div className="flex-1 bg-amber-900/50 border-2 border-amber-400/30 rounded-2xl px-4 py-2 flex items-center gap-2 backdrop-blur">
            <span className="text-2xl">🔍</span>
            <div className="flex-1">
              <div className="text-[10px] text-amber-200/80 uppercase tracking-widest">侦探任务</div>
              <div className="font-display font-bold text-amber-100 text-sm">{currentCase.caseLabel}</div>
            </div>
          </div>
          <div className="bg-amber-900/50 border-2 border-amber-400/30 rounded-2xl px-3 py-2 flex items-center gap-1.5">
            <span className="text-xl">📁</span>
            <span className="font-display font-black text-2xl tabular-nums">{solvedCases}<span className="text-sm opacity-60"> / {DEMO_CASES.length}</span></span>
          </div>
        </div>

        {/* ─── 中部: Mascot 侦探 + 案件档案 + Trickster ─── */}
        <div className="flex-1 flex flex-col items-center min-h-0 relative">

          {/* 顶部小怪 (Trickster) 在上方 */}
          {!won && (
            <div className="relative mb-2">
              <div className={`text-[clamp(50px,9vh,90px)] leading-none ${showResult === "correct" ? "animate-shake-strong" : "animate-float-slow"}`}>🦝</div>
              {showResult === "correct" && (
                <div className="absolute -top-2 left-full ml-2 text-[10px] text-rose-200 whitespace-nowrap font-bold animate-fade-in">露马脚了!</div>
              )}
            </div>
          )}

          {/* 案件档案卡 (Manila folder 风) */}
          <div className="w-full max-w-xl mb-3 relative">
            <div className="rounded-r-2xl rounded-tl-2xl px-5 py-4 shadow-2xl border-r-4 border-b-4 border-amber-900" style={{ background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)", color: "#1a0d2e" }}>
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-900/30">
                <span className="text-lg">📋</span>
                <div className="text-[10px] uppercase tracking-widest font-bold text-amber-900">证据描述</div>
                <div className="flex-1" />
                <div className="text-[10px] tabular-nums text-amber-900/70">题 {caseIdx + 1}/{DEMO_CASES.length}</div>
              </div>
              <div className="font-display font-bold text-[clamp(15px,2vw,20px)] leading-relaxed">
                {currentCase.stem}
              </div>
            </div>
            {/* 文件夹角标 (右下三角形) */}
            <div className="absolute -bottom-1 right-0 w-6 h-6 bg-amber-200 transform rotate-45 -translate-x-1/2 translate-y-1/2 shadow" />
          </div>

          {/* Mascot 侦探装 (左下) */}
          <div className="absolute left-2 bottom-32 flex flex-col items-center">
            <div className="relative">
              <div className={`text-[clamp(70px,12vh,140px)] leading-none ${showResult === "correct" ? "animate-bounce" : showResult === "wrong" ? "animate-pulse" : "animate-float"}`}>🐼</div>
              {/* 放大镜 emoji 浮在右肩 */}
              <div className="absolute -top-2 -right-3 text-2xl rotate-12">🔍</div>
            </div>
            {/* Mascot 鼓励气泡 */}
            {hintMsg && (
              <div className="absolute -top-12 left-full ml-2 bg-amber-50 text-slate-900 px-3 py-1.5 rounded-2xl rounded-bl-none shadow-lg text-xs font-bold whitespace-nowrap animate-fade-in">
                {hintMsg}
              </div>
            )}
          </div>

          {/* 4 证据卡选项 */}
          {!won ? (
            <div className="grid grid-cols-2 gap-3 w-full max-w-lg ml-auto pb-2">
              {currentCase.options.map((opt) => {
                const isSelected = selectedId === opt.id;
                const isCorrect = isSelected && showResult === "correct";
                const isWrong = isSelected && showResult === "wrong";
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleOptionClick(opt)}
                    disabled={showResult === "correct"}
                    className={`relative rounded-2xl p-3 text-left shadow-xl border-2 transition-all hover:scale-[1.03] active:scale-95
                      ${isCorrect ? "bg-emerald-500 border-emerald-200 text-white animate-bounce" :
                        isWrong ? "bg-rose-500/30 border-rose-300/50 text-rose-100 animate-shake opacity-50" :
                        "bg-gradient-to-br from-amber-100 to-amber-200 border-amber-300 text-slate-900 hover:from-amber-50 hover:to-amber-100"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-sm shrink-0
                        ${isCorrect ? "bg-emerald-700 text-white" :
                          isWrong ? "bg-rose-700 text-white" :
                          "bg-amber-800 text-amber-50"
                        }`}>
                        {opt.id.toUpperCase()}
                      </div>
                      <span className="font-bold text-sm tabular-nums">{opt.text}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center pb-2 animate-fade-in">
              <div className="text-6xl mb-3">🎉</div>
              <div className="font-display font-black text-2xl text-amber-200 mb-1">所有案件已破!</div>
              <div className="text-amber-300/80 text-sm mb-4">Trickster 投降了, Panda 侦探得分 {DEMO_CASES.length} ⭐</div>
              <div className="flex gap-3 justify-center">
                <button onClick={handleReset} className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-500 text-slate-900 font-display font-black text-base shadow-xl">
                  ▶ 再来一案
                </button>
                <Link to="/math/hub-v4" className="px-6 py-3 rounded-2xl bg-slate-800 border-2 border-slate-600 text-slate-100 font-display font-bold text-base">
                  ← 回 Hub
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* 评审 tag */}
        <div className="text-center text-[10px] text-amber-300/40 pt-2 shrink-0">
          🔍 应用题侦探 (Word Problem Detective) — Sprint 6 prototype ·{" "}
          <Link className="underline" to="/math/battle-preview">→ 数字竞技场</Link> ·{" "}
          <Link className="underline" to="/math/hub-v4">→ Hub v4</Link> ·{" "}
          <Link className="underline" to="/math">老首页</Link>
        </div>
      </div>

      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
        @keyframes shake-strong { 0%, 100% { transform: translateX(0) rotate(0); } 25% { transform: translateX(-12px) rotate(-12deg); } 75% { transform: translateX(12px) rotate(12deg); } }
        @keyframes fade-in { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        .animate-shake-strong { animation: shake-strong 0.5s ease-in-out; }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}
