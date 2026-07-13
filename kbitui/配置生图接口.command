#!/bin/bash
set -e

clear
echo "KBITUI · 配置 GPT Image 生图通道"
echo
echo "配置会保存到 macOS 钥匙串，不会写入项目或上传 GitHub。"
echo "生图与识别共用 config.toml 中的接口地址；这里只保存生图专用 Key。"
echo

read -r -s -p "生图 API Key：" IMAGE_KEY
echo
if [[ "$IMAGE_KEY" != sk-* ]]; then
  echo "输入内容不像 API Key，请确认后重试。"
  unset IMAGE_KEY
  read -r -p "按回车关闭窗口。"
  exit 1
fi
/usr/bin/security add-generic-password -U -a "$USER" -s "KBIT_OPENAI_IMAGE_API_KEY" -w "$IMAGE_KEY"
unset IMAGE_KEY

echo
echo "配置成功："
echo "生图 Key 已保存；接口地址沿用 ~/.codex/config.toml。"
echo
echo "请重新启动本地服务后使用“生成设计图”。"
read -r -p "按回车关闭窗口。"
