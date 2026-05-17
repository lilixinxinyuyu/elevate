/**
 * Silence known browser-extension console noise (v0.34.71 iter 5).
 *
 * 爸爸看到 "Uncaught (in promise) Error: A listener indicated an asynchronous
 * response by returning true, but the message channel closed before a response
 * was received" 担心是 app 挂了. 实际是浏览器 **扩展**注入 content script 调
 * chrome.runtime.onMessage.addListener 并 `return true` 声明"我会异步答", 但
 * 扩展自己提前关闭 message channel → Chrome 把 unhandled rejection 抛到 page
 * scope. 完全跟我们 app 无关 (我们 grep 整个 src/ 没有任何 chrome.runtime 调用).
 *
 * 该装这个 silencer 因为:
 * 1. 老师演示时 console 出现 scary "Uncaught" 红字 → 显得 app 不稳定
 * 2. 真的 Promise rejection (我们的) 仍要打出来 — 只屏蔽已知 extension pattern
 * 3. 不能 preventDefault() 别人的 error, 但可以拦 stopImmediatePropagation 后
 *    重写 reason 让 console 不那么吓人 — 实际上更简单: 直接 preventDefault()
 *    避免它进 unhandled list.
 *
 * 装在 main.tsx 顶部, 越早越好 (赶在 extension content script 触发前注册).
 */

const KNOWN_EXTENSION_NOISE = [
  /A listener indicated an asynchronous response by returning true, but the message channel closed/,
  // 其他扩展常见 noise (留 hook 给未来加):
  // /chrome\.runtime\.lastError/,
  // /The message port closed before a response was received/,
];

function isExtensionNoise(reason: unknown): boolean {
  if (!reason) return false;
  const msg =
    typeof reason === "string"
      ? reason
      : reason instanceof Error
        ? reason.message ?? ""
        : typeof (reason as { message?: unknown }).message === "string"
          ? (reason as { message: string }).message
          : "";
  if (!msg) return false;
  return KNOWN_EXTENSION_NOISE.some((re) => re.test(msg));
}

export function installExtensionNoiseSilencer(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("unhandledrejection", (ev) => {
    if (isExtensionNoise(ev.reason)) {
      // 阻止 Chrome 抛 scary "Uncaught (in promise)" 红字
      ev.preventDefault();
      // 仍然记一条 debug log, 方便我们排查时知道扩展在搞什么
      console.debug(
        "[silenceExtensionNoise] suppressed extension chrome.runtime async-response error",
      );
    }
  });
  window.addEventListener("error", (ev) => {
    if (isExtensionNoise(ev.message)) {
      ev.preventDefault();
    }
  });
}
