/**
 * One-shot perf setup script for ESA site xiaojin.app.
 *
 * Run once after `esa-cli login`. Idempotent: re-running is safe (skips existing).
 *
 * 干 3 件事：
 *   1. UpdateHttpsBasicConfiguration: HTTP/2 on
 *   2. CreateCompressionRule: gzip/brotli/zstd on
 *   3. CreateCacheRule × 6: 静态资源 prefix-based cache (1y for /assets/, 7d for /env/audio/avatars/agent/icon-)
 *      BrowserCacheMode=follow_origin（关键 —— 不要 no_cache 强加 header）
 *
 * 历史：
 *   - v0.34.10 (Ep140): 爸爸反馈 xiaojin.app 比 CF Pages 慢（3min 首次 / 1min 刷新）。
 *     诊断后发现 HTTP/2 off → ALPN 不返 h2 → 客户端走 HTTP/1.1 6 并发瓶颈。
 *     另外 cache rule 默认 BrowserCacheMode=no_cache 把响应头改成 no-cache，
 *     浏览器永远不 cache。修这两个后：3min → 7.7s 首次 / 1min → 1.5s 刷新。
 */
import { esaCall, siteId } from "./_esa-api.mjs";

const SID = siteId();

// 1) HTTP/2 + HTTP/3 + HTTPS
const cfg = await esaCall("GET", "ListHttpsBasicConfigurations", { SiteId: SID });
const httpsConfig = cfg.body.Configs?.[0];
if (httpsConfig) {
  const r = await esaCall("POST", "UpdateHttpsBasicConfiguration", {
    SiteId: SID,
    ConfigId: String(httpsConfig.ConfigId),
    Http2: "on",
    Http3: "on",
    Https: "on",
    Tls12: "on",
    Tls13: "on",
  });
  console.log("[perf] HTTP/2 enable:", r.status, r.body.Code ?? "ok");
}

// 2) Compression
const existingComp = await esaCall("GET", "ListCompressionRules", { SiteId: SID });
if ((existingComp.body.TotalCount ?? 0) === 0) {
  const r = await esaCall("POST", "CreateCompressionRule", {
    SiteId: SID,
    Gzip: "on",
    Brotli: "on",
    Zstd: "on",
  });
  console.log("[perf] CreateCompressionRule:", r.status, r.body.Code ?? "ok");
} else {
  console.log("[perf] compression already configured");
}

// 3) Cache rules (prefix-based — basic plan 不支持 regex)
const PREFIXES = [
  ["vite_hashed_assets_1y", "/assets/", "31536000"],
  ["env_scenes_7d",         "/env/",    "604800"],
  ["audio_7d",              "/audio/",  "604800"],
  ["avatars_7d",            "/avatars/", "604800"],
  ["agent_7d",              "/agent/",   "604800"],
  ["icons_7d",              "/icon-",    "604800"],
];

const existing = await esaCall("GET", "ListCacheRules", { SiteId: SID });
const existingByName = new Map(
  (existing.body.Configs ?? []).map((c) => [c.RuleName, c.ConfigId]),
);

for (let i = 0; i < PREFIXES.length; i++) {
  const [name, prefix, ttl] = PREFIXES[i];
  const rule = `(starts_with(http.request.uri.path, "${prefix}"))`;
  const params = {
    SiteId: SID,
    RuleName: name,
    RuleEnable: "on",
    Rule: rule,
    EdgeCacheMode: "follow_origin",
    EdgeCacheTtl: ttl,
    BrowserCacheMode: "follow_origin",     // KEY: don't override Cache-Control header
    BrowserCacheTtl: ttl,
    QueryStringMode: "ignore_all",
    Sequence: String(i + 1),
  };
  const existingId = existingByName.get(name);
  if (existingId) {
    const r = await esaCall("POST", "UpdateCacheRule", { ...params, ConfigId: String(existingId) });
    console.log(`[perf] update ${name}:`, r.status, r.body.Code ?? "ok");
  } else {
    const r = await esaCall("POST", "CreateCacheRule", params);
    console.log(`[perf] create ${name}:`, r.status, r.body.Code ?? "ok");
  }
}

console.log("\n✓ ESA perf config applied. Verify: curl -sI --http2 https://xiaojin.app/ | head -5");
