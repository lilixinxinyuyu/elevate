/**
 * v0.35.36 Refactor Priority 4: GameErrorBoundary (Gemini peer review HOTFIX).
 *
 * 痛点 (Gemini-3-pro 指出 v0.35.34 引入的运行时风险):
 *   pickPanel / templateTitle 改用 assertUnreachable(id) 后, 万一 IndexedDB
 *   cache 里有前端不认识的 templateId (旧数据, AI 出题随便填的, schema migration
 *   未同步), pickPanel 在 render 阶段 throw → React unmount 整个组件树 →
 *   **白屏崩溃**. Selena 今天就没法做题了.
 *
 * 解法: React ErrorBoundary 包裹 GameShell 渲染区, 抛出错误时显示友好 fallback
 * + 一个"跳过这题"按钮 (调用 onSkip prop 走 next question 流程).
 *
 * 这是 SAFETY NET. 主流程仍依赖 TS exhaustive + assertUnreachable 在 dev / CI
 * 阶段抓 case. 这个 boundary 是给生产 user 兜底.
 */
import React from "react";

type Props = {
  /** 出错时显示的友好提示 */
  fallbackTitle?: string;
  /** 出错时 "跳过这题" 按钮回调 — 让 Train 走 handleNext() 跳到下一题, Selena 不死等 */
  onSkip?: () => void;
  /** 出错时 "重新加载" — 重新 mount, 大多时候能恢复 (React 状态 reset) */
  onReset?: () => void;
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export class GameErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // 落 console 让 dev 看到, 跟踪 Sentry / Aliyun ARMS 可在这里接 (未来).
    console.error("[GameErrorBoundary] caught:", error, info);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  skip = () => {
    this.setState({ error: null });
    this.props.onSkip?.();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-rose-400/30 bg-rose-900/20 p-6 text-rose-100">
          <div className="text-lg font-display mb-2">⚠️ 这道题打不开了</div>
          <div className="text-sm text-rose-200/80 mb-4">
            {this.props.fallbackTitle ?? "可能是题型有点新, 系统还没认得. 跳到下一题继续答, 这道我们之后修."}
          </div>
          <div className="text-xs text-rose-300/60 mb-4 font-mono break-all">
            错误码: {this.state.error.message.slice(0, 120)}
          </div>
          <div className="flex gap-2">
            {this.props.onSkip && (
              <button
                onClick={this.skip}
                className="px-4 py-2 rounded-md bg-rose-500/80 hover:bg-rose-500 text-white text-sm"
              >
                跳过这题 →
              </button>
            )}
            <button
              onClick={this.reset}
              className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm"
            >
              🔄 再试一次
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
