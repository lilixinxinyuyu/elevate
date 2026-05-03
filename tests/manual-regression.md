# 多学科架构 v0.18.0 手测清单

每次部署到 selena-elevate.pages.dev 后跑一遍。Selena 升级前先把云同步推一份保底。

## 1. 路由 / 学科切换

- [ ] 干净 localStorage（隐身窗）打开 `/` → 看到学科选择页（数学卡 + 语文卡）
- [ ] 数学卡片显示 "和平街小学四年级 · 期中冲刺"，紫粉渐变 SE 头
- [ ] 语文卡片显示 "🛠️ 期中后开放（5月7日）" + "还有 X 天"
- [ ] 点击数学卡 → `/math` → 看到首页（XP / 段位 / 今日卡）
- [ ] 顶部 logo 是紫粉渐变 "数"，标题"Selena's Elevate · 数学 · 本地版"
- [ ] Header 右上的圆形"数 ▾" chip 点开 → 弹出"数学✓ / 语文 / 切换学科 →"
- [ ] 点击 chip 里的"语文" → `/chinese` → 看到"建设中"页 + 倒计时 + 回数学按钮
- [ ] ComingSoon 页"切换学科"按钮 → 回到 `/`
- [ ] 在 `/` 顶部应该有"继续上次：数学 →"快捷按钮（前提：你刚刚进过数学）

## 2. 老路径兜底（PWA 兼容）

- [ ] 直接打 `/train` → 应自动跳到 `/math/train`
- [ ] 直接打 `/picker` → 应自动跳到 `/math/free-practice`
- [ ] 直接打 `/skills` → 应自动跳到 `/math/skills`
- [ ] 直接打 `/mistakes` → 应自动跳到 `/math/mistakes`
- [ ] 直接打 `/admin` → 应自动跳到 `/math/admin`

## 3. 数学功能零回归（最关键）

- [ ] `/math` 首页 XP / 段位数字与升级前一致
- [ ] 学期切换 上册/下册 → rating 数字按学期切换
- [ ] `/math/train` 跑 3 道题 → 完成 → summary 显示正常（XP / 准确率 / 综合分变化）
- [ ] `/math/free-practice` 选 1-2 个技能 → 开始训练 → 进 `/math/train?...`
- [ ] 错题进入 `/math/mistakes` → 点"开始复活" → 进入复习模式
- [ ] `/math/skills` 显示完整技能地图，单击"练"按钮 → 进 `/math/train?skillId=...`
- [ ] `/math/admin` → "TTS 测试"卡片显示"⚠ DASHSCOPE_API_KEY 没配"（除非你已经配了）
- [ ] `/math/admin` → "云同步"按钮 → 推送 / 拉取一切正常
- [ ] 浏览器 devtools Application → IndexedDB → heping-math-trainer →
      attempts / mastery / mistakes 行的 `subjectId` 字段全是 "math"
- [ ] meta 表里 key 形态：`totalXp::math::default-student`，
      `selectedTerm::math::default-student`，`mockExamLastAt::math::default-student`
      等都已加 ::math:: 段；存在新 key `selectedSubject::default-student = "math"`

## 4. TTS 管道（生产 env 配好 DASHSCOPE_API_KEY 后再勾）

- [ ] `/math/admin` "TTS 测试"卡片状态显示"✓ 已配置 Qwen TTS"
- [ ] 输入"你好，我是小晴。" → 点 ▶ 播放 → 听到 Qwen 童声朗读
- [ ] 同一文本第二次点播放 → 缓存命中（可观察 Network tab 不再有 /api/tts/generate 请求）
- [ ] 改成超长文本（>500 字）→ 播放报 `tts_text_too_long_400`
- [ ] 服务端没配 KEY 时 → 按钮禁用，显示"⚠ DASHSCOPE_API_KEY 没配"

## 5. 数据迁移（升级时）

升级前在浏览器控制台抓基线（在原 v0.17.0 上）：

```js
const db = await indexedDB.open("heping-math-trainer", 1);
// 或通过 dexie-react-hooks: 在 /admin 控制台
const before = {
  attempts: await window.__db.attempts.count(),
  totalXp: (await window.__db.meta.get("totalXp::default-student"))?.value,
  rating: (await window.__db.meta.get("rating::default-student::G4B"))?.value,
};
console.log("BEFORE", before);
```

升级（部署 v0.18.0 + reload）后：

- [ ] `attempts` 总数没变
- [ ] `totalXp::math::default-student` 等于升级前的 `totalXp::default-student`
- [ ] `rating::math::default-student::G4B` 等于升级前的 `rating::default-student::G4B`
- [ ] 升级前的旧 key（不带 `::math::`）应该不存在了

## 6. Cloudflare Pages 部署清单

- [ ] 推 commit；CF Pages 自动构建成功
- [ ] CF Pages → Settings → Environment variables 已配 `DASHSCOPE_API_KEY`
- [ ] 生产 selena-elevate.pages.dev 复跑第 1-4 节关键项（首页 / 切换 / 跑题 / TTS）
