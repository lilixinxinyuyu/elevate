/**
 * 盲盒抽奖弹窗 — Selena 解锁稀有 trophy 时显示。
 *
 * 体验流程：
 *  1. 礼物盒摇晃 + "你解锁了一个特殊成就！" 文字
 *  2. 点击礼物盒 → 闪光 + 调 wan2.7-image-pro 生成独家专属图
 *  3. 揭示阶段：图渐显（fade + scale），背景金色烟花
 *  4. "太棒啦" 关闭按钮
 *
 * 这一张图永久存在 db.trophyImages（trophyId 为 key），下次该 trophy 显示
 * 时直接用这张独家图。
 */

import { useEffect, useRef, useState } from "react";
import { ensureTrophyImage, type TrophyMeta } from "../lib/trophyImages";
import { sfx } from "../lib/sfx";
import { MascotAvatar } from "./MascotAvatar";

interface Props {
  trophy: TrophyMeta;
  onClose: () => void;
}

export function LotteryBoxModal({ trophy, onClose }: Props) {
  const [phase, setPhase] = useState<"closed" | "opening" | "generating" | "revealed" | "failed">(
    "closed",
  );
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fired = useRef(false);

  const handleOpen = async () => {
    if (fired.current) return;
    fired.current = true;
    sfx.chest();
    setPhase("opening");
    // 短暂的开盖动画再调 AI
    await new Promise((r) => setTimeout(r, 600));
    setPhase("generating");
    try {
      const row = await ensureTrophyImage(trophy, { force: true, isLottery: true });
      sfx.levelUp();
      setImageUrl(row.imageDataUrl);
      setPhase("revealed");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("failed");
    }
  };

  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 animate-slide-up"
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "generating") onClose();
      }}
    >
      {/* 背景烟花层（revealed 时） */}
      {phase === "revealed" && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-amber-400/30 animate-burst" />
          <div
            className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-rose-400/30 animate-burst"
            style={{ animationDelay: "200ms" }}
          />
          <div
            className="absolute bottom-1/4 left-1/3 w-80 h-80 rounded-full bg-violet-400/30 animate-burst"
            style={{ animationDelay: "400ms" }}
          />
          <div className="absolute inset-0 flex items-start justify-around pt-4 text-3xl pointer-events-none">
            {["🎉", "✨", "🎊", "⭐", "🌟", "💫", "🎉"].map((e, i) => (
              <span
                key={i}
                className="animate-slide-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="relative max-w-md w-full">
        {/* 关闭按钮 */}
        {phase !== "generating" && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-ink-900/80 text-slate-400 hover:text-slate-100 text-xl leading-none flex items-center justify-center"
            aria-label="关闭"
          >
            ×
          </button>
        )}

        <div className="card-glow border-amber-400/60 bg-gradient-to-br from-violet-900/95 via-fuchsia-900/95 to-amber-900/90 text-center px-6 py-8 space-y-4 overflow-hidden">
          <div className="text-xs uppercase tracking-widest text-amber-300 font-display">
            ✨ 稀有成就解锁 ✨
          </div>
          <div className="font-display font-bold text-3xl text-amber-100 leading-tight">
            {trophy.name}
          </div>
          {trophy.description && (
            <div className="text-sm text-amber-200/80">{trophy.description}</div>
          )}

          {/* 主舞台 */}
          <div className="py-6 flex items-center justify-center min-h-[200px]">
            {phase === "closed" && (
              <button
                type="button"
                onClick={handleOpen}
                className="text-9xl hover:scale-110 transition-transform animate-chest-bob cursor-pointer"
                aria-label="点击打开"
              >
                🎁
              </button>
            )}
            {phase === "opening" && <div className="text-9xl animate-pop">🎁</div>}
            {phase === "generating" && (
              <div className="space-y-3 flex flex-col items-center">
                {/* 小进头像 + 旋转的魔法光晕 */}
                <div className="relative">
                  <MascotAvatar size="lg" autoEnsure glow />
                  <div className="absolute inset-0 rounded-full ring-4 ring-amber-400/30 animate-ping pointer-events-none" />
                </div>
                <div className="text-sm text-amber-200">
                  <span className="animate-pulse">小进正在为你画一枚专属勋章…</span>
                </div>
                <div className="flex justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span
                    className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
                <div className="text-[10px] text-slate-400">15-25 秒</div>
              </div>
            )}
            {phase === "revealed" && imageUrl && (
              <img
                src={imageUrl}
                alt={trophy.name}
                className="w-56 h-56 rounded-3xl animate-pop ring-4 ring-amber-400/60 shadow-glow-amber object-cover"
              />
            )}
            {phase === "failed" && (
              <div className="space-y-2">
                <div className="text-5xl">😢</div>
                <div className="text-xs text-rose-300 break-all">{error}</div>
                <button
                  type="button"
                  onClick={() => {
                    fired.current = false;
                    void handleOpen();
                  }}
                  className="btn-primary text-sm"
                >
                  🔄 再开一次
                </button>
              </div>
            )}
          </div>

          {phase === "closed" && (
            <div className="text-sm text-amber-200/90 italic">
              点击礼物盒抽取你的<span className="font-bold text-amber-100">独家专属勋章</span>～
              <br />
              <span className="text-xs text-slate-400">
                每个稀有成就都会生成一枚独一无二的图案
              </span>
            </div>
          )}

          {phase === "revealed" && (
            <div className="space-y-3">
              <div className="text-emerald-200 text-sm font-semibold">
                ✓ 这是属于你的专属勋章！
              </div>
              <div className="text-xs text-slate-400">
                已永久保存到你的勋章墙
              </div>
              <button
                type="button"
                onClick={onClose}
                className="btn-primary text-sm"
              >
                太棒啦 ✨
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
