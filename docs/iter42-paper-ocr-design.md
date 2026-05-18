# Iter 42 P2-3 试卷 OCR 设计稿 (送预审)

> Selena 43% master plan P2-3 (master plan 最后一个 P2). 爸爸 / 老师上传真试卷照片 → 后台 OCR 提取题目 + 学生答案 → 自动判错 + 错题转同型练习推到 Selena 个性化队列.
>
> **基础设施已有**: 现有 SuperAdmin 有 textbook upload pipeline (DashScope qwen-vl-max), aliyun-deploy/scripts 有 _copy-trophy-images-to-cadet.mjs OSS 操作 — 可以复用模式.

## 目标

让爸爸把 Selena 真的考试卷拍照上传, 系统自动:
1. **OCR** 读出题目 + Selena 答案
2. **比对**: 跟正确答案对照, 找出错题
3. **同型生成**: 每个错题用现有 `requestRetryQuestion` infrastructure 生成 2-3 道同型变式
4. **推个性化队列**: 加进 Selena 的 mistakes / 强化挑战池

这是把"线下真试卷"跟"app 训练"的核心闭环.

## 范围 (v1)

最小 MVP:
1. SuperAdmin 加上传 UI: 拍照 / 选文件 → 上传 OSS
2. 后端 OCR (复用现有 textbook upload pattern)
3. OCR 输出 structured JSON: `{ questions: [{ stem, correctAnswer, studentAnswer, isWrong }], paperMeta: {} }`
4. Admin UI 显示 OCR 结果, 让 admin 确认 / 修正 (人 in the loop)
5. 确认后, "推送到 Selena 错题侦探队列" 按钮 → 错题变成 mistake_hunt 题源 / strengthen 候选

## 非范围 (v2 defer)
- 自动同型 AI 生成 (现有手动 retry 已可)
- 题目自动入题库做永久教材
- 多 cadet 试卷批处理
- 直接进 Selena UI (现在只走 admin 确认 → 推送)

## UI

### Admin 上传页 (新 /super-admin/paper-upload)
```
📝 试卷上传

[ 选文件 (jpg/png/pdf) ] [ 上传 ]
                          ↓ 上传中... ⌛
                          ↓ OCR 中... ⌛ (15-30s)
                          ↓
[ OCR 结果 - 可编辑 JSON ]
{
  "paperMeta": { "subject": "数学", "type": "期末" },
  "questions": [
    {
      "stem": "312 × 47 = ?",
      "correctAnswer": "14664",
      "studentAnswer": "14444",
      "isWrong": true,
      "annotation": "加和漏进位"
    },
    ...
  ]
}

[ 推送 N 道错题到 Selena 个性化队列 ]
[ 重新 OCR ] [ 放弃 ]
```

### 推送后 (没新页面)
错题进入:
- `db.mistakes` (Selena 错题本) — 跟主流答错入 mistake 一样
- 标 `source: "real_paper_<paperId>"` 区分线下来源
- 可选: 立刻推 SuperAdmin "已推送 3 道错题给 Selena" toast

## 实现拆分

### 后端 (aliyun-deploy)
- 新 endpoint `POST /api/super-admin/papers/upload` (multipart, 仿现有 textbook upload)
- 新 endpoint `POST /api/super-admin/papers/:paperId/ocr` (调 DashScope qwen-vl-max)
- 新 endpoint `POST /api/super-admin/papers/:paperId/push-mistakes` (写到 student's mistake queue)
- 持久化: OSS 存 paper 图 + OCR JSON 到 `papers/{cadetUid}/{paperId}.json`

### 前端
- 新 page `src/pages/SuperAdminPaperUpload.tsx`: 上传 + OCR 结果编辑 + 推送
- 新文件 `src/core/paperOcrPolicy.ts`: 类型定义 + 校验

### 现有改造
- `aliyun-deploy/src/routes/super-admin.ts`: 加 3 个 endpoint
- `aliyun-deploy/src/lib/normalizeAiQuestion.ts` 类似的 OCR result 校验
- SuperAdmin 页加 "📝 试卷上传" 入口

## 评估这个 iter 的范围

⚠️ **这是 master plan 最重的一件** — 涉及:
- 后端新 3 endpoint (OCR API 调用)
- DashScope API 集成 (现有 textbook 流程参考)
- OSS 上传
- 前端复杂页 (上传 + OCR 编辑 + 推送)
- E2E test (爸爸真试卷)

**保守 v1 削减**:
- ❌ 不做自动 OCR (太复杂, 留 v2). 改"手动录入" — admin 在 UI 里手敲 paper 题目 + 学生答案
- ✅ 只做"推送错题到 Selena 队列" 这一段, OCR 留架构空位但不真接 LLM
- 这样 v1 是"手动错题录入工具", v2 加 OCR

## 设计决策需要预审验证

1. **MVP 范围**: 完整 OCR pipeline vs 手动录入 + 推送? 我倾向手动录入 (v2 加 OCR)
2. **OCR engine**: DashScope qwen-vl-max 现有 textbook 用过. 经过的话是否需要更精确的 (e.g., 简单文字 vs 数学公式)?
3. **推送形式**: 进 db.mistakes (主流错题本) vs 单独 paper_mistakes 表? 不染主 mastery 数据?
4. **同型生成**: 推送时是否同时调 requestRetryQuestion 生成 2-3 同型? 还是只推原错题?
5. **缺什么 corner case** (paper 模糊 / 多页 / 部分题没答)?
6. **整体 v1: 立即做 / 改后再做 / 不做**?
