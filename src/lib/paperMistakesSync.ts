/**
 * v0.35.15 iter 45 P3-1 (爸爸反馈 retrospective P2-3.2):
 * Selena 端拉取爸爸在 admin 录入的纸面试卷错题.
 *
 * Backend: GET /api/paper-mistakes (list) + GET /api/paper-mistakes/:paperId (single)
 * 见 aliyun-deploy/src/routes/paper-mistakes.ts.
 *
 * 流程:
 *   1. list 拉所有 papers 的 paperId + lastModifiedMs
 *   2. 对比 Dexie 中已存的 (按 paperId + pushedAt) 找差异
 *   3. 对差异的每个 paper fetch 全文
 *   4. 把 PaperRecord 打平成 PaperMistakeRow 列表 upsert 到 db.paperMistakes
 *
 * Idempotent: paperMistakeId 是 stable primary key (`${studentId}::${paperId}::${paperQuestionId}`),
 * 重 sync 不会重复.
 *
 * 0 费用 — 只读 OSS list + get, 不调任何 LLM / image gen.
 */
import { db } from "../db/dexie";
import type { PaperMistakeRow } from "../db/dexie";
import { getStoredPassword } from "../db/cloudSync";

interface ListItem {
  paperId: string;
  lastModifiedMs: number;
  bytes: number;
}

interface PaperRecord {
  paperId: string;
  cadetUid: string;
  kind: "midterm" | "final" | "homework" | "quiz" | "other";
  title: string;
  createdAt: number;
  updatedAt: number;
  enteredBy: string;
  mistakes: {
    paperQuestionId: string;
    stem: string;
    correctAnswer: string;
    studentAnswer: string;
    errorTag?: string;
    notes?: string;
    pushedAt?: number;
  }[];
}

export interface PullResult {
  ok: boolean;
  pulledPapers?: number;
  upsertedRows?: number;
  error?: string;
}

/**
 * 主入口: 从 OSS pull 当前 cadet 的所有 paper mistakes, upsert 到 Dexie.
 */
export async function pullPaperMistakes(studentId: string): Promise<PullResult> {
  const pwd = getStoredPassword();
  if (!pwd) return { ok: false, error: "no_password" };

  // 1. list
  let listJson: { ok: boolean; items?: ListItem[]; error?: string };
  try {
    const r = await fetch("/api/paper-mistakes", {
      headers: { Authorization: `Bearer ${pwd}` },
    });
    if (r.status === 401) return { ok: false, error: "unauthorized" };
    if (!r.ok) return { ok: false, error: `list_http_${r.status}` };
    listJson = await r.json();
  } catch (e) {
    return { ok: false, error: "list_network: " + (e as Error).message };
  }
  if (!listJson.ok || !listJson.items) {
    return { ok: false, error: listJson.error ?? "list_no_items" };
  }
  const items = listJson.items;
  if (items.length === 0) return { ok: true, pulledPapers: 0, upsertedRows: 0 };

  // 2. diff against Dexie (key: paperId, compare pushedAt)
  const existingByPaperId = new Map<string, number>();
  const allLocalRows = await db.paperMistakes.where("studentId").equals(studentId).toArray();
  for (const row of allLocalRows) {
    const cur = existingByPaperId.get(row.paperId) ?? 0;
    if (row.pushedAt > cur) existingByPaperId.set(row.paperId, row.pushedAt);
  }
  // toFetch: lastModifiedMs > 本地最大 pushedAt
  const toFetch = items.filter((it) => {
    const localTs = existingByPaperId.get(it.paperId) ?? 0;
    return it.lastModifiedMs > localTs;
  });
  if (toFetch.length === 0) {
    return { ok: true, pulledPapers: 0, upsertedRows: 0 };
  }

  // 3. fetch each + collect upsert rows
  const rowsToUpsert: PaperMistakeRow[] = [];
  let pulledPapers = 0;
  for (const it of toFetch) {
    try {
      const r = await fetch(`/api/paper-mistakes/${encodeURIComponent(it.paperId)}`, {
        headers: { Authorization: `Bearer ${pwd}` },
      });
      if (!r.ok) {
        console.warn(`[paperMistakesSync] fetch ${it.paperId} → http ${r.status}`);
        continue;
      }
      const j = (await r.json()) as { ok: boolean; record?: PaperRecord; error?: string };
      if (!j.ok || !j.record) {
        console.warn(`[paperMistakesSync] fetch ${it.paperId} → ${j.error}`);
        continue;
      }
      const rec = j.record;
      pulledPapers += 1;
      // 4. 打平: 一个 paper × N 道纸面错题 → N 个 PaperMistakeRow
      for (const m of rec.mistakes ?? []) {
        const id = `${studentId}::${rec.paperId}::${m.paperQuestionId}`;
        // 保留 reviewLog / reviewedAt 如果本地已有
        const existing = await db.paperMistakes.get(id);
        rowsToUpsert.push({
          id,
          studentId,
          paperId: rec.paperId,
          paperQuestionId: m.paperQuestionId,
          stem: m.stem,
          correctAnswer: m.correctAnswer,
          studentAnswer: m.studentAnswer,
          errorTag: m.errorTag,
          notes: m.notes,
          paperKind: rec.kind,
          paperTitle: rec.title,
          pushedAt: m.pushedAt ?? rec.updatedAt,
          reviewedAt: existing?.reviewedAt,
          reviewLog: existing?.reviewLog,
        });
      }
    } catch (e) {
      console.warn(`[paperMistakesSync] fetch ${it.paperId} threw:`, e);
    }
  }

  if (rowsToUpsert.length > 0) {
    await db.paperMistakes.bulkPut(rowsToUpsert);
  }
  return { ok: true, pulledPapers, upsertedRows: rowsToUpsert.length };
}

/**
 * 本地 "Selena 写一遍" review 完成时调用.
 */
export async function recordPaperReview(
  rowId: string,
  myAnswer: string,
  correct: boolean,
): Promise<void> {
  const existing = await db.paperMistakes.get(rowId);
  if (!existing) return;
  const newLog = [...(existing.reviewLog ?? []), { ts: Date.now(), myAnswer, correct }];
  await db.paperMistakes.update(rowId, {
    reviewedAt: Date.now(),
    reviewLog: newLog,
  });
}
