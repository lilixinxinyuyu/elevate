请按规范判定下面 {{count}} 道题。

## 批次上下文

- 学科：{{subjectLabel}}
- 范围：{{scopeLabel}}（{{scopeFilter}}）

## 题目（每行一道，JSON 简表）

```json
{{questionsJsonl}}
```

## 输出要求

返回 `{ "judgments": [...] }`，每道题一个 judgment（顺序与输入一致），字段见 system 协议。

⚠️ **必须**对每道题给一个 judgment，不能跳。如果某题信息不够判定，verdict 给 `borderline`、severity 2、reason 写 "信息不全"、issues 空数组。

只输出 JSON，不要解释、不要 markdown 代码块。
