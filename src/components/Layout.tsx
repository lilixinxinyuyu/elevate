import { NavLink, Outlet } from "react-router-dom";

const items = [
  { to: "/", label: "首页", exact: true },
  { to: "/train", label: "今日挑战" },
  { to: "/picker", label: "自由练" },
  { to: "/skills", label: "技能地图" },
  { to: "/mistakes", label: "错题复活" },
  { to: "/admin", label: "管理", subtle: true },
];

export function Layout() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-20 bg-ink-900/80 border-b border-ink-700/70 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 text-white flex items-center justify-center font-display font-bold shadow-glow">
              SE
            </div>
            <div>
              <div className="font-display font-bold text-brand text-lg leading-none">Selena's Elevate</div>
              <div className="text-[10px] text-slate-400">数学挑战 · 本地版</div>
            </div>
          </NavLink>
          <nav className="hidden sm:flex gap-1 text-sm">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.exact}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg ${
                    isActive
                      ? "bg-violet-500/20 text-violet-200 border border-violet-400/30"
                      : it.subtle
                        ? "text-slate-500 hover:text-slate-200"
                        : "text-slate-300 hover:bg-white/5"
                  }`
                }
              >
                {it.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
      {/* mobile bottom nav */}
      <nav className="sm:hidden sticky bottom-0 z-20 bg-ink-900/90 border-t border-ink-700/70 backdrop-blur-md">
        <div className="grid grid-cols-5 text-xs">
          {items.filter((i) => !i.subtle).map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.exact}
              className={({ isActive }) =>
                `py-3 text-center ${isActive ? "text-violet-300" : "text-slate-400"}`
              }
            >
              {it.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <footer className="text-[11px] text-slate-500 text-center py-3">本地优先 · v0.2</footer>
    </div>
  );
}
