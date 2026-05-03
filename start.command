#!/bin/bash
# 双击这个文件就能启动 Selena's Elevate（开发模式，带热重载）
# 第一次会自动装依赖。

set -e

cd "$(dirname "$0")"

# 让 Mac 的 nvm/pnpm 可以被找到
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n1)/bin:$PATH"

# 没装依赖就装一下
if [ ! -d node_modules ]; then
  echo "首次启动，正在安装依赖（约 30 秒）…"
  pnpm install
fi

URL="http://localhost:5174"

# 等服务器起来后自动开浏览器
(
  for i in {1..30}; do
    sleep 1
    if curl -s -o /dev/null -w "%{http_code}" "$URL" | grep -q "200"; then
      open "$URL"
      break
    fi
  done
) &

echo ""
echo "🎮 Selena's Elevate 启动中…"
echo "🌐 浏览器会自动打开 $URL"
echo "📱 iPad / iPhone 在同一 Wi-Fi 也能访问 http://你的 Mac IP:5174"
echo ""
echo "（玩完后想关掉服务器：在这个窗口按 Ctrl+C，或直接关闭终端）"
echo ""

pnpm dev
