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
// Ep159: super-admin 走 lazy import 拆 chunk，学生 bundle 不带管理员代码
import { lazy, Suspense } from "react";
const SuperAdminPage = lazy(() =>
  import("./pages/SuperAdmin").then((m) => ({ default: m.SuperAdminPage })),
);
import { ChineseHomePage } from "./pages/chinese/ChineseHome";
import { ChineseTrainPage } from "./pages/chinese/ChineseTrain";
import { ChinesePickerPage } from "./pages/chinese/ChinesePicker";
import { ChineseAdminPage } from "./pages/chinese/ChineseAdmin";
import { CharPracticePage } from "./pages/chinese/CharPractice";
import { EnglishHomePage } from "./pages/english/EnglishHome";
import { VocabPracticePage } from "./pages/english/VocabPractice";
import { SentencePracticePage } from "./pages/english/SentencePractice";
import { FluencyPage } from "./pages/Fluency";
import { FluencySessionPage } from "./pages/FluencySession";
import { BossWorldPage } from "./pages/BossWorld";
import { BossBattlePage } from "./pages/BossBattle";
import { VoiceTestPage } from "./pages/VoiceTest";
import { Mascot3DTestPage } from "./pages/Mascot3DTest";
import { ParadisePage } from "./pages/paradise/ParadisePage";
import { AtelierHomePage } from "./pages/atelier/AtelierHomePage";
import { AtelierRealmPage } from "./pages/atelier/AtelierRealmPage";
import { TownHomePage } from "./pages/town/TownHomePage";
import { BankPage } from "./pages/town/BankPage";
import { BuildingStubPage } from "./pages/town/BuildingStubPage";
// v0.32.0: P3 Worlds — 3 学科地图独立沙箱（GDD docs/p3-worlds-gdd-v3.md）
import { WorldsHomePage } from "./pages/worlds/WorldsHomePage";
import { BaibaoMapPage } from "./pages/worlds/BaibaoMapPage";
import { BuildingStubPage as WorldsBuildingStub } from "./pages/worlds/BuildingStubPage";
import { WorldLockedPage } from "./pages/worlds/WorldLockedPage";
import { StorePage } from "./pages/worlds/StorePage";
import { BankPage as WorldsBankPage } from "./pages/worlds/BankPage";
import { BakeryPage } from "./pages/worlds/BakeryPage";
import { XingfanMapPage } from "./pages/worlds/XingfanMapPage";
import { AirportPage } from "./pages/worlds/AirportPage";
import { MascotComparePage } from "./pages/MascotCompare";
import { MathTricksPage } from "./pages/MathTricks";
import { PlaygroundPage } from "./pages/Playground";
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
  if (subject.id === "english") return <EnglishHomePage />;
  return <ComingSoonPage />;
}

function TrainRoute() {
  const subject = useSubject();
  if (subject.id === "math") return <TrainPage />;
  if (subject.id === "chinese") return <ChineseTrainPage />;
  // english 的 Train 入口走 vocab page
  if (subject.id === "english") return <VocabPracticePage />;
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

/** v0.31.39: 语文写字表练习页（仅 chinese subject 显示） */
function CharPracticeRoute() {
  const subject = useSubject();
  if (subject.id === "chinese") return <CharPracticePage />;
  return <ComingSoonPage />;
}

/** v0.31.39: 英语单词练习页（仅 english subject 显示） */
function VocabPracticeRoute() {
  const subject = useSubject();
  if (subject.id === "english") return <VocabPracticePage />;
  return <ComingSoonPage />;
}

/** v0.31.103: 英语短句大冒险（朗读 + 造句） */
function SentencePracticeRoute() {
  const subject = useSubject();
  if (subject.id === "english") return <SentencePracticePage />;
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
      // v0.31.49: 闯关 v3 — Boss 战 + 闯关世界
      { path: "big-problems", element: <Phase2Route><BossWorldPage /></Phase2Route> },
      { path: "boss-battle/:unitId", element: <Phase2Route><BossBattlePage /></Phase2Route> },
      // v0.31.71: 巧算工具箱（math-only）
      { path: "tricks", element: <MathOnlyRoute><MathTricksPage /></MathOnlyRoute> },
      // v0.31.87: 玩法试玩台（math-only，admin 用）
      { path: "playground", element: <MathOnlyRoute><PlaygroundPage /></MathOnlyRoute> },
      { path: "voice-test", element: <MathOnlyRoute><VoiceTestPage /></MathOnlyRoute> },
      { path: "mascot3d", element: <MathOnlyRoute><Mascot3DTestPage /></MathOnlyRoute> },
      // v0.31.113: 知识乐园 3D 探索世界（paradise-1 + Selena VRM + 红熊猫 follower）
      { path: "paradise", element: <MathOnlyRoute><ParadisePage /></MathOnlyRoute> },
      { path: "mascot-compare", element: <MathOnlyRoute><MascotComparePage /></MathOnlyRoute> },
      // v0.32.9: 小进的星海工坊（沙箱实验，独立路径，跟主路径完全隔离）
      { path: "atelier", element: <MathOnlyRoute><AtelierHomePage /></MathOnlyRoute> },
      { path: "atelier/realm/:id", element: <MathOnlyRoute><AtelierRealmPage /></MathOnlyRoute> },
      // v0.32.10: 小镇（沙箱实验，超越 atelier 的 3D 城市方向）
      { path: "town", element: <MathOnlyRoute><TownHomePage /></MathOnlyRoute> },
      { path: "town/bank", element: <MathOnlyRoute><BankPage /></MathOnlyRoute> },
      { path: "town/bus-stop", element: <MathOnlyRoute><BuildingStubPage /></MathOnlyRoute> },
      { path: "town/shop", element: <MathOnlyRoute><BuildingStubPage /></MathOnlyRoute> },
      { path: "town/school", element: <MathOnlyRoute><BuildingStubPage /></MathOnlyRoute> },
      { path: "admin", element: <AdminRoute /> },
      // v0.31.39：语文写字表 250 字练习
      { path: "char-practice", element: <CharPracticeRoute /> },
      // v0.31.39：英语单词记忆
      { path: "vocab", element: <VocabPracticeRoute /> },
      // v0.31.103：英语短句（朗读 AI 判 + 造句拼图）
      { path: "sentence", element: <SentencePracticeRoute /> },
      { path: "*", element: <ComingSoonPage /> },
    ],
  },
  // v0.32.0: P3 Worlds 独立沙箱 — 跟 /:subject 完全平行，不挂 SubjectShell
  { path: "/worlds", element: <WorldsHomePage /> },
  { path: "/worlds/baibao", element: <BaibaoMapPage /> },
  { path: "/worlds/baibao/store", element: <StorePage /> },
  { path: "/worlds/baibao/bank", element: <WorldsBankPage /> },
  { path: "/worlds/baibao/bakery", element: <BakeryPage /> },
  { path: "/worlds/baibao/:buildingId", element: <WorldsBuildingStub /> },
  // 星帆岛 (英语世界)
  { path: "/worlds/xingfan", element: <XingfanMapPage /> },
  { path: "/worlds/xingfan/airport", element: <AirportPage /> },
  { path: "/worlds/xingfan/:buildingId", element: <WorldsBuildingStub /> },
  { path: "/worlds/:worldId", element: <WorldLockedPage /> },

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

  // Ep9 (Ep145): super-admin dashboard. backend 自己鉴 isSuperAdmin，
  // 不是 super-admin 会被自动跳回 home。
  // Ep159: lazy load — 学生 bundle 不含此页代码
  {
    path: "/super-admin",
    element: (
      <Suspense fallback={<div className="p-6 text-slate-400 text-sm">⏳ 加载管理员后台…</div>}>
        <SuperAdminPage />
      </Suspense>
    ),
  },
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
