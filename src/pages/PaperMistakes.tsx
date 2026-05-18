/**
 * v0.35.15 iter 45 P3-1 (爸爸反馈 P2-3.2): Selena 端 paper mistakes 复习页.
 *
 * 显示爸爸在 admin /math/paper-entry 录入的纸面试卷错题:
 *   - 顶部按 paper 分组 (一份卷 N 道错题)
 *   - 每道错题 expand: 题干 → 给 Selena 重新写一次 → 比对正解 → 自评对错 → 持久化
 *   - 待复 / 已复 分类显示, 已复折叠
 *   - 不进 mastery / mistakes / attempts (评审 B 防污染)
 *
 * 数据流: db.paperMistakes 表 (v8 schema) ←
 *   pullPaperMistakes (本页 mount 自动 trigger 1 次)
 *
 * Mascot quick-access 浮动按钮在角.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { pullPaperMistakes, recordPaperReview } from "../lib/paperMistakesSync";
import { MascotQuickAccess } from "../components/MascotQuickAccess";

export default function PaperMistakesPage() {
  const navigate = useNavigate();
  const studentId = useLiveQuery(
    async () => (await db.students.toCollection().first())?.id ?? null,
    [],
  ) ?? null;

  const rows = useLiveQuery(
    async () => {
      if (!studentId) return [];
      return db.paperMistakes.where("studentId").equals(studentId).toArray();
    },
    [studentId],
  ) ?? [];

  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "ok" | "err">("idle");
  const [syncMsg, setSyncMsg] = useState<string>("");

  // mount 自动 sync 1 次
  useEffect(() => {
    if (!studentId) return;
    setSyncStatus("syncing");
    (async () => {
      const r = await pullPaperMistakes(studentId);
      if (r.ok) {
        setSyncStatus("ok");
        setSyncMsg(
          r.pulledPapers && r.pulledPapers > 0
            ? `同步了 ${r.pulledPapers} 份新卷, ${r.upsertedRows} 道题`
            : "已是最新",
        );
      } else {
        setSyncStatus("err");
        setSyncMsg(r.error ?? "同步失败");
      }
    })();
  }, [studentId]);

  // 按 paperId 分组
  const grouped = useMemo(() => {
    const m = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = m.get(r.paperId) ?? [];
      list.push(r);
      m.set(r.paperId, list);
    }
    // 按 pushedAt desc (最新卷在前)
    return Array.from(m.entries())
      .map(([paperId, rs]) => ({
        paperId,
        paperTitle: rs[0]!.paperTitle,
        paperKind: rs[0]!.paperKind,
        rows: rs.sort((a, b) => (a.reviewedAt ? 1 : 0) - (b.reviewedAt ? 1 : 0)),
        latestPushedAt: Math.max(...rs.map((r) => r.pushedAt)),
        unreviewedCount: rs.filter((r) => !r.reviewedAt).length,
      }))
      .sort((a, b) => b.latestPushedAt - a.latestPushedAt);
  }, [rows]);

  const totalUnreviewed = rows.filter((r) => !r.reviewedAt).length;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-cyan-100">📄 试卷错题</h1>
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          返回
        </button>
      </div>

      <div className="text-xs text-slate-400">
        爸爸帮我把考过的纸面错题录入进来 · 这边再写一次自己评对错 · 不计 XP / 不进掌握度
      </div>

      {/* sync 状态 chip */}
      <div className="text-xs flex items-center gap-2">
        {syncStatus === "syncing" && (
          <span className="text-cyan-200">⏳ 拉取中…</span>
        )}
        {syncStatus === "ok" && (
          <span className="text-emerald-200">✓ {syncMsg}</span>
        )}
        {syncStatus === "err" && (
          <span className="text-rose-300">⚠️ {syncMsg}</span>
        )}
        <button
          onClick={() => {
            if (!studentId) return;
            setSyncStatus("syncing");
            void (async () => {
              const r = await pullPaperMistakes(studentId);
              setSyncStatus(r.ok ? "ok" : "err");
              setSyncMsg(
                r.ok
                  ? r.pulledPapers && r.pulledPapers > 0
                    ? `同步 ${r.pulledPapers} 份, ${r.upsertedRows} 题`
                    : "已是最新"
                  : r.error ?? "失败",
              );
            })();
          }}
          className="ml-auto text-xs text-cyan-300 hover:text-cyan-100 underline"
        >
          刷新
        </button>
      </div>

      {totalUnreviewed > 0 && (
        <div className="rounded-lg bg-amber-500/15 border border-amber-400/40 p-3 text-sm text-amber-100">
          🔥 还有 <b>{totalUnreviewed}</b> 道纸面错题没复习
        </div>
      )}

      {grouped.length === 0 && syncStatus !== "syncing" && (
        <div className="rounded-lg bg-slate-900/40 border border-slate-500/30 p-6 text-center text-slate-400 text-sm">
          还没有纸面错题. 爸爸录入后这边会自动同步.
        </div>
      )}

      <div className="space-y-3">
        {grouped.map((g) => (
          <PaperGroup key={g.paperId} group={g} />
        ))}
      </div>

      <MascotQuickAccess context="find_mistakes" />
    </div>
  );
}

const KIND_META: Record<string, { label: string; color: string }> = {
  midterm: { label: "期中", color: "bg-cyan-500/20 border-cyan-400/40 text-cyan-100" },
  final: { label: "期末", color: "bg-rose-500/20 border-rose-400/40 text-rose-100" },
  homework: { label: "作业", color: "bg-emerald-500/20 border-emerald-400/40 text-emerald-100" },
  quiz: { label: "小测", color: "bg-amber-500/20 border-amber-400/40 text-amber-100" },
  other: { label: "其它", color: "bg-slate-500/20 border-slate-400/40 text-slate-100" },
};

function PaperGroup({
  group,
}: {
  group: {
    paperId: string;
    paperTitle: string;
    paperKind: string;
    rows: { id: string; reviewedAt?: number }[];
    latestPushedAt: number;
    unreviewedCount: number;
  };
}) {
  const [expanded, setExpanded] = useState(group.unreviewedCount > 0);
  const meta = KIND_META[group.paperKind] ?? KIND_META.other!;
  const date = new Date(group.latestPushedAt);
  const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

  return (
    <section className="rounded-xl bg-slate-900/50 border border-cyan-400/30 overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 p-3 hover:bg-slate-800/40 transition-colors text-left"
      >
        <span className={`chip text-[10px] px-2 py-0.5 border ${meta.color}`}>
          {meta.label}
        </span>
        <span className="text-sm font-semibold text-cyan-100 flex-1 truncate">
          {group.paperTitle}
        </span>
        <span className="text-xs text-slate-400">{dateStr}</span>
        <span
          className={`chip text-[10px] px-2 py-0.5 ${
            group.unreviewedCount > 0
              ? "bg-amber-500/30 text-amber-100 border border-amber-400/40"
              : "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30"
          }`}
        >
          {group.unreviewedCount > 0 ? `${group.unreviewedCount} 未复` : "✓ 已全复"}
        </span>
        <span className="text-slate-400 text-sm">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className="border-t border-cyan-400/20 divide-y divide-cyan-400/10">
          {group.rows.map((r) => (
            <PaperMistakeRowItem key={r.id} rowId={r.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function PaperMistakeRowItem({ rowId }: { rowId: string }) {
  const row = useLiveQuery(async () => db.paperMistakes.get(rowId), [rowId]);
  const [myAnswer, setMyAnswer] = useState("");
  const [reveal, setReveal] = useState(false);
  const [selfMark, setSelfMark] = useState<"correct" | "wrong" | null>(null);

  if (!row) return null;
  const lastReview = row.reviewLog?.[row.reviewLog.length - 1];

  function submit() {
    if (!myAnswer.trim()) return;
    setReveal(true);
  }

  async function markAndSave(correct: boolean) {
    setSelfMark(correct ? "correct" : "wrong");
    await recordPaperReview(rowId, myAnswer, correct);
  }

  function tryAgain() {
    setMyAnswer("");
    setReveal(false);
    setSelfMark(null);
  }

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-xs text-slate-400 mt-0.5">题:</span>
        <div className="text-sm text-slate-100 flex-1 whitespace-pre-wrap">{row.stem}</div>
      </div>

      {row.errorTag && (
        <div className="text-[10px] text-rose-300/80">
          ⚠️ 当时错因: {row.errorTag}
        </div>
      )}

      <div className="flex items-start gap-2">
        <span className="text-xs text-rose-300 mt-0.5">当时:</span>
        <div className="text-sm text-rose-200/80 flex-1 line-through">{row.studentAnswer}</div>
      </div>

      {!reveal && (
        <div className="space-y-1">
          <div className="text-xs text-cyan-200">再写一次:</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={myAnswer}
              onChange={(e) => setMyAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="算一下, 这次正解"
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-100 border border-cyan-400/30 focus:outline-none focus:border-cyan-300 text-sm"
            />
            <button
              onClick={submit}
              disabled={!myAnswer.trim()}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-sm font-semibold hover:bg-cyan-400 disabled:opacity-30"
            >
              对答案
            </button>
          </div>
        </div>
      )}

      {reveal && selfMark === null && (
        <div className="space-y-2">
          <div className="rounded-lg bg-emerald-500/15 border border-emerald-400/30 px-3 py-2">
            <div className="text-xs text-emerald-200/80">正解:</div>
            <div className="text-base text-emerald-100 font-semibold mt-0.5">
              {row.correctAnswer}
            </div>
          </div>
          <div className="rounded-lg bg-slate-800/60 border border-slate-500/30 px-3 py-2">
            <div className="text-xs text-slate-300">你刚写:</div>
            <div className="text-base text-slate-100 mt-0.5">{myAnswer}</div>
          </div>
          <div className="text-xs text-slate-400">这次对了吗? (自己判)</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void markAndSave(true)}
              className="px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 text-sm font-semibold hover:bg-emerald-500/30"
            >
              ✓ 对了
            </button>
            <button
              onClick={() => void markAndSave(false)}
              className="px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-200 text-sm font-semibold hover:bg-rose-500/25"
            >
              ✗ 还错
            </button>
          </div>
        </div>
      )}

      {selfMark !== null && (
        <div className="space-y-1.5">
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              selfMark === "correct"
                ? "bg-emerald-500/15 border border-emerald-400/40 text-emerald-100"
                : "bg-rose-500/15 border border-rose-400/40 text-rose-100"
            }`}
          >
            {selfMark === "correct"
              ? "🎉 这次对了, 已记录"
              : "💪 还差点, 已记录 · 错了不丢人, 再来"}
          </div>
          <button
            onClick={tryAgain}
            className="text-xs text-cyan-300 hover:text-cyan-100 underline"
          >
            再写一次
          </button>
        </div>
      )}

      {lastReview && selfMark === null && !reveal && (
        <div className="text-[10px] text-slate-500">
          上次复习: {new Date(lastReview.ts).toLocaleDateString()} ·{" "}
          {lastReview.correct ? "✓ 写对" : "✗ 没对"}
        </div>
      )}
    </div>
  );
}
