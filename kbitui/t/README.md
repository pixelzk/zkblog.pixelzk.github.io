# KBITUI 使用记录

此目录由 KBITUI 本地 Node 服务自动写入文本使用记录，文件格式为：

```text
usage-YYYY-MM-DD.jsonl
```

每行是一条独立 JSON 记录，包含时间、操作类型、模型、设计需求文本、识别字段或错误信息。

不会写入：

- API Key
- 登录账号和密码
- Authorization 请求头
- 图片 Base64 / Data URL
- 浏览器 IndexedDB 中的图片资产

注意：如果此项目上传到公开 GitHub 仓库，提交该目录中的记录文件会公开其中的设计需求文字。敏感项目请使用私有仓库，或提交前删除对应记录。
