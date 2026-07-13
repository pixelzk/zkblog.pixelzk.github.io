# KBITUI

UI 设计需求表单，支持实时生成 `design.md`、Excel/PNG/ZIP 导出，以及通过 AI 从表格、文档和原型截图中提取需求。

任务管理和资产管理使用浏览器 IndexedDB 本地保存，不占用 GitHub 仓库空间，也不会自动上传服务器。数据只存在当前浏览器；清理网站数据、换浏览器或换电脑前，请在“任务管理 / 资产管理”中导出本地备份。

智能导入支持选择文件、拖拽、点击“从粘贴板导入”，以及在非输入框区域直接按 `Command/Ctrl + V` 粘贴截图、文件或文字。

## 本机启动

```bash
npm start
```

打开 <http://127.0.0.1:8787>。

## 部署环境变量

在 Node.js 部署平台后台配置，不要写入代码或提交 GitHub：

```text
OPENAI_API_KEY=全新的API密钥
OPENAI_MODEL=gpt-5.5
OPENAI_BASE_URL=https://api.wsxcant.com
OPENAI_IMAGE_API_KEY=生图通道密钥
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_QUALITY=medium
HOST=0.0.0.0
PUBLIC_ORIGIN=https://部署后的正式域名
IMAGE_ACCESS_USER=生图权限账号
IMAGE_ACCESS_PASSWORD=生图权限密码
```

`OPENAI_BASE_URL` 为第三方接口时，智能导入的文件会发送到该第三方服务，请确认其隐私与安全策略。

本机使用同一个 `~/.codex/config.toml` 接口地址，只需在 `~/.codex/auth.json` 中分别放两个 Key：

```json
{
  "OPENAI_API_KEY": "识别接口 Key",
  "OPENAI_IMAGE_API_KEY": "图片生成 Key"
}
```

`config.toml` 不需要复制第二份。生图默认使用 `gpt-image-2` 和 `medium`，并通过 Image API 流式接收生成过程，避免同步等待完整图片时被第三方网关返回 524。流式请求使用 1 张中间预览，最终只保存最后返回的图片。

生图按钮带服务端账号密码保护。正式部署时请在托管平台设置 `IMAGE_ACCESS_USER` 和 `IMAGE_ACCESS_PASSWORD`，不要把密码写进 GitHub；验证成功后浏览器会通过 HttpOnly Cookie 保持登录 7 天。

macOS 本机可直接双击 `配置生图接口.command`，配置内容会保存到钥匙串。修改配置后需重新启动本地服务。

## 启动命令

```text
npm start
```
