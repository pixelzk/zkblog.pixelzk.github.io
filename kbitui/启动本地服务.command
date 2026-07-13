#!/bin/bash
set -e

cd "$(dirname "$0")"
clear
echo "正在启动 KBIT UI Design Brief…"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js，请先安装 Node.js 18 或更高版本。"
  read -r -p "按回车关闭窗口。"
  exit 1
fi

(sleep 1; open "http://127.0.0.1:8787") &
npm start
