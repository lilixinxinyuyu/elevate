/**
 * 题目页右下角小进 PIP —— 用于工坊启动的 session。
 *
 * 跟主 Mascot3D 同一个组件，只是尺寸小 (180x180) + 固定 portrait 视角。
 * gesture / emotion 由外部根据答题结果驱动（答对 wave / thumbsUp，答错 nod / shake，闲时 idle）。
 *
 * Lazy 加载：避免主路径 train 用户也下载 R3F / VRM bundle。
 */
import { Suspense, lazy } from "react";
import type { MascotEmotion, MascotGesture, MascotOutfit, MascotSkin } from "../Mascot3D";

const Mascot3D = lazy(() => import("../Mascot3D"));

interface Props {
  gesture: MascotGesture;
  emotion: MascotEmotion;
  outfit: MascotOutfit;
  skin: MascotSkin;
  /** 可选浮窗台词 */
  line?: string;
  /** 可选 accent color (matches realm) */
  accent?: string;
}

export function MascotPIP({ gesture, emotion, outfit, skin, line, accent }: Props) {
  return (
    <div
      className="fixed bottom-3 right-3 z-30 w-[180px] h-[180px] rounded-3xl overflow-hidden border-2 shadow-2xl bg-gradient-to-b from-ink-900 to-ink-950 backdrop-blur-sm"
      style={{ borderColor: (accent ?? "#a78bfa") + "88" }}
    >
      <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-xs text-slate-400">…</div>}>
        <Mascot3D
          view="portrait"
          skin={skin}
          outfit={outfit}
          gesture={gesture}
          emotion={emotion}
        />
      </Suspense>
      {line && (
        <div className="absolute -top-1 -left-2 right-2 -translate-y-full">
          <div className="text-[10px] text-slate-50 px-3 py-1.5 bg-black/80 rounded-2xl border border-violet-300/30 shadow-2xl">
            {line}
          </div>
        </div>
      )}
    </div>
  );
}
