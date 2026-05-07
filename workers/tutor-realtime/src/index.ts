/**
 * Cloudflare Worker：dashscope realtime WebSocket 代理。
 *
 * 浏览器连过来 → 鉴权（APP_PASSWORD）→ Worker 用 DASHSCOPE_API_KEY 连
 * dashscope-intl 的 realtime endpoint → 双向 pipe。
 *
 * 鉴权方式（顺序尝试）：
 *  1. Subprotocol: ['bearer', '<password>']  （首选，不进 URL/日志）
 *  2. ?pwd=<password>  （兜底；用于无法设 subprotocol 的环境）
 *
 * Query 参数：
 *  - model: dashscope realtime model id；默认 qwen3.5-omni-flash-realtime
 *
 * 健康检查：GET /health → {ok:true}
 *
 * 错误码：
 *  - 426 Upgrade Required: 不是 WebSocket 请求
 *  - 401 Unauthorized: 密码不对 / 缺 token
 *  - 503: DASHSCOPE_API_KEY 未配
 *  - 502: dashscope upstream 握手失败
 */

interface Env {
  APP_PASSWORD?: string;
  DASHSCOPE_API_KEY?: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Sec-WebSocket-Protocol",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/** 从 Sec-WebSocket-Protocol 里抽出 bearer token，兼容 ?pwd= */
function extractToken(request: Request, url: URL): { token: string | null; echoProtocol: string | null } {
  const protocols = request.headers.get("sec-websocket-protocol");
  if (protocols) {
    const parts = protocols.split(",").map((s) => s.trim()).filter(Boolean);
    const idx = parts.findIndex((p) => p.toLowerCase() === "bearer");
    if (idx >= 0 && parts[idx + 1]) {
      // echo 第一个 protocol 回去，否则浏览器不接 101
      return { token: parts[idx + 1]!, echoProtocol: parts[0]! };
    }
  }
  const pwd = url.searchParams.get("pwd");
  if (pwd) return { token: pwd, echoProtocol: null };
  return { token: null, echoProtocol: null };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (url.pathname === "/health" || url.pathname === "/healthz") {
      return jsonResponse({ ok: true, hasKey: !!env.DASHSCOPE_API_KEY });
    }

    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response(
        "Expected websocket upgrade. Set Sec-WebSocket-Protocol: 'bearer, <APP_PASSWORD>' or use ?pwd=<APP_PASSWORD>.",
        { status: 426, headers: CORS_HEADERS },
      );
    }

    // 鉴权
    const { token, echoProtocol } = extractToken(request, url);
    if (env.APP_PASSWORD && token !== env.APP_PASSWORD) {
      return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
    }
    if (!env.DASHSCOPE_API_KEY) {
      return new Response("DASHSCOPE_API_KEY not configured", { status: 503, headers: CORS_HEADERS });
    }

    const model = url.searchParams.get("model") || "qwen3.5-omni-flash-realtime";

    // 出方向：用 fetch + Upgrade:websocket 连 dashscope realtime endpoint
    const upstreamUrl = `https://dashscope-intl.aliyuncs.com/api-ws/v1/realtime?model=${encodeURIComponent(model)}`;
    let upstreamResp: Response;
    try {
      upstreamResp = await fetch(upstreamUrl, {
        headers: {
          Upgrade: "websocket",
          Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
        },
      });
    } catch (e) {
      return new Response(`Upstream connect failed: ${(e as Error).message}`, {
        status: 502,
        headers: CORS_HEADERS,
      });
    }
    if (upstreamResp.status !== 101 || !upstreamResp.webSocket) {
      const text = await upstreamResp.text().catch(() => "");
      return new Response(
        `Upstream WS handshake failed: status=${upstreamResp.status} body=${text.slice(0, 200)}`,
        { status: 502, headers: CORS_HEADERS },
      );
    }
    const upstream = upstreamResp.webSocket;
    upstream.accept();

    // 入方向：browser-facing pair
    const pair = new WebSocketPair();
    const browser = pair[1]!;
    browser.accept();

    // 双向 pipe — 任意 binary/text 都透传
    const pipeBrowserToUpstream = (data: ArrayBuffer | string) => {
      try {
        if (upstream.readyState === 1 /* OPEN */) upstream.send(data as never);
      } catch {
        /* ignore */
      }
    };
    const pipeUpstreamToBrowser = (data: ArrayBuffer | string) => {
      try {
        if (browser.readyState === 1 /* OPEN */) browser.send(data as never);
      } catch {
        /* ignore */
      }
    };

    browser.addEventListener("message", (e) => pipeBrowserToUpstream(e.data));
    upstream.addEventListener("message", (e) => pipeUpstreamToBrowser(e.data));

    const closeBoth = (code = 1000, reason = "") => {
      // WebSocket close codes 必须在 1000-4999 范围；非法码会抛
      const safeCode = code >= 1000 && code <= 4999 ? code : 1011;
      try { browser.close(safeCode, reason); } catch { /* */ }
      try { upstream.close(safeCode, reason); } catch { /* */ }
    };
    browser.addEventListener("close", (e) => closeBoth(e.code, e.reason));
    upstream.addEventListener("close", (e) => closeBoth(e.code, e.reason));
    browser.addEventListener("error", () => closeBoth(1011, "browser_error"));
    upstream.addEventListener("error", () => closeBoth(1011, "upstream_error"));

    const headers: Record<string, string> = {};
    if (echoProtocol) headers["Sec-WebSocket-Protocol"] = echoProtocol;

    return new Response(null, {
      status: 101,
      webSocket: pair[0],
      headers,
    });
  },
};
