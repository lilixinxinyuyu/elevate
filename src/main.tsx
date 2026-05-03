import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { ensureSeeded } from "./db/seed";
import { AuthGate } from "./components/AuthGate";
import "./index.css";

ensureSeeded().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <AuthGate>
        <RouterProvider router={router} />
      </AuthGate>
    </React.StrictMode>,
  );
});
