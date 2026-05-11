/**
 * v0.31.106 E2E 测试：模拟 SpeakWordPanel 走 wss → Qwen → 拿到判分。
 *
 * 目标：验证 RealtimeTutor 的 response.text.delta 修复是否真让 Qwen 文字
 * 返回到 assistantTextBuf。
 *
 * 流程：
 * 1. 读 ../.dev.vars 的 APP_PASSWORD
 * 2. WS 连 selena-tutor-realtime Worker（Sec-WebSocket-Protocol bearer auth）
 * 3. 发 session.update（modalities=["text"]，judge prompt for "apple"）
 * 4. 合成 1 秒 PCM16 24kHz mono 声波（模拟 Selena 说"apple"——其实是测试用 dummy
 *    audio，AI 大概率给低分，但能验证整条路）
 * 5. input_audio_buffer.append + commit
 * 6. response.create modalities=["text"]
 * 7. 收集所有事件，特别看是不是 response.text.delta 而非 audio_transcript.delta
 * 8. 等 response.done，打印 assistantTextBuf 内容
 */
import WebSocket from "ws";
import { readFileSync } from "node:fs";

const pwd = readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf8")
  .split("\n")
  .find((l) => l.startsWith("APP_PASSWORD="))
  ?.split("=", 2)[1]
  ?.trim();
if (!pwd) {
  console.error("没拿到 APP_PASSWORD");
  process.exit(1);
}

const url = "wss://selena-tutor-realtime.lilixinxinyuyu.workers.dev/?model=qwen3.5-omni-flash-realtime";
const ws = new WebSocket(url, ["bearer", pwd]);

const events = [];
let assistantTextBuf = "";
let done = false;
let timeout = setTimeout(() => {
  console.error("\n❌ 30s timeout");
  console.error("events seen:", events);
  process.exit(2);
}, 30000);

ws.on("open", () => {
  console.log("✓ WS open");
  // 1. session.update
  ws.send(JSON.stringify({
    type: "session.update",
    session: {
      modalities: ["text"],
      instructions: `你是发音判分老师。目标单词是 "apple"。听完用户录音后严格按这 3 行输出，不要其他话：
转写：<英文>
评分：<0-100 整数>
反馈：<中文一句>`,
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      turn_detection: null,
    },
  }));
});

ws.on("message", (data) => {
  let evt;
  try { evt = JSON.parse(data.toString()); } catch { return; }
  events.push(evt.type);
  if (evt.type === "session.updated") {
    console.log("✓ session.updated");
    // 2. 发 1 秒 PCM16 dummy audio (silence)，24000 samples * 2 bytes = 48000 bytes
    const samples = 24000;
    const buf = Buffer.alloc(samples * 2);
    // 加点低 amplitude 噪声，纯静音可能被服务端拒绝
    for (let i = 0; i < samples; i++) {
      const v = Math.floor(Math.sin(i * 0.02) * 1000); // 低音量正弦
      buf.writeInt16LE(v, i * 2);
    }
    // 分块发，每块 100ms = 4800 samples = 9600 bytes
    const chunkSize = 9600;
    for (let off = 0; off < buf.length; off += chunkSize) {
      ws.send(JSON.stringify({
        type: "input_audio_buffer.append",
        audio: buf.slice(off, off + chunkSize).toString("base64"),
      }));
    }
    console.log("✓ sent 1s PCM16 audio (1000 amplitude sine)");
    // 3. commit + response.create
    ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    ws.send(JSON.stringify({
      type: "response.create",
      response: { modalities: ["text"] },
    }));
  } else if (evt.type === "response.text.delta") {
    const d = evt.delta || "";
    assistantTextBuf += d;
    process.stdout.write(`📝 [text.delta] ${d}`);
  } else if (evt.type === "response.audio_transcript.delta") {
    const d = evt.delta || "";
    process.stdout.write(`🔊 [audio_transcript.delta] ${d}`);
  } else if (evt.type === "response.text.done") {
    console.log("\n✓ response.text.done text=", evt.text);
  } else if (evt.type === "response.done") {
    console.log("\n✓ response.done");
    done = true;
    setTimeout(() => {
      console.log("\n📊 收到事件类型 (去重):", [...new Set(events)]);
      console.log("📝 assistantTextBuf 累计:", JSON.stringify(assistantTextBuf));
      ws.close();
      clearTimeout(timeout);
      process.exit(0);
    }, 200);
  } else if (evt.type === "error") {
    console.error("\n❌ server error:", evt.error);
  } else {
    // 其他事件只 log 类型
    console.log("·", evt.type);
  }
});

ws.on("close", (code, reason) => {
  if (!done) {
    console.error("\n❌ ws closed before done. code=", code, "reason=", reason?.toString());
  }
});

ws.on("error", (e) => {
  console.error("\n❌ ws error:", e.message);
});
