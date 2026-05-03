/**
 * 学科注册表入口。
 *
 * 加新学科只需要：
 *   1. 建 src/subjects/<id>/index.ts，导出符合 Subject 接口的对象
 *   2. 在 SubjectId 联合类型里加 id（src/subjects/types.ts）
 *   3. 在 SUBJECTS / ORDERED_SUBJECT_IDS 里登记
 * UI 路由 /:subject/* 会自动识别；Layout 导航项跟着 subject.navItems 渲染。
 */

import { mathSubject } from "./math";
import { chineseSubject } from "./chinese";
import type { Subject, SubjectId } from "./types";

export const SUBJECTS: Record<SubjectId, Subject> = {
  math: mathSubject,
  chinese: chineseSubject,
};

/** Picker 上从左到右、Header chip 下拉里上下展示的顺序。 */
export const ORDERED_SUBJECT_IDS: SubjectId[] = ["math", "chinese"];

/** URL 段是否对得上一个真实的、已登记的学科。 */
export function isKnownSubjectId(id: string | undefined): id is SubjectId {
  if (!id) return false;
  return ORDERED_SUBJECT_IDS.includes(id as SubjectId);
}

export function getSubject(id: SubjectId): Subject {
  const s = SUBJECTS[id];
  if (!s) throw new Error(`Unknown subject: ${id}`);
  return s;
}

export type { Subject, SubjectId } from "./types";
