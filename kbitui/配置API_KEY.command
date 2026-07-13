#!/bin/bash
set -e

clear
echo "KBIT UI Design Brief · 配置 OpenAI API Key"
echo
echo "提示：请使用新创建、从未公开过的 API Key。"
echo "输入内容不会显示，也不会写入项目文件。"
echo
read -r -s -p "请粘贴新的 API Key，然后按回车：" API_KEY
echo

if [[ -z "$API_KEY" ]]; then
  echo "未输入内容，配置已取消。"
  read -r -p "按回车关闭窗口。"
  exit 1
fi

if [[ "$API_KEY" != sk-* ]]; then
  echo "输入内容不像 OpenAI API Key，请确认后重试。"
  unset API_KEY
  read -r -p "按回车关闭窗口。"
  exit 1
fi

/usr/bin/security add-generic-password -U -a "$USER" -s "KBIT_OPENAI_API_KEY" -w "$API_KEY"
unset API_KEY

echo
echo "配置成功：密钥已安全保存到 macOS 钥匙串。"
echo "现在可以双击“启动本地服务.command”。"
read -r -p "按回车关闭窗口。"
