# Prompts 仓库

所有面向 LLM / 图像模型的 prompt 都写在这个目录的 .md 文件里，**不准散在代码里写硬编码字符串**。

## 结构

```
prompts/
├── questions/
│   ├── system.md            出题任务的 system prompt
│   ├── user-template.md     出题任务的 user prompt 模板（带 {{var}} 占位符）
│   └── game-types/          每种 game_type 一个 schema 片段
│       ├── plain_choice.md
│       ├── cube_view.md
│       ├── balance_lab.md
│       └── ...
├── tutor/
│   ├── text-system.md       /api/tutor/explain 的 system prompt
│   └── voice-system.md      /api/tutor/voice 的 system prompt
├── mascot/
│   └── xiaojin.md           小进吉祥物的图像生成 prompt
├── skill-keywords.json      skill_id → 关键词数组（用于校验 LLM 是否真的按 skill 出题）
└── game-type-by-skill.json  skill_id → 推荐 game_type（决定加载哪个 schema 片段）
```

## 工作流

构建时由 `scripts/build-prompts.mjs` 把这里所有文件嵌入到：

- `functions/_prompts.generated.ts`（Cloudflare Pages Functions 用）
- `src/lib/_prompts.generated.ts`（浏览器端用）

**两个生成文件都被 git 追踪**，部署 `wrangler pages deploy` 不需要再次 build。修改 .md 后跑 `pnpm build` 或 `node scripts/build-prompts.mjs` 重新生成。

## 模板占位符

user-template.md 里用 `{{varName}}` 表示占位，由调用方在运行时替换。常见占位：

- `{{count}}` — 本批要出几道
- `{{subjectId}}` — `math` / `chinese`
- `{{term}}` — `上册` / `下册`
- `{{unitName}}` `{{unitId}}` `{{skillName}}` `{{skillId}}`
- `{{difficulty}}` — 例如 `2-4`
- `{{batchAngle}}` — 本批的"出题角度"种子，避免并发批次重复
- `{{existingStems}}` — 已有题干列表（截断）
- `{{schema}}` — 由 game-types/{name}.md 注入

## 为什么这么搞

1. **可审计**：改 prompt 的 diff 一眼看清，不混在 .ts 里
2. **跨人协作**：非工程师也能改文案
3. **解耦**：换模型只改代码，prompt 不动；换 prompt 只改 md，代码不动
4. **debug 友好**：CI / 日志里直接看到当前用的是哪个 .md 版本
