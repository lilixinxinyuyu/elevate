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
import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ensureFullBodyAvatar } from "../lib/fullBodyAvatar";
import { ARCHETYPE_META, type Archetype, type Gender } from "../lib/characterChoice";

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
  // ── 实时生成 demo: 点职业 → 实时 gen 全身立绘 + 实时抠图 + 换上 (生产可用; dev 无后端会 fallback) ──
  const [charSrc, setCharSrc] = useState("/_fb-demo.png");
  const [gender, setGender] = useState<Gender>("female");
  const [loading, setLoading] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);

  const genLive = useCallback(async (archetype: Archetype) => {
    setLoading(true);
    setGenErr(null);
    try {
      // 固定 demo studentId → 同 (职业,性别) 第一次实时生成, 再点即缓存秒出 (顺带演示缓存)。
      const dataUrl = await ensureFullBodyAvatar("hub-preview-demo", archetype, gender, "school");
      setCharSrc(dataUrl);
    } catch {
      setGenErr("实时生成需要生产后端 (dev 服务器无 /api/generate/image)。生产环境点这里会真生成。");
    } finally {
      setLoading(false);
    }
  }, [gender]);

  return (
    <div className="relative min-h-dvh overflow-hidden text-white bg-gradient-to-b from-[#0a0e2c] via-[#1b1147] to-[#0a0e1f]">
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
          {/* 全身角色立绘 (脚踩平台上方; 可被实时生成的角色替换) */}
          <img src={charSrc} alt="角色"
            className={`relative z-10 w-auto object-contain drop-shadow-[0_18px_44px_rgba(0,0,0,0.55)] transition-opacity ${loading ? "opacity-30" : "opacity-100"}`}
            style={{ height: "clamp(340px, 70vh, 720px)", marginBottom: "13%" }} />
          {/* 生成中遮罩 (预览真实 onboarding/升段 等待 UX) */}
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 mb-[13%]">
              <div className="w-12 h-12 rounded-full border-4 border-cyan-300/30 border-t-cyan-300 animate-spin" />
              <div className="text-sm text-cyan-100 bg-black/40 rounded-full px-3 py-1.5">🐼 小进正在为你画专属角色… 约 30 秒</div>
            </div>
          )}
        </div>
      </div>

      {/* ── 浮动 HUD ── */}
      {/* 顶 HUD: 🐼 + 名字 + Lv + XP (左上) */}
      <div className={`absolute top-4 left-4 ${GLASS} px-4 py-2.5 flex items-center gap-3`}>
        <div className="text-3xl">🐼</div>
        <div>
          <div className="font-display font-bold text-base leading-none">Selena</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[11px] text-amber-300 font-bold">Lv 6</span>
            <div className="w-28 h-1.5 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400" style={{ width: "62%" }} />
            </div>
            <span className="text-[10px] text-white/60 tabular-nums">12.4k XP</span>
          </div>
        </div>
      </div>

      {/* 段位 chevron (顶部右侧, 避开左上 HUD) */}
      <div className={`absolute top-4 right-4 lg:right-[6%] ${GLASS} px-4 py-2 text-center`}>
        <div className="text-[11px] text-white/60 leading-none">当前段位</div>
        <div className="mt-1 font-display font-black text-lg leading-none flex items-center gap-1.5">
          <span>🏛️</span><span className="bg-gradient-to-r from-cyan-200 to-violet-200 bg-clip-text text-transparent">锦江区 II</span>
        </div>
      </div>

      {/* 三环 — 手机: 顶部 HUD 下方横排; sm+: 左中竖排 */}
      <div className={`absolute z-10 left-1/2 -translate-x-1/2 top-[84px] flex flex-row items-center gap-1.5
        sm:left-4 sm:translate-x-0 sm:top-1/2 sm:-translate-y-1/2 sm:flex-col sm:gap-3 ${GLASS} px-3 py-2`}>
        <div className="hidden sm:block text-[11px] text-white/70 text-center font-bold">今日三环</div>
        <Ring label="口算" pct={80} hue="#22d3ee" />
        <Ring label="挑战" pct={45} hue="#a78bfa" />
        <Ring label="专注" pct={100} hue="#fbbf24" />
      </div>

      {/* 任务栈 — 手机: 底部横向滑动卡片 (CTA 上方); md+: 右中竖排 */}
      <div className="absolute z-10 left-1/2 -translate-x-1/2 bottom-[150px] flex flex-row gap-2 w-[94vw] overflow-x-auto pb-1
        md:left-auto md:right-4 md:translate-x-0 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:flex-col md:gap-2.5 md:w-[min(78vw,300px)] md:overflow-visible md:pb-0">
        {[
          { icon: "🚑", t: "红牌救援", s: "3 道错题待复活", c: "from-rose-500/25 to-rose-400/10 border-rose-400/40" },
          { icon: "⚔️", t: "期末 BOSS", s: "39 天后来袭 · 今天备战", c: "from-violet-500/25 to-fuchsia-400/10 border-violet-400/40" },
          { icon: "⚡", t: "能力诊断", s: "看脑力雷达 4 维成长", c: "from-cyan-500/25 to-sky-400/10 border-cyan-400/40" },
        ].map((m) => (
          <div key={m.t} className={`shrink-0 w-[212px] md:w-auto rounded-2xl bg-gradient-to-br ${m.c} border backdrop-blur-md px-4 py-3 flex items-center gap-3 shadow-lg`}>
            <div className="text-2xl">{m.icon}</div>
            <div className="flex-1"><div className="font-display font-bold text-sm">{m.t}</div><div className="text-[11px] text-white/70">{m.s}</div></div>
            <div className="text-white/50 text-xl">›</div>
          </div>
        ))}
      </div>

      {/* 主 CTA (底部中央, 压在平台前景; 手机抬高避开底部导航) */}
      <div className="absolute bottom-20 lg:bottom-[3%] left-1/2 -translate-x-1/2 z-20 w-[min(86vw,420px)]">
        <button className="w-full rounded-3xl py-4 px-6 font-display font-black text-xl text-amber-950 shadow-[0_10px_40px_rgba(251,191,36,0.4)] bg-gradient-to-r from-amber-300 via-orange-400 to-pink-400 active:scale-[0.98] transition">
          ▶ 开始今日挑战
          <div className="text-xs font-bold text-amber-900/80 mt-0.5">还差 20 题 · 赢 ⭐</div>
        </button>
      </div>

      {/* 数值条 (左下) */}
      <div className={`absolute bottom-4 left-4 ${GLASS} px-4 py-2 text-[11px] hidden sm:flex items-center gap-3`}>
        <span className="text-white/60">综合</span><span className="font-bold text-amber-300 tabular-nums">680</span>
        <span className="text-white/20">|</span>
        <span>准确 <b className="text-cyan-300">86</b></span>
        <span>熟练 <b className="text-violet-300">71</b></span>
        <span>坚持 <b className="text-orange-300">9</b></span>
        <span>广度 <b className="text-emerald-300">63</b></span>
      </div>

      {/* 小熊猫副手 (右下) */}
      <div className="absolute bottom-4 right-5 text-4xl animate-bounce z-20" style={{ animationDuration: "3s" }}>🐼</div>

      {/* 实时生成 demo 控制条 (顶部中央) — 点职业 → 实时生成全身立绘 + 抠图 + 换上 */}
      <div className={`absolute top-2 left-1/2 -translate-x-1/2 z-30 ${GLASS} px-3 py-1.5 flex items-center gap-1.5 max-w-[94vw] flex-wrap justify-center`}>
        <span className="text-[10px] text-cyan-200 font-bold whitespace-nowrap">✨ 实时生成</span>
        <button onClick={() => setGender("female")} disabled={loading}
          className={`text-sm rounded-full w-7 h-7 ${gender === "female" ? "bg-pink-400/40 ring-1 ring-pink-300" : "bg-white/10"}`}>👧</button>
        <button onClick={() => setGender("male")} disabled={loading}
          className={`text-sm rounded-full w-7 h-7 ${gender === "male" ? "bg-sky-400/40 ring-1 ring-sky-300" : "bg-white/10"}`}>👦</button>
        <span className="text-white/20">|</span>
        {(Object.keys(ARCHETYPE_META) as Archetype[]).map((arc) => (
          <button key={arc} onClick={() => genLive(arc)} disabled={loading} title={ARCHETYPE_META[arc].label}
            className="text-base rounded-lg w-7 h-7 bg-white/10 hover:bg-white/20 disabled:opacity-40 transition">
            {ARCHETYPE_META[arc].emoji}
          </button>
        ))}
      </div>
      {genErr && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 text-[10px] bg-amber-500/30 border border-amber-400/40 rounded-full px-3 py-1 text-amber-100 max-w-[90vw] text-center">{genErr}</div>
      )}

      {/* 返回 */}
      <div className="absolute top-2 right-2 z-30 flex gap-2">
        <Link to="/math" className="text-[10px] bg-white/15 rounded-full px-2 py-1">← 返回</Link>
      </div>
    </div>
  );
}
