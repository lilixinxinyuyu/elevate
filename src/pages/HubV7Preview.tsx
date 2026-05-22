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

const GLASS =
  "rounded-3xl bg-white/[0.07] backdrop-blur-xl border border-white/15 shadow-[0_8px_40px_rgba(0,0,0,0.5)]";

/** 4 维能力雷达 (彩色, 高级感来源 — 从原版搬进左面板)。 */
function Radar({ vals }: { vals: { label: string; v: number; hue: string }[] }) {
  const cx = 72, cy = 70, R = 50, n = vals.length;
  const pt = (i: number, r: number): [number, number] => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const poly = vals.map((d, i) => pt(i, R * Math.min(1, Math.max(0.04, d.v / 100))).join(",")).join(" ");
  return (
    <svg width="144" height="138" viewBox="0 0 144 138">
      {[0.33, 0.66, 1].map((g, i) => (
        <polygon key={i} points={vals.map((_, j) => pt(j, R * g).join(",")).join(" ")} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      ))}
      {vals.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />; })}
      <polygon points={poly} fill="rgba(99,179,237,0.28)" stroke="#63b3ed" strokeWidth="2" />
      {vals.map((d, i) => { const [x, y] = pt(i, R * Math.min(1, Math.max(0.04, d.v / 100))); return <circle key={i} cx={x} cy={y} r="2.5" fill={d.hue} />; })}
      {vals.map((d, i) => { const [x, y] = pt(i, R + 13); return <text key={i} x={x} y={y} fill={d.hue} fontSize="11" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">{d.label}</text>; })}
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

  // 今日三环 (预览 mock; 真版接 fluency/challengeTodayCount/dueMistakes)。CTA 与熊猫气泡共用 nextRing。
  const ringData = [
    { label: "速算", full: "速算热身", pct: 100, hue: "#22d3ee", to: "/math/fluency", reward: "基本功热身 ✓" },
    { label: "挑战", full: "今日挑战", pct: 45, hue: "#a78bfa", to: "/math/train", reward: "今日主练 · +80 XP" },
    { label: "错题", full: "错题复活", pct: real && real.mistakeCount > 0 ? 0 : 100, hue: "#fbbf24",
      to: "/math/mistakes", reward: real && real.mistakeCount > 0 ? `复活 ${real.mistakeCount} 道错题 · +60 XP` : "错题已清 · 保持" },
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

      {/* ════════ 左面板「我是谁」: Hero + 能力雷达 + 奖杯 (md+ 贴左; 手机见底部) ════════ */}
      <div className={`absolute z-20 left-3 xl:left-6 top-1/2 -translate-y-1/2 w-[clamp(228px,23vw,300px)] ${GLASS} p-4 hidden md:flex flex-col gap-3`}>
        <div className="flex items-center gap-2.5">
          <div className="text-3xl">🐼</div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-base leading-none truncate">{real?.name ?? "Selena"}</div>
            <div className="text-[11px] text-cyan-200/90 mt-1 flex items-center gap-1"><span>🏛️</span>{real ? `${real.tierName} ${real.tierRoman}` : "和平街小学 I"}</div>
          </div>
          <div className="flex flex-col items-center"><span className="text-lg leading-none">🔥</span><span className="text-[11px] font-black text-orange-300 leading-none mt-0.5 tabular-nums">{real?.streak ?? 0}</span></div>
        </div>
        <div>
          <div className="flex justify-between items-center text-[11px]"><span className="text-amber-300 font-bold">Lv {real?.level ?? 1}</span><span className="text-white/45 tabular-nums">{real ? fmtXp(real.xp) : 0} XP</span></div>
          <div className="h-2 rounded-full bg-white/15 mt-1 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400" style={{ width: "62%" }} /></div>
        </div>
        <div className="border-t border-white/10 pt-2">
          <div className="text-[11px] text-white/70 font-bold mb-0.5 flex items-center gap-1">🛰️ 能力扫描 <span className="text-white/35 font-normal">综合 {real?.composite ?? 510}</span></div>
          <div className="flex justify-center"><Radar vals={abilities} /></div>
          <div className="text-[10px] text-white/55 text-center -mt-1">薄弱：<b className="text-rose-300">{weakest.label}</b> · 今日已安排练习</div>
        </div>
        <Link to="/math/skills" className="border-t border-white/10 pt-2.5 flex items-center gap-2 text-[12px] hover:bg-white/5 rounded-xl -mx-1.5 px-1.5 py-1 transition">
          <span className="text-lg">🏆</span><span className="text-white/75">奖杯墙</span><span className="ml-auto text-white/40">›</span>
        </Link>
      </div>

      {/* ════════ 右面板「我要做啥」: 期末倒计时 + 今日三环 + 工具网格 (md+ 贴右; 手机见底部) ════════ */}
      <div className={`absolute z-20 right-3 xl:right-6 top-1/2 -translate-y-1/2 w-[clamp(228px,23vw,300px)] ${GLASS} p-4 hidden md:flex flex-col gap-3`}>
        <div className="rounded-2xl bg-gradient-to-br from-rose-500/30 to-orange-500/15 border border-rose-400/40 px-3 py-2.5 text-center shadow-[0_0_24px_rgba(244,63,94,0.25)]">
          <div className="text-[11px] text-rose-200/90 font-bold">🔥 决战{real?.examShort ?? "期末"}</div>
          <div className="font-display font-black leading-none mt-0.5"><span className="text-4xl bg-gradient-to-r from-amber-200 to-rose-300 bg-clip-text text-transparent tabular-nums">{real?.examDays ?? 39}</span><span className="text-sm text-white/60 ml-1">天</span></div>
        </div>
        <div className="border-t border-white/10 pt-2">
          <div className="text-[11px] text-white/70 font-bold mb-1.5">📋 今日三环 · {doneRings}/3</div>
          <div className="flex flex-col gap-1.5">
            {ringData.map((r) => (
              <Link key={r.label} to={r.to} className="flex items-center gap-2 hover:bg-white/5 rounded-lg px-1 py-0.5 transition">
                <span className="text-sm w-5 text-center">{r.pct >= 100 ? "✅" : "⭕"}</span>
                <span className={`text-[12px] font-bold w-12 ${r.pct >= 100 ? "text-emerald-300" : "text-white/85"}`}>{r.full.slice(0, 4)}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/12 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.hue }} /></div>
                <span className="text-[10px] tabular-nums w-8 text-right" style={{ color: r.hue }}>{r.pct}%</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="border-t border-white/10 pt-2.5 grid grid-cols-2 gap-2">
          {tools.map((t) => (
            <Link key={t.label} to={t.to} className="relative rounded-xl bg-white/[0.06] border border-white/10 py-2.5 flex flex-col items-center gap-0.5 hover:bg-white/15 active:scale-95 transition">
              {t.dot && <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-400 animate-pulse" />}
              <span className="text-xl leading-none">{t.icon}</span>
              <span className="text-[10px] text-white/80 font-bold">{t.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ════════ 底部唯一主 CTA (动态指向下一环) ════════ */}
      <div className="absolute bottom-[88px] md:bottom-[5%] left-1/2 -translate-x-1/2 z-30 w-[min(90vw,420px)] flex flex-col items-center gap-2">
        {/* 熊猫气泡 (强化 CTA, 不抢指令) */}
        <div className={`${GLASS} px-3 py-1.5 text-[11px] text-white/85 flex items-center gap-1.5 self-end mr-1`}>
          <span className="text-lg">🐼</span>{nextRing ? `点这里 → 第 ${doneRings + 1} 环: ${nextRing.full}!` : "三环全闭, 你太强了!"}
        </div>
        <Link to={nextRing ? nextRing.to : "/math/train?mode=mock_exam"}
          className="w-full rounded-3xl py-4 px-6 text-center text-amber-950 shadow-[0_12px_50px_rgba(251,191,36,0.6)] bg-gradient-to-r from-amber-300 via-orange-400 to-pink-400 active:scale-[0.98] transition animate-[pulse_2.6s_ease-in-out_infinite]">
          <div className="font-display font-black text-xl leading-none">{ctaTitle}</div>
          <div className="text-xs font-bold text-amber-900/80 mt-1">{ctaSub}</div>
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
