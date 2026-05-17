# Admin UI 设计指南

爸爸 2026-05-17 决定：所有 super-admin 界面 (`admin.xiaojin.app/super-admin` 及后续 admin 子页)
设计原则参考 **x.ai** 的 DESIGN.md，文件存在 [`admin-design.md`](./admin-design.md)。

来源：[voltagent/awesome-design-md](https://github.com/voltagent/awesome-design-md)
（commit 时是 `design-md/x.ai/DESIGN.md`）

## 为什么选 x.ai —— 跟产品叙事一致

爸爸的判断：
> "我们未来推的也是学好后去探索太空，然后太空舱感觉就很好"

x.ai 的 design 美学叫 **"engineered-cosmic"** —— 工程化的、宇宙感的：
- 严格的近黑 canvas（深空背景）
- 白色 pill 轮廓（飞船舱口 / HUD 元素感）
- 暮色 / 黄昏渐变（accent-sunset / dusk / twilight / breeze / midnight）
- Universal Sans 几何 sans display + 大写 tracked mono caption

跟我们产品故事完美呼应：Selena → 学习数学/语文/英语 → 解锁星帆岛 → 探索 atelier 沙盒 →
未来推太空主题。super-admin 是给"舰长"（爸爸 + 未来其他家长）的太空舱控制台。

## 关键设计 token

### Canvas 三层
```
canvas       #0a0a0a   — 页面底层（深空）
canvas-soft  #1a1c20   — 卡 / panel
canvas-card  #191919   — 卡上的卡
hairline     #212327   — 1px 描边（飞船面板接缝）
```

### Accent 暮色系
```
accent-sunset    #ff7a17   — 夕阳橙（最显眼，主 CTA / hover）
accent-sunset-soft #ffc285 — 浅暮色
accent-dusk      #7c3aed   — 黄昏紫
accent-twilight  #c4b5fd   — 暮霭紫
accent-breeze    #a0c3ec   — 黎明蓝
accent-midnight  #0d1726   — 深夜蓝
```

x.ai 的暮色系比 Linear 的单 violet 更丰富，但仍**克制**：用 **sunset 橙** 当主 CTA，
其他 dusk/twilight/breeze 给次要状态用，midnight 给深层 panel。

### Typography
- **display**：96px → 32px 5 档，Universal Sans / Inter 兜底，**字距 -2.4px → -0.6px 紧凑**
- **body**：白色 / dim (#dadbdf) / muted (#7d8187) 3 档
- **mono caption**：UPPERCASE + tracked，给 ID / etag / 数据值用（呼应"工程仪表"感）

字体 fallback：`Inter, system-ui, -apple-system, "PingFang SC", sans-serif`（无 Universal Sans 私有字体）

### Pill / 圆角
- `pill: 9999px` —— 主按钮全是白色 pill 轮廓 (button-outline)，没有填色按钮
- 卡圆角 8-16px

## 落地原则（写 admin 代码时遵守）

### 1. Canvas 分层（不用渐变背景）
```tsx
<div className="bg-[#0a0a0a]">           {/* canvas */}
  <div className="bg-[#1a1c20] rounded-xl border border-[#212327]">  {/* card */}
    <div className="bg-[#191919]">       {/* card-in-card */}
```

### 2. 主按钮：白 pill 轮廓 + sunset 填色二选一
```tsx
{/* 主 CTA: 暮橙填充 */}
<button className="rounded-full bg-[#ff7a17] hover:bg-[#ffc285] text-[#0a0a0a] px-4 py-2 font-medium">
  确认
</button>

{/* 次要: 白 pill 轮廓 */}
<button className="rounded-full border border-white/30 hover:border-white text-white px-4 py-2">
  取消
</button>
```

### 3. 语义色仍专用（不当 brand）
- `rose-300/400` → error
- `amber-300/400` → warn
- `emerald-300/400` → success
- **brand accent 只用暮色系** (sunset / dusk / twilight / breeze)

### 4. Mono 字段
- userId、reportId、taskId、guardianPhone、etag、timestamp → `font-mono uppercase tracking-wider text-[#7d8187]`

### 5. anti-pattern（**当前 admin 已经犯的**，重构 ep 改）
- ❌ `bg-gradient-to-r from-sky-500/20 to-violet-500/20` —— x.ai 不用渐变背景，改 hairline 卡
- ❌ 4 色按钮（emerald/violet/amber/sky）—— 收敛到 **sunset (主) + 白 pill 轮廓 (次)**
- ❌ `shadow-glow-violet` 厚阴影 —— 用 1px hairline `border-[#212327]` 替代
- ❌ Emoji 当 brand 主导（🛠 🤖 📊）—— 当 hint 可以，header 改成简洁 wordmark

## 适用范围

| 界面 | 设计准则 |
|---|---|
| `admin.xiaojin.app/super-admin` | ✅ 严格 x.ai engineered-cosmic |
| `admin.xiaojin.app/*` (未来新增) | ✅ 一来就 x.ai |
| **学生界面 (selena.xiaojin.app)** | ❌ **保留现有可爱风格**（紫粉渐变 / kawaii / 大量 emoji）—— 太空感不适合 10 岁鼓励性 UI |
| 家长 view (`/math/parent` 等) | ⚠️ 介于两者，待定（可能用 x.ai 的浅色变体或 Linear） |

## 后续 ep 重构 super-admin 时清单

1. 全局背景 `app-bg` → `bg-[#0a0a0a]`
2. 卡 `card-glow` → `bg-[#1a1c20] border border-[#212327] rounded-xl`
3. 按钮收敛：主按钮 sunset 橙填充，次按钮白 pill 轮廓
4. 去 `bg-gradient-to-r` 全部，改 hairline
5. Mono 字段：userId/etag/phone 用 `font-mono uppercase tracking-wider`
6. Typography scale 对齐 5 档 display + 4 档 body
7. emoji header → 文字 wordmark（"COMMAND CONSOLE" / "FLEET STATUS" 之类太空舱风）

## 视觉参考

主页：https://x.ai —— 看实际渲染感（near-black + 偶尔的橙色 hover + 严格白 pill）

可对照 x.ai blog 文章 / "About" 页拿 admin 重构灵感。
