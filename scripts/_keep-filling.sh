#!/usr/bin/env bash
# 持续运行 fill-bank-v2 直到所有 skill 题量 ≥ TARGET（默认 30）。
# 一轮跑完后 audit + 如果还有 <20 → 再跑。budget 触底就长等再试。
#
# 用法：
#   APP_PASSWORD=... bash scripts/_keep-filling.sh
#
# 退出条件：所有 skill total ≥ 20 → 退出 0
# 中断恢复：D1 是源真，每次 audit 重新算，自动避免重复。

set -u
PROD="https://selena-elevate.pages.dev"
LOG=/tmp/keepfill.log
ROUND=0

if [ -z "${APP_PASSWORD:-}" ]; then
  echo "APP_PASSWORD env required" >&2
  exit 1
fi

echo "▶ keep-filling started at $(date)" >> "$LOG"

while true; do
  ROUND=$((ROUND+1))
  echo "▶ round $ROUND begin at $(date)" >> "$LOG"

  # 1. pull D1 latest
  curl -s -H "Authorization: Bearer $APP_PASSWORD" \
    "$PROD/api/sync/download" -o /tmp/prod-snapshot.json
  if [ ! -s /tmp/prod-snapshot.json ]; then
    echo "  download failed, sleep 5min" >> "$LOG"
    sleep 300
    continue
  fi

  # 2. audit (TARGET=30 by default; can be overridden via env)
  TARGET=${TARGET:-30} node scripts/_audit-all-counts.mjs > /tmp/all-counts.json 2>>"$LOG"
  REMAINING=$(jq '.summary.underTwenty' /tmp/all-counts.json 2>/dev/null || echo "?")
  NEED=$(jq '.summary.needTotal' /tmp/all-counts.json 2>/dev/null || echo "?")
  AI_TOTAL=$(jq '.summary.aiTotal' /tmp/all-counts.json 2>/dev/null || echo "?")
  echo "  state: under20=$REMAINING needTotal=$NEED aiTotal=$AI_TOTAL" >> "$LOG"

  # 3. done?
  if [ "$REMAINING" = "0" ]; then
    echo "▶ DONE: all skills ≥ 20" >> "$LOG"
    break
  fi

  # 4. swap priorities to under20 list
  cp /tmp/under20.json /tmp/priorities.json

  # 5. run fill-bank-v2 — target=20 per script run, but v2 reads per-skill `need`
  #    from priorities so won't overshoot. Cap 8 passes per round.
  echo "  filling round $ROUND…" >> "$LOG"
  node scripts/_fill-bank-v2.mjs 20 8 >> "$LOG" 2>&1 || \
    echo "  fill-bank-v2 exit nonzero (continuing)" >> "$LOG"

  echo "▶ round $ROUND end at $(date)" >> "$LOG"

  # 6. small pause before next audit (give D1 time to settle)
  sleep 30
done

echo "▶ keep-filling DONE at $(date)" >> "$LOG"
