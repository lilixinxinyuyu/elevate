import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
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
import { normalizeJsonText } from "../lib/normalizeJsonText";
import { generateAiQuestions, generateImage } from "../lib/tutor";
import { TrophyImagesAdminPanel } from "../components/TrophyImagesAdminPanel";
import { QuestionsAdminPanel } from "../components/QuestionsAdminPanel";
import { SkillBankDashboard } from "../components/admin/SkillBankDashboard";
import { ReportsPanel } from "../components/ReportsPanel";
import type { Question } from "../core/types";

type AdminTab = "bank" | "sync" | "assets" | "system";

// v0.31.55: hash → tab 映射，支持老的 deep link
const HASH_TO_TAB: Record<string, AdminTab> = {
  "bank-workbench": "bank",
  "ai-gen": "bank",
  "trophy-images": "assets",
  "image-gen": "assets",
  "prompt-builder": "assets",
  "cloud-sync": "sync",
  "system": "system",
};

export function AdminPage() {
  const students = useLiveQuery(async () => db.students.toArray(), []);
  const questions = useLiveQuery(async () => db.questions.toArray(), []);
  const [importText, setImportText] = useState("");
  const location = useLocation();
  // v0.31.55: 4 tabs replace flat cards
  const [tab, setTab] = useState<AdminTab>(() => {
    if (typeof window !== "undefined") {
      const h = window.location.hash.replace(/^#/, "");
      if (h && HASH_TO_TAB[h]) return HASH_TO_TAB[h]!;
    }
    return "bank";
  });

  // 处理 deep link：URL 带 #trophy-images / #ai-gen 等 hash 时切到对应 tab + 滚动到 id。
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace(/^#/, "");
    const targetTab = HASH_TO_TAB[id];
    if (targetTab && targetTab !== tab) setTab(targetTab);
    // 等一帧让 tab 切换 + 所有 card 渲染完
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash]);
  const [importResult, setImportResult] = useState<null | {
    ok: number;
    failed: { id: string; issues: string[] }[];
  }>(null);

  const handleImport = async () => {
    setImportResult(null);
    let data: unknown;
    try {
      data = JSON.parse(normalizeJsonText(importText));
    } catch (e) {
      setImportResult({
        ok: 0,
        failed: [{ id: "JSON", issues: [(e as Error).message, "提示：通常是 LLM 把直引号变成了中文弯引号 “”，已自动尝试修正——如果还失败，多半是结构问题（缺括号、多逗号等）。"] }],
      });
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

  // v0.31.55: 4 tab 重组。SkillDiagnosticsPanel + 题库统计 + 学生档案 老 cards 删/合：
  //   - SkillDiagnosticsPanel(Selena 学情 list) → 已合并到 SkillBankDashboard，函数后面删
  //   - 题库统计(by unit) → 移到 系统 tab 当快速概览
  //   - 学生档案 → 移到 同步 tab（一般和云同步一起看）
  //   - 导入题目 JSON 拆开：导入 textarea 留 题库 tab，重置/导出按钮 → 同步 tab
  return (
    <div className="space-y-3">
      {/* Tab nav — 4 顶部 tabs */}
      <nav className="flex gap-0.5 border-b border-white/10 -mb-px overflow-x-auto">
        {(
          [
            { id: "bank", label: "📋 题库 / 学情" },
            { id: "sync", label: "☁️ 同步 / 备份" },
            { id: "assets", label: "🎨 资源生成" },
            { id: "system", label: "🛠️ 系统" },
          ] as { id: AdminTab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-violet-400 text-violet-200"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-white/20"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ============ 题库 / 学情 ============ */}
      {tab === "bank" && (
        <div className="space-y-4 pt-2">
          {/* 主视图 */}
          <div className="card" id="bank-workbench">
            <div className="font-semibold mb-2">📋 题库工作台（合并诊断 + 批量出题）</div>
            <SkillBankDashboard />
          </div>

          {/* 综合分 / 段位 — Selena 学情 XP 累积视角，跟 dashboard mastery 不重 */}
          <div className="card">
            <div className="font-semibold mb-2">📊 综合分 / 段位真实指标</div>
            <RatingDiagnostics />
          </div>

          {/* 单 skill 简易出题 */}
          <div className="card" id="ai-gen">
            <div className="font-semibold mb-2">🤖 单 skill AI 出题（简易版）</div>
            <div className="text-xs text-slate-500 mb-2">
              批量出题去顶上工作台。这是单 skill 一道一道试的小工具。
            </div>
            <MathAIGeneratorPanel />
          </div>

          {/* 题库清理 + AI 质检 */}
          <div className="card">
            <div className="font-semibold mb-2">🩺 题库清理与 AI 质检</div>
            <QuestionsAdminPanel />
          </div>

          {/* 题导入 JSON */}
          <div className="card">
            <div className="font-semibold mb-2">📥 导入题目 JSON</div>
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
        </div>
      )}

      {/* ============ 同步 / 备份 ============ */}
      {tab === "sync" && (
        <div className="space-y-4 pt-2">
          <div className="card" id="cloud-sync">
            <div className="font-semibold mb-2">☁️ 云同步</div>
            <CloudSyncPanel />
          </div>

          <div className="card">
            <div className="font-semibold mb-2">👤 学生档案</div>
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
            <div className="font-semibold mb-2">💾 备份 / 重置</div>
            <div className="text-xs text-slate-500 mb-2">
              "只清空进度"保留题库和档案；"完全清空"会一并清掉题库（需重新 seed）。
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={handleExport}>
                📦 导出本地备份 JSON
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
                ⚠️ 只清空进度数据
              </button>
              <button
                type="button"
                className="btn-ghost text-rose-400 whitespace-nowrap"
                onClick={async () => {
                  if (confirm("会清空所有数据（包括题库），需要重新载入。继续？")) await resetAllData();
                }}
              >
                ☠️ 完全清空
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 资源生成 ============ */}
      {tab === "assets" && (
        <div className="space-y-4 pt-2">
          <div className="card" id="trophy-images">
            <div className="font-semibold mb-2">🏆 勋章图批量生成（替换 emoji）</div>
            <TrophyImagesAdminPanel />
          </div>

          <div className="card" id="image-gen">
            <div className="font-semibold mb-2">🎨 AI 图像生成（单图）</div>
            <ImageGeneratorPanel />
          </div>

          <div className="card" id="prompt-builder">
            <div className="font-semibold mb-2">📝 AI 出题 Prompt 生成器</div>
            <PromptBuilder />
          </div>
        </div>
      )}

      {/* ============ 系统 ============ */}
      {tab === "system" && (
        <div className="space-y-4 pt-2">
          <ReportsPanel />

          <div className="card">
            <div className="font-semibold mb-2">📊 题库快速统计（按 unit）</div>
            <div className="text-sm text-slate-400 mb-2">
              共 {stats.total} 道 · 下册 {stats.byTerm["下册"] ?? 0} · 上册 {stats.byTerm["上册"] ?? 0}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {UNITS.map((u) => (
                <div key={u.id} className="rounded-lg border border-white/10 bg-ink-900/40 p-2">
                  <div className="font-medium text-slate-200">{u.name}</div>
                  <div className="text-xs text-slate-500">
                    {stats.byUnit[u.id] ?? 0} 题 · {u.term}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="font-semibold mb-2">📚 文档</div>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>语文专属 admin（TTS 测试 / 语文重置）→ <code className="text-violet-300">/chinese/admin</code></li>
              <li>repo docs → <code className="text-violet-300">docs/README.md</code></li>
              <li>当前应用版本见底部 footer。</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}


// v0.31.55: SkillDiagnosticsPanel 删除 — 内容已全部合并到 SkillBankDashboard
// (上下册标签 + mastery + 准确率 + 期末重要度 + 题量 + audit issues 全在那一张表里)

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

function ImageGeneratorPanel() {
  const [prompt, setPrompt] = useState(
    "一枚卡通风格的金色奖杯勋章，上面是数字 100，背景紫色渐变，圆形，扁平插画风，4 年级女生喜欢的可爱风",
  );
  const [size, setSize] = useState<"512*512" | "1024*1024">("1024*1024");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ urls: string[]; model: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 几个预设：让用户一键试
  const presets = [
    {
      label: "📚 古诗勋章",
      prompt:
        "一枚卡通圆形勋章，上面是中国古风毛笔字「诗」字，金色边框，背景樱花和山水水墨画，扁平 3D 插画，4 年级女生喜欢的可爱风格",
    },
    {
      label: "🎯 数学计算勋章",
      prompt:
        "一枚卡通圆形勋章，上面是金色加减乘除符号 + - × ÷，紫粉色渐变背景，闪烁星星点缀，扁平插画，可爱风",
    },
    {
      label: "🎓 状元勋章",
      prompt:
        "一枚金色卡通圆形勋章，上面是「状元」毛笔字 + 古代状元帽 + 红色绶带，喜庆中国风，扁平插画风",
    },
    {
      label: "🔥 连击勋章",
      prompt:
        "一枚卡通圆形勋章，火焰图案围绕，中间是数字「10」，红橙渐变背景，扁平 3D 风格，动感十足",
    },
  ];

  const onGen = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await generateImage({
        prompt,
        size,
        model: "qwen-image-2.0-pro",
        n: 1,
      });
      setResult({ urls: r.urls, model: r.model });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-sm text-slate-300 space-y-3">
      <div className="text-xs text-slate-400 leading-relaxed">
        用 Qwen-Image-2.0-Pro 给勋章 / 图标生成图。生成后右键图片"另存为"
        到本地，再放到 <code className="text-amber-300">public/badges/</code> 即可在勋章墙引用。
        异步任务，每次约 10-25 秒。
      </div>

      <div>
        <div className="text-[11px] text-slate-500 mb-1">快速预设：</div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setPrompt(p.prompt)}
              className="chip bg-violet-500/15 border border-violet-400/30 text-violet-200 text-xs hover:bg-violet-500/25"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        className="field text-sm w-full"
        placeholder="描述你想要的图…"
      />

      <div className="flex items-center gap-2">
        <select
          value={size}
          onChange={(e) => setSize(e.target.value as "512*512" | "1024*1024")}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="512*512">512×512（勋章）</option>
          <option value="1024*1024">1024×1024（高清）</option>
        </select>
        <button
          type="button"
          onClick={onGen}
          disabled={busy || !prompt.trim()}
          className="btn-primary text-sm"
        >
          {busy ? "🎨 生成中（10-25s）…" : "🎨 生成图"}
        </button>
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded p-2 break-all">
          ⚠ {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="text-xs text-slate-400">
            模型：<span className="text-slate-200">{result.model}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {result.urls.map((u, i) => (
              <div key={i} className="rounded-xl border border-violet-400/30 overflow-hidden bg-ink-800/40">
                <img
                  src={u}
                  alt={`generated-${i}`}
                  className="w-full h-auto block"
                />
                <div className="p-2 text-[10px] text-slate-400 break-all">
                  <a
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-300 hover:underline"
                  >
                    打开原图 / 右键另存为
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MathAIGeneratorPanel() {
  const [unitId, setUnitId] = useState<string>(UNITS[0]?.id ?? "");
  const [skillId, setSkillId] = useState<string>(
    SKILLS.find((s) => s.unitId === (UNITS[0]?.id ?? ""))?.id ?? "",
  );
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("2-4");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | {
    generated: Question[];
    valid: Question[];
    invalid: { id: string; issues: string[] }[];
    model: string;
  }>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const skillsForUnit = SKILLS.filter((s) => s.unitId === unitId);

  const onGenerate = async () => {
    if (!unitId || !skillId) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setSavedCount(null);
    try {
      const unit = UNITS.find((u) => u.id === unitId);
      const skill = SKILLS.find((s) => s.id === skillId);
      // 同一 skill 的现有题干 → AI 避免重复语境
      const existingStems = (await db.questions.where({ skill_id: skillId }).toArray())
        .map((q) => q.stem)
        .slice(0, 30);

      const r = await generateAiQuestions({
        subjectId: "math",
        unitId,
        unitName: unit?.name,
        skillId,
        skillName: skill?.name,
        count,
        difficulty,
        existingStems,
      });

      // 用 core/validateQuestion 严格校验（math 用法和 chinese 不同：math 注册表全在 core）
      const valid: Question[] = [];
      const invalid: { id: string; issues: string[] }[] = [];
      for (const q of r.questions) {
        const v = validateQuestion(q);
        if (v.ok && v.question) valid.push(v.question);
        else
          invalid.push({
            id: q.question_id,
            issues: v.issues.map((i) => `${i.severity}: ${i.path} ${i.message}`),
          });
      }
      setResult({ generated: r.questions, valid, invalid, model: r.model });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (!result || result.valid.length === 0) return;
    setBusy(true);
    try {
      // 加 subjectId stamp
      const stamped = result.valid.map((q) => ({ ...q, subjectId: "math" as const }));
      await db.questions.bulkPut(stamped as never);
      setSavedCount(stamped.length);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-sm space-y-3">
      <div className="text-xs text-slate-400 leading-relaxed">
        让 qwen-plus 按当前选的单元 / 技能 / 难度，生成新题。生成后用 validateQuestion
        校验 → 点 "导入" 写进 db.questions。math train 的 scheduler 会自动从 db 拉到。
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-slate-500">单元</span>
          <select
            value={unitId}
            onChange={(e) => {
              setUnitId(e.target.value);
              const first = SKILLS.find((s) => s.unitId === e.target.value);
              if (first) setSkillId(first.id);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
          >
            {UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.term} · {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">技能</span>
          <select
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
          >
            {skillsForUnit.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-slate-500">数量（1-10）</span>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) =>
              setCount(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">难度（如 2-4）</span>
          <input
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
          />
        </label>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={onGenerate}
          disabled={busy || !unitId || !skillId}
          className="btn-primary text-sm"
        >
          {busy ? "AI 出题中…" : "🤖 让 AI 出题"}
        </button>
        {result && result.valid.length > 0 && savedCount === null && (
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="btn-secondary text-sm border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10"
          >
            💾 导入 {result.valid.length} 道到题库
          </button>
        )}
        {savedCount !== null && (
          <span className="text-emerald-300 text-xs self-center">
            ✓ 已写入 {savedCount} 道，回 /math/train 就能练到
          </span>
        )}
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded p-2 break-all">
          ⚠ {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="text-xs text-slate-400">
            模型：<span className="text-slate-200">{result.model}</span> · 生成{" "}
            {result.generated.length} 道，校验通过 {result.valid.length} 道，
            {result.invalid.length > 0 && (
              <span className="text-rose-300">失败 {result.invalid.length} 道</span>
            )}
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-2">
            {result.valid.map((q) => (
              <div
                key={q.question_id}
                className="rounded border border-emerald-400/30 bg-emerald-500/5 p-2 text-xs"
              >
                <div className="text-slate-100">{q.stem}</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  D{q.difficulty} · {(q.options ?? []).length} 选项
                </div>
              </div>
            ))}
            {result.invalid.map((f) => (
              <div
                key={f.id}
                className="rounded border border-rose-400/30 bg-rose-500/5 p-2 text-xs"
              >
                <div className="text-rose-300">✗ {f.id}</div>
                <ul className="list-disc list-inside text-[10px] text-rose-200/80 mt-1">
                  {f.issues.slice(0, 3).map((i, k) => (
                    <li key={k}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RatingDiagnostics() {
  const [data, setData] = useState<null | {
    seasonXp: number;
    seasonTier: string;
    seasonSub: string;
    avgXpPerAttempt: number;
    totalAttempts: number;
    ability: import("../core/rating").AbilityDiagnostic;
  }>(null);
  useEffect(() => {
    (async () => {
      const { computeCurrentRating } = await import("../db/service");
      const { computeAbilityDiagnostic } = await import("../core/rating");
      const students = await db.students.toArray();
      if (!students[0]) return;
      const sid = students[0].id;
      const r = await computeCurrentRating(sid, "下册");
      const allAttempts = await db.attempts.where({ studentId: sid }).toArray();
      const allMastery = await db.mastery.where({ studentId: sid }).toArray();
      const ability = computeAbilityDiagnostic(allAttempts, allMastery, "下册");
      setData({
        seasonXp: r.score,
        seasonTier: r.tier.name + " " + r.subRankRoman,
        seasonSub: r.subRankStars,
        avgXpPerAttempt: r.raw.avgXpPerAttempt,
        totalAttempts: r.raw.totalAttempts,
        ability,
      });
    })();
  }, []);

  if (!data) return <div className="text-sm text-slate-400">载入中…</div>;
  const ability = data.ability;
  const masteryDeflation = ability.raw.rawWeightedMastery - ability.raw.weightedMastery;
  return (
    <div className="text-sm space-y-3">
      <div className="rounded-lg bg-amber-500/10 border border-amber-400/30 p-3 text-amber-200/90 text-xs">
        ⚠️ <strong>家长须知</strong>：主显示是<strong>本学期累计 XP</strong>（每答一题加分，永远在涨）。
        段位区间反推自"完美 4 月 ≈ 48,000 XP"：和平街 0-10k / 锦江 10-22k / 成都 22-32k / 四川 32-40k / 全国 40k+。
      </div>

      {/* 主：赛季 XP */}
      <div>
        <div className="text-xs text-slate-400">本学期（下册）赛季分</div>
        <div className="font-display font-bold text-lg tabular-nums">
          {data.seasonXp.toLocaleString()} XP · {data.seasonTier} {data.seasonSub}
        </div>
        <div className="text-xs text-slate-500">
          平均 {data.avgXpPerAttempt.toFixed(1)} XP/题 · 共 {data.totalAttempts} 题
        </div>
      </div>

      {/* 辅：能力诊断（独立 0-1000 综合分） */}
      <div className="border-t border-slate-700 pt-3 mt-3">
        <div className="text-xs text-slate-400 mb-1">能力诊断（与 XP 无关，0-1000，反映学习"质量"）</div>
        <div className="font-display font-bold">
          {ability.score} / 1000
        </div>
        <table className="w-full text-xs mt-2">
          <thead className="text-slate-400"><tr>
            <th className="text-left">分量</th><th className="text-right">得分</th><th className="text-right">最大</th><th className="text-right">原始</th>
          </tr></thead>
          <tbody>
            <tr><td>准确率（7天）</td><td className="text-right">{Math.round(ability.components.accuracy)}</td><td className="text-right text-slate-400">/ 250</td><td className="text-right">{Math.round(ability.raw.accuracy7d * 100)}%</td></tr>
            <tr><td>熟练度</td><td className="text-right">{Math.round(ability.components.mastery)}</td><td className="text-right text-slate-400">/ 400</td><td className="text-right">eff {Math.round(ability.raw.weightedMastery)}</td></tr>
            <tr><td>持续性</td><td className="text-right">{Math.round(ability.components.continuity)}</td><td className="text-right text-slate-400">/ 200</td><td className="text-right">连{ability.raw.streak}·共{ability.raw.cumulativeDays}天</td></tr>
            <tr title="v0.30.12: 练习广度=每 skill 最多贡献 5 道独立答对，最大 150。强反姊妹题刷分。"><td>广度</td><td className="text-right">{Math.round(ability.components.volume)}</td><td className="text-right text-slate-400">/ 150</td><td className="text-right">cov {ability.raw.skillCoverageScore} · {ability.raw.uniqueQuestionsCorrect} 独立答对</td></tr>
          </tbody>
        </table>
      </div>

      {masteryDeflation > 5 && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-400/30 p-3 text-rose-200/90 text-xs">
          🔍 <strong>反刷分诊断</strong>：原始 mastery 加权平均 {Math.round(ability.raw.rawWeightedMastery)}，
          按独立题数封顶后变成 <strong>{Math.round(ability.raw.weightedMastery)}</strong>
          —— 每个 skill 平均只见过 <strong>{ability.raw.avgUniqueQuestionsPerSkill.toFixed(1)}</strong> 道独立题。
          {ability.raw.avgUniqueQuestionsPerSkill < 12 && " 建议：让 AI 出更多新题。"}
        </div>
      )}
    </div>
  );
}
