/**
 * /math/mascot-compare — 隐藏的小进基础形象对比页（不进 nav，直链可达）。
 *
 * 用途：5 种风格各生成 N 张候选，并排展示，让爸爸/妈妈看着对比挑出"地基"。
 * 选定后存进 db.trophyImages 作为 mascot 默认图，全 UI 立刻换。
 *
 * 不消耗装扮卡（这是基础形象选型，不是衣装）。
 */

import { useEffect, useRef, useState } from "react";
import { generateImage } from "../lib/tutor";
import { MASCOT_STYLE_VARIANTS, type MascotStyleVariant } from "../lib/mascotStyles";
import { db } from "../db/dexie";
import { MASCOT_XIAOJIN } from "../lib/mascot";

interface CandidateState {
  styleId: string;
  blob?: Blob;
  url?: string;
  status: "pending" | "ok" | "failed";
  error?: string;
}

export function MascotComparePage() {
  const [n, setN] = useState(2); // 每风格几张
  const [candidates, setCandidates] = useState<CandidateState[]>([]);
  const [running, setRunning] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const generateAll = async () => {
    setRunning(true);
    setCandidates([]);
    setSavedId(null);

    // 给每个 style × 每张候选都加 placeholder 占位
    const initial: CandidateState[] = [];
    for (const s of MASCOT_STYLE_VARIANTS) {
      for (let i = 0; i < n; i++) {
        initial.push({ styleId: s.id, status: "pending" });
      }
    }
    setCandidates(initial);

    // 并发：每个 style 一个 generateImage 请求（n 张）
    await Promise.all(
      MASCOT_STYLE_VARIANTS.map(async (s) => {
        try {
          const r = await generateImage({ prompt: s.prompt, size: "512*512", n });
          if (!r.urls || r.urls.length === 0) throw new Error("no_urls");
          for (let i = 0; i < r.urls.length; i++) {
            const url = r.urls[i]!;
            try {
              const resp = await fetch(url);
              if (!resp.ok) throw new Error(`http_${resp.status}`);
              const blob = await resp.blob();
              const localUrl = URL.createObjectURL(blob);
              urlsRef.current.push(localUrl);
              setCandidates((prev) => {
                const next = [...prev];
                let updated = false;
                for (let j = 0; j < next.length; j++) {
                  const c = next[j];
                  if (c && c.styleId === s.id && c.status === "pending" && !updated) {
                    next[j] = { styleId: s.id, blob, url: localUrl, status: "ok" };
                    updated = true;
                  }
                }
                return next;
              });
            } catch (e) {
              setCandidates((prev) => {
                const next = [...prev];
                let updated = false;
                for (let j = 0; j < next.length; j++) {
                  const c = next[j];
                  if (c && c.styleId === s.id && c.status === "pending" && !updated) {
                    next[j] = { styleId: s.id, status: "failed", error: (e as Error).message };
                    updated = true;
                  }
                }
                return next;
              });
            }
          }
        } catch (e) {
          // 整个 style 失败：把所有 pending 标 failed
          setCandidates((prev) =>
            prev.map((c) =>
              c.styleId === s.id && c.status === "pending"
                ? { styleId: s.id, status: "failed", error: (e as Error).message }
                : c,
            ),
          );
        }
      }),
    );
    setRunning(false);
  };

  const saveAsBase = async (cand: CandidateState, style: MascotStyleVariant, idx: number) => {
    if (!cand.blob) return;
    // 写进 db.trophyImages 作为默认 mascot 图（替换之前缓存的）
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("FileReader not string"));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(cand.blob!);
    });
    await db.trophyImages.put({
      trophyId: MASCOT_XIAOJIN.id,
      subjectId: "math",
      imageDataUrl: dataUrl,
      sourceUrl: cand.url,
      prompt: style.prompt,
      model: "qwen-image-2.0-pro",
      generatedAt: Date.now(),
      isLottery: false,
    });
    // 清掉佩戴中的 wardrobe 衣装，让 base mascot 显示
    const wAll = await db.mascotWardrobe.toArray();
    for (const w of wAll) {
      if (w.equipped === 1) {
        w.equipped = 0;
        await db.mascotWardrobe.put(w);
      }
    }
    setSavedId(`${style.id}_${idx}`);
  };

  return (
    <div className="space-y-4 p-4">
      <header className="card-glow border-amber-400/30 bg-gradient-to-br from-amber-500/15 to-rose-500/5">
        <div className="font-display font-bold text-amber-100 text-lg">
          🎨 小进基础形象对比页
        </div>
        <div className="text-xs text-amber-200/80 mt-1 leading-relaxed">
          5 种网上流行的熊猫吉祥物风格，并排生成对比。挑一张作为"地基形象"，
          以后所有 wardrobe 衣装变体都从它派生。不消耗装扮卡。
        </div>
      </header>

      <div className="card flex flex-wrap items-center gap-3">
        <span className="text-xs text-slate-400">每风格生成</span>
        <select
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          disabled={running}
          className="field py-1 text-sm w-auto"
        >
          <option value={1}>1 张</option>
          <option value={2}>2 张（推荐）</option>
          <option value={3}>3 张</option>
          <option value={4}>4 张</option>
        </select>
        <span className="text-xs text-slate-500">×</span>
        <span className="text-xs text-slate-400">{MASCOT_STYLE_VARIANTS.length} 种风格</span>
        <span className="text-xs text-slate-500">=</span>
        <span className="text-xs text-slate-300 font-bold">
          {n * MASCOT_STYLE_VARIANTS.length} 张候选
        </span>
        <button
          type="button"
          onClick={generateAll}
          disabled={running}
          className="btn-primary text-sm ml-auto"
        >
          {running ? "生成中…（30-60 秒）" : "✨ 全部生成"}
        </button>
      </div>

      {savedId && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 p-3 text-sm text-emerald-100">
          ✓ 已设为基础形象。回首页 / TutorPanel 等任何地方的小进头像都换成这张了。
        </div>
      )}

      {MASCOT_STYLE_VARIANTS.map((style) => {
        const styleCands = candidates.filter((c) => c.styleId === style.id);
        if (styleCands.length === 0 && !running) return null;
        return (
          <section key={style.id} className="card space-y-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-display font-bold text-slate-100">{style.name}</span>
              <span className="text-[11px] text-slate-400">— {style.tagline}</span>
            </div>
            <div className="text-[10px] text-slate-500">
              灵感：<span className="text-slate-400">{style.inspiration}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              {styleCands.map((c, idx) => {
                const id = `${style.id}_${idx}`;
                const isSaved = savedId === id;
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border-2 overflow-hidden bg-ink-800/40 ${
                      isSaved
                        ? "border-emerald-400 shadow-glow-emerald"
                        : "border-white/10 hover:border-amber-400/60"
                    }`}
                  >
                    <div className="aspect-square relative">
                      {c.status === "pending" && (
                        <div className="w-full h-full flex items-center justify-center bg-ink-800/40">
                          <div className="animate-pulse text-slate-500 text-xs">画中…</div>
                        </div>
                      )}
                      {c.status === "ok" && c.url && (
                        <img src={c.url} alt={`${style.name} ${idx + 1}`} className="w-full h-full object-cover" />
                      )}
                      {c.status === "failed" && (
                        <div className="w-full h-full flex items-center justify-center bg-rose-900/20 text-rose-300 text-[10px] p-2 text-center">
                          ✗ {c.error?.slice(0, 60)}
                        </div>
                      )}
                    </div>
                    {c.status === "ok" && !isSaved && (
                      <button
                        type="button"
                        onClick={() => void saveAsBase(c, style, idx)}
                        className="w-full text-[11px] py-1.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-100 transition-colors"
                      >
                        选为基础形象
                      </button>
                    )}
                    {isSaved && (
                      <div className="w-full text-[11px] py-1.5 bg-emerald-500/30 text-emerald-50 text-center">
                        ✓ 已选
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {!running && candidates.length === 0 && (
        <div className="text-xs text-slate-500 leading-relaxed text-center py-8">
          点 "✨ 全部生成" 开始 — 5 种风格并发出图，30-60 秒拿到全部候选。
        </div>
      )}

      <div className="text-[11px] text-slate-500 leading-relaxed">
        ⚙️ 每张选完会替换 db.trophyImages 里的 mascot 图，并清掉 wardrobe 装备的衣装
        让基础形象立刻显示。后续衣装生成的 prompt 还是用现行 BASE_MASCOT_DESCRIPTOR
        （目前是 plushie 风格）—— 如果你想让 wardrobe 也跟着新风格走，告诉我，
        改 mascotWardrobe.ts 里的描述符就行。
      </div>
    </div>
  );
}
