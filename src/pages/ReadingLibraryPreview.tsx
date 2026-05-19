/**
 * v0.36.3 — Sprint C6: 📖 阅读图书馆 (Reading Library) Chinese cluster prototype.
 *
 * Chinese Cluster 6/7. 覆盖 阅读理解 multi-step 题型 (G4B 期中考第 10-11 题).
 *
 * 核心洞察: 期中卷子原文 page 1 "假如我来当校长" + page 3 "健康食堂" 都是
 * 短文 + 多问 格式. 把 "阅读理解" → "在古风书院里读卷, 答完一连串问题".
 * 古典书院氛围让长篇阅读更有仪式感, 没那么"累".
 *
 * 设计 DNA (古典书院 / 翰林院主题, 深酒红+烫金+木色, 跟其他 cluster 区别):
 * - 深酒红 + 烫金 + 木色 (古典书院, 翰林苑)
 * - 书架剪影 (5+ 层书) + 烛台 + 卷轴堆 + 古砚台
 * - Mascot 🐼 戴 📚 学士帽 (左下)
 * - 助手 = 🦉 学问 Owl (右上)
 * - 中央: 大书页展开 + 短文 + 当前问题 + 4 选项
 * - 进度: "第 N 问 / 共 5 问"
 * - 答对 → 烫金光晕 + Owl 鞠躬 + "学问见长!"
 * - 答错 → 书页轻颤 + Owl 提示 "再读细一些"
 *
 * 数据: 复用 readingPack.ts 的 短文 + 问题 (跟 ChineseTrain 一致)
 * Phase 3 用第一短文 "春天的乡下" (5 题) 演示.
 *
 * 入口: `/chinese/reading-library-preview`
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

type ReadingPassage = {
  id: string;
  title: string;
  passage: string;
  questions: {
    q: string;
    options: string[];
    correctIdx: number;
    solution: string;
  }[];
};

// 复用 readingPack 短文 1 数据 (春天的乡下, 5 题)
const PASSAGE_1: ReadingPassage = {
  id: "p1",
  title: "📖 卷一·春天的乡下",
  passage: `春天到了, 乡下到处充满了生机. 桃花开得像火, 樱花白得像雪, 油菜花金黄一片, 远远望去像铺在田野上的金色地毯.

燕子从南方飞回来了, 在屋檐下叽叽喳喳地筑起了温暖的小巢. 小溪欢快地流着, 水里的小鱼自由自在地游来游去.

乡下的孩子们也忙起来了, 他们在田野里放风筝, 在小溪边追蝴蝶, 在桃树下捉迷藏. 春天的乡下, 真是个充满乐趣的地方.`,
  questions: [
    {
      q: "短文主要描写的是什么?",
      options: [
        "春天乡下的生机和孩子们的乐趣",
        "桃花和樱花的区别",
        "怎样捉迷藏",
        "燕子的生活习性",
      ],
      correctIdx: 0,
      solution: "短文从景物 (花/燕/溪) + 孩子活动 (放风筝/追蝶/捉迷藏) 双线描写春天乡下.",
    },
    {
      q: "\"桃花开得像火, 樱花白得像雪\" 用了什么修辞?",
      options: ["比喻 (X 像 Y)", "拟人 (物当人)", "排比 (3 个相同结构)", "夸张 (放大特征)"],
      correctIdx: 0,
      solution: "\"X 像 Y\" 是比喻句. 桃花比火 (红艳), 樱花比雪 (洁白).",
    },
    {
      q: "孩子在做的 3 件事是?",
      options: [
        "放风筝 / 追蝴蝶 / 捉迷藏",
        "种花 / 钓鱼 / 爬树",
        "唱歌 / 跳舞 / 画画",
        "种树 / 摘花 / 抓鱼",
      ],
      correctIdx: 0,
      solution: "短文倒数第二句: \"在田野里放风筝, 在小溪边追蝴蝶, 在桃树下捉迷藏\".",
    },
    {
      q: "\"金色的地毯\" 在文中指什么?",
      options: ["成片的油菜花", "金色的稻田", "黄色的沙土", "金黄的落叶"],
      correctIdx: 0,
      solution: "\"油菜花金黄一片, 远远望去像铺在田野上的金色地毯\". 比喻油菜花.",
    },
    {
      q: "这篇短文表达了作者怎样的感情?",
      options: [
        "对春天乡下的喜爱和留恋",
        "对花朵颜色的好奇",
        "对孩子玩耍的羡慕",
        "对城市生活的厌倦",
      ],
      correctIdx: 0,
      solution: "末句 \"真是个充满乐趣的地方\" + 全文景物 + 孩子双线烘托喜爱.",
    },
  ],
};

const ENCOURAGE_PHRASES = [
  "再读细一些, 答案藏在字里",
  "Owl 慢慢看, 不急",
  "卷子读 2 遍, 通透不少",
  "古人云: 书读百遍, 其义自见",
];

export function ReadingLibraryPreviewPage() {
  const [qIdx, setQIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [encouragePhrase, setEncouragePhrase] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);

  const cur = PASSAGE_1.questions[qIdx]!;

  useEffect(() => {
    if (result === "correct") {
      const t = setTimeout(() => {
        if (qIdx + 1 >= PASSAGE_1.questions.length) {
          setAllDone(true);
        } else {
          setQIdx((i) => i + 1);
          setSelectedIdx(null);
          setResult("idle");
          setEncouragePhrase(null);
        }
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [result, qIdx]);

  function handleChoice(idx: number) {
    if (result === "correct") return;
    setSelectedIdx(idx);
    if (idx === cur.correctIdx) {
      setResult("correct");
      setEncouragePhrase(null);
    } else {
      setResult("wrong");
      setEncouragePhrase(ENCOURAGE_PHRASES[Math.floor(Math.random() * ENCOURAGE_PHRASES.length)] ?? null);
      setTimeout(() => setResult("idle"), 700);
    }
  }

  function restart() {
    setQIdx(0);
    setSelectedIdx(null);
    setResult("idle");
    setEncouragePhrase(null);
    setAllDone(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden text-amber-50"
      style={{
        height: "100dvh",
        background: "radial-gradient(ellipse at top, #4c1d1d 0%, #2d1010 50%, #1a0606 100%)",
      }}
    >
      {/* 深酒红 ambience */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-red-900/30 blur-[120px] pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-amber-700/25 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-orange-900/20 blur-[120px] pointer-events-none" />

      {/* 书院背景: 高大书架 + 烛光 */}
      <svg className="absolute inset-0 w-full h-full opacity-35 pointer-events-none" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice">
        {/* 左书架 (高大) */}
        <rect x="0" y="80" width="120" height="540" fill="#2d1010" stroke="#fcd34d" strokeWidth="1" opacity="0.5" />
        {[120, 200, 280, 360, 440, 520].map((y, i) => (
          <g key={`l-${i}`}>
            <line x1="0" y1={y} x2="120" y2={y} stroke="#fcd34d" strokeWidth="1" opacity="0.4" />
            {[0, 2, 4].map((bi) => (
              <rect
                key={bi}
                x={10 + bi * 35}
                y={y - 70 + (bi % 2) * 5}
                width="30"
                height={60 + (bi % 2) * 8}
                fill={["#7c2d12", "#92400e", "#a16207", "#854d0e", "#6b1d04"][bi % 5]}
                stroke="#fcd34d"
                strokeWidth="0.5"
                opacity="0.85"
              />
            ))}
          </g>
        ))}

        {/* 右书架 */}
        <rect x="880" y="80" width="120" height="540" fill="#2d1010" stroke="#fcd34d" strokeWidth="1" opacity="0.5" />
        {[150, 230, 310, 390, 470, 550].map((y, i) => (
          <g key={`r-${i}`}>
            <line x1="880" y1={y} x2="1000" y2={y} stroke="#fcd34d" strokeWidth="1" opacity="0.4" />
            {[0, 2, 4].map((bi) => (
              <rect
                key={bi}
                x={890 + bi * 35}
                y={y - 70 + (bi % 2) * 5}
                width="30"
                height={60 + (bi % 2) * 8}
                fill={["#92400e", "#7c2d12", "#854d0e", "#a16207", "#6b1d04"][bi % 5]}
                stroke="#fcd34d"
                strokeWidth="0.5"
                opacity="0.85"
              />
            ))}
          </g>
        ))}

        {/* 烛台 (left mid + right mid) */}
        {[
          { x: 180, y: 530 },
          { x: 820, y: 530 },
        ].map((c, i) => (
          <g key={i} transform={`translate(${c.x}, ${c.y})`} className="animate-candle-flicker" style={{ animationDelay: `${i * 0.6}s` } as React.CSSProperties}>
            {/* 烛台 base */}
            <ellipse cx="0" cy="0" rx="14" ry="4" fill="#854d0e" />
            <rect x="-3" y="-22" width="6" height="22" fill="#92400e" />
            {/* 烛 */}
            <rect x="-2" y="-32" width="4" height="10" fill="#fef3c7" />
            {/* 火焰 */}
            <path d="M 0 -32 Q -3 -42 0 -50 Q 3 -42 0 -32 Z" fill="#fcd34d" opacity="0.9" />
            <circle cx="0" cy="-42" r="2" fill="#fef3c7" opacity="0.8" />
            {/* 光晕 */}
            <circle cx="0" cy="-30" r="60" fill="#fcd34d" opacity="0.12" />
          </g>
        ))}

        {/* 古砚台 (bottom center) */}
        <g transform="translate(500, 660)">
          <ellipse cx="0" cy="0" rx="40" ry="10" fill="#1c0a05" stroke="#fcd34d" strokeWidth="1" opacity="0.6" />
          <ellipse cx="0" cy="-3" rx="30" ry="6" fill="#0c0306" opacity="0.8" />
        </g>

        {/* 飘字 (背景层装饰) */}
        {Array.from({ length: 12 }).map((_, i) => {
          const x = ((i * 91) % 90) + 5;
          const y = ((i * 47) % 50) + 10;
          const ch = ["书", "卷", "学", "墨", "诗", "文", "知", "智", "读", "思", "道", "礼"][i % 12];
          return (
            <text
              key={i}
              x={`${x}%`}
              y={`${y}%`}
              fontSize={14 + (i % 3) * 4}
              fill="#fcd34d"
              opacity={((i * 13) % 100) / 100 * 0.2 + 0.1}
              fontFamily="serif"
              className="animate-char-drift"
              style={{ animationDelay: `${i * 0.5}s` } as React.CSSProperties}
            >
              {ch}
            </text>
          );
        })}
      </svg>

      {/* 角落装饰 emoji */}
      <div className="absolute top-16 left-6 text-3xl opacity-50 select-none">📚</div>
      <div className="absolute top-16 right-6 text-3xl opacity-50 select-none">🪔</div>
      <div className="absolute bottom-44 left-6 text-3xl opacity-50 select-none">📜</div>
      <div className="absolute bottom-44 right-6 text-3xl opacity-50 select-none">🖋️</div>

      {/* ─── 顶部 HUD ─── */}
      <div className="absolute top-3 left-0 right-0 px-4 z-20 flex items-center justify-between">
        <Link to="/chinese" className="px-3 py-1.5 rounded-xl bg-red-950/85 backdrop-blur-md border border-amber-500/50 text-xs font-bold text-amber-100">
          ← 离开书院
        </Link>
        <div className="px-4 py-1.5 rounded-xl bg-red-950/85 backdrop-blur-md border border-amber-500/50 text-center">
          <div className="text-[10px] text-amber-300 uppercase tracking-widest">📖 翰林书院</div>
          <div className="text-sm font-display font-bold text-amber-100">{PASSAGE_1.title}</div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-red-950/85 backdrop-blur-md border border-amber-500/50 text-xs font-bold text-amber-100 tabular-nums">
          {qIdx + 1} / {PASSAGE_1.questions.length}
        </div>
      </div>

      {/* ─── 中央: 大书页 (短文左 + 题目右) ─── */}
      {!allDone && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-full max-w-5xl px-4 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
            {/* 左书页: 短文 */}
            <div
              className={`relative px-6 py-5 rounded-2xl border-4 border-amber-700 shadow-2xl transition-all duration-300 ${result === "wrong" ? "animate-library-shake" : ""}`}
              style={{
                // v0.36.5 (Bruce P0): "灰文红 bg 不好识别" — repeating-linear 当 backgroundImage
                // 覆盖了 Tailwind amber gradient → 卷透明 → 红底显示穿透.
                // 改 backgroundColor 强制米黄底色, 文字 text-stone-900 在米黄上对比清晰.
                backgroundColor: "#fef3c7",
                backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 26px, rgba(146,64,14,0.18) 26px, rgba(146,64,14,0.18) 27px)",
                animation: result === "wrong" ? "library-shake 0.5s ease-in-out" : undefined,
              }}
            >
              <div className="text-[10px] text-red-800 uppercase tracking-widest text-center mb-2">📖 卷宗</div>
              <div className="text-stone-900 leading-relaxed text-sm sm:text-base font-display whitespace-pre-line" style={{ fontFamily: "'Songti SC', 'STSong', serif" }}>
                {PASSAGE_1.passage}
              </div>
            </div>

            {/* 右书页: 题目 + 选项 */}
            <div className="px-5 py-5 rounded-2xl bg-red-950/60 backdrop-blur-md border-2 border-amber-500/40 shadow-xl flex flex-col">
              <div className="text-[10px] text-amber-300 uppercase tracking-widest mb-1">📝 第 {qIdx + 1} 问</div>
              <div className="font-display font-bold text-amber-100 text-base sm:text-lg mb-4 leading-snug">
                {cur.q}
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {cur.options.map((opt, i) => {
                  const isCorrect = result === "correct" && i === cur.correctIdx;
                  const isWrong = result === "wrong" && i === selectedIdx;
                  const isOther = result !== "idle" && i !== cur.correctIdx && i !== selectedIdx;
                  return (
                    <button
                      key={i}
                      onClick={() => handleChoice(i)}
                      disabled={result === "correct"}
                      className={`
                        px-3 py-2.5 rounded-xl border-2 font-display font-bold text-sm text-left
                        transition-all
                        ${isCorrect ? "bg-amber-300 border-amber-200 text-amber-950 scale-[1.02] shadow-lg shadow-amber-500/50" :
                          isWrong ? "bg-rose-500 border-rose-200 text-rose-950 animate-pulse" :
                          isOther ? "bg-red-900/30 border-red-900 text-red-300/50 opacity-50" :
                          "bg-red-950/60 backdrop-blur-md border-amber-500/40 text-amber-100 hover:scale-[1.01] active:scale-95 shadow-lg"}
                      `}
                    >
                      <span className="text-amber-400 mr-2">{String.fromCharCode(65 + i)}.</span>
                      {opt}
                    </button>
                  );
                })}
              </div>
              {/* 解析 (答对后显示) */}
              {result === "correct" && (
                <div className="mt-3 px-3 py-2 bg-emerald-900/60 backdrop-blur-md border border-emerald-300/40 rounded-lg text-emerald-100 text-xs">
                  💡 {cur.solution}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── 完成 ─── */}
      {allDone && (
        <div className="absolute inset-0 flex items-center justify-center z-30">
          <div className="text-center max-w-lg px-6 py-8 bg-red-950/95 backdrop-blur-md border-2 border-amber-400 rounded-3xl shadow-2xl">
            <div className="text-6xl mb-3">🎓</div>
            <div className="font-display font-black text-2xl text-amber-200 mb-2">学问见长!</div>
            <div className="text-amber-100 text-sm mb-5">完成《春天的乡下》5 问. 你已掌握短文阅读的精髓.</div>
            <button
              onClick={restart}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 font-bold shadow-lg hover:scale-105 transition"
            >
              再读一遍 ↻
            </button>
            <Link to="/chinese" className="block mt-3 text-amber-300 text-xs underline">回语文 hub</Link>
          </div>
        </div>
      )}

      {/* ─── 左下 Mascot ─── */}
      <div className="absolute left-4 bottom-4 sm:left-8 sm:bottom-8 flex flex-col items-center gap-1 pointer-events-none z-10">
        <div className="relative">
          <div
            className="text-[64px] sm:text-[80px] leading-none"
            style={{
              animation: result === "correct" ? "library-bow 0.8s ease-in-out" : "library-float 3s ease-in-out infinite",
            }}
          >🐼</div>
          {/* 学士帽 */}
          <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 text-3xl">📚</div>
        </div>
        {encouragePhrase && (
          <div className="px-3 py-1.5 rounded-2xl bg-amber-100/95 text-red-900 text-xs font-bold shadow-lg max-w-[180px] text-center" style={{ animation: "library-pop 0.4s ease-out" }}>
            {encouragePhrase}
          </div>
        )}
      </div>

      {/* ─── 右上 Wise Owl ─── */}
      <div className="absolute right-4 bottom-4 sm:right-8 sm:bottom-8 flex flex-col items-center pointer-events-none z-10">
        <div
          className="text-[52px] sm:text-[64px] leading-none"
          style={{
            animation: result === "correct" ? "library-owl-cheer 0.8s ease-in-out" : "library-float-slow 4s ease-in-out infinite",
          }}
        >🦉</div>
        <div className="text-[10px] text-amber-400/70 mt-1">学问 Owl</div>
      </div>

      {/* footer */}
      <div className="fixed bottom-1 left-2 text-[9px] text-amber-400/30 z-40 pointer-events-auto">
        Sprint C6 📖 阅读图书馆 · <Link className="underline" to="/chinese">语文 hub</Link>
      </div>

      <style>{`
        @keyframes library-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes library-float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes library-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        @keyframes library-bow { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-18deg); } }
        @keyframes library-owl-cheer { 0%, 100% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(-15deg) scale(1.2); } 75% { transform: rotate(15deg) scale(1.2); } }
        @keyframes library-pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes candle-flicker { 0%, 100% { opacity: 0.9; } 33% { opacity: 1; } 66% { opacity: 0.85; } }
        @keyframes char-drift { 0%, 100% { transform: translateY(0); opacity: 0.15; } 50% { transform: translateY(-8px); opacity: 0.25; } }
        .animate-candle-flicker { animation: candle-flicker 2s ease-in-out infinite; }
        .animate-char-drift { animation: char-drift 6s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
