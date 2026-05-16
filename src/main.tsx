import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { ensureSeeded } from "./db/seed";
import { AuthGate } from "./components/AuthGate";
import { ProfileGate } from "./components/ProfileGate";
import { installDevHelpers } from "./lib/devCleanup";
import "./index.css";

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
