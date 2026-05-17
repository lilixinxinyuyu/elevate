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
ensureSeeded().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <AuthGate>
        <RouterProvider router={router} />
        <ProfileGate />
      </AuthGate>
    </React.StrictMode>,
  );
});
