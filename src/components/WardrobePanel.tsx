/**
 * 小进衣柜面板 — 显示已生成的造型 grid + 装扮卡余额 + 生成新造型对话框。
 *
 * 嵌在 MascotProfile 里折叠展开。Selena 用装扮卡换 AI 生成的新造型，
 * 像养宠物一样不断丰富衣橱，最终积累出一个独特的小进。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../db/dexie";
import {
  type GenerateCandidate,
  deleteWardrobeItem,
  generateCandidates,
  getWardrobeCards,
  listWardrobe,
  saveWardrobeOutfit,
  setEquippedWardrobe,
  spendWardrobeCard,
} from "../lib/mascotWardrobe";
import type { MascotWardrobeRow } from "../db/dexie";

const PRESET_PROMPTS = [
  "戴一顶红色贝雷帽",
  "粉色蝴蝶结 + 长裙",
  "戴金色眼镜 + 围巾",
  "穿着宇航员服装",
  "戴一朵樱花在耳朵上",
  "穿厨师服 + 厨师帽",
  "戴音乐家头戴式耳机",
  "穿汉服 + 头饰",
];

export function WardrobePanel({ studentId }: { studentId: string }) {
  const [items, setItems] = useState<MascotWardrobeRow[]>([]);
  const [cards, setCards] = useState(0);
  const [genOpen, setGenOpen] = useState(false);

  const refresh = async () => {
    const [is, c] = await Promise.all([listWardrobe(studentId), getWardrobeCards(studentId)]);
    setItems(is);
    setCards(c);
  };

  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    db.mascotWardrobe.hook("creating", handler);
    db.mascotWardrobe.hook("updating", handler);
    db.mascotWardrobe.hook("deleting", handler);
    db.meta.hook("creating", handler);
    db.meta.hook("updating", handler);
    return () => {
      db.mascotWardrobe.hook("creating").unsubscribe(handler);
      db.mascotWardrobe.hook("updating").unsubscribe(handler);
      db.mascotWardrobe.hook("deleting").unsubscribe(handler);
      db.meta.hook("creating").unsubscribe(handler);
      db.meta.hook("updating").unsubscribe(handler);
    };
  }, [studentId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-amber-200/80">
          🎁 装扮卡：<span className="font-display font-bold text-amber-100 text-base ml-1">{cards}</span>
          <span className="ml-1.5 text-amber-300/60">张</span>
        </div>
        <button
          type="button"
          disabled={cards < 1}
          onClick={() => setGenOpen(true)}
          className={`chip text-xs px-3 py-1.5 ${
            cards >= 1
              ? "bg-violet-500/30 border border-violet-400/50 text-violet-100 hover:bg-violet-500/50"
              : "bg-slate-800/40 border border-slate-700/40 text-slate-500 cursor-not-allowed"
          }`}
        >
          ✨ 用 1 张换新造型
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-xs text-slate-400 leading-relaxed">
          还没有自定义造型。完整做完一组练习就拿一张装扮卡，攒卡换 AI 生成的新造型 ✨
          {cards > 0 && <span className="text-amber-300"> · 你已经有 {cards} 张可用！</span>}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((it) => (
            <WardrobeCard key={it.id} item={it} onChanged={refresh} />
          ))}
        </div>
      )}

      {genOpen && (
        <GenerateDialog
          studentId={studentId}
          onClose={() => setGenOpen(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function WardrobeCard({
  item,
  onChanged,
}: {
  item: MascotWardrobeRow;
  onChanged: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(item.blob), [item.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const handleEquip = async () => {
    await setEquippedWardrobe(item.studentId, item.equipped === 1 ? null : item.id);
    onChanged();
  };
  const handleDelete = async () => {
    if (!confirm("删除这件造型？")) return;
    await deleteWardrobeItem(item.id);
    onChanged();
  };

  return (
    <div
      className={`rounded-xl border-2 overflow-hidden bg-ink-800/60 cursor-pointer transition-all ${
        item.equipped === 1
          ? "border-amber-400 shadow-glow-amber"
          : "border-white/10 hover:border-violet-400/60"
      }`}
      onClick={handleEquip}
      title={item.prompt}
    >
      <div className="aspect-square relative">
        <img
          src={url}
          alt={item.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {item.equipped === 1 && (
          <div className="absolute top-1 left-1 chip text-[9px] px-1.5 py-0.5 bg-amber-500/90 text-amber-50 border border-amber-300">
            ✓ 佩戴中
          </div>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void handleDelete();
          }}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-900/80 hover:bg-rose-700 text-rose-200 text-xs flex items-center justify-center"
          title="删除"
        >
          ×
        </button>
      </div>
      <div className="text-[10px] text-slate-400 px-1.5 py-1 truncate">{item.name}</div>
    </div>
  );
}

function GenerateDialog({
  studentId,
  onClose,
  onSaved,
}: {
  studentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<"input" | "generating" | "picking" | "saving" | "error">("input");
  const [candidates, setCandidates] = useState<GenerateCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  // candidate URLs cleanup
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setError(null);
    // 先扣卡（防止生成途中关掉就刷出免费的）
    const after = await spendWardrobeCard(studentId, 1);
    if (after === null) {
      setError("装扮卡不够了，先做几道题攒卡。");
      setPhase("error");
      return;
    }
    setPhase("generating");
    const r = await generateCandidates({ prompt, n: 2 });
    if (!r.ok) {
      setError(`生成失败：${r.error}`);
      setPhase("error");
      // 退还卡
      const { awardWardrobeCard } = await import("../lib/mascotWardrobe");
      await awardWardrobeCard(studentId, 1);
      return;
    }
    setCandidates(r.candidates);
    urlsRef.current = r.candidates.map((c) => URL.createObjectURL(c.blob));
    setPhase("picking");
  };

  const handlePick = async (idx: number) => {
    setPhase("saving");
    try {
      await saveWardrobeOutfit({
        studentId,
        name: prompt.trim().slice(0, 24) || `造型 ${new Date().toLocaleDateString("zh-CN")}`,
        prompt,
        candidate: candidates[idx]!,
        equipImmediately: true,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError("保存失败：" + (e as Error).message);
      setPhase("error");
    }
  };

  const handleRejectAll = () => {
    if (!confirm("全部不要？这次的卡片就花掉了。")) return;
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card-glow w-full sm:max-w-md bg-ink-900/95 border border-violet-400/40 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between p-3 border-b border-ink-700/60">
          <div className="font-display font-bold text-violet-100">✨ 给小进做新造型</div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-2xl leading-none px-2"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-3">
          {phase === "input" && (
            <>
              <div className="text-xs text-slate-300 leading-relaxed">
                想让小进打扮成什么样子？写一句描述，AI 会画 2 张候选给你挑。
                <br />
                <span className="text-slate-500">（消耗 1 张装扮卡）</span>
              </div>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="戴一顶红色贝雷帽 / 穿宇航员服装 / 樱花头饰 …"
                className="field text-sm w-full"
              />
              <div className="flex flex-wrap gap-1.5">
                {PRESET_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrompt(p)}
                    className="chip text-[11px] px-2 py-1 bg-white/5 text-slate-300 border border-white/10 hover:bg-violet-500/20 hover:border-violet-400/40"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="btn-ghost text-sm">
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!prompt.trim()}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  ✨ 用 1 张卡生成
                </button>
              </div>
            </>
          )}

          {phase === "generating" && (
            <div className="text-center py-8 space-y-3">
              <div className="text-3xl animate-bounce">🎨</div>
              <div className="text-sm text-violet-200">小进的画师正在画…（10-30 秒）</div>
              <div className="text-xs text-slate-500">"{prompt}"</div>
            </div>
          )}

          {phase === "picking" && (
            <>
              <div className="text-sm text-violet-200">两张候选，挑一张存进衣柜：</div>
              <div className="grid grid-cols-2 gap-2">
                {candidates.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handlePick(i)}
                    className="rounded-xl border-2 border-white/10 hover:border-amber-400/80 transition-all overflow-hidden bg-ink-800/40"
                  >
                    <div className="aspect-square">
                      <img src={urlsRef.current[i]} alt={`候选 ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-[10px] text-slate-400 py-1">挑这张</div>
                  </button>
                ))}
              </div>
              <button type="button" onClick={handleRejectAll} className="btn-ghost text-xs w-full">
                两张都不要 ×（卡片已花掉）
              </button>
            </>
          )}

          {phase === "saving" && (
            <div className="text-center py-6 text-sm text-violet-200 animate-pulse">保存中…</div>
          )}

          {phase === "error" && (
            <div className="space-y-3">
              <div className="text-sm text-rose-200">⚠ {error}</div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="btn-secondary text-sm">
                  关闭
                </button>
                <button type="button" onClick={() => setPhase("input")} className="btn-primary text-sm">
                  再试一次
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
