# Admin UI 设计指南

爸爸 2026-05-17 决定：所有 super-admin 界面 (`admin.xiaojin.app/super-admin` 及后续 admin 子页)
设计原则参考 **linear.app** 的 DESIGN.md，文件存在 [`admin-design.md`](./admin-design.md)。

来源：[voltagent/awesome-design-md](https://github.com/voltagent/awesome-design-md)
（commit 时是 `design-md/linear.app/DESIGN.md`）

## 为什么选 linear

Linear 是已知最强的 data-dense + dark + technical UI 的标杆。我们 admin 的现实需求
（多列同学表 + 操作 chips + modal 表单 + 行内 KPI）跟 Linear 几乎一比一。

| 我们当前 admin | Linear 对应 |
|---|---|
| `bg-slate-900` 深色 canvas | `canvas: "#010102"` 近黑 |
| violet accent chips | `primary: "#5e6ad2"` 单一 lavender accent |
| 行内 KPI 信息密度 | "dense, technical, quietly luxurious" |
| modal 表单 | charcoal panels + hairline borders |
| emerald/amber/sky 多色按钮 | Linear 用 single accent — **未来 admin 重构时统一收敛** |

## 落地原则（写 admin 代码时遵守）

### 1. Canvas / Surface 层级
```
canvas (#010102)         — 页面最底层
surface-1 (#0f1011)      — 卡 / panel
surface-2 (#141516)      — 卡上的卡 / nested
surface-3 (#18191a)      — 高亮区
hairline (#23252a)       — 1px 描边，不用 box-shadow 强投影
```

### 2. Typography
- **Display**: 大标题用大尺寸 / 负字距 / 500-700 字重
- **Body**: 16px 默认 / 14px 紧凑 / 12px caption
- **Mono**: 给 ID / etag / 数据值用（监护人手机号、userId、taskId）
- 字体 fallback: `system-ui, -apple-system, "PingFang SC", sans-serif`（无 Linear 私有字体）

### 3. Color 系统
- **只一个 chromatic accent**：决定一个 → violet 或 sky，**别再混 emerald/amber/sky/violet**
- **语义色专用**：rose=error / amber=warn / emerald=success — 不用作 brand
- ink 文字三档：默认 → muted → subtle
- 不要无意义的渐变背景

### 4. 圆角
```
xs: 4px   sm: 6px   md: 8px   lg: 12px   xl: 16px
pill: 9999px  (按钮、chip)
```

### 5. 间距
（Linear 用 8px 基准）`p-2/3/4/6/8` 对应 8/12/16/24/32px

### 6. 关键 anti-pattern（我们当前 admin 已经犯的）
- ❌ 4 色按钮（emerald/violet/amber/sky）—— 改成单色 accent + 灰
- ❌ `bg-gradient-to-r` 渐变 —— Linear 不用，太"消费品"
- ❌ 厚阴影 `shadow-glow-violet` —— Linear 用 1px hairline 替代
- ❌ Emoji 当主导视觉（🛠 🤖 📊）—— 当 hint 可以，别当 brand

## 适用范围

| 界面 | 适用 |
|---|---|
| `admin.xiaojin.app/super-admin` | ✅ 严格遵守 |
| `admin.xiaojin.app/*` (未来) | ✅ 严格遵守 |
| 学生界面 (selena.xiaojin.app, etc.) | ❌ 保留现有可爱风格（紫粉渐变、Selena's Elevate）|
| 家长 view (`/math/parent` 等) | ⚠️ 介于两者之间，待定 |

## 后续 ep 重构 super-admin 时

1. 替换多色按钮 → 单一 violet primary + slate secondary
2. 去 gradient → 纯色 surface
3. 加 hairline border 替代 shadow
4. Typography scale 收紧到 Linear 8 档
5. 行高 / 字距按 Linear 表对齐

实际改动放进 **未来某个 admin 重构 ep**，不阻塞当前迁移工作。
