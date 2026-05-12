/**
 * 工坊维度入口页 —— 点传送门后到达，做一段过场，"开始挑战" 跳真题流。
 *
 * Flow：
 *  1. URL `/math/atelier/realm/:id`
 *  2. 加载 realm 定义，Mascot3D 切换到对应 outfit + skin
 *  3. Xiaojin gesture wave 1 次 → 显示 greeting 台词
 *  4. "开始挑战" button → navigate `/math/train?skillIds=...&fromAtelier=<id>`
 *  5. （未来）train 完成后回此页加灵感
 */
import { Suspense, lazy, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getRealmById } from "../../content/atelier/realms";
import type { MascotGesture } from "../../components/Mascot3D";
import { recordRealmVisit } from "../../lib/atelier/atelierProgress";

const Mascot3D = lazy(() => import("../../components/Mascot3D"));

export function AtelierRealmPage() {
  const params = useParams<{ id: string }>();
  const realm = getRealmById(params.id);
  const navigate = useNavigate();
  const [gesture, setGesture] = useState<MascotGesture>("idle");
  const [phase, setPhase] = useState<"intro" | "ready">("intro");

  // 记录访问 + 自动播放欢迎动画
  useEffect(() => {
    if (!realm) return;
    void recordRealmVisit(realm.id);
    // 200ms 后 Xiaojin wave 一下，3.7s 后回 idle，进入 ready
    const t1 = setTimeout(() => setGesture("wave"), 200);
    const t2 = setTimeout(() => {
      setGesture("idle");
      setPhase("ready");
    }, 3900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [realm]);

  if (!realm) {
    return (
      <div className="p-4">
        <div className="card text-center">
          <div className="text-base text-rose-200">未找到该维度</div>
          <Link to="/math/atelier" className="btn-secondary text-sm mt-3">回工坊</Link>
        </div>
      </div>
    );
  }

  const startChallenge = () => {
    // 进入 train 页 + 自由练 skill 列表
    const params = new URLSearchParams();
    params.set("skillIds", realm.skillIds.join(","));
    params.set("fromAtelier", realm.id);
    navigate(`/math/train?${params.toString()}`);
  };

  const accentColor = realm.accent.color;

  return (
    <div className="space-y-4 p-4">
      {/* Realm 标题 */}
      <div
        className="card-glow border-2"
        style={{
          borderColor: accentColor + "66",
          background: `linear-gradient(135deg, ${realm.accent.grad[0]}, ${realm.accent.grad[1]})`,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="text-4xl drop-shadow" style={{ filter: `drop-shadow(0 0 8px ${accentColor})` }}>
            {realm.emoji}
          </div>
          <div className="flex-1">
            <div className="font-display font-bold text-xl text-slate-50">{realm.name}</div>
            <div className="text-xs text-slate-300 mt-0.5">{realm.desc}</div>
          </div>
          <Link
            to="/math/atelier"
            className="chip text-xs px-3 py-1.5 bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
          >
            ← 回工坊
          </Link>
        </div>
      </div>

      {/* Mascot3D 视口（带 realm-specific outfit + skin） */}
      <div
        className="relative rounded-3xl overflow-hidden border-2 h-[420px] sm:h-[500px]"
        style={{ borderColor: accentColor + "55" }}
      >
        <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-slate-400">进入维度…</div>}>
          <Mascot3D
            view="portrait"
            skin={realm.xiaojinSkin}
            outfit={realm.xiaojinOutfit}
            gesture={gesture}
            emotion="happy"
          />
        </Suspense>
        {/* Xiaojin 台词 */}
        <div className="absolute bottom-3 left-3 right-3">
          <div
            className="rounded-2xl backdrop-blur-sm px-4 py-3 border shadow-2xl bg-black/60"
            style={{ borderColor: accentColor + "55" }}
          >
            <div className="text-[10px] mb-0.5" style={{ color: accentColor }}>
              小进
            </div>
            <div className="text-sm text-slate-50 leading-snug">{realm.greeting}</div>
          </div>
        </div>
      </div>

      {/* "开始挑战" / 等小进介绍完 */}
      <div className="card flex flex-col items-center gap-3 text-center">
        <div className="text-xs text-slate-400">本维度训练内容</div>
        <div className="text-sm text-slate-200 leading-relaxed">
          {realm.skillIds.length} 个相关 skill：
          <span className="text-slate-400 mx-1">·</span>
          <span className="font-mono text-[11px] text-slate-500">{realm.skillIds.slice(0, 3).join(" / ")}</span>
          {realm.skillIds.length > 3 && <span className="text-slate-500"> +{realm.skillIds.length - 3} 个</span>}
        </div>
        <button
          type="button"
          onClick={startChallenge}
          disabled={phase !== "ready"}
          className="btn-primary text-base px-6 py-3 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={
            phase === "ready"
              ? { background: `linear-gradient(135deg, ${accentColor}, ${accentColor}99)`, color: "#fff" }
              : undefined
          }
        >
          {phase === "ready" ? `🚀 开始挑战 ${realm.name}` : "✨ 小进正在介绍…"}
        </button>
        <div className="text-[10px] text-slate-500">
          （挑战完成后会回工坊，灵感 +N。）
        </div>
      </div>

      {/* 小进 tagline 浮层 */}
      <div className="card-flat text-xs italic text-slate-300 text-center">
        💬 小进：&quot;{realm.tagline}&quot;
      </div>
    </div>
  );
}
