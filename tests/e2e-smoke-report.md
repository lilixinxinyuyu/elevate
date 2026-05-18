# E2E smoke report (Selena 43% master plan iter 32-42)

Generated: 2026-05-18T06:23:54.290Z

## 页面 render check

| 序 | 页面 | URL | 状态 | 用时 | 大小 | 检查 |
|---|---|---|---|---|---|---|
| 01-math-home | ❌ error | selena.xiaojin.app/math | —ms | — KB | — |
| 02-mistake-hunt | ✅ ok | math/find-mistakes | 49702ms | 114.0 KB | 错题侦探页 render |
| 03-base-systems | ✅ ok | math/base-systems | 29607ms | 152.4 KB | 进制小课堂主菜单 render (含 10/60 进制节) |
| 04-brainpower-radar | ✅ ok | math/radar | 38363ms | 147.3 KB | 脑力雷达页 render (5 维度) |
| 05-train-home | ✅ ok | math/train | 36514ms | 134.2 KB | Train 页 render |
| 06-mock-report-empty | ✅ ok | math/mock-report?sessionId=nonexistent | 48086ms | 91.3 KB | Mock report empty state 优雅 |
| 07-paper-entry | ✅ ok | math/paper-entry | 48102ms | 143.1 KB | 试卷录入页 render |

## Console errors (2)

- `https://selena.xiaojin.app/math/find-mistakes` → Failed to load resource: the server responded with a status of 401 ()
- `https://admin.xiaojin.app/math/paper-entry` → Failed to load resource: the server responded with a status of 401 ()

## 总结

- ✅ 6 页正常 + check 通过
- ⚠️ 0 页 render OK 但 check 失败 (检查 UI 缺什么)
- ❌ 1 页 navigation 失败
- Console errors: 2
