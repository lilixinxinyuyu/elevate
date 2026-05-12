/**
 * 银行游戏页 —— 3D 场景里凑钱找零，**完全无 popup modal**。
 *
 * 玩法：
 *  1. 一进就有客户 + 任务（"我要存 ¥X.XX"）
 *  2. 玩家点底部钱币堆 → +1 到中央托盘
 *  3. 托盘累加到 == target → 客户离开 + 加灵感 + 自动下一位（最多 5 位）
 *  4. 5 位完成 → "工作日结束" celebration + 回小镇
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BankScene } from "../../components/town/BankScene";
import {
  genBankTask,
  type BankTask,
  type CoinValue,
} from "../../content/town/bankTasks";
import {
  addInspiration,
  recordBuildingTask,
  recordBuildingVisit,
} from "../../lib/town/townProgress";

const SHIFT_TARGET = 5; // 一个班 5 位客户

export function BankPage() {
  const navigate = useNavigate();
  const [task, setTask] = useState<BankTask>(() => genBankTask(1));
  const [tray, setTray] = useState<Map<CoinValue, number>>(() => new Map());
  const [served, setServed] = useState(0);
  const [shiftEnded, setShiftEnded] = useState(false);
  const [lastReward, setLastReward] = useState<number | null>(null);

  useEffect(() => {
    void recordBuildingVisit("bank");
  }, []);

  // 实时总和
  const total = useMemo(() => {
    let s = 0;
    for (const [v, n] of tray) s += v * n;
    return Math.round(s * 100) / 100;
  }, [tray]);
  const status: null | "win" = Math.abs(total - task.target) < 0.001 ? "win" : null;

  // 自动判定完成
  useEffect(() => {
    if (status === "win" && !shiftEnded) {
      // 加灵感 +2 一个客户。下一位 1.2s 后。
      const t = setTimeout(async () => {
        const reward = 2;
        await addInspiration(reward);
        await recordBuildingTask("bank", true);
        setLastReward(reward);
        setTimeout(() => setLastReward(null), 1400);
        if (served + 1 >= SHIFT_TARGET) {
          setShiftEnded(true);
        } else {
          setServed((s) => s + 1);
          // 难度递增：3 位后开始难度 2，4 位后难度 3
          const diff = served + 1 >= 4 ? 3 : served + 1 >= 2 ? 2 : 1;
          setTask(genBankTask(diff));
          setTray(new Map());
        }
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [status, served, shiftEnded]);

  const onPickCoin = (v: CoinValue) => {
    setTray((m) => {
      const next = new Map(m);
      next.set(v, (next.get(v) ?? 0) + 1);
      return next;
    });
  };

  const onReturnCoin = (v: CoinValue) => {
    setTray((m) => {
      const next = new Map(m);
      const cur = next.get(v) ?? 0;
      if (cur <= 1) next.delete(v);
      else next.set(v, cur - 1);
      return next;
    });
  };

  if (shiftEnded) {
    return (
      <div className="space-y-3 p-4">
        <div className="card-glow border-2 border-amber-400/60 bg-gradient-to-br from-amber-500/20 to-yellow-500/10 text-center py-8">
          <div className="text-5xl mb-2">🎉</div>
          <div className="font-display font-bold text-2xl text-amber-100">下班啦！</div>
          <div className="text-sm text-amber-200/80 mt-2">
            你帮助了 {SHIFT_TARGET} 位客户，村庄银行运营完美！
          </div>
          <div className="text-xs text-amber-300 font-mono mt-1 tabular-nums">
            灵感 +{SHIFT_TARGET * 2}（每位客户 +2）
          </div>
          <div className="flex gap-3 justify-center mt-5">
            <button
              type="button"
              onClick={() => {
                setShiftEnded(false);
                setServed(0);
                setTask(genBankTask(1));
                setTray(new Map());
              }}
              className="btn-secondary"
            >
              ☀️ 再开一班
            </button>
            <button
              type="button"
              onClick={() => navigate("/math/town")}
              className="btn-primary"
            >
              🏘️ 回小镇
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {/* 顶 banner：客户进度 + 回小镇 */}
      <div className="card-glow border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-yellow-500/5 flex items-center gap-3">
        <div className="text-3xl">🏦</div>
        <div className="flex-1">
          <div className="font-display font-bold text-amber-100">村庄银行 · 今日工作</div>
          <div className="text-xs text-amber-200/70 mt-0.5 tabular-nums">
            第 {served + 1} / {SHIFT_TARGET} 位客户
            {lastReward !== null && (
              <span className="ml-2 text-amber-300 animate-pulse">+{lastReward} 灵感</span>
            )}
          </div>
        </div>
        <Link
          to="/math/town"
          className="chip text-xs px-3 py-1.5 bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
        >
          ← 回小镇
        </Link>
      </div>

      {/* 3D 银行场景 */}
      <div className="relative rounded-3xl overflow-hidden border border-amber-400/30 bg-slate-900 h-[520px] sm:h-[600px] shadow-2xl">
        <BankScene
          task={task}
          tray={tray}
          onPickCoin={onPickCoin}
          onReturnCoin={onReturnCoin}
          total={total}
          status={status}
        />
        {/* 顶部 hint */}
        <div className="absolute top-3 left-3 right-3 pointer-events-none">
          <div className="px-2 py-1 rounded-full inline-block bg-black/60 backdrop-blur-sm text-[10px] text-amber-200 border border-amber-300/30">
            💡 点底部钱币 +1 / 点托盘上钱币 -1 · 总和 = 目标即完成
          </div>
        </div>
      </div>

      {/* 当前难度 hint */}
      <div className="card-flat text-[11px] text-slate-400 leading-relaxed">
        🧮 数学技能：小数加 / 凑总额 / 找零。
        {served >= 4 ? "难度 ⭐⭐⭐（5 分硬币也来了）" : served >= 2 ? "难度 ⭐⭐" : "难度 ⭐"}
      </div>
    </div>
  );
}
