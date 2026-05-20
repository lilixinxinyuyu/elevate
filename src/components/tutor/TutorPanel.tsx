/**
 * AI 老师面板 — 答错题后弹出的"小进姐姐讲题"面板。
 *
 * 设计原则（重要！）：
 *  - 苏格拉底式：第一回合不给答案，问引导问题让 Selena 思考
 *  - 第二/三回合：顺着她的思路追问、给线索
 *  - 必须在多轮里建立思维习惯，而不是灌答案
 *
 * 交互：
 *  1. 文本讲解：进面板自动调 /api/tutor/explain，TTS 朗读
 *  2. 语音对话：按住 🎤 录音，松开发送 → TTS 朗读
 *
 * TTS 防双播：
 *  - audioRef 维护当前正在播的 HTMLAudioElement
 *  - 每次新 speakText 前先 pause 旧的 → 永远只有一个声源
 *  - 准备阶段（请求 TTS bytes）显示 ⏳ + 禁用 🔊 按钮
 *
 * 语音降级：
 *  - 如果第一次 voiceAsk 报 FreeTierOnly / AllocationQuota / model_unavailable
 *    → 标记 voiceUnavailable，隐藏 🎤 按钮 + 显示文字"账号无 omni 权限，先用文字"
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MascotAvatar } from "../MascotAvatar";
// v0.35.44 Refactor Priority 11: localStorage 跨文件 key SSOT
import { STORAGE_KEYS } from "../../config/storage";
import {
  createMicRecorder,
  explainQuestion,
  voiceAsk,
  type MicRecorder,
} from "../../lib/tutor";
import { speakText } from "../../lib/tts";
import { db } from "../../db/dexie";
import type { TutorMessage, TutorSession } from "../../core/types";
import { RealtimeTutor, type RealtimeState } from "../../lib/realtimeTutor";
import {
  bindToolsForStudent,
  currentQuestionToInstructions,
  gatherSnapshot,
  snapshotToInstructions,
} from "../../lib/tutorContext";
import {
  awardMascotXp,
  getEquippedVoice,
  getMascotState,
  talentDisplayName,
  type MascotXpReason,
} from "../../lib/mascotProgress";

const REALTIME_URL =
  (import.meta as unknown as { env: { VITE_REALTIME_URL?: string } }).env.VITE_REALTIME_URL ??
  "wss://selena-tutor-realtime.lilixinxinyuyu.workers.dev";

/** 拼 realtime 模式的 system instructions（snapshot + 上下文 + 已解锁的隐藏技能提示） */
async function buildRealtimeInstructions(
  props: TutorPanelProps,
  unlockedTalents: string[],
): Promise<string> {
  const baseSys = `你是 Selena 的数学老师"小进姐姐"，温柔耐心，普通话。
- 用 60-100 字的简短句，像聊天，不长篇说教
- 苏格拉底式：先问思路、给小线索，不直接报答案
- Selena 9 岁四年级，听不懂大人术语，用具体例子
- 鼓励多于指正

回答策略：
- 如果她问当前在做的具体题：苏格拉底式问思路 → 一个小线索 → 让她自己算。
- 如果她问"我最近怎么样"/"我哪个 skill 最弱"等：用下面的学情快照具体回答，不要说"挺好的"。
- 如果需要更细的数据（"具体哪几道题做错了"等）：调对应 tool 拿数据再答。`;

  // === 隐藏技能 ===
  const talentLines: string[] = [];
  if (unlockedTalents.includes("sing_multiplication")) {
    talentLines.push(
      `- 隐藏技能：你会"唱乘法口诀"。如果她说"唱乘法口诀"/"唱一段"/"唱给我听"等，
        用节奏感的方式真把口诀朗读出来（"二二得四，二三得六…"），
        不要拒绝、不要写谱，就当作 rap 一样读出来。读完问她想接着哪段。`,
    );
  }
  if (unlockedTalents.includes("math_jokes")) {
    talentLines.push(
      `- 隐藏技能：你会"讲数学冷笑话"。她说"讲笑话"/"逗我笑"等，讲一个 9 岁能听懂的数学小笑话。`,
    );
  }
  if (unlockedTalents.includes("birthday_song")) {
    talentLines.push(`- 隐藏技能：生日相关话题时可以唱生日歌。`);
  }
  const talentBlock = talentLines.length > 0 ? `\n\n=== 隐藏技能（已解锁，可主动提）===\n${talentLines.join("\n")}` : "";

  let snapshotText = "";
  let studentId: string | undefined = props.studentId;
  if (!studentId) {
    const students = await db.students.toArray();
    studentId = students[0]?.id;
  }
  if (studentId) {
    try {
      const students = await db.students.toArray();
      const student = students.find((s) => s.id === studentId) ?? students[0];
      if (student) {
        const snap = await gatherSnapshot(student.id, student.name);
        snapshotText = "\n\n" + snapshotToInstructions(snap);
      }
    } catch {
      /* 容错：没 snapshot 就空 */
    }
  }

  const ctx = props.context ?? "wrong_retry";
  let scenarioBlock = "";
  if (props.stem) {
    // 有具体题
    scenarioBlock = "\n\n" + currentQuestionToInstructions({
      stem: props.stem,
      correctAnswer: props.correctAnswer,
      studentAnswer: props.studentAnswer,
      skillName: props.skillName,
    });
  } else if (ctx === "skill_help" && props.skillName) {
    const wrongInfo = props.consecutiveWrong
      ? `连错了 ${props.consecutiveWrong} 次`
      : "最近表现不太稳";
    scenarioBlock = `\n\n=== 现在的场景 ===
Selena 主动找你来了——她在 "${props.skillName}" 这个 knowledge point 上${wrongInfo}。
开口先打招呼 + 问她："你觉得 ${props.skillName} 最难的地方是什么？" 让她说一说。
然后根据她说的，挑一个具体小例子，一起算一遍。
不要一上来就讲解一长段——要交流。`;
  } else if (ctx === "review_session") {
    scenarioBlock = `\n\n=== 现在的场景 ===
Selena 刚做完一组题。先夸夸她坚持下来了，再问"哪道题想再聊聊？"`;
  } else {
    // free_chat
    scenarioBlock = `\n\n=== 现在的场景 ===
Selena 主动来找你聊天。打招呼时自然一点，问她"今天想聊数学的哪部分？" 让她带话题。`;
  }
  return `${baseSys}${talentBlock}${snapshotText}${scenarioBlock}`;
}

interface TutorPanelProps {
  subjectId: "math" | "chinese";
  /** 题目相关 — 没有就是"跟小进闲聊/通用辅导"模式 */
  stem?: string;
  correctAnswer?: string;
  studentAnswer?: string;
  /** skill 相关 — 用于 prompt + 上下文（"她在某某 skill 上连错…"） */
  skillName?: string;
  /** 弹出 panel 的具体场景，让 prompt 知道为什么打开。
   *  - "wrong_retry": Selena 答错后让小进讲题（默认 / 老行为）
   *  - "skill_help": 从 home struggle-skill 区点开（"她在 X skill 上连错 N 次"）
   *  - "review_session": 一组题做完总结
   *  - "free_chat": 没具体 context，纯聊天 */
  context?: "wrong_retry" | "skill_help" | "review_session" | "free_chat";
  /** 当前 Selena 学生 id（用于关联对话日志） */
  studentId?: string;
  /** 触发面板的 attempt id（错题才有） */
  attemptId?: string;
  /** 题目 id */
  questionId?: string;
  /** skill id */
  skillId?: string;
  /** struggle skill 场景：连错次数 */
  consecutiveWrong?: number;
  onClose: () => void;
}

interface ChatMsg {
  role: "assistant" | "user";
  content: string;
  via?: "voice" | "text";
  ts: number;
}

type AudioStatus =
  | { kind: "idle" }
  | { kind: "loading"; messageTs: number }
  | { kind: "playing"; messageTs: number };

/** 错误码里包含这些 = 模型在用户的账号不可用，建议关掉语音模式 */
function isQuotaError(msg: string): boolean {
  return /FreeTierOnly|AllocationQuota|model.+not.+exist|model.+unavailable/i.test(msg);
}

/** tool name → 给孩子看的友好名字（"小进在查最近错题…"）*/
function toolDisplayName(name: string): string {
  switch (name) {
    case "get_recent_mistakes":
      return "你最近的错题";
    case "get_skill_summary":
      return "各个 skill 熟练度";
    case "get_today_progress":
      return "你今天的练习";
    default:
      return name;
  }
}

export function TutorPanel(props: TutorPanelProps) {
  const [conversation, setConversation] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState<"explain" | "voice" | "follow" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followText, setFollowText] = useState("");
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MicRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ===== Phase 1+2+3: realtime 模式 =====
  // 默认用 realtime（连 selena-tutor-realtime Worker → dashscope qwen3.5-omni-flash-realtime）。
  // 失败任意一步（无密码 / WS 握手失败 / 无麦克风权限）都退到老的"文本 explain + push-to-talk voiceAsk"流程。
  const [realtimeMode, setRealtimeMode] = useState(true);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("idle");
  const [realtimeStreamingText, setRealtimeStreamingText] = useState("");
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const realtimeRef = useRef<RealtimeTutor | null>(null);
  // 升级提示：连接后/对话结束后如果新解锁了内容，弹一下
  const [levelUpToast, setLevelUpToast] = useState<{
    title: string;
    detail: string;
  } | null>(null);

  const showLevelUpToast = (
    title: string,
    unlocks?: { voices: string[]; talents: string[]; skins: string[]; unlocks3d: boolean },
  ) => {
    const parts: string[] = [];
    if (unlocks?.voices.length) parts.push(`新音色：${unlocks.voices.join("、")}`);
    if (unlocks?.talents.length)
      parts.push(`隐藏技能：${unlocks.talents.map(talentDisplayName).join("、")}`);
    if (unlocks?.skins.length) parts.push(`Skin：${unlocks.skins.join("、")}`);
    if (unlocks?.unlocks3d) parts.push("3D 形象（实验性）");
    setLevelUpToast({
      title,
      detail: parts.length > 0 ? parts.join("｜") : "继续聊她还会涨更多！",
    });
    setTimeout(() => setLevelUpToast(null), 5000);
  };

  /**
   * 本次面板的对话日志 row id（首次写入 db 时生成，后续每条消息都更新这一行）。
   * 没传 studentId 时不持久化（只有 admin 测试场景）。
   */
  const tutorSessionIdRef = useRef<string | null>(null);

  /**
   * 把当前 conversation 持久化到 db.tutorSessions。upsert 模式：第一次创建 row，
   * 后续更新 messages + updatedAt。失败静默（不影响主流程）。
   *
   * studentId 没传就从 db.students 查（默认 selena 那 1 行）。
   */
  const persistTutorSession = async (msgs: ChatMsg[]) => {
    if (msgs.length === 0) return;
    try {
      let studentId = props.studentId;
      if (!studentId) {
        const students = await db.students.toArray();
        studentId = students[0]?.id;
      }
      if (!studentId) return;
      const now = Date.now();
      let id = tutorSessionIdRef.current;
      if (!id) {
        id = `tutor-${props.attemptId ?? "free"}-${now}-${Math.random().toString(36).slice(2, 8)}`;
        tutorSessionIdRef.current = id;
        const row: TutorSession = {
          id,
          studentId,
          subjectId: props.subjectId,
          attemptId: props.attemptId,
          questionId: props.questionId,
          skillId: props.skillId,
          skillName: props.skillName,
          questionStem: props.stem,
          correctAnswer: props.correctAnswer,
          studentInitialAnswer: props.studentAnswer,
          messages: msgs.map<TutorMessage>((m) => ({
            role: m.role,
            content: m.content,
            via: m.via,
            ts: m.ts,
          })),
          startedAt: now,
          updatedAt: now,
        };
        await db.tutorSessions.put(row);
      } else {
        const existing = await db.tutorSessions.get(id);
        if (existing) {
          existing.messages = msgs.map<TutorMessage>((m) => ({
            role: m.role,
            content: m.content,
            via: m.via,
            ts: m.ts,
          }));
          existing.updatedAt = now;
          await db.tutorSessions.put(existing);
        }
      }
    } catch (e) {
      console.warn("[tutor] persistTutorSession failed", e);
    }
  };

  // TTS 单声源管控
  const [audioStatus, setAudioStatus] = useState<AudioStatus>({ kind: "idle" });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 语音模式可用性（FreeTierOnly 错误后置为 false）
  const [voiceUnavailable, setVoiceUnavailable] = useState(false);
  const [voiceUnavailableReason, setVoiceUnavailableReason] = useState<string | null>(null);

  /**
   * 安全播放：永远只有一个 audio 在响。
   * 来源消息 ts 用于在 UI 上区分 "正在为哪条消息准备/播放语音"。
   */
  const safePlayTts = async (text: string, messageTs: number) => {
    // 1. 停掉旧的
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
    // 2. 标记 loading，禁用 🔊 按钮
    setAudioStatus({ kind: "loading", messageTs });
    try {
      const audio = await speakText(text);
      audioRef.current = audio;
      setAudioStatus({ kind: "playing", messageTs });
      const handleDone = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setAudioStatus({ kind: "idle" });
        }
      };
      audio.addEventListener("ended", handleDone);
      audio.addEventListener("error", handleDone);
      audio.addEventListener("pause", () => {
        // pause 不一定意味着结束（可能是被 safePlayTts 主动 pause 的）
        // 如果还是 current，说明是用户/外部暂停，标记 idle
        if (audioRef.current === audio && audio.currentTime > 0 && audio.ended) {
          handleDone();
        }
      });
    } catch (e) {
      console.warn("[tutor] TTS failed", e);
      setAudioStatus({ kind: "idle" });
    }
  };

  // 进面板：先尝试 realtime；失败就 fall back 到文本 explainQuestion
  useEffect(() => {
    let cancelled = false;
    // v0.31.28: race-mode connect — realtime + 文字 explain 并行起跑，谁先到用谁。
    // realtime 慢于 REALTIME_TIMEOUT_MS 直接放弃，免得 Selena 等 2 分钟。
    // 之前的串行逻辑：先 await snapshot/instructions → await tutor.connect()，任何一步
    // 卡 30s+ 都把整个 panel 锁死。现在 worst-case 用户最多等 ~3s 拿到内容。
    const REALTIME_TIMEOUT_MS = 3500;
    /** 已经决定走哪个模式了？避免 race 双方都激活渲染（重复消息）*/
    let modeDecided: "realtime" | "text" | null = null;

    const renderTextResult = (explanation: string) => {
      if (cancelled || modeDecided === "realtime") return;
      const msg: ChatMsg = { role: "assistant", content: explanation, ts: Date.now() };
      setConversation([msg]);
      void persistTutorSession([msg]);
      void safePlayTts(explanation, msg.ts);
    };

    const fallbackToText = async (reason: string, prefetchedText?: string) => {
      // 任何已 decided 状态都直接 return，保证 fallback 只执行一次
      // （avoid double-render if onError + race rejection 双方都进来）
      if (cancelled || modeDecided !== null) return;
      console.warn("[tutor] falling back to text mode:", reason);
      modeDecided = "text";
      try {
        realtimeRef.current?.close();
      } catch {
        /* */
      }
      realtimeRef.current = null;
      setRealtimeMode(false);
      setError(null);

      // v0.31.91: TutorPanel XP 之前只在 realtime 成功路径触发（line 570+）。
      // 但 realtime 经常 timeout/error → fallback to text → 永远不给 XP。
      // 这是 Bruce "昨天聊了很多但小进没升级" bug 的真原因。
      // 现在 fallback 路径也给 XP（一致的 reason 逻辑）。
      const xpReason: MascotXpReason =
        props.context === "review_session"
          ? "session_review"
          : props.context === "free_chat" || props.context === "skill_help"
            ? "proactive_chat"
            : "session_start";
      void (async () => {
        // 重新查 studentId（fallbackToText 可能在 realtime 路径定义 studentId
        // 之前就被调用，避免 TDZ）
        let sid = props.studentId;
        if (!sid) {
          const ss = await db.students.toArray();
          sid = ss[0]?.id;
        }
        if (!sid) return;
        const r1 = await awardMascotXp(sid, xpReason);
        if (r1.leveledUp && r1.newLevel) {
          showLevelUpToast(r1.newLevel.title, r1.newUnlocks);
        }
        const r2 = await awardMascotXp(sid, "daily_first");
        if (r2.leveledUp && r2.newLevel) {
          showLevelUpToast(r2.newLevel.title, r2.newUnlocks);
        }
      })();
      // 已经预取到文字了？直接渲染
      if (prefetchedText) {
        renderTextResult(prefetchedText);
        return;
      }
      // skill_help / free_chat 模式无 stem → 不调 explainQuestion，留空让用户输入
      if (!props.stem) return;
      setLoading("explain");
      try {
        // v0.36.23 (爸爸 prompt review): 文字讲题也注入 Selena 学情 (弱项 + 错题),
        // 跟 realtime 一致 — 让小进讲题时知道她哪里薄弱, 更针对性引导.
        let studentContext: string | undefined;
        try {
          let sid = props.studentId;
          if (!sid) { const ss = await db.students.toArray(); sid = ss[0]?.id; }
          if (sid) {
            const stu = await db.students.get(sid);
            const snap = await gatherSnapshot(sid, stu?.name ?? "Selena");
            studentContext = snapshotToInstructions(snap);
          }
        } catch { /* 容错: 没学情就不注入 */ }
        const r = await explainQuestion({
          subjectId: props.subjectId,
          stem: props.stem,
          correctAnswer: props.correctAnswer ?? "",
          studentAnswer: props.studentAnswer ?? "",
          skillName: props.skillName,
          studentContext,
        });
        if (cancelled) return;
        renderTextResult(r.explanation);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(null);
      }
    };

    void (async () => {
      // 没存密码（开发期可能跳过 AuthGate）→ 直接走文本 fallback
      const pwd = (() => {
        try {
          return localStorage.getItem(STORAGE_KEYS.cloudPwd);
        } catch {
          return null;
        }
      })();
      // realtime 需要密码（Worker 校验）。没密码就走文字。
      if (!pwd) {
        void fallbackToText("no_password");
        return;
      }
      // 找 studentId 给 tools 绑学情
      let studentId = props.studentId;
      if (!studentId) {
        const ss = await db.students.toArray();
        studentId = ss[0]?.id;
      }
      if (!studentId) {
        void fallbackToText("no_student");
        return;
      }

      // === 关键：speculatively 同时起 explainQuestion ===
      // 不 await，放进 promise 里。realtime 赢就丢弃；realtime 慢就拿来用。
      const textExplainPromise: Promise<string | null> = props.stem
        ? explainQuestion({
            subjectId: props.subjectId,
            stem: props.stem,
            correctAnswer: props.correctAnswer ?? "",
            studentAnswer: props.studentAnswer ?? "",
            skillName: props.skillName,
          })
            .then((r) => r.explanation)
            .catch((e) => {
              console.warn("[tutor] text explain failed:", e);
              return null;
            })
        : Promise.resolve(null);

      // 拿小进当前等级 + 已解锁技能 + 装备的音色
      const mascotState = await getMascotState(studentId);
      const equippedVoice = await getEquippedVoice(studentId);

      let instructions = "";
      try {
        instructions = await buildRealtimeInstructions(props, mascotState.unlockedTalents);
      } catch (e) {
        void fallbackToText(
          "instructions_failed: " + (e as Error).message,
          await textExplainPromise.then((t) => t ?? undefined),
        );
        return;
      }
      if (cancelled) return;

      const tools = bindToolsForStudent(studentId);
      const tutor = new RealtimeTutor(
        {
          serverUrl: REALTIME_URL,
          password: pwd,
          systemPrompt: instructions,
          voice: equippedVoice,
          tools,
        },
        {
          onState: (s) => {
            if (cancelled) return;
            setRealtimeState(s);
            // 状态变化时把 thinking/speaking 显示为"加载小气泡"
            if (s === "thinking") setLoading("voice");
            else if (s === "speaking" || s === "ready") setLoading(null);
            if (s !== "tool_calling") setActiveToolName(null);
          },
          onUserTranscript: (text) => {
            if (cancelled) return;
            const msg: ChatMsg = { role: "user", content: text, via: "voice", ts: Date.now() };
            setConversation((prev) => {
              const next = [...prev, msg];
              void persistTutorSession(next);
              return next;
            });
          },
          onAssistantTranscriptDelta: (delta) => {
            if (cancelled) return;
            setRealtimeStreamingText((t) => t + delta);
          },
          onAssistantTurnDone: (fullText) => {
            if (cancelled) return;
            const text = fullText.trim();
            setRealtimeStreamingText("");
            if (!text) return;
            const msg: ChatMsg = { role: "assistant", content: text, ts: Date.now() };
            setConversation((prev) => {
              const next = [...prev, msg];
              void persistTutorSession(next);
              return next;
            });
          },
          onToolCall: (info) => {
            if (cancelled) return;
            // 显示"小进在查最近错题…"
            setActiveToolName(info.error ? null : info.name);
          },
          onError: (err) => {
            if (cancelled) return;
            console.warn("[tutor realtime]", err);
            // 致命错误（连不上 / 401 / mic_denied）→ fallback 文字
            const msg = (err.message ?? "").toLowerCase();
            if (
              err.code === "mic_denied" ||
              msg.includes("ws_open_failed") ||
              msg.includes("websocket_error") ||
              msg.includes("worklet_load_failed")
            ) {
              void fallbackToText(err.code ?? err.message);
            } else {
              setError(err.message);
            }
          },
        },
      );
      realtimeRef.current = tutor;

      // === 三方 race ===
      //  1. realtime ready  → 用 realtime
      //  2. realtime error  → fallback 文字
      //  3. timeout 3.5s    → 放弃 realtime，等文字
      const realtimeP = tutor
        .connect()
        .then(() => "realtime_ready" as const)
        .catch((e) => ({ kind: "realtime_error" as const, error: e as Error }));
      const timeoutP = new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), REALTIME_TIMEOUT_MS),
      );

      const winner = await Promise.race([realtimeP, timeoutP]);
      if (cancelled) return;

      // 错误或超时 → 都算 realtime 失败，立即 fallback 用文字
      // （prefetched textExplainPromise 大概率已经回来或快回来）
      if (winner === "timeout") {
        const prefetched = await textExplainPromise;
        await fallbackToText(
          "realtime_timeout_3500ms",
          prefetched ?? undefined,
        );
        return;
      }
      if (typeof winner === "object" && winner.kind === "realtime_error") {
        const prefetched = await textExplainPromise;
        await fallbackToText(
          "realtime_error: " + winner.error.message,
          prefetched ?? undefined,
        );
        return;
      }

      // realtime 赢了 — 锁定 mode，丢弃 textExplainPromise（它仍会跑完，但结果被忽略）
      modeDecided = "realtime";
      // 给小进涨经验：根据 context 不同奖励不同
      const xpReason: MascotXpReason =
        props.context === "review_session"
          ? "session_review"
          : props.context === "free_chat" || props.context === "skill_help"
            ? "proactive_chat"
            : "session_start";
      void (async () => {
        // 主奖励
        const r1 = await awardMascotXp(studentId, xpReason);
        if (r1.leveledUp && r1.newLevel) {
          showLevelUpToast(r1.newLevel.title, r1.newUnlocks);
        }
        // 当日首聊额外 +15
        const r2 = await awardMascotXp(studentId, "daily_first");
        if (r2.leveledUp && r2.newLevel) {
          showLevelUpToast(r2.newLevel.title, r2.newUnlocks);
        }
      })();
    })();
    return () => {
      cancelled = true;
      try {
        realtimeRef.current?.close();
      } catch {
        /* */
      }
      realtimeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // realtime push-to-talk: mousedown=startRecording / mouseup=stopAndRespond
  const startRealtimeRec = async () => {
    try {
      await realtimeRef.current?.startRecording();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const stopRealtimeRec = async () => {
    try {
      await realtimeRef.current?.stopAndRespond();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // 自动滚到最新一条
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation]);

  // 关闭时释放麦 + 停 audio
  useEffect(() => {
    return () => {
      recorderRef.current?.release();
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const handleAskAgain = async () => {
    if (!followText.trim() || loading) return;
    const userMsg: ChatMsg = {
      role: "user",
      content: followText.trim(),
      via: "text",
      ts: Date.now(),
    };
    const newConv = [...conversation, userMsg];
    setConversation(newConv);
    setFollowText("");
    setLoading("follow");
    setError(null);
    try {
      const r = await explainQuestion({
        subjectId: props.subjectId,
        // 没具体题就拿 skill name 当 stem 兜底，让后端 prompt 有 anchor
        stem: props.stem ?? (props.skillName ? `（关于 ${props.skillName} 的问题）` : "（自由提问）"),
        correctAnswer: props.correctAnswer ?? "",
        studentAnswer: props.studentAnswer ?? "",
        skillName: props.skillName,
        conversation: newConv.map((m) => ({ role: m.role, content: m.content })),
      });
      const aiMsg: ChatMsg = { role: "assistant", content: r.explanation, ts: Date.now() };
      const updated = [...newConv, aiMsg];
      setConversation(updated);
      void persistTutorSession(updated);
      void safePlayTts(r.explanation, aiMsg.ts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const startRecording = async () => {
    if (recording || loading || voiceUnavailable) return;
    setError(null);
    try {
      if (!recorderRef.current) {
        recorderRef.current = await createMicRecorder();
      }
      await recorderRef.current.start();
      setRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const stopRecording = async () => {
    if (!recording || !recorderRef.current) return;
    setRecording(false);
    setLoading("voice");
    try {
      const { blob, mimeType, durationMs } = await recorderRef.current.stop();
      if (durationMs < 500 || blob.size < 1000) {
        setError("录得太短了，按住按钮 1 秒以上再说话");
        setLoading(null);
        return;
      }
      const userMsg: ChatMsg = {
        role: "user",
        content: `🎤 (语音 ${Math.round(durationMs / 100) / 10}s)`,
        via: "voice",
        ts: Date.now(),
      };
      const newConv = [...conversation, userMsg];
      setConversation(newConv);
      const r = await voiceAsk({
        audioBlob: blob,
        mimeType,
        subjectId: props.subjectId,
        questionContext: props.stem
          ? { stem: props.stem, correctAnswer: props.correctAnswer, skillName: props.skillName }
          : props.skillName
            ? { stem: `（关于 ${props.skillName} 的问题）`, skillName: props.skillName }
            : undefined,
        conversation: conversation.map((m) => ({ role: m.role, content: m.content })),
      });
      const aiMsg: ChatMsg = { role: "assistant", content: r.reply, ts: Date.now() };
      const updated = [...newConv, aiMsg];
      setConversation(updated);
      void persistTutorSession(updated);
      void safePlayTts(r.reply, aiMsg.ts);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      // 鉴权 / 配额错 → 自动关掉语音模式，引导用文字
      if (isQuotaError(msg)) {
        setVoiceUnavailable(true);
        setVoiceUnavailableReason(
          "DashScope 账号当前等级没有开通 omni 语音模型权限。继续用 💬 文字追问，效果一样好。",
        );
      }
    } finally {
      setLoading(null);
    }
  };

  const replayLast = () => {
    const last = [...conversation].reverse().find((m) => m.role === "assistant");
    if (last) void safePlayTts(last.content, last.ts);
  };

  // 当前最后一条 AI 消息（用于 🔊 状态判断）
  const lastAssistantMsg = [...conversation].reverse().find((m) => m.role === "assistant");
  const audioForLast =
    lastAssistantMsg && audioStatus.kind !== "idle" && audioStatus.messageTs === lastAssistantMsg.ts;
  const speakerDisabled =
    !lastAssistantMsg || (audioStatus.kind === "loading" && audioForLast);
  const speakerLabel =
    audioStatus.kind === "loading" && audioForLast
      ? "⏳"
      : audioStatus.kind === "playing" && audioForLast
        ? "🔉"
        : "🔊";
  const speakerClass =
    audioStatus.kind === "loading" && audioForLast
      ? "animate-pulse opacity-70"
      : audioStatus.kind === "playing" && audioForLast
        ? "bg-amber-500/30 animate-pulse"
        : "";

  // 关闭：清理麦 + 停 audio + 关 realtime + 通知父组件
  const closePanel = () => {
    recorderRef.current?.release();
    recorderRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    try {
      realtimeRef.current?.close();
    } catch {
      /* */
    }
    realtimeRef.current = null;
    props.onClose();
  };

  // 监听 Escape 键关闭（键盘 a11y）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v0.31.21：用 Portal 挂到 document.body 逃出 containing block。
  // 之前 TutorPanel 从 MascotProfile / 各 card-glow 容器里弹出时，被父容器的
  // backdrop-filter / transform 限制了 fixed inset-0 的边界（CSS 规范：filter
  // 类属性会创建 containing block for fixed descendants），导致下方页面没被遮罩
  // 盖到、按钮也被截断。
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4"
      onClick={(e) => {
        // 点击 backdrop（不在 card 内部）= 关闭
        if (e.target === e.currentTarget) closePanel();
      }}
    >
      {/* 浮动关闭按钮 — 永远固定在视口右上角，确保即便 panel 高度异常也能关掉 */}
      <button
        type="button"
        onClick={closePanel}
        className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[60] w-10 h-10 rounded-full bg-ink-900/90 border border-violet-400/40 text-slate-200 hover:bg-rose-500/30 hover:text-rose-100 hover:border-rose-400/60 text-2xl leading-none shadow-glow flex items-center justify-center transition-all"
        aria-label="关闭面板"
        title="关闭（Esc）"
      >
        ×
      </button>

      {/* 小进升级 toast */}
      {levelUpToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[70] card-glow border-amber-400/60 bg-gradient-to-br from-amber-500/30 to-rose-500/20 px-4 py-3 max-w-sm animate-slide-up shadow-glow-amber">
          <div className="font-display font-bold text-amber-100 text-sm">
            ✨ 小进升级 → {levelUpToast.title}
          </div>
          <div className="text-xs text-amber-200/90 mt-1">{levelUpToast.detail}</div>
        </div>
      )}

      {/* 主面板：用 dvh 而不是 vh（dvh 排除 iOS Safari 地址栏，避免顶部被吃掉） */}
      <div
        className="card-glow w-full sm:max-w-md flex flex-col bg-ink-900/95 border border-violet-400/40 animate-slide-up overflow-hidden"
        style={{ maxHeight: "min(85dvh, 85vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between p-3 border-b border-ink-700/60 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* 小进吉祥物头像 */}
            <MascotAvatar size="md" autoEnsure glow />
            <div className="min-w-0">
              <div className="font-display font-bold text-amber-200">小进姐姐</div>
              <div className="text-[10px] text-slate-400 truncate">AI 引导 · {props.skillName ?? props.subjectId}</div>
            </div>
          </div>
          {/* 内嵌 × 兜底（如果浮动 × 被某个布局遮住） */}
          <button
            type="button"
            onClick={closePanel}
            className="text-slate-400 hover:text-slate-200 text-2xl leading-none px-3 py-1 rounded shrink-0"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* 对话区 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[180px]">
          {/* 题面提示卡 — 仅当有具体题时显示 */}
          {props.stem && (
            <div className="rounded-lg bg-violet-500/10 border border-violet-400/20 p-2 text-[11px] text-slate-300">
              <div className="text-slate-400 mb-0.5">题目：</div>
              <div className="text-slate-200">{props.stem}</div>
            </div>
          )}
          {/* skill_help 模式：显示她在哪个 skill 上挣扎 */}
          {!props.stem && props.context === "skill_help" && props.skillName && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-400/30 p-2 text-[11px] text-rose-200">
              <div className="text-rose-300/80 mb-0.5">小进要帮你看：</div>
              <div className="text-rose-100">
                <span className="font-bold">{props.skillName}</span>
                {props.consecutiveWrong != null && (
                  <span className="ml-1 text-rose-200/70">— 最近连错 {props.consecutiveWrong} 次</span>
                )}
              </div>
            </div>
          )}

          {conversation.length === 0 && loading === "explain" && (
            <div className="text-sm text-slate-400 flex items-center gap-2">
              <span className="animate-pulse">●</span>
              小进姐姐正在想怎么引导你思考…
            </div>
          )}
          {conversation.length === 0 && !loading && realtimeMode && realtimeState === "ready" && (
            <div className="text-sm text-slate-400 flex items-center gap-2">
              <span>👋</span>
              <span>按住下面的按钮，开口跟小进姐姐说就行。</span>
            </div>
          )}

          {conversation.map((m, i) => {
            const isLastAssistant =
              m.role === "assistant" && i === conversation.length - 1;
            const isLoadingThisMsg =
              isLastAssistant &&
              audioStatus.kind === "loading" &&
              audioStatus.messageTs === m.ts;
            const isPlayingThisMsg =
              isLastAssistant &&
              audioStatus.kind === "playing" &&
              audioStatus.messageTs === m.ts;
            return (
              <div
                key={`${m.ts}-${i}`}
                className={`rounded-xl p-2.5 text-sm leading-relaxed animate-slide-up ${
                  m.role === "assistant"
                    ? "bg-gradient-to-br from-amber-500/10 to-rose-500/10 border border-amber-400/30 text-amber-100"
                    : "bg-violet-500/15 border border-violet-400/30 text-violet-100 ml-6"
                }`}
              >
                {m.role === "assistant" ? (
                  <>
                    <div className="text-[10px] text-amber-300/80 mb-1 flex items-center gap-1">
                      <span>👩‍🏫</span> 小进姐姐说：
                      {isLoadingThisMsg && (
                        <span className="ml-2 text-slate-400 animate-pulse">⏳ 正在准备朗读…</span>
                      )}
                      {isPlayingThisMsg && (
                        <span className="ml-2 text-emerald-300">🔉 正在播放</span>
                      )}
                    </div>
                    <div>{m.content}</div>
                  </>
                ) : (
                  <div className="flex items-start gap-1.5">
                    {m.via === "voice" ? <span>🎤</span> : <span>💬</span>}
                    <span>{m.content}</span>
                  </div>
                )}
              </div>
            );
          })}

          {loading === "follow" && (
            <div className="text-xs text-slate-400 ml-2 animate-pulse">
              小进姐姐正在想…
            </div>
          )}
          {loading === "voice" && !realtimeMode && (
            <div className="text-xs text-slate-400 ml-2 animate-pulse">
              小进姐姐在听你的语音…
            </div>
          )}

          {/* realtime: 流式显示 assistant 当前正在说的话（assistant turn done 后会
              转到正式的 conversation 里，这里清空）*/}
          {realtimeMode && realtimeStreamingText && (
            <div className="rounded-xl p-2.5 text-sm leading-relaxed bg-gradient-to-br from-amber-500/10 to-rose-500/10 border border-amber-400/30 text-amber-100 animate-slide-up">
              <div className="text-[10px] text-amber-300/80 mb-1 flex items-center gap-1">
                <span>👩‍🏫</span> 小进姐姐说：<span className="text-emerald-300 animate-pulse">🔉</span>
              </div>
              <div>{realtimeStreamingText}</div>
            </div>
          )}
          {realtimeMode && activeToolName && (
            <div className="text-xs text-amber-300/70 ml-2 animate-pulse">
              🔧 小进在查{toolDisplayName(activeToolName)}…
            </div>
          )}
          {realtimeMode && realtimeState === "connecting" && (
            <div className="text-xs text-slate-400 ml-2 animate-pulse">
              连接小进姐姐中…
            </div>
          )}

          {error && !voiceUnavailable && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-400/30 text-rose-200 text-xs p-2 break-all">
              ⚠ {error}
            </div>
          )}

          {/* v0.31.27：realtime 失败 fallback 文字模式时给个温柔提示
              （以前老 voiceUnavailable 文案"账号无 omni 权限"对孩子太技术了）*/}
          {!realtimeMode && conversation.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-400/30 text-amber-200 text-xs p-2">
              💬 这次小进用文字讲。点 🔊 可以听她念出来；想追问就在下面写。
            </div>
          )}
        </div>

        {/* 底部操作区 */}
        <div className="p-3 border-t border-ink-700/60 space-y-2">
          {/* realtime 模式：push-to-talk 直接送到 dashscope，回流式 PCM 自动播 */}
          {realtimeMode && (
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onMouseDown={startRealtimeRec}
                onMouseUp={stopRealtimeRec}
                onMouseLeave={() => realtimeState === "recording" && void stopRealtimeRec()}
                onTouchStart={(e) => {
                  e.preventDefault();
                  void startRealtimeRec();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  void stopRealtimeRec();
                }}
                disabled={
                  realtimeState !== "ready" && realtimeState !== "recording"
                }
                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm border transition-all select-none ${
                  realtimeState === "recording"
                    ? "bg-rose-500/30 border-rose-400/60 text-rose-100 scale-105 animate-pulse"
                    : "bg-violet-500/15 border-violet-400/40 text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
                }`}
              >
                {realtimeState === "recording"
                  ? "🎤 松开发送…"
                  : realtimeState === "thinking" || realtimeState === "tool_calling"
                    ? "处理中…"
                    : realtimeState === "speaking"
                      ? "🔉 小进在说…"
                      : realtimeState === "connecting"
                        ? "连接中…"
                        : realtimeState === "ready"
                          ? "🎤 按住说话（实时）"
                          : "等待中…"}
              </button>
              {(realtimeState === "speaking" || realtimeState === "thinking") && (
                <button
                  type="button"
                  onClick={() => realtimeRef.current?.cancelResponse()}
                  className="px-3 py-2.5 rounded-xl border text-sm bg-rose-500/15 border-rose-400/30 text-rose-200 hover:bg-rose-500/25"
                  title="打断小进"
                >
                  ⏹
                </button>
              )}
            </div>
          )}

          {/* v0.31.27：realtime fallback 后只露文字 + TTS replay。
              老的"按住说话 → /api/tutor/voice qwen-omni"路径已经全 403（账号无权），
              点了必然失败、显示一段诡异错误，对孩子是噪音。直接砍掉。
              旧 startRecording / stopRecording 函数仍在代码里但 UI 不再触发。 */}
          {!realtimeMode && lastAssistantMsg && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={replayLast}
                disabled={speakerDisabled}
                className={`px-3 py-2 rounded-xl border text-sm ${speakerClass} ${
                  speakerDisabled
                    ? "bg-slate-700/40 border-slate-600/40 text-slate-400 cursor-not-allowed"
                    : "bg-amber-500/15 border-amber-400/30 text-amber-200 hover:bg-amber-500/25"
                }`}
              >
                {speakerLabel} 再听一遍
              </button>
            </div>
          )}
          {/* 文字追问 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={followText}
              onChange={(e) => setFollowText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) handleAskAgain();
              }}
              placeholder={
                conversation.length === 0
                  ? "等小进先讲，再来追问…"
                  : "回答小进的引导问题 / 继续追问…"
              }
              disabled={loading !== null}
              className="field flex-1 text-sm"
            />
            <button
              type="button"
              onClick={handleAskAgain}
              disabled={!followText.trim() || loading !== null}
              className="btn-primary text-sm disabled:opacity-50"
            >
              问
            </button>
          </div>
          <div className="text-[10px] text-slate-500 text-center leading-relaxed">
            💡 小进会引导你<strong className="text-slate-400">自己想答案</strong>，不直接告诉你。
            认真回答她的问题，越想越聪明 ✨
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
