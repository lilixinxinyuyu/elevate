/**
 * Hub v7 主界面预览 — "指挥舱 (Cockpit)" 重构。
 * 入口: /math/hub-v7-preview。
 *
 * 设计来源: Bruce 反馈 + 看真截图的 gemini-3-pro(设计师) + gpt-5.5(策划师) 一致 critique
 * (docs/hub-v7-design-spec.md v3): 三栏指挥舱 = 中央角色(情绪) + 左右两块大磨砂玻璃面板(信息)
 * + 底部动态主 CTA(行动)。把原版 dashboard 的信息密度/精致/彩色能力雷达**收纳进面板**, 修掉
 * 之前"角色周围空旷 + 边缘散 icon(贴纸效应)"的廉价感。
 *
 * 角色立绘用预抠样张 (/_fb-demo.png); 真版 = onboarding/升段 实时生成 + 抠图 + 缓存。
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from "../db/dexie";
import { getTotalXp, computeCurrentRating, getFragileSkillsToReview } from "../db/service";
import { levelFromXp } from "../core/scoring";
import { currentExam, daysUntil } from "../core/examDates";
import { computeAbilityDiagnostic } from "../core/rating";

// 高级玻璃: 顶部内高光(白) + 底部内暗边 = 厚度感; 强背景模糊 (designer: 别像平庸网页 div)。
const GLASS =
  "rounded-3xl bg-white/[0.07] backdrop-blur-2xl border border-white/20 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.3),0_10px_44px_rgba(0,0,0,0.55)]";

/** 4 维能力雷达 (彩色, 高级感来源 — 从原版搬进左面板)。 */
function Radar({ vals, prev, grow }: { vals: { label: string; v: number; hue: string }[]; prev?: number[]; grow?: boolean }) {
  const cx = 72, cy = 70, R = 50, n = vals.length;
  const pt = (i: number, r: number): [number, number] => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const poly = vals.map((d, i) => pt(i, R * Math.min(1, Math.max(0.04, d.v / 100))).join(",")).join(" ");
  // 上周的自己 (虚线轮廓) — 安全的单用户攀比: 跟过去的自己比, 看见成长 (心理学 #2)
  const prevPoly = prev ? prev.map((v, i) => pt(i, R * Math.min(1, Math.max(0.04, v / 100))).join(",")).join(" ") : null;
  return (
    <svg width="150" height="142" viewBox="0 0 150 142">
      <defs>
        <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.4" />
        </linearGradient>
        <filter id="radarGlow"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {[0.33, 0.66, 1].map((g, i) => (
        <polygon key={i} points={vals.map((_, j) => pt(j, R * g).join(",")).join(" ")} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      ))}
      {vals.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />; })}
      {prevPoly && <polygon points={prevPoly} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeDasharray="3 3" strokeLinejoin="round" />}
      <g style={{ transformOrigin: `${cx}px ${cy}px`, transform: grow ? "scale(1)" : "scale(0.02)", opacity: grow ? 1 : 0, transition: "transform 0.9s cubic-bezier(0.34,1.56,0.64,1), opacity 0.5s ease-out" }}>
        <polygon points={poly} fill="url(#radarFill)" stroke="#7dd3fc" strokeWidth="2.5" filter="url(#radarGlow)" strokeLinejoin="round" />
        {vals.map((d, i) => { const [x, y] = pt(i, R * Math.min(1, Math.max(0.04, d.v / 100))); return <circle key={i} cx={x} cy={y} r="3" fill="#fff" stroke={d.hue} strokeWidth="2" />; })}
      </g>
      {vals.map((d, i) => { const [x, y] = pt(i, R + 14); return <text key={i} x={x} y={y} fill={d.hue} fontSize="12" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">{d.label}</text>; })}
    </svg>
  );
}

export function HubV7PreviewPage() {
  const charSrc = "/_fb-demo.png";

  const [real, setReal] = useState<{
    name: string; level: number; xp: number; tierName: string; tierRoman: string;
    examShort: string; examDays: number; mistakeCount: number; streak: number;
    accuracy: number; mastery: number; continuity: number; breadth: number; composite: number;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = (await db.students.toArray())[0];
        if (!s || cancelled) return;
        const xp = await getTotalXp(s.id);
        const r = await computeCurrentRating(s.id, "下册");
        const fragile = await getFragileSkillsToReview(s.id);
        const attempts = await db.attempts.where({ studentId: s.id }).toArray();
        const mastery = await db.mastery.where({ studentId: s.id }).toArray();
        const ab = computeAbilityDiagnostic(attempts, mastery, "下册");
        const exam = currentExam();
        if (cancelled) return;
        const has = ab.raw.totalAttempts >= 15;
        const pct = (v: number, d: number) => Math.min(100, Math.round((v / d) * 100));
        setReal({
          name: s.name ?? "Selena",
          level: levelFromXp(xp),
          xp,
          tierName: r.tier.name,
          tierRoman: r.subRankRoman,
          examShort: exam.name.replace("考试", ""),
          examDays: daysUntil(exam.date),
          mistakeCount: fragile.length,
          streak: ab.raw.streak ?? 0,
          accuracy: has ? pct(ab.components.accuracy, 250) : 78,
          mastery: has ? pct(ab.components.mastery, 400) : 62,
          continuity: has ? pct(ab.components.continuity, 200) : (ab.raw.streak >= 7 ? 90 : Math.round((ab.raw.streak / 7) * 100)),
          breadth: has ? pct(ab.components.volume, 150) : 50,
          composite: has ? ab.score : 510,
        });
      } catch { /* 预览失败不影响布局 */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const fmtXp = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n));

  // step④ 返场 juice: 数据到位后触发"填充"动画 (XP/三环条 0→目标缓动涨, 雷达 pop, 数字 count-up)。
  // 真版在"练完回大厅"时播; 预览里进场即播一次, 给 Bruce 看 juice 方向。
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!real) return;
    const t = setTimeout(() => setRevealed(true), 90);
    return () => clearTimeout(t);
  }, [real]);
  // 大数字 count-up (倒计时 / XP)
  const useCountUp = (target: number, ms = 900) => {
    const [v, setV] = useState(0);
    useEffect(() => {
      if (!revealed) return;
      const t0 = performance.now();
      let raf = 0;
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / ms);
        setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); // ease-out cubic
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [target, ms, revealed]); // 必须含 revealed: 它在 target settle 后才翻 true, 漏了会卡在 0
    return v;
  };
  const examDaysAnim = useCountUp(real?.examDays ?? 38);

  // 今日三环 (预览 mock; 真版接 fluency/challengeTodayCount/dueMistakes)。CTA 与熊猫气泡共用 nextRing。
  // 三环 = 必胜(保底启动) + 薄弱修复(补短板) + 荣耀挑战(可选, 给称号碎片) — 心理学 #3。
  // 错题用正向"修复"框架(非红色羞辱告警)。
  const ringData = [
    { label: "必胜", full: "速算热身", pct: 100, hue: "#22d3ee", to: "/math/fluency", reward: "今日必胜 ✓ 已启动" },
    { label: "修复", full: "薄弱修复", pct: real && real.mistakeCount > 0 ? 0 : 100, hue: "#a78bfa",
      to: "/math/mistakes", reward: real && real.mistakeCount > 0 ? `修复 ${real.mistakeCount} 处薄弱 · +60 XP` : "薄弱已清 · 保持" },
    { label: "荣耀", full: "荣耀挑战", pct: 45, hue: "#fbbf24", to: "/math/train", reward: "今日主练 · 解锁称号碎片" },
  ];
  const nextRing = ringData.find((r) => r.pct < 100);
  const doneRings = ringData.filter((r) => r.pct >= 100).length;
  // CTA 动态文案 (策划 review: 三态)
  const ctaTitle = !nextRing ? "🎉 三环已闭 · 自由挑战 ▶" : doneRings === 0 ? "开始今日 3 环 ▶" : `继续 ${doneRings + 1}/3 · ${nextRing.full} ▶`;
  const ctaSub = nextRing ? nextRing.reward : "做套模拟卷巩固提分";

  const abilities = real
    ? [
        { label: "准确", v: real.accuracy, hue: "#22d3ee" },
        { label: "熟练", v: real.mastery, hue: "#a78bfa" },
        { label: "坚持", v: real.continuity, hue: "#fb923c" },
        { label: "广度", v: real.breadth, hue: "#34d399" },
      ]
    : [{ label: "准确", v: 78, hue: "#22d3ee" }, { label: "熟练", v: 62, hue: "#a78bfa" }, { label: "坚持", v: 40, hue: "#fb923c" }, { label: "广度", v: 50, hue: "#34d399" }];
  const weakest = abilities.reduce((a, b) => (b.v < a.v ? b : a));
  // 上周的自己 (预览 mock = 当前的 ~82-90%; 真版接 7 天前快照) → 雷达虚线 + 成长率 (心理学 #2)
  const lastWeek = abilities.map((a, i) => Math.max(8, Math.round(a.v * (0.82 + 0.025 * i))));
  const topGain = abilities
    .map((a, i) => ({ label: a.label, hue: a.hue, d: a.v - lastWeek[i]! }))
    .sort((x, y) => y.d - x.d)[0]!;

  const tools = [
    { icon: "🗺️", label: "技能图", to: "/math/skills" },
    { icon: "🎯", label: "模拟卷", to: "/math/train?mode=mock_exam" },
    { icon: "🎨", label: "工坊", to: "/math/atelier" },
    { icon: "🔧", label: "错题营", to: "/math/mistakes", dot: !!(real && real.mistakeCount > 0) },
  ];

  return (
    // 铺满视口(含 4K), 盖住全局菜单, 单屏不滚动。
    <div className="fixed inset-0 z-50 overflow-hidden text-white bg-gradient-to-b from-[#0a0e2c] via-[#1b1147] to-[#0a0e1f]">
      {/* ── 背景: 星空 + 漂浮数学符号 + 暖光 ── */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.5]"
          style={{ backgroundImage: "radial-gradient(1.5px 1.5px at 20% 30%, #fff6, transparent), radial-gradient(1.5px 1.5px at 70% 20%, #fff5, transparent), radial-gradient(1px 1px at 40% 70%, #fff4, transparent), radial-gradient(2px 2px at 85% 60%, #fff5, transparent), radial-gradient(1px 1px at 60% 85%, #fff4, transparent)" }} />
        {["＋", "×", "½", "π", "÷", "√", "9", "∑"].map((g, i) => (
          <div key={i} className="absolute font-display font-bold text-white/[0.06] select-none"
            style={{ left: `${(i * 13 + 7) % 92}%`, top: `${(i * 17 + 11) % 80}%`, fontSize: `${40 + (i % 4) * 22}px` }}>{g}</div>
        ))}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[80vw] h-64 rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      {/* ── 中央: 角色 + 平台 ── */}
      <div className="absolute inset-0 flex items-end justify-center">
        <div className="relative flex items-end justify-center" style={{ height: "100%" }}>
          {/* 竖向能量光柱 (把角色从背景里"推"出来 — vision review #1: 角色与场景融合) */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[10%] w-[clamp(150px,18vw,260px)] h-[78%] rounded-[50%] bg-gradient-to-t from-cyan-400/25 via-violet-400/15 to-transparent blur-2xl" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[20%] w-[clamp(240px,32vw,460px)] aspect-square rounded-full bg-cyan-400/20 blur-3xl animate-pulse" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[12%] w-[clamp(240px,30vw,420px)] h-[clamp(40px,6vw,80px)] rounded-[50%] bg-indigo-400/35 blur-lg" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[13%] w-[clamp(190px,24vw,330px)] h-[clamp(24px,3.5vw,46px)] rounded-[50%] border-2 border-cyan-300/50 shadow-[0_0_30px_rgba(34,211,238,0.4)]" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[12.5%] w-[clamp(120px,16vw,220px)] h-[clamp(14px,2vw,30px)] rounded-[50%] bg-black/45 blur-lg" />
          <img src={charSrc} alt="角色"
            className="relative z-10 w-auto object-contain drop-shadow-[0_18px_44px_rgba(0,0,0,0.55)]"
            style={{ height: "clamp(300px, 68vh, 700px)", marginBottom: "13%" }} />
        </div>
      </div>

      {/* ── 努力落"空间": 平台道具 + 专注光环 (里程碑/连胜解锁) ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[12.5%] z-[6] flex items-end justify-center">
        <div className="relative w-[clamp(240px,30vw,420px)] h-0">
          {(real?.streak ?? 0) >= 3 && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[clamp(200px,26vw,360px)] h-[clamp(26px,3.6vw,48px)] rounded-[50%] border border-amber-300/45 shadow-[0_0_22px_rgba(251,191,36,0.4)] animate-pulse" />
          )}
          <div className="absolute left-[2%] bottom-1.5 text-2xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">📐</div>
          <div className="absolute right-[3%] bottom-2.5 text-2xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">📖</div>
          <div className="absolute right-[16%] -bottom-1 text-lg opacity-90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">🔮</div>
        </div>
      </div>

      {/* ════════ 左面板「我是谁」: Hero + 能力雷达 + 奖杯槽 (md+ 贴左; 手机见底部) ════════ */}
      <div className={`absolute z-20 left-4 lg:left-[3%] xl:left-[5%] top-1/2 -translate-y-1/2 w-[clamp(236px,23vw,304px)] ${GLASS} p-4 hidden md:flex flex-col gap-3.5 overflow-hidden`}>
        {/* 朝中心的青色内光边 (cockpit 融合感) */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-transparent via-cyan-300/40 to-transparent" />
        <div className="flex items-center gap-2.5">
          <div className="text-[40px] leading-none">🐼</div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-lg leading-none truncate">{real?.name ?? "Selena"}</div>
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-cyan-400/15 border border-cyan-300/25 px-2 py-0.5 text-[11px] font-bold text-cyan-100"><span>🏛️</span>{real ? `${real.tierName} ${real.tierRoman}` : "和平街小学 I"}</div>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-orange-400/15 border border-orange-300/25 px-1.5 py-1"><span className="text-base leading-none">🔥</span><span className="text-[12px] font-black text-orange-200 leading-none mt-0.5 tabular-nums">{real?.streak ?? 0}</span></div>
        </div>
        <div>
          <div className="flex justify-between items-center text-[12px]"><span className="text-amber-300 font-black">Lv {real?.level ?? 1}</span><span className="text-white/60 tabular-nums font-bold">{real ? fmtXp(real.xp) : 0} XP</span></div>
          <div className="h-2.5 rounded-full bg-white/15 mt-1 overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] transition-[width] duration-[1100ms] ease-out" style={{ width: revealed ? "62%" : "0%" }} /></div>
        </div>
        <div className="border-t border-white/10 pt-2.5">
          <div className="text-[13px] text-white font-bold mb-0.5 flex items-center gap-1.5">🛰️ 能力扫描 <span className="text-white/45 text-[11px] font-normal ml-auto">综合 {real?.composite ?? 510}</span></div>
          <div className="flex justify-center"><Radar vals={abilities} prev={lastWeek} grow={revealed} /></div>
          {/* 成长镜像: 跟上周的自己比 (安全攀比) + 木桶薄弱提示 */}
          <div className="flex items-center justify-center gap-2 text-[11px] -mt-1">
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-400/15 border border-emerald-300/30 px-1.5 py-0.5 font-bold" style={{ color: topGain.hue }}>📈 {topGain.label} 比上周 +{topGain.d}</span>
            <span className="text-white/60">补 <b className="text-amber-200">{weakest.label}</b> 拉满</span>
          </div>
          <div className="text-[9px] text-white/30 text-center mt-0.5">虚线 = 上周的你</div>
        </div>
        <div className="border-t border-white/10 pt-2.5">
          <div className="flex items-center text-[12px] mb-1.5"><span className="text-white/75 font-bold">🏆 奖杯墙</span><Link to="/math/skills" className="ml-auto text-cyan-200/80 hover:text-cyan-100">全部 ›</Link></div>
          <div className="grid grid-cols-4 gap-1.5">
            {["🥇", "🎖️", "⭐", "🔒"].map((t, i) => (
              <div key={i} className={`aspect-square rounded-xl flex items-center justify-center text-lg ${i < 3 ? "bg-amber-400/15 border border-amber-300/30 shadow-[0_0_10px_rgba(251,191,36,0.2)]" : "bg-white/[0.04] border border-white/10 opacity-50"}`}>{t}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════ 右面板「我要做啥」: 期末倒计时 + 今日三环 + 工具网格 (md+ 贴右; 手机见底部) ════════ */}
      <div className={`absolute z-20 right-4 lg:right-[3%] xl:right-[5%] top-1/2 -translate-y-1/2 w-[clamp(236px,23vw,304px)] ${GLASS} p-4 hidden md:flex flex-col gap-3.5 overflow-hidden`}>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-transparent via-cyan-300/40 to-transparent" />
        {/* 倒计时大卡 (霓虹橙红 + 发光, designer: 要冲刺情绪) */}
        <div className="rounded-2xl bg-gradient-to-br from-orange-500/40 via-rose-500/30 to-fuchsia-500/20 border border-orange-300/50 px-3 py-3 text-center shadow-[0_0_28px_rgba(251,113,36,0.4),inset_0_1px_0_rgba(255,255,255,0.25)]">
          <div className="text-[12px] text-orange-100 font-black tracking-wide">🔥 决战{real?.examShort ?? "期末"}</div>
          <div className="font-display font-black leading-none mt-1"><span className="text-5xl text-white tabular-nums drop-shadow-[0_0_14px_rgba(255,200,120,0.7)]">{examDaysAnim}</span><span className="text-base text-orange-100/80 ml-1 font-bold">天</span></div>
        </div>
        <div className="border-t border-white/10 pt-2.5">
          <div className="text-[13px] text-white font-bold mb-2">📋 今日三环 <span className="text-white/45 text-[11px] font-normal ml-1">{doneRings}/3</span></div>
          <div className="flex flex-col gap-2">
            {ringData.map((r) => (
              <Link key={r.label} to={r.to} className="flex items-center gap-2 hover:bg-white/5 rounded-lg px-1 py-0.5 transition">
                <span className="text-sm w-5 text-center">{r.pct >= 100 ? "✅" : "⬜"}</span>
                <span className={`text-[12px] font-bold w-11 ${r.pct >= 100 ? "text-emerald-300" : "text-white/90"}`}>{r.full.slice(0, 4)}</span>
                <div className="flex-1 h-2 rounded-full bg-white/12 overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]"><div className="h-full rounded-full transition-[width] duration-[1100ms] ease-out" style={{ width: revealed ? `${r.pct}%` : "0%", background: r.pct >= 100 ? "#34d399" : r.hue, boxShadow: `0 0 6px ${r.hue}` }} /></div>
                <span className="text-[11px] font-bold tabular-nums w-9 text-right" style={{ color: r.pct >= 100 ? "#34d399" : r.hue }}>{r.pct}%</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="border-t border-white/10 pt-2.5 grid grid-cols-2 gap-2">
          {tools.map((t) => (
            <Link key={t.label} to={t.to} className="relative rounded-xl bg-white/[0.08] border border-white/15 py-3 flex flex-col items-center gap-1 hover:bg-white/[0.18] active:scale-95 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
              {t.dot && <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-400 animate-pulse shadow-[0_0_6px_rgba(244,63,94,0.8)]" />}
              <span className="text-2xl leading-none">{t.icon}</span>
              <span className="text-[11px] text-white/90 font-bold">{t.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ════════ 底部唯一主 CTA (动态指向下一环) — vision review: 上移避开脚部, 白字, 气泡换暖色引导 ════════ */}
      <div className="absolute bottom-[92px] md:bottom-[8%] left-1/2 -translate-x-1/2 z-30 w-[min(90vw,440px)] flex flex-col items-center gap-2">
        {/* 暖色引导胶囊 + 呼吸下箭头 (替换灰色网页风气泡; 强化 CTA 不抢指令) */}
        <div className="flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-300/40 backdrop-blur-md px-3 py-1 text-[12px] font-bold text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.3)]">
          <span className="text-base">🐼</span>{nextRing ? `第 ${doneRings + 1} 环, 冲!` : "三环全闭, 你太强了!"}
          <span className="text-amber-200 animate-bounce" style={{ animationDuration: "1.2s" }}>▾</span>
        </div>
        <Link to={nextRing ? nextRing.to : "/math/train?mode=mock_exam"}
          className="relative overflow-hidden w-full rounded-3xl py-4 px-6 text-center text-white border-b-[5px] border-orange-700/70 shadow-[0_16px_56px_rgba(251,146,36,0.7),inset_0_2px_0_rgba(255,255,255,0.45)] bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 active:scale-[0.98] active:translate-y-0.5 active:border-b-2 transition animate-[pulse_2.6s_ease-in-out_infinite]">
          <span className="hubv7-cta-shimmer" aria-hidden />
          <div className="relative font-display font-black text-xl leading-none drop-shadow-[0_2px_4px_rgba(120,40,0,0.6)]">{ctaTitle}</div>
          <div className="relative text-xs font-bold text-white/90 mt-1 drop-shadow-[0_1px_2px_rgba(120,40,0,0.5)]">{ctaSub}</div>
        </Link>
      </div>

      {/* ════════ 手机紧凑版 (md 以下): 顶 HUD 行 + 底部工具行 (面板太宽塞不下, 改叠层) ════════ */}
      <div className={`md:hidden absolute top-3 left-3 right-3 z-20 ${GLASS} px-3 py-2 flex items-center gap-2`}>
        <span className="text-2xl">🐼</span>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-sm leading-none truncate">{real?.name ?? "Selena"} <span className="text-amber-300 text-[11px]">Lv {real?.level ?? 1}</span></div>
          <div className="h-1.5 rounded-full bg-white/15 mt-1 overflow-hidden w-full"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400" style={{ width: "62%" }} /></div>
        </div>
        <div className="flex flex-col items-center px-1"><span className="text-sm leading-none">🔥</span><span className="text-[10px] font-black text-orange-300">{real?.streak ?? 0}</span></div>
        <div className="text-center pl-2 border-l border-white/15">
          <div className="text-[9px] text-rose-200">决战</div>
          <div className="font-display font-black text-base leading-none tabular-nums text-rose-200">{real?.examDays ?? 39}<span className="text-[9px] text-white/50">天</span></div>
        </div>
      </div>
      <div className="md:hidden absolute bottom-3 left-3 right-3 z-20 flex gap-2 overflow-x-auto pb-1">
        {tools.map((t) => (
          <Link key={t.label} to={t.to} className={`${GLASS} shrink-0 w-[60px] py-2 flex flex-col items-center gap-0.5 relative`}>
            {t.dot && <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-400 animate-pulse" />}
            <span className="text-lg leading-none">{t.icon}</span><span className="text-[9px] text-white/80 font-bold">{t.label}</span>
          </Link>
        ))}
      </div>

      {/* 返回 */}
      <Link to="/math" className="absolute top-2 right-2 z-40 text-[10px] bg-white/15 rounded-full px-2 py-1">← 返回</Link>
    </div>
  );
}
