import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { validateQuestion } from "../core/validateQuestion";
import { UNITS } from "../content/units";
import { SKILLS } from "../content/skills";
import { resetAllData, resetProgressOnly } from "../db/seed";
import {
  clearPassword,
  getLastPullAt,
  getLastPushAt,
  getStoredPassword,
  pullFromCloud,
  pushToCloud,
} from "../db/cloudSync";

export function AdminPage() {
  const students = useLiveQuery(async () => db.students.toArray(), []);
  const questions = useLiveQuery(async () => db.questions.toArray(), []);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<null | {
    ok: number;
    failed: { id: string; issues: string[] }[];
  }>(null);

  const handleImport = async () => {
    setImportResult(null);
    let data: unknown;
    try {
      data = JSON.parse(importText);
    } catch (e) {
      setImportResult({ ok: 0, failed: [{ id: "JSON", issues: [(e as Error).message] }] });
      return;
    }
    const arr = Array.isArray(data) ? data : [data];
    const okItems: typeof arr = [];
    const failed: { id: string; issues: string[] }[] = [];
    for (const item of arr) {
      const r = validateQuestion(item);
      if (r.ok && r.question) okItems.push(r.question);
      else {
        failed.push({
          id: (item as { question_id?: string } | null)?.question_id ?? "unknown",
          issues: r.issues.map((i) => `${i.severity}: ${i.path} ${i.message}`),
        });
      }
    }
    if (okItems.length > 0) {
      await db.questions.bulkPut(okItems as never);
    }
    setImportResult({ ok: okItems.length, failed });
  };

  const handleExport = async () => {
    const all = {
      version: 1,
      exportedAt: new Date().toISOString(),
      students: await db.students.toArray(),
      questions: await db.questions.toArray(),
      sessions: await db.sessions.toArray(),
      attempts: await db.attempts.toArray(),
      mastery: await db.mastery.toArray(),
      mistakes: await db.mistakes.toArray(),
      trophies: await db.trophies.toArray(),
    };
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `heping-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = buildStats(questions ?? []);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="font-semibold mb-2">学生档案</div>
        {(students ?? []).length === 0 ? (
          <div className="text-sm text-slate-500">暂无档案</div>
        ) : (
          <ul className="text-sm space-y-1">
            {(students ?? []).map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>{s.name}</span>
                <span className="text-slate-500">
                  {s.currentTerm} · 当前单元 {s.currentUnitId ?? "未设置"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="font-semibold mb-2">题库统计</div>
        <div className="text-sm text-slate-600 mb-2">
          共 {stats.total} 道，下册 {stats.byTerm["下册"] ?? 0}，上册 {stats.byTerm["上册"] ?? 0}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          {UNITS.map((u) => (
            <div key={u.id} className="rounded-lg border border-slate-200 p-2">
              <div className="font-medium">{u.name}</div>
              <div className="text-xs text-slate-500">
                {stats.byUnit[u.id] ?? 0} 题 · {u.term}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="font-semibold mb-2">导入题目 JSON</div>
        <div className="text-xs text-slate-500 mb-2">
          粘贴 Question 对象数组或单个对象。每道题会走 validateQuestion 校验。
        </div>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-slate-300 p-2 text-sm font-mono"
          placeholder='[{ "question_id": "...", ... }]'
        />
        <div className="mt-2 flex gap-2 flex-wrap">
          <button type="button" className="btn-primary" onClick={handleImport} disabled={!importText.trim()}>
            校验并导入
          </button>
          <button type="button" className="btn-secondary" onClick={handleExport}>
            导出本地备份
          </button>
          <button
            type="button"
            className="btn-ghost text-amber-300 whitespace-nowrap"
            onClick={async () => {
              if (confirm("将清空所有训练记录、错题、奖杯和经验值。题库和档案保留。继续？")) {
                await resetProgressOnly();
                alert("进度已重置！可以开始新的挑战。");
                window.location.href = "/";
              }
            }}
          >
            只清空进度数据
          </button>
          <button
            type="button"
            className="btn-ghost text-rose-400 whitespace-nowrap"
            onClick={async () => {
              if (confirm("会清空所有数据（包括题库），需要重新载入。继续？")) await resetAllData();
            }}
          >
            完全清空
          </button>
        </div>
        {importResult && (
          <div className="mt-3 text-sm">
            <div className="text-emerald-700">成功导入 {importResult.ok} 道</div>
            {importResult.failed.length > 0 && (
              <div className="mt-1">
                <div className="text-rose-700">失败 {importResult.failed.length} 道：</div>
                <ul className="list-disc list-inside text-xs text-rose-600 mt-1 space-y-0.5">
                  {importResult.failed.slice(0, 10).map((f) => (
                    <li key={f.id}>
                      {f.id}：{f.issues.join(" / ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="font-semibold mb-2">云同步</div>
        <CloudSyncPanel />
      </div>

      <div className="card">
        <div className="font-semibold mb-2">AI 出题 Prompt 生成器</div>
        <PromptBuilder />
      </div>
    </div>
  );
}

function CloudSyncPanel() {
  const [busy, setBusy] = useState<"push" | "pull" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const lastPush = getLastPushAt();
  const lastPull = getLastPullAt();
  const hasPwd = !!getStoredPassword();

  // 让"上次同步时间"刷新
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const fmt = (t: number) => {
    if (!t) return "从未";
    const diff = Date.now() - t;
    if (diff < 60_000) return "刚刚";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
    return new Date(t).toLocaleString();
  };

  const onPush = async () => {
    setBusy("push"); setMsg(null);
    const r = await pushToCloud();
    setMsg(r.ok ? `✓ 已上传到云端（${fmt(r.version ?? Date.now())}）` : `× 上传失败：${r.error}`);
    setBusy(null);
  };
  const onPull = async () => {
    if (!confirm("从云端拉最新进度会覆盖本地数据。继续？")) return;
    setBusy("pull"); setMsg(null);
    const r = await pullFromCloud({ force: true });
    if (r.ok && r.changed) {
      setMsg("✓ 已从云端拉最新数据。3 秒后刷新…");
      setTimeout(() => window.location.reload(), 3000);
    } else if (r.ok && !r.changed) {
      setMsg("✓ 云端没有更新，本地已是最新。");
    } else {
      setMsg(`× 下载失败：${r.error}`);
    }
    setBusy(null);
  };
  const onForget = () => {
    if (!confirm("忘记云端密码，下次打开需要重新输入。继续？")) return;
    clearPassword();
    setMsg("已清除密码。刷新页面会再次询问。");
  };

  return (
    <div className="text-sm space-y-3">
      <div className="text-xs text-slate-500">
        <span className="hidden">{tick}</span>
        {hasPwd ? "✓ 已配密码" : "× 没有云端密码（本机离线模式）"}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
        <div>上次推送：<span className="text-slate-100">{fmt(lastPush)}</span></div>
        <div>上次拉取：<span className="text-slate-100">{fmt(lastPull)}</span></div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          className="btn-primary"
          onClick={onPush}
          disabled={!hasPwd || busy != null}
        >
          {busy === "push" ? "上传中…" : "↑ 立即上传"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={onPull}
          disabled={!hasPwd || busy != null}
        >
          {busy === "pull" ? "下载中…" : "↓ 拉取云端最新"}
        </button>
        <button type="button" className="btn-ghost text-rose-300" onClick={onForget}>
          忘记密码
        </button>
      </div>
      {msg && (
        <div className={msg.startsWith("✓") ? "text-emerald-300" : "text-rose-300"}>{msg}</div>
      )}
      <div className="text-xs text-slate-500 leading-relaxed">
        每次完成一组挑战会自动上传。新设备打开输完密码会自动拉一次。
        如果数据看着不对，可以手动「拉取云端最新」恢复。
      </div>
    </div>
  );
}

function buildStats(questions: { term: string; unit_id: string }[]) {
  const byTerm: Record<string, number> = {};
  const byUnit: Record<string, number> = {};
  for (const q of questions) {
    byTerm[q.term] = (byTerm[q.term] ?? 0) + 1;
    byUnit[q.unit_id] = (byUnit[q.unit_id] ?? 0) + 1;
  }
  return { total: questions.length, byTerm, byUnit };
}

function PromptBuilder() {
  const [unitId, setUnitId] = useState("G4B_U3_DECIMAL_MULTIPLY");
  const [skillId, setSkillId] = useState("decimal_price_quantity");
  const [count, setCount] = useState(10);
  const [diff, setDiff] = useState("3-4");
  const unitName = UNITS.find((u) => u.id === unitId)?.name ?? "";
  const skill = SKILLS.find((s) => s.id === skillId);
  const skillName = skill?.name ?? "";
  const term = UNITS.find((u) => u.id === unitId)?.term ?? "下册";
  const ability = skill?.ability ?? ["calculation"];
  const examPriority = skill?.examPriority ?? "NORMAL";
  const exampleId = `${unitId}_${skillId}_000001`;
  const exampleQuestion = JSON.stringify(
    {
      question_id: exampleId,
      version: 1,
      status: "approved",
      grade: 4,
      term,
      unit_id: unitId,
      unit_name: unitName,
      skill_id: skillId,
      skill_name: skillName,
      ability_dimension: ability,
      exam_priority: examPriority,
      game_type: "speed_calc",
      play_as: "speed_match",
      cognitive_level: "procedural",
      difficulty: 3,
      estimated_time_seconds: 30,
      stem: "题干文本（不超过两行）",
      question_format: "numeric",
      distractors: [12, 1.2, 18],
      answer: { type: "number", value: 1.8 },
      solution_steps: ["先...", "再...", "得 1.8"],
      hints: [
        { text: "提示 1（点向方向）", penalty: 1 },
        { text: "提示 2（更具体）", penalty: 1 },
      ],
      common_errors: [
        { tag: "decimal_point_error", error: "把积写成 18 或 0.18", remediation: "先按整数算再点小数。" },
        { tag: "careless_reading", error: "看错数字", remediation: "重读一遍题。" },
      ],
      feedback_correct: "做得很稳！",
      feedback_wrong: "再想想，关系是 单价 × 数量 = 总价。",
      tags: ["可选标签"],
    },
    null,
    2,
  );

  const prompt = `请生成 ${count} 道四年级北师大版数学题。

【教材定位】
- term: ${term}
- unit_id: ${unitId}（${unitName}）
- skill_id: ${skillId}（${skillName}）
- exam_priority: ${examPriority}
- ability_dimension: ${JSON.stringify(ability)}
- difficulty: ${diff}

【硬性输出要求】
- 仅输出一个 JSON 数组，**不要 markdown，不要解释文字，不要代码块标记**
- 每个元素都必须严格符合下面这份 Question Schema
- question_id 全部唯一，用 \`{unit_id}_{skill_id}_000001\` 这种格式递增
- numeric / numeric_choice 类题：answer.type = "number"；同时必须给 distractors 至少 3 个非答案数字（生成 4 选 1 用）
- application 类题（含 stem 是应用题的）：建议同时提供 word_problem_steps 和 subquestions[]（clue_pick → choose → numeric 三步）
- 每题必须有 hints 1-3 级（penalty 默认 1，难度高的题可以给 2-3 级）
- 每题至少 2 个 common_errors，tag 用错因库里的标签（如 decimal_point_error / relation_model_error / careless_reading 等）
- 数值答案必须可程序校验；尽量给整数或两位以内小数
- 应用题情境用：文具店、图书角、跳绳、植树、骑车、家务等校园/生活场景
- **不允许**：真实姓名身份证手机号邮箱、付费充值抽奖、广告链接、负面文案（"笨"/"粗心鬼" 等）、超纲词（比例/函数/方程组/平方根）

【play_as 字段建议】
- 纯口算 / 概念真假 → "speed_match"（题面 + 4 选 1）
- 概念真假更适合 swipe → "true_false_swipe"（answer.value 用 "T"/"F"）
- 应用题（多步） → "shop_counter"（必须给 subquestions）
- 列方程 → "equation_builder"（multi_step answer + word_problem_steps）
- 小数点扩大缩小 → "decimal_shifter"（tags: ["start:3.6", "factor:×10"]，answer.value 写最终值）
- 三角形三边判定 → "shape_court"（tags: ["sticks:3,4,5"]，answer 用 choice T/F）
- 解方程 → "balance_lab"（tags: ["eq:x+3.6=10"]，answer.value=未知数值）
- 平均数 / 条形图 → "chart_detective"（tags: ["bars:120,128,124,132,126","step:1"]，answer.value=平均数）
- 翻牌配对 → "memory_match"（tags: ["pair:0.5|5个0.1","pair:1/2|0.5"]，question_format 用 "numeric" 兜底）
- 三角形分类 / 角度推理 / 等腰特殊（带图） → "triangle_judge"
  · 给三个角度（带图） tags: ["tri-angles:30,60,90"]
  · 给三条边（自动判断能否围成）tags: ["tri-sides:5,8,7"]
  · 等腰三角形特殊渲染 tags: ["tri-iso:apex=110,base=8","tri-mark:isoceles"]
  · 直角标记 tags: ["tri-mark:right"]
- 立体观察 / 数正方体 / 三视图 → "cube_view"
  · 题面立体图形 tags: ["solid:0,0,0|1,0,0|0,1,0"]（每个 x,y,z 是一个单位立方体；x→右、y→上、z→后）
  · 题面 2D 视图 tags: ["grid-front:3x2:1,1,1|0,1,0"]（WxH，行用 \\| 分，1=有方块、0=空），同理 grid-top / grid-left
  · 选项各带 2D 视图 tags: ["opt-grid-A:2x2:1,0|1,1","opt-grid-B:..."]
  · 选项各带 3D 立体 tags: ["opt-solid-A:0,0,0|1,0,0","opt-solid-B:..."]

【单题示例（请仿照这个格式严格输出）】
${exampleQuestion}
`;

  const skillOptions = SKILLS.filter((s) => s.unitId === unitId);

  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="block">
          <span className="text-xs text-slate-500">单元</span>
          <select
            value={unitId}
            onChange={(e) => {
              setUnitId(e.target.value);
              const first = SKILLS.find((s) => s.unitId === e.target.value);
              if (first) setSkillId(first.id);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1"
          >
            {UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.term}·{u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">技能</span>
          <select
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1"
          >
            {skillOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">数量</span>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-slate-500">难度范围</span>
        <input
          value={diff}
          onChange={(e) => setDiff(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1"
        />
      </label>
      <textarea readOnly value={prompt} rows={20} className="w-full rounded-lg border border-slate-300 p-2 font-mono text-xs" />
      <button
        type="button"
        className="btn-secondary"
        onClick={() => navigator.clipboard.writeText(prompt)}
      >
        复制 Prompt
      </button>
    </div>
  );
}
