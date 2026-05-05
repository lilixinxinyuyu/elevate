import { createBrowserRouter, Link, Navigate, useLocation } from "react-router-dom";
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
import { ChineseHomePage } from "./pages/chinese/ChineseHome";
import { ChineseTrainPage } from "./pages/chinese/ChineseTrain";
import { ChinesePickerPage } from "./pages/chinese/ChinesePicker";
import { ChineseAdminPage } from "./pages/chinese/ChineseAdmin";
import { FluencyPage } from "./pages/Fluency";
import { FluencySessionPage } from "./pages/FluencySession";
import { useSubject } from "./subjects/context";
import { isPhase2Live } from "./lib/featureFlags";

/**
 * SubjectAware：按当前 useSubject().id 分发到 math / chinese 不同的 page 组件。
 *
 * Phase 2 MVP：math 路由用现有数学 page；chinese 路由用 ChineseHome/Train/Picker；
 * 别的 subject id 都回 ComingSoon。
 *
 * 这种"按 subject 分发"的好处：math 完全不动；chinese 有自己简化版的 page；
 * 期中后真去耦合时，可以让两边都用通用的 GenericTrainPage(subject)，
 * 把这一层 dispatch 拆掉。
 */
function HomeRoute() {
  const subject = useSubject();
  if (subject.id === "math") return <HomePage />;
  if (subject.id === "chinese") return <ChineseHomePage />;
  return <ComingSoonPage />;
}

function TrainRoute() {
  const subject = useSubject();
  if (subject.id === "math") return <TrainPage />;
  if (subject.id === "chinese") return <ChineseTrainPage />;
  return <ComingSoonPage />;
}

function FreePracticeRoute() {
  const subject = useSubject();
  if (subject.id === "math") return <SkillPickerPage />;
  if (subject.id === "chinese") return <ChinesePickerPage />;
  return <ComingSoonPage />;
}

function MathOnlyRoute({ children }: { children: React.ReactNode }) {
  const subject = useSubject();
  if (subject.id !== "math") return <ComingSoonPage />;
  return <>{children}</>;
}

/** Phase 2 路由：feature flag off 时强制 ComingSoon，避免期中前误入。 */
function Phase2Route({ children }: { children: React.ReactNode }) {
  const subject = useSubject();
  if (subject.id !== "math") return <ComingSoonPage />;
  if (!isPhase2Live()) return <ComingSoonPage />;
  return <>{children}</>;
}

function AdminRoute() {
  const subject = useSubject();
  if (subject.id === "math") return <AdminPage />;
  if (subject.id === "chinese") return <ChineseAdminPage />;
  return <ComingSoonPage />;
}

/**
 * 路由结构（多学科 v2 / Phase 2 MVP）：
 *
 *   /                      → SubjectPickerPage
 *   /:subject              → SubjectShell（注入 SubjectProvider）
 *      ├ index             → HomeRoute       (math: HomePage / chinese: ChineseHomePage)
 *      ├ train             → TrainRoute      (math: TrainPage / chinese: ChineseTrainPage)
 *      ├ free-practice     → FreePracticeRoute (math: SkillPicker / chinese: ChinesePicker)
 *      ├ skills            → MathOnly(SkillsPage)        — chinese 期中后再做
 *      ├ mistakes          → MathOnly(MistakesPage)      — chinese 期中后再做
 *      ├ report            → MathOnly(ReportPage)        — chinese 期中后再做
 *      ├ admin             → AdminPage（跨学科共用）
 *      └ * (catch-all)     → ComingSoonPage
 *
 * 老路径兜底依旧是 /train → /math/train 等。
 */
export const router = createBrowserRouter([
  { path: "/", element: <SubjectPickerPage /> },
  {
    path: "/:subject",
    element: <SubjectShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: "train", element: <TrainRoute /> },
      { path: "free-practice", element: <FreePracticeRoute /> },
      { path: "skills", element: <MathOnlyRoute><SkillsPage /></MathOnlyRoute> },
      { path: "mistakes", element: <MathOnlyRoute><MistakesPage /></MathOnlyRoute> },
      { path: "report", element: <MathOnlyRoute><ReportPage /></MathOnlyRoute> },
      // Phase 2 Axis 3：Fluency 口算训练营。feature flag off 期间走 ComingSoon。
      { path: "fluency", element: <Phase2Route><FluencyPage /></Phase2Route> },
      { path: "fluency/:moduleId", element: <Phase2Route><FluencySessionPage /></Phase2Route> },
      { path: "admin", element: <AdminRoute /> },
      { path: "*", element: <ComingSoonPage /> },
    ],
  },
  // 老路径重定向：保护 PWA 已装的 Selena 设备。
  // 关键：必须保留 query string + hash —— 老代码里有 `/train?skillIds=...` 类似
  // 调用，普通 <Navigate to="/math/train" replace /> 会**直接丢掉 query**，
  // 自由练选了 skill 但跳转后页面以为是每日挑战。用 LegacyRedirect 透传。
  { path: "/train", element: <LegacyRedirect to="/math/train" /> },
  { path: "/skills", element: <LegacyRedirect to="/math/skills" /> },
  { path: "/picker", element: <LegacyRedirect to="/math/free-practice" /> },
  { path: "/mistakes", element: <LegacyRedirect to="/math/mistakes" /> },
  { path: "/report", element: <LegacyRedirect to="/math/report" /> },
  { path: "/admin", element: <LegacyRedirect to="/math/admin" /> },
]);

/** 老路径 → 新路径重定向，保留 query string + hash。 */
function LegacyRedirect({ to }: { to: string }) {
  const loc = useLocation();
  return <Navigate to={`${to}${loc.search}${loc.hash}`} replace />;
}

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
