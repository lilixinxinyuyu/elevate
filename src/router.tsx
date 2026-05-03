import { createBrowserRouter, Link } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/Home";
import { TrainPage } from "./pages/Train";
import { SkillsPage } from "./pages/Skills";
import { SkillPickerPage } from "./pages/SkillPicker";
import { MistakesPage } from "./pages/Mistakes";
import { ReportPage } from "./pages/Report";
import { AdminPage } from "./pages/Admin";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "train", element: <TrainPage /> },
      { path: "skills", element: <SkillsPage /> },
      { path: "picker", element: <SkillPickerPage /> },
      { path: "mistakes", element: <MistakesPage /> },
      { path: "report", element: <ReportPage /> },
      { path: "admin", element: <AdminPage /> },
    ],
  },
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
          <Link to="/train?fresh=1" className="btn-primary">重新开始</Link>
          <Link to="/" className="btn-secondary">回到首页</Link>
        </div>
      </div>
    </div>
  );
}
