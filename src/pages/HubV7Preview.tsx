/**
 * v0.36.65 — Hub v7 布局预览 (Bruce 2026-05-21 反馈后重做方向 demo)。
 *
 * 给 Bruce 看"融合方向"用的预览 (UI/数值是静态 mock)。
 * v0.36.68: 加"实时生成 demo"控制条 — 点性别+职业 → 真调 ensureFullBodyAvatar 实时生成
 *   全身立绘 + 实时抠图 + 换进场景 (生产可用; dev 无 /api/generate/image 后端会 graceful
 *   fallback 提示)。让 Bruce 看到的不只是静态布局, 而是真实管线 (生成→抠图→融场景) 跑给他看。
 * 演示要点 (回应 Bruce 反馈: 现版是相框 + 大屏空旷):
 *   - 全身角色**站在场景里**(发光平台 + 接地阴影 + 背后光环 + 星空数字背景), 不是相框。
 *   - UI 全做成**浮在画面上的玻璃 HUD**(等级/段位/三环/任务/CTA/数值/小熊猫副手),
 *     宽屏铺开填满空间(角色居中偏右, 面板分布两侧), 不是居中窄列。
 *   - 经 8788(gpt-5.5) peer review 的"Math Adventure Lobby"结构, 适配本 app 暗色宇宙主题。
 *
 * 角色立绘用一张预抠好的样张 (/_fb-demo.png); 真版会是选角/升段实时生成 + 实时抠图。
 * 入口: /math/hub-v7-preview
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from "../db/dexie";
import { getTotalXp, computeCurrentRating, getFragileSkillsToReview } from "../db/service";
import { levelFromXp } from "../core/scoring";
import { currentExam, daysUntil } from "../core/examDates";
import { computeAbilityDiagnostic } from "../core/rating";

const GLASS =
  "rounded-3xl bg-white/10 backdrop-blur-md border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)]";

function Ring({ label, pct, hue }: { label: string; pct: number; hue: string }) {
  const R = 26, C = 2 * Math.PI * R, off = C * (1 - pct / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
        <circle cx="32" cy="32" r={R} fill="none" stroke={hue} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={off} />
      </svg>
      <div className="text-[11px] text-white/80 leading-none">{label}</div>
      <div className="text-[11px] font-bold tabular-nums leading-none" style={{ color: hue }}>{pct}%</div>
    </div>
  );
}

export function HubV7PreviewPage() {
  // v0.36.x step②: 角色立绘 = onboarding 配过一次后锁定的静态形象 (真版进大厅/升段才实时生成 +
  // 缓存)。删掉了顶部"实时生成"demo 控制条 —— Bruce 反馈: 不允许同学频繁重生角色, 顶部应放
  // minigame / 技能地图入口。预览用预抠样张。
  const charSrc = "/_fb-demo.png";

  // ── 真实数据 (让预览显示 Selena 的实际进度, 不是 mock; 全 dev 可验证, 无需 gen) ──
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
        // 数据够多 (≥15 题) 才显示真实诊断; 否则给鼓励性占位 — 新手/空账号不被一排 0 打击,
        // 也避免预览在 dev 低数据账号上显示成"坏掉"的样子。Selena 真实账号数据足 → 显示她的真值。
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
          // 能力诊断 (跟 HubScreenV6 同款 components→0-100 映射; 无数据回退合理 mock)
          accuracy: has ? pct(ab.components.accuracy, 250) : 78,
          mastery: has ? pct(ab.components.mastery, 400) : 62,
          continuity: has ? pct(ab.components.continuity, 200) : (ab.raw.streak >= 7 ? 90 : Math.round((ab.raw.streak / 7) * 100)),
          breadth: has ? pct(ab.components.volume, 150) : 50,
          composite: has ? ab.score : 510,
        });
      } catch { /* 预览失败不影响布局展示 */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const fmtXp = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n));

  // step③: 今日三环状态 (预览 mock; 真版接 fluency/challengeTodayCount/dueMistakes 实数据)。
  // CTA 与熊猫气泡**共用同一个 nextRing** → 保证"全屏唯一行动指令"一致 (designer review 铁律:
  // 气泡不能跟 CTA 抢指令, 否则 10 岁娃会懵)。
  const ringData = [
    { label: "速算", full: "速算热身", pct: 100, hue: "#22d3ee", to: "/math/fluency", reward: "基本功热身 ✓" },
    { label: "挑战", full: "今日挑战", pct: 45, hue: "#a78bfa", to: "/math/train", reward: "今日主练 · +80 XP" },
    { label: "错题", full: "错题复活", pct: real && real.mistakeCount > 0 ? 0 : 100, hue: "#fbbf24",
      to: "/math/mistakes", reward: real && real.mistakeCount > 0 ? `复活 ${real.mistakeCount} 道错题 · +60 XP` : "错题已清 · 保持" },
  ];
  const nextRing = ringData.find((r) => r.pct < 100);
  const doneRings = ringData.filter((r) => r.pct >= 100).length;

  return (
    // v0.36.x step①: fixed inset-0 = 铺满整个视口(含 4K), 盖住 SubjectShell 全局菜单, 单屏不滚动。
    // 之前 min-h-dvh 套在 SubjectShell chrome 内 → 中间 50% + 顶部老菜单 + 要 scroll + 覆盖。
    <div className="fixed inset-0 z-50 overflow-hidden text-white bg-gradient-to-b from-[#0a0e2c] via-[#1b1147] to-[#0a0e1f]">
      {/* ── 背景场景层: 星空 + 漂浮数学符号 (低透明, 不抢角色) ── */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.5]"
          style={{ backgroundImage: "radial-gradient(1.5px 1.5px at 20% 30%, #fff6, transparent), radial-gradient(1.5px 1.5px at 70% 20%, #fff5, transparent), radial-gradient(1px 1px at 40% 70%, #fff4, transparent), radial-gradient(2px 2px at 85% 60%, #fff5, transparent), radial-gradient(1px 1px at 60% 85%, #fff4, transparent)" }} />
        {["＋", "×", "½", "π", "÷", "√", "9", "∑"].map((g, i) => (
          <div key={i} className="absolute font-display font-bold text-white/[0.06] select-none"
            style={{ left: `${(i * 13 + 7) % 92}%`, top: `${(i * 17 + 11) % 80}%`, fontSize: `${40 + (i % 4) * 22}px` }}>{g}</div>
        ))}
        {/* 顶部暖光 + 底部地面辉光 */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[80vw] h-64 rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      {/* ── 角色 + 平台 (居中, 左右两列 UI 各自分布不压角色) ── */}
      <div className="absolute inset-0 flex items-end justify-center">
        <div className="relative flex items-end justify-center" style={{ height: "100%" }}>
          {/* 背后光环 (慢脉动) */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[20%] w-[clamp(240px,32vw,460px)] aspect-square rounded-full bg-cyan-400/20 blur-3xl animate-pulse" />
          {/* 平台椭圆 (发光) + 边缘高光环 */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[12%] w-[clamp(240px,30vw,420px)] h-[clamp(40px,6vw,80px)] rounded-[50%] bg-indigo-400/35 blur-lg" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[13%] w-[clamp(190px,24vw,330px)] h-[clamp(24px,3.5vw,46px)] rounded-[50%] border-2 border-cyan-300/50 shadow-[0_0_30px_rgba(34,211,238,0.4)]" />
          {/* 接地阴影 */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[12.5%] w-[clamp(120px,16vw,220px)] h-[clamp(14px,2vw,30px)] rounded-[50%] bg-black/45 blur-lg" />
          {/* 全身角色立绘 (脚踩平台上方; 真版 = onboarding/升段 实时生成的形象) */}
          <img src={charSrc} alt="角色"
            className="relative z-10 w-auto object-contain drop-shadow-[0_18px_44px_rgba(0,0,0,0.55)]"
            style={{ height: "clamp(340px, 70vh, 720px)", marginBottom: "13%" }} />
        </div>
      </div>

      {/* ════ step⑤ 努力落"空间": 平台已赚到的装饰道具 + 专注光环 (按里程碑/连胜解锁; 预览 mock) ════
          designer+planner 一致: 努力要肉眼可见累积在主场景, 否则"获得感"断裂。真版接 完成单元/streak 解锁。 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[12.5%] z-[6] flex items-end justify-center">
        <div className="relative w-[clamp(240px,30vw,420px)] h-0">
          {(real?.streak ?? 0) >= 3 && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[clamp(200px,26vw,360px)] h-[clamp(26px,3.6vw,48px)] rounded-[50%] border border-amber-300/45 shadow-[0_0_22px_rgba(251,191,36,0.4)] animate-pulse" title="连胜≥3 解锁: 专注光环" />
          )}
          <div className="absolute left-[2%] bottom-1.5 text-2xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" title="完成单元解锁">📐</div>
          <div className="absolute right-[3%] bottom-2.5 text-2xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" title="模拟卷符文">📖</div>
          <div className="absolute right-[16%] -bottom-1 text-lg opacity-90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" title="连胜奖励">🔮</div>
        </div>
      </div>
      {/* 努力累积小标签 (左下, 数值条上方) — "再练解锁下一件" */}
      <div className={`absolute bottom-[58px] left-4 ${GLASS} px-3 py-1.5 text-[11px] hidden sm:flex items-center gap-1.5`}>
        <span>✨</span><span className="text-white/70">平台已集</span><b className="text-amber-300">3</b><span className="text-white/45">件 · 再练解锁下一件</span>
      </div>

      {/* ── 浮动 HUD ── */}
      {/* 顶 HUD: 🐼 + 名字 + Lv + XP (左上) */}
      <div className={`absolute top-4 left-4 ${GLASS} px-4 py-2.5 flex items-center gap-3`}>
        <div className="text-3xl">🐼</div>
        <div>
          <div className="font-display font-bold text-base leading-none">{real?.name ?? "Selena"}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[11px] text-amber-300 font-bold">Lv {real?.level ?? 1}</span>
            <div className="w-28 h-1.5 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400" style={{ width: "62%" }} />
            </div>
            <span className="text-[10px] text-white/60 tabular-nums">{real ? fmtXp(real.xp) : "0"} XP</span>
          </div>
        </div>
        {/* 连胜 streak — 强留存钩子 (planner+designer 都点名) */}
        <div className="flex flex-col items-center pl-2 ml-1 border-l border-white/15">
          <span className="text-lg leading-none">🔥</span>
          <span className="text-[11px] font-black text-orange-300 tabular-nums leading-none mt-0.5">{real?.streak ?? 0}</span>
        </div>
      </div>

      {/* 段位 + 期末"史诗倒计时" (顶部右侧, 避开左上 HUD) */}
      <div className={`absolute top-4 right-4 lg:right-[6%] ${GLASS} px-4 py-2 text-center`}>
        <div className="text-[11px] text-white/60 leading-none flex items-center justify-center gap-1">
          <span>🏛️</span><span className="bg-gradient-to-r from-cyan-200 to-violet-200 bg-clip-text text-transparent font-bold">{real ? `${real.tierName} ${real.tierRoman}` : "和平街小学 I"}</span>
        </div>
        <div className="mt-1.5 pt-1.5 border-t border-white/15 leading-none">
          <span className="text-[10px] text-white/55">⚔️ 决战{real?.examShort ?? "期末"}</span>
          <div className="mt-0.5 font-display font-black text-base leading-none">
            <span className="bg-gradient-to-r from-amber-200 to-rose-300 bg-clip-text text-transparent tabular-nums">{real?.examDays ?? 39}</span>
            <span className="text-white/60 text-[11px] ml-0.5">天</span>
          </div>
        </div>
      </div>

      {/* ════ step③ 唯一主干道: 今日三环(集成) + 动态主 CTA(自动指向下一个没闭的环) ════
          指挥中心核心: 不让娃选, 5 秒内一个发光按钮指向"今天该练的下一步"。三环不再单独平铺左侧,
          集成在 CTA 正上方; 红牌救援/BOSS 等任务卡砍掉, 并进环里 (错题环=救援, 挑战环=主练)。 */}
      <div className="absolute bottom-[92px] lg:bottom-[5%] left-1/2 -translate-x-1/2 z-20 w-[min(92vw,460px)] flex flex-col items-center gap-2.5">
        <div className={`${GLASS} px-4 py-2 flex items-center gap-4`}>
          {ringData.map((r) => <Ring key={r.label} label={r.label} pct={r.pct} hue={r.hue} />)}
        </div>
        <Link to={nextRing ? nextRing.to : "/math/train?mode=mock_exam"}
          className="w-full rounded-3xl py-4 px-6 text-center text-amber-950 shadow-[0_12px_50px_rgba(251,191,36,0.6)] bg-gradient-to-r from-amber-300 via-orange-400 to-pink-400 active:scale-[0.98] transition animate-[pulse_2.6s_ease-in-out_infinite]">
          <div className="font-display font-black text-xl leading-none">
            {nextRing ? `今日 ${doneRings + 1}/3 · ${nextRing.full} ▶` : "🎉 三环已闭 · 自由挑战 ▶"}
          </div>
          <div className="text-xs font-bold text-amber-900/80 mt-1">{nextRing ? nextRing.reward : "做套模拟卷巩固"}</div>
        </Link>
      </div>

      {/* ════ step② 边缘系统入口 (左右竖排 icon, 视觉低于主 CTA) — 替代回退的顶部 ribbon。
          大屏向中心聚拢避免"视线断层"(designer+planner review)。 ════ */}
      <div className="absolute z-10 left-2 lg:left-[7%] xl:left-[11%] top-1/2 -translate-y-1/2 flex flex-col gap-2">
        {[
          { icon: "🗺️", label: "技能图", to: "/math/skills" },
          { icon: "🎯", label: "模拟卷", to: "/math/train?mode=mock_exam" },
          { icon: "🕹️", label: "街机", to: "/math" },
        ].map((s) => (
          <Link key={s.to} to={s.to} className={`${GLASS} w-[52px] py-2 flex flex-col items-center gap-0.5 hover:bg-white/20 active:scale-95 transition`}>
            <span className="text-xl leading-none">{s.icon}</span>
            <span className="text-[9px] text-white/80 font-bold">{s.label}</span>
          </Link>
        ))}
      </div>
      <div className="absolute z-10 right-2 lg:right-[7%] xl:right-[11%] top-1/2 -translate-y-1/2 flex flex-col gap-2">
        {[
          { icon: "🎨", label: "工坊", to: "/math/atelier", dot: false },
          { icon: "🏆", label: "奖杯", to: "/math/skills", dot: false },
          { icon: "🔧", label: "错题", to: "/math/mistakes", dot: !!(real && real.mistakeCount > 0) },
        ].map((s) => (
          <Link key={s.label} to={s.to} className={`${GLASS} w-[52px] py-2 flex flex-col items-center gap-0.5 hover:bg-white/20 active:scale-95 transition relative`}>
            {s.dot && <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-400 animate-pulse" />}
            <span className="text-xl leading-none">{s.icon}</span>
            <span className="text-[9px] text-white/80 font-bold">{s.label}</span>
          </Link>
        ))}
      </div>

      {/* ════ step⑥ 降级数值: 一句综合分 + 点开看雷达 (砍掉 4 数值"体检条") ════ */}
      <Link to="/math/skills" className={`absolute bottom-4 left-4 ${GLASS} px-3 py-2 text-[11px] hidden sm:flex items-center gap-2 hover:bg-white/20 transition`}>
        <span className="text-base">📈</span>
        <span className="text-white/70">综合</span><b className="text-amber-300 tabular-nums">{real?.composite ?? 510}</b>
        <span className="text-white/20">·</span><span className="text-white/55">点开看 4 维成长</span>
      </Link>

      {/* 小熊猫副手 + 对话气泡 (向导嘴替, 驱动每日提示) */}
      <div className="absolute bottom-3 right-4 z-20 flex items-end gap-2 max-w-[64vw]">
        <div className={`${GLASS} px-3 py-2 text-[11px] text-white/85 mb-2 max-w-[200px]`}>
          {/* designer review 铁律: 气泡必须**强化** CTA(同一 nextRing), 不能给竞争指令 */}
          {nextRing ? `点下面金色按钮 → 今天第 ${doneRings + 1} 环: ${nextRing.full}! 💪` : "三环全闭啦, 你太强了! 🎉"}
        </div>
        <div className="text-4xl animate-bounce" style={{ animationDuration: "3s" }}>🐼</div>
      </div>

      {/* 返回 */}
      <div className="absolute top-2 right-2 z-30 flex gap-2">
        <Link to="/math" className="text-[10px] bg-white/15 rounded-full px-2 py-1">← 返回</Link>
      </div>
    </div>
  );
}
