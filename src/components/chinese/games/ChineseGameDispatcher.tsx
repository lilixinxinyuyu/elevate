/**
 * 语文新游戏统一分发器：按 question.game_data.kind 选模板。
 *
 * - pair_match → PairMatchGame
 * - sentence_shuffle → SentenceShuffleGame
 * - poem_cloze → PoemClozeGame
 *
 * 没有 game_data 时返回 null（外层用经典 plain_choice 渲染）。
 */

import type { Question } from "../../../core/types";
import { PairMatchGame } from "./PairMatchGame";
import { SentenceShuffleGame } from "./SentenceShuffleGame";
import { PoemClozeGame } from "./PoemClozeGame";

export interface GameResult {
  correct: boolean;
  meta?: Record<string, unknown>;
}

interface Props {
  question: Question;
  frozen: boolean;
  onResult: (result: GameResult) => void;
}

export function ChineseGameDispatcher({ question, frozen, onResult }: Props) {
  const data = question.game_data;
  if (!data) return null;
  switch (data.kind) {
    case "pair_match":
      return <PairMatchGame data={data} frozen={frozen} onResult={onResult} />;
    case "sentence_shuffle":
      return <SentenceShuffleGame data={data} frozen={frozen} onResult={onResult} />;
    case "poem_cloze":
      return <PoemClozeGame data={data} frozen={frozen} onResult={onResult} />;
    default:
      return null;
  }
}

/** 题面是不是用了新游戏？（外层用来切换 UI） */
export function hasChineseMiniGame(q: Question): boolean {
  return q.game_data !== undefined;
}
