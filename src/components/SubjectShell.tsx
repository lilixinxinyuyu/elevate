/**
 * SubjectShell：/:subject/* 路由的壳。
 *
 * 职责：
 *  1. 从 useParams() 拿 subject id，校验是否登记（不认得 → 跳回 /）
 *  2. 把对应 Subject 对象注入 SubjectProvider
 *  3. 持久化 selectedSubject::<studentId> 让"继续上次"按钮可用
 *  4. 渲染 Layout（Layout 内部读 useSubject().navItems）
 *  5. 子路由通过 <Outlet /> 渲染
 *
 * 注意：useEffect / useLiveQuery 必须在所有 return 之前调用，遵守 React Hooks
 * Rule（每次 render hook 顺序一致）。
 */

import { Navigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { isKnownSubjectId, SUBJECTS } from "../subjects";
import { SubjectProvider } from "../subjects/context";
import { Layout } from "./Layout";

export function SubjectShell() {
  const { subject: subjectParam } = useParams<{ subject: string }>();
  const student = useLiveQuery(async () => (await db.students.toArray())[0]);
  const validSubjectId = isKnownSubjectId(subjectParam) ? subjectParam : null;

  // 持久化"上次进入的学科"。必须在条件 return 之前 —— hook 顺序固定。
  useEffect(() => {
    if (!student?.id || !validSubjectId) return;
    void db.meta.put({
      key: `selectedSubject::${student.id}`,
      value: validSubjectId,
    });
  }, [student?.id, validSubjectId]);

  if (!validSubjectId) {
    return <Navigate to="/" replace />;
  }
  const subject = SUBJECTS[validSubjectId];

  return (
    <SubjectProvider subject={subject}>
      <Layout />
    </SubjectProvider>
  );
}
