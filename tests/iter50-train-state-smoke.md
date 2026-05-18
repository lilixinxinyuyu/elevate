# iter 50 Train state smoke (v0.35.21)

Run: 2026-05-18T10:10:29.412Z
Result: 8 PASS / 0 FAIL

## Scenarios

- **✅ A.1 navigate /math/train (no params, default normal mode)** — stem="Selena's Elevate..." index=1/10
- **✅ A.2 first question loaded → capture stem + index** — captured: Selena's Elevate... 1/10
- **✅ A.3 RELOAD page (no fresh) → expect same indexTotal (session persisted)** — same indexTotal = 1/10 (session persisted ✅)
- **✅ B.1 navigate ?fresh=<ts> → expect new session loaded** — fresh session loaded (1/10); URL has fresh ✅
- **✅ C.1 navigate /math/train?mode=mock_exam&size=30 → 30-题 mock** — mock 30 题 OK: 1/30
- **✅ C.2 navigate /math/train?mode=mock_exam&size=60 → 60-题 mock** — mock 60 题 OK: 1/60
- **✅ D.1 mock_exam ?hard=1 → 硬限时 mode (URL preserved)** — hard mode URL preserved: ?mode=mock_exam&fresh=1779099027714&size=30&hard=1
- **✅ E.1 console errors check** — 0 real console errors (0 total filtered)

## Console errors (raw)

_(none)_

## Screenshots

`tests/iter50-screenshots/` 含 A1 / A3 / B1 / C1 / C2 / D1 各场景截图.
