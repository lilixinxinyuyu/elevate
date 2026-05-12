/**
 * 工坊大厅里的一个传送门卡片。
 * Emoji + 名 + 描述 + 已完成次数（如果有）+ 星等
 */
import { Link } from "react-router-dom";
import type { AtelierRealm } from "../../content/atelier/realms";
import type { RealmProgress } from "../../lib/atelier/atelierProgress";

interface Props {
  realm: AtelierRealm;
  progress: RealmProgress;
  locked: boolean;
}

export function RealmPortal({ realm, progress, locked }: Props) {
  const visited = progress.visited > 0;
  const stars = "⭐".repeat(progress.stars) + "☆".repeat(Math.max(0, 3 - progress.stars));

  const cardClass =
    "relative flex flex-col items-center gap-2 rounded-3xl border-2 p-4 transition-all overflow-hidden " +
    (locked
      ? "opacity-50 cursor-not-allowed border-white/10 bg-white/[0.02]"
      : "border-2 hover:scale-[1.04] hover:shadow-2xl cursor-pointer");

  const content = (
    <>
      {/* 玻璃光晕 (visible only when unlocked) */}
      {!locked && (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-80 transition-opacity"
          style={{
            background: `radial-gradient(circle at 50% 40%, ${realm.accent.grad[0]}, ${realm.accent.grad[1]} 70%, transparent)`,
          }}
        />
      )}
      {/* Emoji 巨大 */}
      <div
        className="text-5xl drop-shadow-lg"
        style={!locked ? { filter: `drop-shadow(0 0 8px ${realm.accent.color})` } : undefined}
      >
        {locked ? "🔒" : realm.emoji}
      </div>
      <div className="text-center">
        <div className="font-display font-bold text-base text-slate-100">{realm.name}</div>
        <div className="text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-2 px-1">
          {realm.desc}
        </div>
      </div>
      {!locked && (
        <div className="flex items-center gap-2 text-[11px] text-amber-300/80">
          <span className="font-mono">{stars}</span>
          {visited && <span className="text-slate-500">· 探索 {progress.completed}/{progress.visited}</span>}
        </div>
      )}
    </>
  );

  if (locked) {
    return (
      <div className={cardClass} aria-disabled style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        {content}
      </div>
    );
  }

  return (
    <Link
      to={`/math/atelier/realm/${realm.id}`}
      className={cardClass}
      style={{ borderColor: realm.accent.color + "66" }}
    >
      {content}
    </Link>
  );
}
