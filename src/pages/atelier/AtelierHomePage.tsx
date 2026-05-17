/**
 * 小进的星海工坊 — 大厅入口
 *
 * 上半屏：Mascot3D Xiaojin 在她的星空教室 idle，偶尔挥手
 * 中部：对话框（Xiaojin 说话）
 * 下半屏：5 个传送门卡片
 * 角落：灵感条 + 工坊阶段
 *
 * 完全独立沙箱，跟主路径无任何耦合。
 */
import { Suspense, lazy, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { MascotGesture } from "../../components/Mascot3D";
import { ATELIER_REALMS, getRealmById, type AtelierRealmId } from "../../content/atelier/realms";
import { RealmPortal } from "../../components/atelier/RealmPortal";
import { AtelierDecorations } from "../../components/atelier/AtelierDecorations";
import {
  getAllRealmProgress,
  getAtelierStage,
  getInspiration,
  INSPIRATION_THRESHOLDS,
  type RealmProgress,
} from "../../lib/atelier/atelierProgress";
import { getDisplayName, useDisplayName } from "../../lib/displayName";

const Mascot3D = lazy(() => import("../../components/Mascot3D"));

// 随机 idle 台词 —— 每次刷新换一句，让 Xiaojin 显得"在思考"
// v0.34.67: 第一句插 displayName, 用 getDisplayName() 在构造时取
function buildIdleLines(name: string): string[] {
  return [
    `${name}！今天想去哪个维度？`,
    "工坊的星核今天特别亮 ✨ —— 我们去玩哪个？",
    "我刚把所有传送门擦干净了，挑一个吧～",
    "宝石矿里好像新长出了一颗光球，要不要去看看？",
    "时光塔的指针今天有点迷糊，过去帮一下？",
    "嘿嘿，听说折扣街又打折了！",
    "数学就像魔法 —— 选一扇门，我们就开始～",
  ];
}

export function AtelierHomePage() {
  useDisplayName(); // subscribe so name change re-renders (line refresh on next mount)
  const [inspiration, setInspiration] = useState(0);
  const [progress, setProgress] = useState<Record<string, RealmProgress>>({});
  const [line, setLine] = useState(() => {
    const lines = buildIdleLines(getDisplayName());
    return lines[Math.floor(Math.random() * lines.length)]!;
  });
  const [gesture, setGesture] = useState<MascotGesture>("idle");
  // 回工坊 banner — 从 SummaryView 跳回来时 URL 带 ?just=N&realm=id
  const [searchParams] = useSearchParams();
  const justInspiration = Number(searchParams.get("just")) || 0;
  const justRealmId = searchParams.get("realm") as AtelierRealmId | null;
  const justRealm = justRealmId ? getRealmById(justRealmId) : null;
  const [bannerVisible, setBannerVisible] = useState(justInspiration > 0);

  // 加载进度
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [insp, allProg] = await Promise.all([
        getInspiration(),
        getAllRealmProgress(ATELIER_REALMS.map((r) => r.id)),
      ]);
      if (!cancelled) {
        setInspiration(insp);
        setProgress(allProg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 进入后 0.9s 触发一次欢迎挥手；之后每 9-15s 随机来一个 idle 小动作
  useEffect(() => {
    let cancelled = false;
    const cycle: { gesture: MascotGesture; durMs: number; nextDelayMs: number }[] = [
      { gesture: "wave", durMs: 3700, nextDelayMs: 12000 },
      { gesture: "nod", durMs: 2400, nextDelayMs: 10000 },
      { gesture: "thumbsUp", durMs: 2400, nextDelayMs: 13000 },
      { gesture: "point", durMs: 2400, nextDelayMs: 11000 },
      { gesture: "cheer", durMs: 2800, nextDelayMs: 14000 },
    ];

    const playNext = (idx: number, initialDelay: number) => {
      setTimeout(() => {
        if (cancelled) return;
        const step = cycle[idx]!;
        setGesture(step.gesture);
        setTimeout(() => {
          if (cancelled) return;
          setGesture("idle");
          // 偶尔换一句台词
          if (Math.random() < 0.5) {
            const lines = buildIdleLines(getDisplayName());
            setLine(lines[Math.floor(Math.random() * lines.length)] ?? "");
          }
          playNext((idx + 1) % cycle.length, step.nextDelayMs);
        }, step.durMs);
      }, initialDelay);
    };

    playNext(0, 900); // 先 wave 欢迎
    return () => {
      cancelled = true;
    };
  }, []);

  const stage = getAtelierStage(inspiration);
  const nextThreshold = INSPIRATION_THRESHOLDS.find((t) => inspiration < t.at);

  return (
    <div className="space-y-4 p-4">
      {/* 完成 train 返工坊的庆祝 banner — 5s 后自动隐藏 */}
      {bannerVisible && justRealm && (
        <div
          className="card-glow border-2 animate-pulse-once"
          style={{
            borderColor: justRealm.accent.color + "aa",
            background: `linear-gradient(135deg, ${justRealm.accent.grad[0]}, ${justRealm.accent.grad[1]})`,
          }}
        >
          <div className="flex items-center gap-3">
            <div className="text-4xl">{justRealm.emoji}</div>
            <div className="flex-1">
              <div className="font-display font-bold text-base text-slate-50">
                从 {justRealm.name} 满载而归 🎉
              </div>
              <div className="text-xs text-slate-300 mt-0.5">
                灵感 <span className="font-mono text-amber-300 font-bold">+{justInspiration}</span>{" "}
                · 工坊会因为你越来越亮 ✨
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBannerVisible(false)}
              className="chip text-xs px-2 py-1 bg-white/10 border border-white/10 text-slate-300 hover:bg-white/20"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 顶 hint + 灵感条 */}
      <div className="card-glow border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-rose-500/5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="font-display font-bold text-amber-100 text-lg flex items-center gap-2">
              🏠 小进的星海工坊
              <span className="text-xs text-amber-300/60 font-normal">（沙箱实验）</span>
            </div>
            <div className="text-xs text-amber-200/80 mt-1 leading-relaxed">
              欢迎来到 Xiaojin 的工坊 —— 点击传送门，进入对应的数学维度。
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] text-slate-400">灵感</div>
            <div className="font-display font-bold text-2xl text-amber-300">{inspiration}</div>
            {nextThreshold && (
              <div className="text-[10px] text-slate-500">
                还差 {nextThreshold.at - inspiration} 解锁
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mascot3D 视口 + 对话框叠加 */}
      <div className="relative rounded-3xl overflow-hidden border border-violet-400/30 bg-gradient-to-b from-ink-900 to-ink-950 h-[360px] sm:h-[440px]">
        <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-slate-400">加载工坊…</div>}>
          <Mascot3D
            view="portrait"
            skin="default"
            outfit="default"
            gesture={gesture}
            emotion="happy"
          />
        </Suspense>
        {/* 装饰层（按 stage 阶段性出现） */}
        <AtelierDecorations stage={stage} />
        {/* 顶部 SVG 浮空标题（不挡 Xiaojin 脸） */}
        <div className="absolute top-3 left-0 right-0 text-center pointer-events-none">
          <div className="inline-block px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm text-[11px] text-violet-200">
            ✨ 工坊阶段 {stage} / {INSPIRATION_THRESHOLDS.length}
          </div>
        </div>
        {/* 底部对话框 */}
        <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-4 py-2.5 border border-violet-300/30 shadow-2xl">
            <div className="text-[10px] text-violet-300/70 mb-0.5">小进</div>
            <div className="text-sm text-violet-50 leading-snug">{line}</div>
          </div>
        </div>
      </div>

      {/* 5 个传送门 */}
      <div className="space-y-2">
        <div className="text-xs text-slate-400 px-1">维度选择</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {ATELIER_REALMS.map((realm) => {
            const realmProgress = progress[realm.id] ?? { visited: 0, completed: 0, stars: 0 };
            const locked = inspiration < realm.inspirationGate;
            return (
              <RealmPortal
                key={realm.id}
                realm={realm}
                progress={realmProgress}
                locked={locked}
              />
            );
          })}
        </div>
      </div>

      {/* 阶段解锁 hint */}
      {nextThreshold && (
        <div className="card text-center">
          <div className="text-xs text-slate-400 mb-1">下一个里程碑</div>
          <div className="text-sm text-slate-200">
            <span className="font-mono text-amber-300">{nextThreshold.at}</span>{" "}
            灵感解锁{" "}
            <span className="text-amber-200">{nextThreshold.label}</span>
          </div>
        </div>
      )}

      {/* 友情链接 + 沙箱声明 */}
      <div className="card-flat text-[11px] text-slate-500 leading-relaxed">
        💡 这是沙箱版工坊，跟主路径完全隔离。进度仅存在 <code>db.meta `atelier::*`</code>，可随时
        <Link to="/math/admin" className="text-violet-300 ml-1 underline">从 admin reset</Link>
        。如果你想做日常练习，请回
        <Link to="/math" className="text-violet-300 ml-1 underline">数学主页</Link>。
      </div>
    </div>
  );
}
