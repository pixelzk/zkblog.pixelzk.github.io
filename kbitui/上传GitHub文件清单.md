# 上传 GitHub 文件清单

## 必须上传

- `index.html`
- `server.mjs`
- `package.json`
- `.gitignore`
- `README.md`
- `favicon.svg`
- `t/README.md`

## 使用记录（按项目保密级别决定）

- `t/usage-YYYY-MM-DD.jsonl`：包含设计需求文字、模型、操作和错误记录，不包含图片与密钥。
- 公开仓库不建议提交真实使用记录；私有仓库可以按需提交。
- 网页运行时不会自动写回 GitHub，需要在本地提交，或后续配置服务端 GitHub Token/自动化工作流。

## 本机使用时可保留，线上部署不需要

- `配置API_KEY.command`
- `配置生图接口.command`
- `启动本地服务.command`
- `上传GitHub文件清单.md`

## 绝对不要上传

- API Key
- `.env`、`.env.*`
- `~/.codex/auth.json`
- `~/.codex/config.toml`
- macOS 钥匙串导出文件
- 用户上传的业务资料与参考图
- 表单导出的 ZIP、Excel、PNG、design.md

GitHub Pages 只能发布静态页面，无法运行 `server.mjs`。需要 AI 智能导入时，请将 GitHub 仓库连接到支持 Node.js 的部署平台，并在平台后台配置环境变量。
