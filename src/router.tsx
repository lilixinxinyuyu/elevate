import { createBrowserRouter, Link, Navigate } from "react-router-dom";
import { SubjectShell } from "./components/SubjectShell";
import { SubjectPickerPage } from "./pages/SubjectPicker";
import { ComingSoonPage } from "./pages/ComingSoon";
import { HomePage } from "./pages/Home";
import { TrainPage } from "./pages/Train";
import { SkillsPage } from "./pages/Skills";
import { SkillPickerPage } from "./pages/SkillPicker";
import { MistakesPage } from "./pages/Mistakes";
import { ReportPage } from "./pages/Report";
import { AdminPage } from "./pages/Admin";
import { useSubject } from "./subjects/context";

/**
 * MathOnly：Phase 1 的"内容就绪"网关。
 *
 * Phase 1 只有 math 学科有题、有 mastery、有 trophies；chinese 是空。访问
 * /chinese/* 路由时不能让 math 页面（HomePage 等）跑——它们 import service.ts
 * 的 math 数据，empty 状态没意义。这里直接拦下来 render ComingSoon。
 *
 * Phase 2 chinese 内容到位后：
 *  - 要么改这个判断为 `subject.units.length > 0`
 *  - 要么按学科 + 路由维护一个 ready map
 *  - 现在硬编码 math 是最简单且不容易出 bug 的做法
 */
function MathOnly({ children }: { children: React.ReactNode }) {
  const subject = useSubject();
  if (subject.id !== "math") return <ComingSoonPage />;
  return <>{children}</>;
}

/**
 * 路由结构（多学科 v2）：
 *
 *   /                      → SubjectPickerPage（登录后落地这里）
 *   /:subject              → SubjectShell（校验 subject id + 注入 SubjectProvider）
 *      ├ index             → HomePage（包 MathOnly）
 *      ├ train             → TrainPage（包 MathOnly）
 *      ├ skills            → SkillsPage（包 MathOnly）
 *      ├ free-practice     → SkillPickerPage（旧路由 /picker）
 *      ├ mistakes          → MistakesPage
 *      ├ report            → ReportPage
 *      ├ admin             → AdminPage（不包：管理页跨学科可用）
 *      └ * (catch-all)     → ComingSoonPage（chinese 的 vocab/poems/writing 等）
 *
 * 老路径兜底：/train → /math/train 之类
 */
export const router = createBrowserRouter([
  { path: "/", element: <SubjectPickerPage /> },
  {
    path: "/:subject",
    element: <SubjectShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <MathOnly><HomePage /></MathOnly> },
      { path: "train", element: <MathOnly><TrainPage /></MathOnly> },
      { path: "skills", element: <MathOnly><SkillsPage /></MathOnly> },
      { path: "free-practice", element: <MathOnly><SkillPickerPage /></MathOnly> },
      { path: "mistakes", element: <MathOnly><MistakesPage /></MathOnly> },
      { path: "report", element: <MathOnly><ReportPage /></MathOnly> },
      { path: "admin", element: <AdminPage /> },
      { path: "*", element: <ComingSoonPage /> },
    ],
  },
  // 老路径重定向：保护已经装在 Selena 设备上的 PWA / 已分享的链接
  { path: "/train", element: <Navigate to="/math/train" replace /> },
  { path: "/skills", element: <Navigate to="/math/skills" replace /> },
  { path: "/picker", element: <Navigate to="/math/free-practice" replace /> },
  { path: "/mistakes", element: <Navigate to="/math/mistakes" replace /> },
  { path: "/report", element: <Navigate to="/math/report" replace /> },
  { path: "/admin", element: <Navigate to="/math/admin" replace /> },
]);

function RouteError() {
  return (
    <div className="min-h-screen app-bg text-slate-100 flex items-center justify-center px-4">
      <div className="card-glow max-w-md w-full text-center">
        <div className="font-display text-3xl font-bold text-brand">小挑战卡住了</div>
        <div className="mt-2 text-sm text-slate-300">
          换一组题继续，刚才那道我会当作内容问题处理。
        </div>
        <div className="mt-5 flex justify-center gap-3">
          <Link to="/math/train?fresh=1" className="btn-primary">重新开始</Link>
          <Link to="/" className="btn-secondary">回学科选择</Link>
        </div>
      </div>
    </div>
  );
}
