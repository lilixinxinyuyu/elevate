/**
 * AudioWorkletProcessor：把麦克风的 Float32 mono PCM 转成 Int16 (PCM16 LE)
 * 块发回主线程。realtime 协议要的是 base64(PCM16)。
 *
 * 输入：AudioContext 的 inputs[0][0] = Float32Array（每次 ~128 samples）
 * 输出：postMessage(int16Buffer) 累计到 ~2400 samples (~100ms @24kHz) 再发，
 *       减少消息频率（main thread 起 100 次/秒消息也 OK，但合并降低开销）。
 */

const FRAME_SAMPLES = 2400; // ~100ms @ 24kHz

class PCM16Encoder extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Int16Array(FRAME_SAMPLES);
    this._cursor = 0;
  }

  /**
   * @param {Float32Array[][]} inputs
   */
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0]) {
      return true;
    }
    const channel = input[0]; // mono — 多声道直接取第一个
    for (let i = 0; i < channel.length; i++) {
      let s = channel[i];
      if (s > 1) s = 1;
      else if (s < -1) s = -1;
      this._buffer[this._cursor++] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
      if (this._cursor >= FRAME_SAMPLES) {
        const chunk = this._buffer.slice(0, this._cursor);
        this.port.postMessage(chunk.buffer, [chunk.buffer]);
        this._buffer = new Int16Array(FRAME_SAMPLES);
        this._cursor = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm16-encoder", PCM16Encoder);
