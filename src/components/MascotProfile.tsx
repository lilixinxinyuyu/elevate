/**
 * 小进姐姐资料卡 — 显示 XP / 等级 / 进度 + 切换音色。
 *
 * 进首页就能看到她长大了多少、还差多少升下一级。
 * 切音色就在这里折叠按钮，点开看哪些已解锁、哪些还在等级门槛后。
 */

import { useEffect, useState } from "react";
import { db } from "../db/dexie";
import { MascotAvatar } from "./MascotAvatar";
import { TutorPanel } from "./tutor/TutorPanel";
import { WardrobePanel } from "./WardrobePanel";
import {
  buildMascotState,
  getMascotState,
  setEquippedVoice,
  getEquippedVoice,
  MASCOT_LEVELS,
  talentDisplayName,
  voiceDescription,
  type MascotState,
} from "../lib/mascotProgress";

interface MascotProfileProps {
  studentId: string;
}

export function MascotProfile({ studentId }: MascotProfileProps) {
  const [state, setState] = useState<MascotState | null>(null);
  const [equippedVoice, setVoiceState] = useState<string>("Tina");
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await getMascotState(studentId);
      setState(s);
      const v = await getEquippedVoice(studentId);
      setVoiceState(v);
    })();
    // 监听 mascotXp 变化（meta 表变了就刷新）
    const onMetaChange = () => {
      void (async () => {
        const s = await getMascotState(studentId);
        setState(s);
      })();
    };
    db.meta.hook("creating", onMetaChange);
    db.meta.hook("updating", onMetaChange);
    return () => {
      db.meta.hook("creating").unsubscribe(onMetaChange);
      db.meta.hook("updating").unsubscribe(onMetaChange);
    };
  }, [studentId]);

  if (!state) return null;
  const allVoices = ["Tina", "Cindy", "Sunny", "Serena", "Mia", "Hana"];

  const handlePickVoice = async (v: string) => {
    if (!state.unlockedVoices.includes(v)) return;
    const ok = await setEquippedVoice(studentId, v);
    if (ok) setVoiceState(v);
    setVoicePickerOpen(false);
  };

  return (
    <section className="card-glow border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-rose-500/5">
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <MascotAvatar size="md" autoEnsure glow />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-display font-bold text-amber-100">小进姐姐</span>
            <span className="chip text-[10px] px-2 py-0.5 bg-amber-500/30 border border-amber-400/40 text-amber-100">
              Lv {state.level.level} · {state.level.title}
            </span>
          </div>
          <div className="text-[11px] text-amber-200/80 mt-0.5">
            {state.xp} XP
            {state.nextLevel && (
              <span className="ml-1.5 text-amber-300/60">
                · 还差 {state.deltaToNext} 升 Lv {state.nextLevel.level}
              </span>
            )}
          </div>
          <div className="h-1 mt-1.5 rounded-full bg-black/25 overflow-hidden ring-1 ring-white/5">
            <div
              className="h-full bg-gradient-to-r from-amber-300 to-rose-300 transition-all duration-500"
              style={{ width: `${Math.round(state.progressInLevel * 100)}%` }}
            />
          </div>
        </div>
        <div className="shrink-0 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="chip text-[11px] px-2.5 py-1 bg-violet-500/30 border border-violet-400/50 text-violet-100 hover:bg-violet-500/50 transition-colors"
            title="找小进语音聊天"
          >
            💬 找小进
          </button>
          <button
            type="button"
            onClick={() => setVoicePickerOpen((v) => !v)}
            className="chip text-[10px] px-2 py-0.5 bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30 transition-colors"
          >
            🎙️ {equippedVoice}
          </button>
        </div>
      </div>

      {voicePickerOpen && (
        <div className="mt-3 border-t border-amber-400/20 pt-3 space-y-1.5 animate-slide-up">
          <div className="text-[11px] text-amber-200/80 mb-1">选个音色（升级解锁更多）：</div>
          {allVoices.map((v) => {
            const unlocked = state.unlockedVoices.includes(v);
            const lockLv = MASCOT_LEVELS.find((lv) => lv.unlocks.voices?.includes(v))?.level;
            return (
              <button
                key={v}
                type="button"
                onClick={() => handlePickVoice(v)}
                disabled={!unlocked}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 ${
                  v === equippedVoice
                    ? "bg-amber-500/30 border border-amber-300/60 text-amber-50"
                    : unlocked
                      ? "bg-white/5 border border-white/10 text-slate-200 hover:bg-amber-500/15 hover:border-amber-400/30"
                      : "bg-slate-800/40 border border-slate-700/40 text-slate-500 cursor-not-allowed"
                }`}
              >
                <span>
                  {v === equippedVoice && "✓ "}
                  <span className="font-display font-semibold">{v}</span>
                  <span className="ml-1.5 text-[10px] opacity-70">{voiceDescription(v)}</span>
                </span>
                {!unlocked && lockLv && (
                  <span className="text-[10px] text-slate-500">🔒 Lv {lockLv}</span>
                )}
              </button>
            );
          })}

          {/* 已解锁的隐藏技能 */}
          {state.unlockedTalents.length > 0 && (
            <div className="mt-3 pt-2 border-t border-amber-400/10">
              <div className="text-[11px] text-amber-200/80 mb-1">已解锁技能（语音聊天时可让她展示）：</div>
              <div className="flex flex-wrap gap-1.5">
                {state.unlockedTalents.map((t) => (
                  <span
                    key={t}
                    className="chip text-[10px] px-2 py-0.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-100"
                  >
                    {talentDisplayName(t)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* v0.31.22：小进衣柜 */}
          <div className="mt-3 pt-3 border-t border-amber-400/10">
            <div className="text-[11px] text-amber-200/80 mb-2">小进衣柜：</div>
            <WardrobePanel studentId={studentId} />
          </div>
        </div>
      )}

      {chatOpen && (
        <TutorPanel
          subjectId="math"
          context="free_chat"
          studentId={studentId}
          onClose={() => setChatOpen(false)}
        />
      )}
    </section>
  );
}
