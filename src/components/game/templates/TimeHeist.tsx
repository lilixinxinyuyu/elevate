import { useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";

/**
 * 时间窃贼（Time Heist） — v0.31.87
 *
 * 训练：时间换算 / 持续时间 / 速度 × 时间
 *
 * 玩法：钟面（指针 SVG）+ 起止时间提示 → 4 选 1 答持续时间或出发时刻
 *
 * 三种 mode：
 *   - duration：给开始 + 结束时刻，问"用了多久"
 *   - start：给结束时刻 + 持续时间，问"几点出发"
 *   - end：给开始时刻 + 持续时间，问"几点到"
 *
 * SVG 钟面：12h 表盘 + 时针 + 分针，时分根据 showOn（"start" or "end"）渲染。
 *
 * 数据：question.time_heist + question.options（4 选 = 4 个时间字符串 / 时长）
 */
export function TimeHeistPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const spec = question.time_heist;
  const sessionSalt = useMemo(
    () => Math.random().toString(36).slice(2),
    [question.question_id],
  );
  const options = useMemo(
    () => buildOptions(question, sessionSalt),
    [question.question_id, sessionSalt],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  function handlePick(optId: string, ev: React.MouseEvent<HTMLButtonElement>) {
    if (disabled || locked) return;
    const opt = options.find((o) => o.id === optId);
    if (!opt) return;
    setPicked(optId);
    setLocked(true);
    const rect = ev.currentTarget.getBoundingClientRect();
    if (opt.correct) {
      triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "⏰");
      // v0.31.93: 时钟主题 burst
      triggerFx.burstAt(rect.left + rect.width / 2, rect.top, ["⏰", "⌛", "✨", "⭐"], 8);
      window.setTimeout(() => {
        onFinish({
          answer: opt.id,
          isCorrect: true,
          partialCorrect: false,
          matchedErrorTags: [],
        });
      }, 400);
    } else {
      triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
      window.setTimeout(() => {
        onFinish({
          answer: opt.id,
          isCorrect: false,
          partialCorrect: false,
          matchedErrorTags: opt.errorTag ? [opt.errorTag] : ["time_calc"],
        });
      }, 400);
    }
  }

  // 决定钟面显示什么时刻
  const clockTime = (() => {
    if (!spec) return null;
    if (spec.showOn === "end") return spec.endTime ?? null;
    return spec.startTime ?? null; // 默认 start
  })();

  return (
    <div>
      <div className="font-display font-bold text-xl mb-3 whitespace-pre-wrap">
        {question.stem}
      </div>

      {/* 钟面 + 时间提示 */}
      <div className="rounded-3xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-violet-400/20 p-5 mb-4 flex items-center justify-center gap-6 flex-wrap">
        {clockTime && <ClockFace time={clockTime} />}
        {spec && (
          <div className="text-left text-sm space-y-1">
            {spec.startTime && (
              <div>
                <span className="text-slate-400">开始：</span>
                <span className="font-mono text-violet-200">{spec.startTime}</span>
              </div>
            )}
            {spec.endTime && (
              <div>
                <span className="text-slate-400">结束：</span>
                <span className="font-mono text-violet-200">{spec.endTime}</span>
              </div>
            )}
            {spec.durationMinutes != null && (
              <div>
                <span className="text-slate-400">用时：</span>
                <span className="font-mono text-amber-300">
                  {formatDuration(spec.durationMinutes)}
                </span>
              </div>
            )}
            <div className="pt-1 mt-1 border-t border-ink-700/40">
              <span className="text-slate-400">问：</span>
              <span className="text-amber-200">
                {spec.mode === "duration" && "总共用了多久？"}
                {spec.mode === "start" && "几点出发的？"}
                {spec.mode === "end" && "几点到的？"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4 选 1 */}
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const isPicked = picked === opt.id;
          const showAnswer = disabled || locked;
          const reveal = showAnswer && opt.correct;
          let cls = "bubble py-4 text-xl font-display font-bold tabular-nums";
          if (reveal) cls = "bubble bubble-correct animate-pop py-4 text-xl font-display font-bold tabular-nums";
          else if (isPicked && !opt.correct) cls = "bubble bubble-wrong py-4 text-xl font-display font-bold tabular-nums";
          else if (showAnswer) cls = "bubble bubble-faded py-4 text-xl font-display font-bold tabular-nums";
          return (
            <button
              key={opt.id}
              type="button"
              onClick={(e) => handlePick(opt.id, e)}
              disabled={disabled || locked}
              className={cls}
            >
              {opt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 12h 钟面 SVG。time = "HH:MM"（支持 24h，会自动 mod 12 显示）
 */
function ClockFace({ time }: { time: string }) {
  const [hh, mm] = time.split(":").map((s) => parseInt(s, 10));
  const h = ((hh ?? 0) % 12) + (mm ?? 0) / 60;
  const m = mm ?? 0;
  const hourAngle = (h / 12) * 360 - 90;
  const minAngle = (m / 60) * 360 - 90;
  const hr = polarPoint(50, 50, 22, hourAngle);
  const mr = polarPoint(50, 50, 33, minAngle);
  return (
    <svg viewBox="0 0 100 100" width={120} height={120} aria-label={`钟面 ${time}`}>
      <defs>
        <radialGradient id="clockBg" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#1f2548" />
          <stop offset="100%" stopColor="#0b0f1f" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#clockBg)" stroke="#a78bfa" strokeWidth="1.5" />
      {/* 12 个小时刻度 */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * 360 - 90;
        const p1 = polarPoint(50, 50, 42, a);
        const p2 = polarPoint(50, 50, 38, a);
        return (
          <line
            key={i}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="#cbd5e1"
            strokeWidth={i % 3 === 0 ? 2 : 1}
          />
        );
      })}
      {/* 12 / 3 / 6 / 9 数字 */}
      {[
        { n: 12, a: -90 },
        { n: 3, a: 0 },
        { n: 6, a: 90 },
        { n: 9, a: 180 },
      ].map(({ n, a }) => {
        const p = polarPoint(50, 50, 32, a);
        return (
          <text
            key={n}
            x={p.x}
            y={p.y + 3}
            textAnchor="middle"
            fontSize="9"
            fill="#94a3b8"
            fontFamily="ui-monospace,monospace"
          >
            {n}
          </text>
        );
      })}
      {/* 时针 */}
      <line
        x1="50"
        y1="50"
        x2={hr.x}
        y2={hr.y}
        stroke="#fbbf24"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* 分针 */}
      <line
        x1="50"
        y1="50"
        x2={mr.x}
        y2={mr.y}
        stroke="#f472b6"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="2.5" fill="#a78bfa" />
    </svg>
  );
}

function polarPoint(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} 分钟`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分钟`;
}

function buildOptions(
  q: TemplateRenderProps["question"],
  salt: string,
): Array<{ id: string; text: string; correct: boolean; errorTag?: string }> {
  const opts = (q.options ?? []).map((o) => ({
    id: o.id,
    text: o.text,
    correct:
      q.answer.type === "choice" && q.answer.value === o.id ? true : false,
    errorTag: o.errorTag,
  }));
  const arr = [...opts];
  let h = 0;
  for (const c of salt) h = (h * 31 + c.charCodeAt(0)) | 0;
  for (let i = arr.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) | 0;
    const j = Math.abs(h) % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
