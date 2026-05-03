#!/bin/bash
# 双击启动「生产模式」：比 dev 快、内存占用小，没有 HMR 的开发噪音。
# 适合给 Selena 长期使用。第一次会先 build。

set -e

cd "$(dirname "$0")"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n1)/bin:$PATH"

if [ ! -d node_modules ]; then
  echo "首次启动，正在安装依赖（约 30 秒）…"
  pnpm install
fi

# 如果代码动过、或还没 build，先 build 一次
if [ ! -d dist ] || [ src -nt dist ]; then
  echo "代码有更新，正在打包（约 5 秒）…"
  pnpm build
fi

URL="http://localhost:4173"

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
echo "🎮 Selena's Elevate（生产模式）启动中…"
echo "🌐 浏览器会自动打开 $URL"
echo "📱 同 Wi-Fi 设备：http://你的 Mac IP:4173"
echo ""
echo "（关掉就在终端窗口按 Ctrl+C 或直接关掉窗口）"
echo ""

pnpm preview --host --port 4173
