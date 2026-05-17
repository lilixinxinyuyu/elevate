import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { ensureSeeded } from "./db/seed";
import { AuthGate } from "./components/AuthGate";
import { ProfileGate } from "./components/ProfileGate";
import { installDevHelpers } from "./lib/devCleanup";
import { installExtensionNoiseSilencer } from "./lib/silenceExtensionNoise";
import { installOnboardingTrophyListener } from "./lib/onboardingTrophy";
import "./index.css";

// v0.34.71 iter 5: 拦扩展 chrome.runtime 异步 promise rejection 这类 noise,
// 避免老师演示时 console 红字让家长以为 app 挂了.
installExtensionNoiseSilencer();
// v0.34.79 iter 13: 监听 ProfileGate 完成事件 → 颁发 profile_pioneer 勋章
installOnboardingTrophyListener();
installDevHelpers();

// v0.34.87 iter 21 perf: ensureSeeded() 之前 await 阻塞 render — 含 bulkPut 960
// 题, 首次 1-2s 死等. 现在并行: render 立刻, seed 后台跑. AuthGate / SubjectPicker
// 通过 useLiveQuery 自动 reactive — seed 完会自动刷新 (Dexie hooks 设计就是这样).
// 风险: 某些组件首帧拿 0 题会闪一下 "0/X", LiveQuery 触发后重渲染. 可接受.
void ensureSeeded(); // fire-and-forget, 不 await
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthGate>
      <RouterProvider router={router} />
      <ProfileGate />
    </AuthGate>
  </React.StrictMode>,
);
