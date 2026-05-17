import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, host: true, strictPort: true },
  // v0.31.99：footer 版本号从 package.json 自动注入，避免每次升版手忘
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    /**
     * Ep 爸爸-2026-05-17：默认 vite 会在每个页面 <link rel="modulepreload">
     * 所有 dynamic-import 出去的 chunk —— 把 worlds chunk 在主页也预拉了，
     * 抵消了 lazy 的省流量收益。这里 filter 掉 worlds-*.js，只有真进
     * /worlds/* 的 React.lazy 触发时才拉。
     */
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((d) => !/worlds-[A-Za-z0-9]+\.js$/.test(d)),
    },
    rollupOptions: {
      output: {
        /**
         * Ep 爸爸-2026-05-17：把 /worlds/* 真实世界应用游戏（还在 WIP）
         * 拆到独立 chunk `worlds-{hash}.js`，让我们改 worlds 不会更新主
         * bundle 的 hash —— 用户刷新只下载这一个文件，主页 / train / settings
         * 等已缓存的资源保持复用。
         *
         * 涵盖：pages/worlds/* + components/worlds/* + lib/worlds/* + content/worlds/*
         * 所有依赖都进同一 chunk，不会因为 9 个 lazy() 拆出 9 个文件。
         *
         * 副产物：Three.js 等只 worlds 用的大库会跟着自然落到 worlds chunk，
         * 主 bundle 进一步瘦身（atelier/town/paradise 等其它 3D 场景如果共享
         * 同库会被 vite 自动提到 shared-vendor 节点，不会破）。
         */
        manualChunks(id: string) {
          if (
            id.includes("/src/pages/worlds/") ||
            id.includes("/src/components/worlds/") ||
            id.includes("/src/lib/worlds/") ||
            id.includes("/src/content/worlds/")
          ) {
            return "worlds";
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
