/**
 * SubjectProvider / useSubject：把 Subject 对象注进 React 树。
 *
 * 用法：SubjectShell 拿到 useParams().subject，校验后用 <SubjectProvider>
 * 包子树；任意页面里 useSubject() 拿当前 Subject 对象。
 */

import { createContext, useContext } from "react";
import type { Subject } from "./types";

const SubjectContext = createContext<Subject | null>(null);

export function SubjectProvider({
  subject,
  children,
}: {
  subject: Subject;
  children: React.ReactNode;
}) {
  return (
    <SubjectContext.Provider value={subject}>{children}</SubjectContext.Provider>
  );
}

/**
 * 强制要求外层有 SubjectProvider。读不到就抛——比 silent fallback 安全。
 */
export function useSubject(): Subject {
  const s = useContext(SubjectContext);
  if (!s) {
    throw new Error(
      "useSubject() called outside SubjectProvider. Make sure the page is rendered under /:subject/* via SubjectShell.",
    );
  }
  return s;
}

/**
 * 软读：返回 null 而不是抛。给 Layout 这种偶尔在 subject 之外渲染的组件用。
 */
export function useOptionalSubject(): Subject | null {
  return useContext(SubjectContext);
}
