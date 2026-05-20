import { createBrowserRouter, Link, Navigate, useLocation } from "react-router-dom";
import { SubjectShell } from "./components/SubjectShell";
import { SubjectPickerPage } from "./pages/SubjectPicker";
import { ComingSoonPage } from "./pages/ComingSoon";
import { HomePage } from "./pages/Home";
import { ChineseHomePage } from "./pages/chinese/ChineseHome";
import { EnglishHomePage } from "./pages/english/EnglishHome";
// v0.34.84 iter 18 (爸爸反馈 LCP 36-45s): 把所有非 home 页 lazy 化, 主路径
// 落地 /math 时只下 HomePage. Train/Paradise/Atelier/Town/Boss 等 3D / canvas
// 重页全部按需加载, 主 bundle 从 1.7MB 大幅瘦身.
import { lazy, Suspense, type ReactNode } from "react";
const SuperAdminPage = lazy(() => import("./pages/SuperAdmin").then((m) => ({ default: m.SuperAdminPage })));
const TrainPage = lazy(() => import("./pages/Train").then((m) => ({ default: m.TrainPage })));
const SkillsPage = lazy(() => import("./pages/Skills").then((m) => ({ default: m.SkillsPage })));
const SkillPickerPage = lazy(() => import("./pages/SkillPicker").then((m) => ({ default: m.SkillPickerPage })));
const MistakesPage = lazy(() => import("./pages/Mistakes").then((m) => ({ default: m.MistakesPage })));
const MistakeHuntPage = lazy(() => import("./pages/MistakeHunt"));
const StrengthenPage = lazy(() => import("./pages/Strengthen").then((m) => ({ default: m.StrengthenPage })));
const BaseSystemsPage = lazy(() => import("./pages/BaseSystems"));
const BrainpowerRadarPage = lazy(() => import("./pages/BrainpowerRadar"));
const MockExamReportPage = lazy(() => import("./pages/MockExamReport"));
const PaperMistakeEntryPage = lazy(() => import("./pages/PaperMistakeEntry"));
const ExamPrepPage = lazy(() => import("./pages/ExamPrep"));
const PaperMistakesPage = lazy(() => import("./pages/PaperMistakes"));
const ReportPage = lazy(() => import("./pages/Report").then((m) => ({ default: m.ReportPage })));
const AdminPage = lazy(() => import("./pages/Admin").then((m) => ({ default: m.AdminPage })));
const ChineseTrainPage = lazy(() => import("./pages/chinese/ChineseTrain").then((m) => ({ default: m.ChineseTrainPage })));
const ChinesePickerPage = lazy(() => import("./pages/chinese/ChinesePicker").then((m) => ({ default: m.ChinesePickerPage })));
const ChineseAdminPage = lazy(() => import("./pages/chinese/ChineseAdmin").then((m) => ({ default: m.ChineseAdminPage })));
const CharPracticePage = lazy(() => import("./pages/chinese/CharPractice").then((m) => ({ default: m.CharPracticePage })));
const VocabPracticePage = lazy(() => import("./pages/english/VocabPractice").then((m) => ({ default: m.VocabPracticePage })));
const SentencePracticePage = lazy(() => import("./pages/english/SentencePractice").then((m) => ({ default: m.SentencePracticePage })));
const FluencyPage = lazy(() => import("./pages/Fluency").then((m) => ({ default: m.FluencyPage })));
const FluencySessionPage = lazy(() => import("./pages/FluencySession").then((m) => ({ default: m.FluencySessionPage })));
const BossWorldPage = lazy(() => import("./pages/BossWorld").then((m) => ({ default: m.BossWorldPage })));
const BossBattlePage = lazy(() => import("./pages/BossBattle").then((m) => ({ default: m.BossBattlePage })));
const VoiceTestPage = lazy(() => import("./pages/VoiceTest").then((m) => ({ default: m.VoiceTestPage })));
const Mascot3DTestPage = lazy(() => import("./pages/Mascot3DTest").then((m) => ({ default: m.Mascot3DTestPage })));
const ParadisePage = lazy(() => import("./pages/paradise/ParadisePage").then((m) => ({ default: m.ParadisePage })));
const AtelierHomePage = lazy(() => import("./pages/atelier/AtelierHomePage").then((m) => ({ default: m.AtelierHomePage })));
const AtelierRealmPage = lazy(() => import("./pages/atelier/AtelierRealmPage").then((m) => ({ default: m.AtelierRealmPage })));
// v0.35.69 Sprint A: D2 World Map preview (Bruce 评审, 不替换 home)
const WorldMapPreviewPage = lazy(() => import("./pages/WorldMapPreview").then((m) => ({ default: m.WorldMapPreviewPage })));
// v0.35.71 Hub Screen prototype v2 (hamster-game style Mascot 中心 + 单 PLAY)
const HubScreenPage = lazy(() => import("./pages/HubScreen").then((m) => ({ default: m.HubScreenPage })));
// v0.35.72 Celebration Screen 评审入口 (Sprint 2, Duolingo Lesson Complete style)
const CelebrationPreviewPage = lazy(() => import("./pages/CelebrationPreview").then((m) => ({ default: m.CelebrationPreviewPage })));
// v0.35.73 Hub Screen v3 (Bruce 反馈 "真游戏 1 屏不 scroll", fixed inset overlay)
const HubScreenV3Page = lazy(() => import("./pages/HubScreenV3").then((m) => ({ default: m.HubScreenV3Page })));
// v0.35.74 Streak Screen 评审 (Sprint 4, Duolingo style 火焰 + 周日 dots)
const StreakPreviewPage = lazy(() => import("./pages/StreakPreview").then((m) => ({ default: m.StreakPreviewPage })));
// v0.35.75 Hub Screen v4 (Bruce 反馈 v3 "4K 屏空白 + 信息密度低", 3-column grid + responsive)
const HubScreenV4Page = lazy(() => import("./pages/HubScreenV4").then((m) => ({ default: m.HubScreenV4Page })));
// v0.35.76 Battle Preview — Number Arena minigame prototype (Bruce 要看 minigame 具体设计)
const BattlePreviewPage = lazy(() => import("./pages/BattlePreview").then((m) => ({ default: m.BattlePreviewPage })));
// v0.35.77 Detective Preview — Word Problem Detective cluster (Sprint 6)
const DetectivePreviewPage = lazy(() => import("./pages/DetectivePreview").then((m) => ({ default: m.DetectivePreviewPage })));
// v0.35.78 Temple Preview — Equation Temple cluster (Sprint 7, 天平 + 神殿)
const TemplePreviewPage = lazy(() => import("./pages/TemplePreview").then((m) => ({ default: m.TemplePreviewPage })));
// v0.35.79 Hub Screen v5 (Bruce 反馈 v4 整体感弱 / 老 3 环段位能力诊断扔了 → 全数捡回)
const HubScreenV5Page = lazy(() => import("./pages/HubScreenV5").then((m) => ({ default: m.HubScreenV5Page })));
// Phase B Hub Screen v6 (角色立绘居中 lobby, OFF-by-default flag isHubV6Default; live 首页不变)
const HubScreenV6Page = lazy(() => import("./pages/HubScreenV6").then((m) => ({ default: m.HubScreenV6Page })));
// v0.35.81 Sprint 8: Lab Preview — 几何实验室 cluster (TriangleJudge/ShapeCourt/CubeViewer)
const LabPreviewPage = lazy(() => import("./pages/LabPreview").then((m) => ({ default: m.LabPreviewPage })));
// v0.35.83 Sprint 9: Data Preview — 数据探险 cluster (BarChart/LineChart/PieChart)
const DataPreviewPage = lazy(() => import("./pages/DataPreview").then((m) => ({ default: m.DataPreviewPage })));
// v0.35.86 Sprint 10a: Carnival Preview — 金钱时间游乐场 (Money/Clock/TimeArith)
const CarnivalPreviewPage = lazy(() => import("./pages/CarnivalPreview").then((m) => ({ default: m.CarnivalPreviewPage })));
// v0.35.87 Sprint 10b: Canvas Preview — 符文绘制 (HandDrawRune/TraceShape/DotConnect/DigitWrite)
const CanvasPreviewPage = lazy(() => import("./pages/CanvasPreview").then((m) => ({ default: m.CanvasPreviewPage })));
// v0.35.89 Character Gallery — 12 base avatar 评审 (6 archetype × 2 gender)
const CharacterGalleryPage = lazy(() => import("./pages/CharacterGallery").then((m) => ({ default: m.CharacterGalleryPage })));
// v0.35.92 Sprint C1: Poem Lantern Preview — 古诗拍灯笼 (元宵主题 + 古诗补字)
const PoemLanternPreviewPage = lazy(() => import("./pages/PoemLanternPreview").then((m) => ({ default: m.PoemLanternPreviewPage })));
// v0.35.94 Sprint C2: Glyph Detective Preview — 字形侦探 (民国侦探 + 偏旁部首)
const GlyphDetectivePreviewPage = lazy(() => import("./pages/GlyphDetectivePreview").then((m) => ({ default: m.GlyphDetectivePreviewPage })));
// v0.35.96 Sprint C3: Sentence Dragon Preview — 病句龙训 (中国龙 + 句子重组)
const SentenceDragonPreviewPage = lazy(() => import("./pages/SentenceDragonPreview").then((m) => ({ default: m.SentenceDragonPreviewPage })));
// v0.35.99 Sprint C4: Rhetoric Scroll Preview — 修辞画卷 (山水画 + 修辞辨认)
const RhetoricScrollPreviewPage = lazy(() => import("./pages/RhetoricScrollPreview").then((m) => ({ default: m.RhetoricScrollPreviewPage })));
// v0.36.3 Sprint C6: Reading Library Preview — 阅读图书馆 (古风书院 + 长篇阅读 multi-step)
const ReadingLibraryPreviewPage = lazy(() => import("./pages/ReadingLibraryPreview").then((m) => ({ default: m.ReadingLibraryPreviewPage })));
// v0.36.21 Sprint C5: Imitate Painter Preview — 仿写画师 (美术馆 + 4选1临摹 + 自由仿写 AI 点评)
const ImitatePainterPreviewPage = lazy(() => import("./pages/ImitatePainterPreview").then((m) => ({ default: m.ImitatePainterPreviewPage })));
// v0.36.27 Sprint C7: Essay Inkstone Preview — 自由作文 (书房砚台 + 片段/成篇 + 作文 AI 点评) — 7/7 完成
const EssayInkstonePreviewPage = lazy(() => import("./pages/EssayInkstonePreview").then((m) => ({ default: m.EssayInkstonePreviewPage })));
const TownHomePage = lazy(() => import("./pages/town/TownHomePage").then((m) => ({ default: m.TownHomePage })));
const BankPage = lazy(() => import("./pages/town/BankPage").then((m) => ({ default: m.BankPage })));
const BuildingStubPage = lazy(() => import("./pages/town/BuildingStubPage").then((m) => ({ default: m.BuildingStubPage })));
// v0.32.0: P3 Worlds — 3 学科地图独立沙箱（GDD docs/p3-worlds-gdd-v3.md）
// Ep爸爸-2026-05-17：worlds 还在 WIP，全部 lazy() 拆独立 chunk，
// 主 bundle 不带 Three.js 场景文件。配合 vite.config 里 manualChunks
// 把这些 9 个文件 + components/worlds + lib/worlds + content/worlds
// 合并到一个 worlds-{hash}.js chunk，OSS 只动这一个文件就能独立 ship。
const WorldsHomePage = lazy(() => import("./pages/worlds/WorldsHomePage").then((m) => ({ default: m.WorldsHomePage })));
const BaibaoMapPage = lazy(() => import("./pages/worlds/BaibaoMapPage").then((m) => ({ default: m.BaibaoMapPage })));
const WorldsBuildingStub = lazy(() => import("./pages/worlds/BuildingStubPage").then((m) => ({ default: m.BuildingStubPage })));
const WorldLockedPage = lazy(() => import("./pages/worlds/WorldLockedPage").then((m) => ({ default: m.WorldLockedPage })));
const WorldsStorePage = lazy(() => import("./pages/worlds/StorePage").then((m) => ({ default: m.StorePage })));
const WorldsBankPage = lazy(() => import("./pages/worlds/BankPage").then((m) => ({ default: m.BankPage })));
const WorldsBakeryPage = lazy(() => import("./pages/worlds/BakeryPage").then((m) => ({ default: m.BakeryPage })));
const XingfanMapPage = lazy(() => import("./pages/worlds/XingfanMapPage").then((m) => ({ default: m.XingfanMapPage })));
const WorldsAirportPage = lazy(() => import("./pages/worlds/AirportPage").then((m) => ({ default: m.AirportPage })));

/**
 * Suspense fallback for worlds lazy chunks. Kawaii 学生风（worlds 在学生
 * 路径，不用 super-admin 的 x.ai 冷色调）。轻量 spinner，避免空白闪屏。
 */
function WorldsLazyFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-violet-950 via-slate-900 to-slate-950">
      <div className="text-center">
        <div className="text-5xl mb-3 animate-pulse">🌍</div>
        <div className="text-sm text-violet-200 font-mono">载入世界中…</div>
        <div className="text-[10px] text-slate-500 mt-1">worlds chunk lazy-loading</div>
      </div>
    </div>
  );
}

/**
 * v0.34.84 iter 18: 普通页面 lazy fallback. 简洁 spinner.
 */
function PageLazyFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="text-slate-400 text-sm flex items-center gap-2">
        <span className="inline-block w-4 h-4 border-2 border-slate-500 border-t-violet-400 rounded-full animate-spin" />
        载入中…
      </div>
    </div>
  );
}

/** wrap each Worlds element in Suspense once */
function W(element: ReactNode) {
  return <Suspense fallback={<WorldsLazyFallback />}>{element}</Suspense>;
}

/** v0.34.84: wrap generic lazy pages in Suspense */
function L(element: ReactNode) {
  return <Suspense fallback={<PageLazyFallback />}>{element}</Suspense>;
}

const MascotComparePage = lazy(() => import("./pages/MascotCompare").then((m) => ({ default: m.MascotComparePage })));
const MathTricksPage = lazy(() => import("./pages/MathTricks").then((m) => ({ default: m.MathTricksPage })));
const PlaygroundPage = lazy(() => import("./pages/Playground").then((m) => ({ default: m.PlaygroundPage })));
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

function ChineseOnlyRoute({ children }: { children: React.ReactNode }) {
  const subject = useSubject();
  if (subject.id !== "chinese") return <ComingSoonPage />;
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
      { path: "train", element: L(<TrainRoute />) },
      { path: "free-practice", element: L(<FreePracticeRoute />) },
      { path: "skills", element: L(<MathOnlyRoute><SkillsPage /></MathOnlyRoute>) },
      { path: "mistakes", element: L(<MathOnlyRoute><MistakesPage /></MathOnlyRoute>) },
      { path: "find-mistakes", element: L(<MathOnlyRoute><MistakeHuntPage /></MathOnlyRoute>) },
      { path: "strengthen", element: L(<MathOnlyRoute><StrengthenPage /></MathOnlyRoute>) },
      { path: "base-systems", element: L(<MathOnlyRoute><BaseSystemsPage /></MathOnlyRoute>) },
      { path: "radar", element: L(<MathOnlyRoute><BrainpowerRadarPage /></MathOnlyRoute>) },
      { path: "mock-report", element: L(<MathOnlyRoute><MockExamReportPage /></MathOnlyRoute>) },
      { path: "exam-prep", element: L(<MathOnlyRoute><ExamPrepPage /></MathOnlyRoute>) },
      { path: "paper-entry", element: L(<MathOnlyRoute><PaperMistakeEntryPage /></MathOnlyRoute>) },
      { path: "paper-mistakes", element: L(<MathOnlyRoute><PaperMistakesPage /></MathOnlyRoute>) },
      { path: "report", element: L(<MathOnlyRoute><ReportPage /></MathOnlyRoute>) },
      { path: "fluency", element: L(<Phase2Route><FluencyPage /></Phase2Route>) },
      { path: "fluency/:moduleId", element: L(<Phase2Route><FluencySessionPage /></Phase2Route>) },
      { path: "big-problems", element: L(<Phase2Route><BossWorldPage /></Phase2Route>) },
      { path: "boss-battle/:unitId", element: L(<Phase2Route><BossBattlePage /></Phase2Route>) },
      { path: "tricks", element: L(<MathOnlyRoute><MathTricksPage /></MathOnlyRoute>) },
      { path: "playground", element: L(<MathOnlyRoute><PlaygroundPage /></MathOnlyRoute>) },
      { path: "voice-test", element: L(<MathOnlyRoute><VoiceTestPage /></MathOnlyRoute>) },
      { path: "mascot3d", element: L(<MathOnlyRoute><Mascot3DTestPage /></MathOnlyRoute>) },
      { path: "paradise", element: L(<MathOnlyRoute><ParadisePage /></MathOnlyRoute>) },
      { path: "mascot-compare", element: L(<MathOnlyRoute><MascotComparePage /></MathOnlyRoute>) },
      { path: "atelier", element: L(<MathOnlyRoute><AtelierHomePage /></MathOnlyRoute>) },
      { path: "atelier/realm/:id", element: L(<MathOnlyRoute><AtelierRealmPage /></MathOnlyRoute>) },
      // v0.35.69 Sprint A: D2 World Map 小样, Bruce 评审用
      { path: "world-preview", element: L(<MathOnlyRoute><WorldMapPreviewPage /></MathOnlyRoute>) },
      // v0.35.71 Hub Screen 小样 v2 (Mascot 中心 + 单 PLAY, hamster-game style)
      { path: "hub-preview", element: L(<MathOnlyRoute><HubScreenPage /></MathOnlyRoute>) },
      // v0.35.72 Celebration Screen 评审 (3 scenario: high/mid/low)
      { path: "celebration-preview", element: L(<MathOnlyRoute><CelebrationPreviewPage /></MathOnlyRoute>) },
      // v0.35.73 Hub Screen v3 (锁视口不 scroll, overlay SubjectShell)
      { path: "hub-v3", element: L(<MathOnlyRoute><HubScreenV3Page /></MathOnlyRoute>) },
      // v0.35.74 Streak Screen 评审 (3 scenario)
      { path: "streak-preview", element: L(<MathOnlyRoute><StreakPreviewPage /></MathOnlyRoute>) },
      // v0.35.75 Hub Screen v4 (大屏 grid + 高信息密度)
      { path: "hub-v4", element: L(<MathOnlyRoute><HubScreenV4Page /></MathOnlyRoute>) },
      // v0.35.76 Battle Preview (Number Arena minigame prototype)
      { path: "battle-preview", element: L(<MathOnlyRoute><BattlePreviewPage /></MathOnlyRoute>) },
      // v0.35.77 Detective Preview (Word Problem Detective cluster)
      { path: "detective-preview", element: L(<MathOnlyRoute><DetectivePreviewPage /></MathOnlyRoute>) },
      // v0.35.78 Temple Preview (Equation Temple cluster, 天平 + 神殿)
      { path: "temple-preview", element: L(<MathOnlyRoute><TemplePreviewPage /></MathOnlyRoute>) },
      // v0.35.79 Hub Screen v5 (统一 hero scene, 3 环 + 段位徽章 + 能力诊断 全回归)
      { path: "hub-v5", element: L(<MathOnlyRoute><HubScreenV5Page /></MathOnlyRoute>) },
      // Phase B Hub Screen v6 (角色立绘居中 lobby; flag OFF-by-default, 仅此路由可见)
      { path: "hub-v6", element: L(<MathOnlyRoute><HubScreenV6Page /></MathOnlyRoute>) },
      // v0.35.81 Lab Preview (Geometry Lab cluster, Sprint 8)
      { path: "lab-preview", element: L(<MathOnlyRoute><LabPreviewPage /></MathOnlyRoute>) },
      // v0.35.83 Data Preview (Data Adventure cluster, Sprint 9)
      { path: "data-preview", element: L(<MathOnlyRoute><DataPreviewPage /></MathOnlyRoute>) },
      // v0.35.86 Carnival Preview (Money/Time cluster, Sprint 10a)
      { path: "carnival-preview", element: L(<MathOnlyRoute><CarnivalPreviewPage /></MathOnlyRoute>) },
      // v0.35.87 Canvas Preview (Rune Drawing cluster, Sprint 10b — final 7/7)
      { path: "canvas-preview", element: L(<MathOnlyRoute><CanvasPreviewPage /></MathOnlyRoute>) },
      // v0.35.89 Character Gallery (12 base avatar Bruce 评审)
      { path: "character-gallery", element: L(<MathOnlyRoute><CharacterGalleryPage /></MathOnlyRoute>) },
      // v0.35.92 Sprint C1: Poem Lantern (古诗拍灯笼 Chinese cluster)
      { path: "poem-lantern-preview", element: L(<ChineseOnlyRoute><PoemLanternPreviewPage /></ChineseOnlyRoute>) },
      // v0.35.94 Sprint C2: Glyph Detective (字形侦探 Chinese cluster)
      { path: "glyph-detective-preview", element: L(<ChineseOnlyRoute><GlyphDetectivePreviewPage /></ChineseOnlyRoute>) },
      // v0.35.96 Sprint C3: Sentence Dragon (病句龙训 Chinese cluster)
      { path: "sentence-dragon-preview", element: L(<ChineseOnlyRoute><SentenceDragonPreviewPage /></ChineseOnlyRoute>) },
      // v0.35.99 Sprint C4: Rhetoric Scroll (修辞画卷 Chinese cluster)
      { path: "rhetoric-scroll-preview", element: L(<ChineseOnlyRoute><RhetoricScrollPreviewPage /></ChineseOnlyRoute>) },
      // v0.36.3 Sprint C6: Reading Library (阅读图书馆 Chinese cluster)
      { path: "reading-library-preview", element: L(<ChineseOnlyRoute><ReadingLibraryPreviewPage /></ChineseOnlyRoute>) },
      // v0.36.21 Sprint C5: Imitate Painter (仿写画师 Chinese cluster — 4选1临摹 + 自由仿写 AI 点评)
      { path: "imitate-painter-preview", element: L(<ChineseOnlyRoute><ImitatePainterPreviewPage /></ChineseOnlyRoute>) },
      // v0.36.27 Sprint C7: Essay Inkstone (自由作文 Chinese cluster — 书房砚台 + 作文 AI 点评) — 7/7
      { path: "essay-inkstone-preview", element: L(<ChineseOnlyRoute><EssayInkstonePreviewPage /></ChineseOnlyRoute>) },
      { path: "town", element: L(<MathOnlyRoute><TownHomePage /></MathOnlyRoute>) },
      { path: "town/bank", element: L(<MathOnlyRoute><BankPage /></MathOnlyRoute>) },
      { path: "town/bus-stop", element: L(<MathOnlyRoute><BuildingStubPage /></MathOnlyRoute>) },
      { path: "town/shop", element: L(<MathOnlyRoute><BuildingStubPage /></MathOnlyRoute>) },
      { path: "town/school", element: L(<MathOnlyRoute><BuildingStubPage /></MathOnlyRoute>) },
      { path: "admin", element: L(<AdminRoute />) },
      { path: "char-practice", element: L(<CharPracticeRoute />) },
      { path: "vocab", element: L(<VocabPracticeRoute />) },
      { path: "sentence", element: L(<SentencePracticeRoute />) },
      { path: "*", element: <ComingSoonPage /> },
    ],
  },
  // v0.32.0: P3 Worlds 独立沙箱 — 跟 /:subject 完全平行，不挂 SubjectShell
  // Ep 爸爸-2026-05-17：每条 element 都用 W() 包成 Suspense，触发 lazy chunk 载入
  { path: "/worlds", element: W(<WorldsHomePage />) },
  { path: "/worlds/baibao", element: W(<BaibaoMapPage />) },
  { path: "/worlds/baibao/store", element: W(<WorldsStorePage />) },
  { path: "/worlds/baibao/bank", element: W(<WorldsBankPage />) },
  { path: "/worlds/baibao/bakery", element: W(<WorldsBakeryPage />) },
  { path: "/worlds/baibao/:buildingId", element: W(<WorldsBuildingStub />) },
  // 星帆岛 (英语世界)
  { path: "/worlds/xingfan", element: W(<XingfanMapPage />) },
  { path: "/worlds/xingfan/airport", element: W(<WorldsAirportPage />) },
  { path: "/worlds/xingfan/:buildingId", element: W(<WorldsBuildingStub />) },
  { path: "/worlds/:worldId", element: W(<WorldLockedPage />) },

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
