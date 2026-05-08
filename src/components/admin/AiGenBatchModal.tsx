/**
 * v0.31.52: AI 出题批量工作台 modal
 *
 * 流程：
 *   config → running (sequential per-skill loop with abort) → review → saving → done
 *
 * Review 阶段每道题都跑了 questionAuditLite，按严重度上色：
 *   - critical / likely-broken：默认拒绝（可强制接受）
 *   - minor：默认接受（可拒绝或重生成）
 *   - pass：默认接受
 *
 * 接受 → 写入 db.questions + 加 ai_generated tag + status: "approved"。
 * 写入后由 cloudSync 全量上传到 D1（v0.31.52 起 PUSH_TABLES 含 questions）。
 *
 * 默认配置：每个 skill 5 道；批量上限提示 token 限制。
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { db } from "../../db/dexie";
import { generateAiQuestions } from "../../lib/tutor";
import { auditQuestion, type AuditResult } from "../../lib/questionAuditLite";
import { validateQuestion } from "../../core/validateQuestion";
import { pushToCloud } from "../../db/cloudSync";
import type { SkillRow } from "../../lib/skillDiagnostic";
import type { Question } from "../../core/types";

interface QResult {
  question: Question;
  audit: AuditResult;
  validatorOk: boolean;
  validatorIssues: string[];
  decision: "accept" | "reject";
}

interface SkillBatchResult {
  skillId: string;
  skillName: string;
  term: string;
  questions: QResult[];
  error: string | null;
}

type ModalState =
  | { phase: "config" }
  | {
      phase: "running";
      progress: { skillId: string; done: number; total: number }[];
      currentSkillIdx: number;
      partial: SkillBatchResult[];
    }
  | { phase: "review"; results: SkillBatchResult[] }
  | { phase: "saving" }
  | { phase: "done"; saved: number; rejected: number; pushedToD1: boolean };

interface Config {
  perSkillCount: number;
  difficulty: string;
}

const DEFAULTS: Config = {
  perSkillCount: 5,
  difficulty: "2-4",
};

const SOFT_LIMIT_TOTAL = 50;

export function AiGenBatchModal({
  selectedSkills,
  onClose,
  onAfterSave,
}: {
  selectedSkills: SkillRow[];
  onClose: () => void;
  onAfterSave: () => void;
}) {
  const [state, setState] = useState<ModalState>({ phase: "config" });
  const [cfg, setCfg] = useState<Config>(DEFAULTS);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  const totalRequested = cfg.perSkillCount * selectedSkills.length;
  const exceedsSoftLimit = totalRequested > SOFT_LIMIT_TOTAL;

  const onStart = useCallback(async () => {
    abortRef.current = { aborted: false };
    const progress = selectedSkills.map((s) => ({
      skillId: s.skillId,
      done: 0,
      total: cfg.perSkillCount,
    }));
    setState({ phase: "running", progress, currentSkillIdx: 0, partial: [] });

    const partial: SkillBatchResult[] = [];

    for (let i = 0; i < selectedSkills.length; i++) {
      if (abortRef.current.aborted) break;
      const sk = selectedSkills[i]!;
      // 不并发：sequential 防 token-plan rate limit
      try {
        const existingStems = (await db.questions
          .where({ skill_id: sk.skillId })
          .toArray())
          .map((q) => q.stem)
          .slice(0, 30);

        const r = await generateAiQuestions({
          subjectId: "math",
          unitId: sk.unitId,
          unitName: sk.unitName,
          skillId: sk.skillId,
          skillName: sk.skillName,
          count: cfg.perSkillCount,
          difficulty: cfg.difficulty,
          // Term 限于上/下册（综合复习 = mixed pool，不传 term 让 AI 自由出题）
          term: sk.term === "综合复习" ? undefined : sk.term,
          existingStems,
        });

        const qResults: QResult[] = r.questions.map((q) => {
          const v = validateQuestion(q);
          const a = auditQuestion(q);
          // 默认决策：validator pass + audit 不致命 → accept；否则 reject
          const defaultAccept =
            v.ok && a.worstSeverity !== "critical" && a.worstSeverity !== "likely-broken";
          return {
            question: q,
            audit: a,
            validatorOk: v.ok,
            validatorIssues: v.issues.map((iss) => `${iss.severity}: ${iss.path} ${iss.message}`),
            decision: defaultAccept ? "accept" : "reject",
          };
        });

        partial.push({
          skillId: sk.skillId,
          skillName: sk.skillName,
          term: sk.term,
          questions: qResults,
          error: null,
        });
      } catch (e) {
        partial.push({
          skillId: sk.skillId,
          skillName: sk.skillName,
          term: sk.term,
          questions: [],
          error: e instanceof Error ? e.message : String(e),
        });
      }

      // 更新 progress
      progress[i] = { ...progress[i]!, done: progress[i]!.total };
      setState({
        phase: "running",
        progress: [...progress],
        currentSkillIdx: i + 1,
        partial: [...partial],
      });
    }

    setState({ phase: "review", results: partial });
  }, [cfg, selectedSkills]);

  const onAbort = useCallback(() => {
    abortRef.current.aborted = true;
  }, []);

  const onRegenerate = useCallback(
    async (skillIdx: number, qIdx: number) => {
      if (state.phase !== "review") return;
      const skillResult = state.results[skillIdx]!;
      const oldQ = skillResult.questions[qIdx]!;
      const sk = selectedSkills.find((s) => s.skillId === skillResult.skillId);
      if (!sk) return;
      try {
        const existingStems = (await db.questions
          .where({ skill_id: skillResult.skillId })
          .toArray())
          .map((q) => q.stem)
          .slice(0, 30);
        // 加上当前批次的 stem 防止再生成同一道
        const batchStems = skillResult.questions
          .filter((_, i) => i !== qIdx)
          .map((qr) => qr.question.stem);
        const r = await generateAiQuestions({
          subjectId: "math",
          unitId: sk.unitId,
          unitName: sk.unitName,
          skillId: sk.skillId,
          skillName: sk.skillName,
          count: 1,
          difficulty: cfg.difficulty,
          term: sk.term === "综合复习" ? undefined : sk.term,
          existingStems: [...existingStems, ...batchStems],
        });
        const newQ = r.questions[0];
        if (!newQ) return;
        const v = validateQuestion(newQ);
        const a = auditQuestion(newQ);
        const defaultAccept =
          v.ok && a.worstSeverity !== "critical" && a.worstSeverity !== "likely-broken";
        const updated: QResult = {
          question: newQ,
          audit: a,
          validatorOk: v.ok,
          validatorIssues: v.issues.map((iss) => `${iss.severity}: ${iss.path} ${iss.message}`),
          decision: defaultAccept ? "accept" : "reject",
        };
        const newResults = [...state.results];
        newResults[skillIdx] = {
          ...skillResult,
          questions: skillResult.questions.map((q, i) => (i === qIdx ? updated : q)),
        };
        setState({ phase: "review", results: newResults });
      } catch (e) {
        // 重生成失败：保留旧题，标记决策为 reject
        const newResults = [...state.results];
        const oldOne: QResult = { ...oldQ, decision: "reject" };
        newResults[skillIdx] = {
          ...skillResult,
          questions: skillResult.questions.map((q, i) => (i === qIdx ? oldOne : q)),
          error: `重生成失败：${e instanceof Error ? e.message : String(e)}`,
        };
        setState({ phase: "review", results: newResults });
      }
    },
    [state, cfg.difficulty, selectedSkills],
  );

  const toggleDecision = useCallback(
    (skillIdx: number, qIdx: number) => {
      if (state.phase !== "review") return;
      const newResults: SkillBatchResult[] = state.results.map((s, si) =>
        si !== skillIdx
          ? s
          : {
              ...s,
              questions: s.questions.map((q, qi): QResult =>
                qi !== qIdx
                  ? q
                  : { ...q, decision: q.decision === "accept" ? "reject" : "accept" },
              ),
            },
      );
      setState({ phase: "review", results: newResults });
    },
    [state],
  );

  const onSave = useCallback(async () => {
    if (state.phase !== "review") return;
    setState({ phase: "saving" });
    let saved = 0;
    let rejected = 0;
    const toSave: Question[] = [];
    for (const sr of state.results) {
      for (const qr of sr.questions) {
        if (qr.decision === "accept") {
          const stamped: Question = {
            ...qr.question,
            subjectId: "math",
            status: "approved",
            tags: Array.from(new Set([...(qr.question.tags ?? []), "ai_generated"])),
          };
          toSave.push(stamped);
          saved++;
        } else {
          rejected++;
        }
      }
    }
    if (toSave.length > 0) {
      await db.questions.bulkPut(toSave as never);
    }
    // 推送 D1 (v0.31.52 cloudSync 已含 questions)
    let pushedToD1 = false;
    try {
      const r = await pushToCloud();
      pushedToD1 = !!r?.ok;
    } catch (e) {
      console.warn("[AiGenBatch] pushToCloud failed:", e);
    }
    setState({ phase: "done", saved, rejected, pushedToD1 });
    onAfterSave();
  }, [state, onAfterSave]);

  // ===== UI =====

  if (state.phase === "config") {
    return (
      <Backdrop onClose={onClose}>
        <div className="text-base font-display font-bold mb-3">🤖 AI 批量出题</div>
        <div className="text-xs text-slate-400 mb-4">
          为选中的 <b className="text-violet-300">{selectedSkills.length}</b> 个知识点批量生成题目，
          生成后自动跑客户端审计，你逐题确认是否入库。
        </div>

        <div className="text-xs text-slate-300 mb-2">选中的 skill：</div>
        <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-ink-900/40 p-2 mb-4 space-y-1 text-xs">
          {selectedSkills.map((s) => (
            <div key={s.skillId} className="flex items-center gap-2">
              <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-700/50 text-[10px]">
                {s.term === "上册" ? "📕 上" : "📚 下"}
              </span>
              <span className="flex-1 truncate text-slate-200">{s.skillName}</span>
              <span className="shrink-0 text-slate-400">题量 {s.totalCount}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="text-xs text-slate-400">每个 skill 出题数</span>
            <input
              type="number"
              min={1}
              max={20}
              value={cfg.perSkillCount}
              onChange={(e) => setCfg((c) => ({ ...c, perSkillCount: Math.max(1, Math.min(20, Number(e.target.value) || 1)) }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">难度（2-4 / 3-5 等）</span>
            <input
              type="text"
              value={cfg.difficulty}
              onChange={(e) => setCfg((c) => ({ ...c, difficulty: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-sm text-slate-100"
            />
          </label>
        </div>

        <div className={`text-xs mb-4 p-2 rounded-lg ${exceedsSoftLimit ? "bg-amber-500/15 text-amber-200 border border-amber-400/30" : "bg-slate-700/30 text-slate-300"}`}>
          预计共生成 <b className="font-mono">{totalRequested}</b> 道题
          {exceedsSoftLimit && (
            <>
              {" — "}超过推荐上限 {SOFT_LIMIT_TOTAL} 道，可能触发 token-plan rate limit / 报告太长。
              建议拆成多批。
            </>
          )}
          。生成期间可中止，已生成的部分保留。
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            取消
          </button>
          <button
            type="button"
            onClick={() => void onStart()}
            disabled={selectedSkills.length === 0}
            className="btn-primary text-sm"
          >
            开始生成 {totalRequested} 道
          </button>
        </div>
      </Backdrop>
    );
  }

  if (state.phase === "running") {
    const totalDone = state.progress.reduce((sum, p) => sum + p.done, 0);
    const totalTarget = state.progress.reduce((sum, p) => sum + p.total, 0);
    return (
      <Backdrop>
        <div className="text-base font-display font-bold mb-2">🤖 生成中…</div>
        <div className="text-xs text-slate-400 mb-3">
          顺序为每个 skill 调用 AI（避免并发 rate limit）。中途可中止。
        </div>
        <div className="h-2 rounded-full bg-black/30 overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-violet-400 via-pink-300 to-amber-300 transition-all"
            style={{ width: `${Math.round((totalDone / Math.max(1, totalTarget)) * 100)}%` }}
          />
        </div>
        <div className="text-xs text-slate-300 mb-3">
          {state.currentSkillIdx} / {selectedSkills.length} skill 完成
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
          {state.progress.map((p, i) => {
            const sk = selectedSkills.find((s) => s.skillId === p.skillId);
            const inProgress = i === state.currentSkillIdx;
            const done = p.done >= p.total;
            return (
              <div
                key={p.skillId}
                className={`flex items-center gap-2 p-1.5 rounded ${
                  inProgress ? "bg-violet-500/15" : done ? "text-slate-500" : "text-slate-300"
                }`}
              >
                <span>{done ? "✅" : inProgress ? "⏳" : "⚪"}</span>
                <span className="flex-1 truncate">{sk?.skillName ?? p.skillId}</span>
                <span className="text-slate-400">
                  {p.done}/{p.total}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end mt-4">
          <button type="button" onClick={onAbort} className="btn-ghost text-sm border border-amber-400/40 text-amber-200">
            🛑 中止（保留已生成）
          </button>
        </div>
      </Backdrop>
    );
  }

  if (state.phase === "review") {
    const allQuestions = state.results.flatMap((s) => s.questions);
    const acceptedCount = allQuestions.filter((q) => q.decision === "accept").length;
    const rejectedCount = allQuestions.length - acceptedCount;
    const totalErrors = state.results.filter((s) => s.error).length;

    return (
      <Backdrop wide>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-base font-display font-bold">📋 审核与入库</div>
            <div className="text-xs text-slate-400">
              共生成 {allQuestions.length} 道 ·
              <span className="text-emerald-300"> 接受 {acceptedCount}</span> ·
              <span className="text-rose-300"> 拒绝 {rejectedCount}</span>
              {totalErrors > 0 && <span className="text-amber-300"> · {totalErrors} 个 skill 出错</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost text-sm">
              全部丢弃
            </button>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={acceptedCount === 0}
              className="btn-primary text-sm"
            >
              ✅ 入库 {acceptedCount} 道 · 推 D1
            </button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
          {state.results.map((sr, si) => (
            <div key={sr.skillId} className="rounded-lg border border-white/10 bg-ink-900/40 p-3">
              <div className="flex items-center gap-2 mb-2 text-sm">
                <span className="px-1.5 py-0.5 rounded bg-slate-700/50 text-[10px]">
                  {sr.term === "上册" ? "📕 上" : "📚 下"}
                </span>
                <span className="font-display font-bold text-violet-200">{sr.skillName}</span>
                <span className="text-xs text-slate-400">
                  · {sr.questions.length} 道
                </span>
                {sr.error && (
                  <span className="text-xs text-rose-300 truncate" title={sr.error}>
                    · ❌ {sr.error.slice(0, 40)}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {sr.questions.map((qr, qi) => (
                  <QuestionReviewRow
                    key={qr.question.question_id}
                    qr={qr}
                    onToggle={() => toggleDecision(si, qi)}
                    onRegenerate={() => void onRegenerate(si, qi)}
                  />
                ))}
                {sr.questions.length === 0 && (
                  <div className="text-xs text-slate-500 italic">没生成出题（见上方错误）</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Backdrop>
    );
  }

  if (state.phase === "saving") {
    return (
      <Backdrop>
        <div className="text-base font-display font-bold mb-2">⏳ 入库 + 推 D1…</div>
        <div className="text-xs text-slate-400">写入 db.questions，然后推送到 cloud。</div>
      </Backdrop>
    );
  }

  // done
  return (
    <Backdrop>
      <div className="text-base font-display font-bold mb-2">🎉 完成</div>
      <div className="text-sm text-slate-300 space-y-1">
        <div>✅ 入库 <b className="text-emerald-300">{state.saved}</b> 道</div>
        <div>🚫 拒绝 {state.rejected} 道</div>
        <div>
          {state.pushedToD1 ? (
            <span className="text-emerald-300">☁️ 已推送 D1 cloud</span>
          ) : (
            <span className="text-amber-300">⚠️ D1 推送未成功（可在上方手动 push 同步）</span>
          )}
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <button type="button" onClick={onClose} className="btn-primary text-sm">
          关闭
        </button>
      </div>
    </Backdrop>
  );
}

function Backdrop({
  children,
  wide,
  onClose,
}: {
  children: React.ReactNode;
  wide?: boolean;
  onClose?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-ink-800 border border-white/10 rounded-2xl p-5 ${wide ? "max-w-3xl w-full" : "max-w-md w-full"} shadow-2xl`}
      >
        {children}
      </div>
    </div>
  );
}

function QuestionReviewRow({
  qr,
  onToggle,
  onRegenerate,
}: {
  qr: QResult;
  onToggle: () => void;
  onRegenerate: () => void;
}) {
  const sev = qr.audit.worstSeverity;
  const tone =
    sev === "critical" || !qr.validatorOk
      ? "border-rose-400/50 bg-rose-500/5"
      : sev === "likely-broken"
        ? "border-amber-400/50 bg-amber-500/5"
        : sev === "minor"
          ? "border-yellow-400/30 bg-yellow-500/5"
          : "border-emerald-400/40 bg-emerald-500/5";
  const sevChip =
    sev === "critical" || !qr.validatorOk
      ? { label: "🔴 critical", tone: "bg-rose-500/30 text-rose-200" }
      : sev === "likely-broken"
        ? { label: "🟠 likely-broken", tone: "bg-amber-500/30 text-amber-200" }
        : sev === "minor"
          ? { label: "🟡 minor", tone: "bg-yellow-500/20 text-yellow-200" }
          : { label: "🟢 pass", tone: "bg-emerald-500/20 text-emerald-200" };

  return (
    <div className={`rounded border ${tone} p-2 text-xs`}>
      <div className="flex items-start gap-2 mb-1.5">
        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] ${sevChip.tone}`}>
          {sevChip.label}
        </span>
        <span className="text-slate-400 shrink-0">D{qr.question.difficulty}</span>
        <span className="text-slate-300 flex-1 leading-snug">{qr.question.stem}</span>
      </div>
      {Array.isArray((qr.question as { options?: { text?: string }[] }).options) && (
        <div className="ml-12 space-y-0.5 text-slate-400 text-[11px]">
          {((qr.question as { options?: { id?: string; text?: string }[] }).options ?? []).map((o, i) => (
            <div key={i}>
              {o.id}. {o.text}
            </div>
          ))}
        </div>
      )}
      {(qr.audit.issues.length > 0 || !qr.validatorOk) && (
        <div className="mt-2 ml-12 space-y-0.5 text-[10px]">
          {!qr.validatorOk &&
            qr.validatorIssues.slice(0, 3).map((iss, i) => (
              <div key={`v${i}`} className="text-rose-300">
                ❗ {iss}
              </div>
            ))}
          {qr.audit.issues.slice(0, 5).map((iss, i) => (
            <div
              key={`a${i}`}
              className={
                iss.severity === "critical"
                  ? "text-rose-300"
                  : iss.severity === "likely-broken"
                    ? "text-amber-300"
                    : "text-yellow-300/80"
              }
            >
              {iss.code}: {iss.message}
              {iss.fix && <span className="opacity-70"> · {iss.fix}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-end gap-2">
        <button type="button" onClick={onRegenerate} className="text-[11px] px-2 py-0.5 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 border border-violet-400/30">
          🔄 重生成
        </button>
        <button
          type="button"
          onClick={onToggle}
          className={`text-[11px] px-2 py-0.5 rounded border ${
            qr.decision === "accept"
              ? "bg-emerald-500/25 text-emerald-200 border-emerald-400/40"
              : "bg-slate-700/50 text-slate-300 border-slate-500/30"
          }`}
        >
          {qr.decision === "accept" ? "✅ 已选入库" : "⚪ 不要"}
        </button>
      </div>
    </div>
  );
}
