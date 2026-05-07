/**
 * Cloudflare Workers 最小类型 stub（只列我们用到的部分）。
 * 想要完整类型可装 @cloudflare/workers-types；这里手写避免引依赖。
 */

interface CFWebSocket extends WebSocket {
  accept(): void;
}

interface WebSocketPair {
  0: CFWebSocket;
  1: CFWebSocket;
}

interface WebSocketPairConstructor {
  new (): { 0: CFWebSocket; 1: CFWebSocket };
}

declare const WebSocketPair: WebSocketPairConstructor;

interface ResponseInit {
  webSocket?: CFWebSocket;
}

interface Response {
  readonly webSocket?: CFWebSocket;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

declare module "*.ts" {
  // 让 wrangler 的 main 路径解析不报
}
