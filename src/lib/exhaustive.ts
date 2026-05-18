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

/**
 * v0.35.36 (Gemini peer review HOTFIX): "soft" 版本.
 *
 * TS 仍要求 x 类型为 never (= 编译时 exhaustive 一样 enforce),
 * 但运行时不 throw, 而是返回 fallback 值 + console.error.
 *
 * 用于 render path 不能崩的地方: pickPanel / templateTitle 等. 不然 IDB
 * cache 里有 unknown templateId → render throw → React 整树 unmount → 白屏.
 *
 * 用法:
 *   default: return exhaustiveOr(x, PlainNumericPanel, `pickPanel missing: ${x}`);
 *
 * 比单纯 default fallthrough 强: TS 仍抓"加 union member 忘加 case".
 */
export function exhaustiveOr<T>(x: never, fallback: T, msg?: string): T {
  // eslint-disable-next-line no-console
  console.error(`[exhaustiveOr] ${msg ?? "unreachable"}: got ${String(x)} — falling back`);
  return fallback;
}
