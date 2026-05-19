/**
 * v0.35.69 — D2 World Map Preview (Sprint A 设计 prototype).
 *
 * Bruce directive (2026-05-19): "考虑一下游戏的这个界面设计... 整体地图,
 * 汤后的概念... 游戏化程度更高... 新模块我们也知道结构可以在哪些地方再去扩展."
 *
 * 这是 D2 (World Map) 方向的小样, 不替换现行 home. 入口: `/math/world-preview`.
 *
 * 设计要点:
 *  - SVG-based 可滚动地图. 节点 = G4B 6 个 unit + 期末 boss + 沙箱 atelier
 *  - 节点状态: locked / unlocked / current (Selena 在哪) / completed
 *  - Mascot 🐼 在 current 节点旁
 *  - 顶 HUD: XP 段位 / freezeTokens / 灵感
 *  - 点节点 → 该 unit 的 skill session (现有 TrainRoute)
 *
 * 后续 (若 Bruce 选 D2): 此 prototype 升级成 main home, 加 path 走动画 / mastery
 * 颜色渐变 / 节点解锁仪式动画.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { UNITS } from "../content/units";
import { SKILLS } from "../content/skills";
import { getUnlockedUnitIdSet } from "../db/unitUnlock";
import { TrainRoute } from "../lib/routes";
import { loadDaily, FREEZE_MAX_TOKENS } from "../lib/dailyTarget";
import type { Term } from "../core/types";

type NodeState = "locked" | "unlocked" | "current" | "completed";

interface MapNode {
  id: string;
  unitId?: string; // undefined = special (期末 boss / atelier)
  emoji: string;
  label: string;
  /** SVG 坐标 — viewBox 是 600 × 800 (竖屏滚动) */
  x: number;
  y: number;
  state: NodeState;
}

/** G4B 6 unit + 1 期末 boss + 1 atelier 沙箱 = 8 节点 */
function buildNodes(unlockedUnits: Set<string>, currentUnitId: string | undefined, masteryByUnit: Map<string, number>): MapNode[] {
  // 取 G4B 下册 6 unit (orderIndex 1-6)
  const g4bUnits = UNITS.filter((u) => u.term === "下册").sort((a, b) => a.orderIndex - b.orderIndex);
  // 蜿蜒 zig-zag 布局
  const positions = [
    { x: 120, y: 700 },  // U1
    { x: 460, y: 600 },  // U2
    { x: 140, y: 510 },  // U3
    { x: 440, y: 410 },  // U4
    { x: 150, y: 310 },  // U5
    { x: 450, y: 220 },  // U6
  ];
  const emojis = ["🏠", "△", "✨", "👁️", "🔬", "🏛️"];

  const unitNodes: MapNode[] = g4bUnits.slice(0, 6).map((u, i) => {
    const mastery = masteryByUnit.get(u.id) ?? 0;
    let state: NodeState = "locked";
    if (unlockedUnits.has(u.id)) {
      state = mastery >= 75 ? "completed" : (u.id === currentUnitId ? "current" : "unlocked");
    }
    return {
      id: u.id,
      unitId: u.id,
      emoji: emojis[i] ?? "📍",
      label: u.name,
      x: positions[i]?.x ?? 300,
      y: positions[i]?.y ?? 400,
      state,
    };
  });

  // 期末 boss (上方)
  unitNodes.push({
    id: "final_boss",
    emoji: "🏰",
    label: "期末城堡",
    x: 300,
    y: 100,
    state: unitNodes.every((n) => n.state === "completed") ? "unlocked" : "locked",
  });

  // 沙箱 atelier (右下)
  unitNodes.push({
    id: "atelier",
    emoji: "🎨",
    label: "小进工坊",
    x: 480,
    y: 760,
    state: "unlocked",
  });

  return unitNodes;
}

const STATE_STYLES: Record<NodeState, { bg: string; border: string; opacity: string; pulse?: string }> = {
  locked: { bg: "fill-slate-700", border: "stroke-slate-600", opacity: "opacity-40" },
  unlocked: { bg: "fill-violet-500/70", border: "stroke-violet-300", opacity: "" },
  current: { bg: "fill-amber-400", border: "stroke-amber-200 stroke-[3px]", opacity: "", pulse: "animate-pulse" },
  completed: { bg: "fill-emerald-500", border: "stroke-emerald-200", opacity: "" },
};

export function WorldMapPreviewPage() {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [currentUnitId, setCurrentUnitId] = useState<string | undefined>();
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [freezeTokens, setFreezeTokens] = useState(0);
  const [streak, setStreak] = useState(0);
  // 简单 mastery 加总 — 用 mastery 表 (这里只做 placeholder)
  const masteryByUnit = new Map<string, number>();

  // load student + unlock + freeze state
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const students = await db.students.toArray();
      const s = students[0];
      if (cancelled || !s) return;
      setStudentId(s.id);
      setCurrentUnitId(s.currentUnitId);
      const unlockedIds = await getUnlockedUnitIdSet(s.id, (s.currentTerm ?? "下册") as Term);
      setUnlocked(unlockedIds);
      const daily = await loadDaily("math", s.id);
      setFreezeTokens(daily.freezeTokens ?? 0);
      setStreak(daily.streak);
    })();
    return () => { cancelled = true; };
  }, []);

  // skill counts per unit (for 浮动 chip)
  const skillCountByUnit = new Map<string, number>();
  for (const s of SKILLS) {
    skillCountByUnit.set(s.unitId, (skillCountByUnit.get(s.unitId) ?? 0) + 1);
  }

  const nodes = buildNodes(unlocked, currentUnitId, masteryByUnit);
  const currentNode = nodes.find((n) => n.state === "current");

  function handleNodeClick(node: MapNode) {
    if (node.state === "locked") return;
    if (node.id === "final_boss") {
      navigate("/math/exam-prep");
      return;
    }
    if (node.id === "atelier") {
      navigate("/math/atelier");
      return;
    }
    if (node.unitId) {
      // 该 unit 的 skill session
      const skills = SKILLS.filter((s) => s.unitId === node.unitId).slice(0, 3);
      if (skills.length === 0) return;
      navigate(TrainRoute.build({ mode: "skill", skillIds: skills.map((s) => s.id), fresh: Date.now() }));
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-slate-950 to-slate-900 text-slate-100 pb-20">
      {/* HUD 顶栏 */}
      <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur border-b border-slate-700 px-4 py-3 flex items-center gap-3">
        <Link to="/math" className="text-slate-400 hover:text-slate-100 text-sm">← 老首页</Link>
        <div className="flex-1 text-center">
          <div className="font-display font-bold text-sm">🗺️ 数学世界 · 四年级下册</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-400/40 text-violet-100">
            🔥 {streak}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-100">
            🎫 {freezeTokens}/{FREEZE_MAX_TOKENS}
          </span>
        </div>
      </div>

      {/* Mascot 介绍 banner */}
      {currentNode && (
        <div className="mx-4 mt-3 p-3 rounded-2xl bg-gradient-to-r from-violet-600/30 to-fuchsia-600/20 border border-violet-400/40 flex items-center gap-3">
          <div className="text-4xl">🐼</div>
          <div className="flex-1">
            <div className="text-xs text-violet-200/80">小进现在在</div>
            <div className="font-display font-bold text-base text-violet-50">{currentNode.label}</div>
            <div className="text-[11px] text-violet-200/70 mt-0.5">点亮黄色节点继续探险</div>
          </div>
        </div>
      )}

      {/* 地图 SVG */}
      <div className="mx-2 mt-4 rounded-3xl bg-gradient-to-b from-slate-900/50 to-indigo-900/30 border border-indigo-400/20 overflow-hidden">
        <svg viewBox="0 0 600 820" className="w-full h-auto" aria-label="数学世界地图">
          {/* 装饰背景 — 星星 + 云 */}
          <defs>
            <radialGradient id="star" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#fde047" stopOpacity="1" />
              <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="path-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          {[...Array(40)].map((_, i) => {
            const x = (i * 37) % 600;
            const y = (i * 53) % 820;
            const r = (i % 3) + 1;
            return <circle key={i} cx={x} cy={y} r={r} fill="url(#star)" opacity="0.4" />;
          })}

          {/* 路径线 (连接 connected nodes) */}
          {nodes.slice(0, 6).map((n, i) => {
            if (i === 0) return null;
            const prev = nodes[i - 1];
            if (!prev) return null;
            const dim = n.state === "locked" || prev.state === "locked";
            return (
              <path
                key={`path-${i}`}
                d={`M ${prev.x} ${prev.y} Q ${(prev.x + n.x) / 2} ${(prev.y + n.y) / 2 - 20} ${n.x} ${n.y}`}
                stroke={dim ? "#475569" : "url(#path-grad)"}
                strokeWidth="6"
                strokeDasharray={dim ? "8 6" : "0"}
                fill="none"
                opacity={dim ? 0.4 : 0.9}
              />
            );
          })}
          {/* U6 → 期末 boss path */}
          {(() => {
            const u6 = nodes[5];
            const boss = nodes.find((n) => n.id === "final_boss");
            if (!u6 || !boss) return null;
            const dim = boss.state === "locked";
            return (
              <path
                d={`M ${u6.x} ${u6.y} Q ${(u6.x + boss.x) / 2} ${(u6.y + boss.y) / 2 - 30} ${boss.x} ${boss.y}`}
                stroke={dim ? "#475569" : "url(#path-grad)"}
                strokeWidth="6"
                strokeDasharray={dim ? "8 6" : "0"}
                fill="none"
                opacity={dim ? 0.4 : 0.9}
              />
            );
          })()}

          {/* 节点 */}
          {nodes.map((n) => {
            const style = STATE_STYLES[n.state];
            const skillCount = n.unitId ? (skillCountByUnit.get(n.unitId) ?? 0) : 0;
            return (
              <g
                key={n.id}
                onClick={() => handleNodeClick(n)}
                className={`cursor-pointer ${style.opacity} ${style.pulse ?? ""}`}
                style={{ pointerEvents: n.state === "locked" ? "none" : "auto" }}
              >
                {/* 节点外圈 */}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.id === "final_boss" || n.id === "atelier" ? 42 : 36}
                  className={`${style.bg} ${style.border} stroke-[2px]`}
                />
                {/* Emoji */}
                <text
                  x={n.x}
                  y={n.y + 8}
                  textAnchor="middle"
                  className="text-2xl"
                  style={{ fontSize: 28 }}
                >
                  {n.emoji}
                </text>
                {/* 锁 icon */}
                {n.state === "locked" && (
                  <text x={n.x + 22} y={n.y - 22} textAnchor="middle" style={{ fontSize: 14 }}>🔒</text>
                )}
                {/* completed star */}
                {n.state === "completed" && (
                  <text x={n.x + 22} y={n.y - 22} textAnchor="middle" style={{ fontSize: 14 }}>⭐</text>
                )}
                {/* 标签 */}
                <text
                  x={n.x}
                  y={n.y + 60}
                  textAnchor="middle"
                  fill="white"
                  style={{ fontSize: 14, fontWeight: 600 }}
                >
                  {n.label}
                </text>
                {/* skill count chip */}
                {skillCount > 0 && n.state !== "locked" && (
                  <text
                    x={n.x}
                    y={n.y + 78}
                    textAnchor="middle"
                    fill="#cbd5e1"
                    style={{ fontSize: 11 }}
                  >
                    {skillCount} 技能
                  </text>
                )}
                {/* current Mascot 跟随 */}
                {n.state === "current" && (
                  <text x={n.x + 50} y={n.y - 10} textAnchor="middle" style={{ fontSize: 30 }}>🐼</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 底部 quick 入口 (类似游戏菜单) */}
      <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
        <Link to={TrainRoute.build({ fresh: Date.now() })} className="rounded-xl p-3 text-center bg-violet-600/30 border border-violet-400/40 hover:bg-violet-600/50 transition">
          <div className="text-2xl">🎯</div>
          <div className="text-xs mt-1 text-violet-100">今日挑战</div>
        </Link>
        <Link to="/math/mistakes" className="rounded-xl p-3 text-center bg-rose-600/30 border border-rose-400/40 hover:bg-rose-600/50 transition">
          <div className="text-2xl">⚔️</div>
          <div className="text-xs mt-1 text-rose-100">驯龙营</div>
        </Link>
        <Link to="/math/fluency" className="rounded-xl p-3 text-center bg-cyan-600/30 border border-cyan-400/40 hover:bg-cyan-600/50 transition">
          <div className="text-2xl">⚡</div>
          <div className="text-xs mt-1 text-cyan-100">闪电口算</div>
        </Link>
      </div>

      {/* 设计说明 (preview only, ship 时删) */}
      <div className="mx-4 mt-6 p-3 rounded-xl bg-slate-900/60 border border-slate-700 text-xs text-slate-300 space-y-1">
        <div className="font-display font-bold text-slate-100">🛠️ Preview 说明 (Bruce 评审用)</div>
        <p>• 这是 D2 World Map 方向小样, 不替换现行 /math 首页</p>
        <p>• 6 节点 = G4B 6 个 unit, 当前位置 = student.currentUnitId (黄色 pulse)</p>
        <p>• 已解锁/已完成节点点击 → 该 unit 的 skill train session</p>
        <p>• 🏰 期末城堡 = exam-prep dashboard (6 unit 全 mastery &ge; 75 才解锁)</p>
        <p>• 🎨 工坊 = atelier 沙箱入口 (旁支)</p>
        <p>• 顶部 HUD: 🔥 streak / 🎫 freezeTokens (P1-2 已 ship)</p>
        <p>• 后续若选 D2: 加 path 走动画 / 解锁仪式 / unit 进度环 / mascot 走到目标</p>
      </div>
    </div>
  );
}
