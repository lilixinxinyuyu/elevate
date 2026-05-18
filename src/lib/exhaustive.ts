/**
 * v0.35.34 Refactor Priority 2.5: TS exhaustive switch helper.
 *
 * 用法:
 *   switch (x.kind) {
 *     case "a": return foo;
 *     case "b": return bar;
 *     default: return assertUnreachable(x.kind, `bad kind: ${x.kind}`);
 *   }
 *
 * 如果 union 加了新 member 没在 switch 加 case, TS 编译时 default 分支
 * 会拿到 non-never 类型 → assertUnreachable 参数类型不匹配 → compile error.
 *
 * 比 default fallthrough "默默用 PlainNumeric / 返回 '挑战'" 安全 N 倍.
 *
 * v0.35.33 之前 templateTitle 漏了 balance_lab / plain_numeric / dot_grid_draw
 * 3 个 GameTemplate 没加 case → 显示 "挑战" 默认值, 用户看到错误标题没人发现.
 * 这个 helper 让 TS 帮我们抓.
 */
export function assertUnreachable(x: never, msg?: string): never {
  throw new Error(msg ?? `unreachable: got ${String(x)}`);
}
