import http from "node:http";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { extname, join } from "node:path";
import { homedir } from "node:os";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8787);
const PUBLIC_ORIGIN = String(process.env.PUBLIC_ORIGIN || "").replace(/\/$/, "");
const ROOT = new URL("./", import.meta.url).pathname;
const HOME_FILE = "index.html";
const MAX_BODY = 24 * 1024 * 1024;
const USAGE_ROOT = join(ROOT, "t");
const requests = [];
const TYPE_EXTRACTION_RULES = `
【按最终交付类型提取】
- 小程序：目标小程序平台、页面清单与层级、核心功能与用户路径、TabBar 结构、平台原生能力、关键页面状态、目标设备与基准尺寸。
- 原生 APP：目标系统、页面清单与导航结构、核心功能与用户路径、系统能力与权限、平台规范偏好、关键页面状态、目标设备与基准尺寸。
- Web 网站：网站类型、页面清单与信息架构、核心功能与任务流、导航与布局方式、浏览器兼容范围、交互与页面状态、目标设备与响应式尺寸。
- H5 活动页：H5 类型与使用场景、页面清单与底部导航、核心栏目与内容分类、核心功能与用户路径、登录与个人中心、分享与外部能力、关键页面状态、目标设备与基准尺寸。
- 单个页面：页面名称、页面目标、页面模块、核心交互、页面状态、目标设备与页面尺寸。
- Logo：Logo名称、品牌定位、Logo寓意、中英文名称、主要使用场景、目标输出尺寸。
- Icon：图标名称 / 功能含义、图标数量、使用位置、状态、目标输出尺寸。
- 数字 Banner：主题、主标题 / 副标题、按钮文案、需要包含的素材、投放位置、尺寸 / 比例。
- 平面设计 / 海报：印刷品类型、主标题 / 副标题 / 正文、使用场景与观看距离、印刷要求、纸张与工艺、必须包含的素材、交付格式、明确禁止与注意事项、成品尺寸与物料。
- 数据大屏：大屏主题、核心指标、图表类型、展示环境、刷新 / 交互要求、目标屏幕分辨率。
- PPT：演示主题与用途、目标观众与决策任务、核心结论 / 一句话主张、内容素材与数据来源、建议页数与演讲时长、叙事结构、必须包含的页面、图表与可视化需求、演示环境与交付、演讲者备注要求、演示比例与输出尺寸。
- 组件 / Design System：组件范围、适用平台、现有规范、需要覆盖的状态、技术框架、覆盖设备与响应式断点。

【图片视觉提取】
如果附件属于视觉参考或已有设计稿，还要从真实可见内容中提取：整体风格、页面氛围、主色、辅色、配色说明、版式偏好、图形 / 图标 / 插画风格、希望重点突出。分析信息层级、栅格/留白、导航形态、卡片与按钮形态、图片使用方式；不要把参考图上的业务名称误当成新项目名称，除非其他需求文件也支持。

【冲突与可信度】
业务需求/栏目规划 > 原型截图 > 品牌规范 > 视觉参考。业务需求决定做什么，视觉参考只决定怎么呈现。同一字段冲突时采用高优先级来源，并在 notes 说明。没有证据的字段不输出；不要用行业常识补全。notes 必须列出附件角色和仍缺少的关键字段。`;
const imageSessions = new Map();
const imageLoginAttempts = new Map();
const IMAGE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_IMAGE_USER = "KBIT";
const DEFAULT_IMAGE_PASSWORD_SHA256 = "8721d1333b764926ff121fed87539c492af07cc3930258752fc3a26b33a91cd8";

function getKeychainValue(service) {
  if (process.platform !== "darwin") return "";
  try {
    return execFileSync("/usr/bin/security", ["find-generic-password", "-s", service, "-w"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch { return ""; }
}

function getAuthConfig() {
  try {
    return JSON.parse(readFileSync(join(homedir(), ".codex", "auth.json"), "utf8"));
  } catch { return {}; }
}

function getApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  const keychainKey = getKeychainValue("KBIT_OPENAI_API_KEY");
  if (keychainKey) return keychainKey;
  const auth = getAuthConfig();
  if (auth.OPENAI_API_KEY) return String(auth.OPENAI_API_KEY).trim();
  return "";
}

function getProviderConfig() {
  let model = process.env.OPENAI_MODEL || "";
  let baseUrl = process.env.OPENAI_BASE_URL || "";
  try {
    const toml = readFileSync(join(homedir(), ".codex", "config.toml"), "utf8");
    if (!model) model = toml.match(/^model\s*=\s*["']([^"']+)["']/m)?.[1] || "";
    if (!baseUrl) {
      const section = toml.match(/\[model_providers\.OpenAI\]([\s\S]*?)(?=\n\[|$)/)?.[1] || "";
      baseUrl = section.match(/^base_url\s*=\s*["']([^"']+)["']/m)?.[1] || "";
    }
  } catch {}
  return {
    model: model || "gpt-5-mini",
    baseUrl: String(baseUrl || "https://api.openai.com/v1").replace(/\/$/, "")
  };
}

function getImageProviderConfig() {
  const textProvider = getProviderConfig();
  const auth = getAuthConfig();
  let baseUrl = String(process.env.OPENAI_IMAGE_BASE_URL || getKeychainValue("KBIT_OPENAI_IMAGE_BASE_URL") || textProvider.baseUrl).replace(/\/$/, "");
  try {
    const parsed = new URL(baseUrl);
    if (!parsed.pathname || parsed.pathname === "/") baseUrl += "/v1";
  } catch {}
  return {
    model: process.env.OPENAI_IMAGE_MODEL || getKeychainValue("KBIT_OPENAI_IMAGE_MODEL") || "gpt-image-2",
    quality: process.env.OPENAI_IMAGE_QUALITY || getKeychainValue("KBIT_OPENAI_IMAGE_QUALITY") || "medium",
    baseUrl,
    key: String(process.env.OPENAI_IMAGE_API_KEY || getKeychainValue("KBIT_OPENAI_IMAGE_API_KEY") || auth.OPENAI_IMAGE_API_KEY || "").trim()
  };
}

function json(res, status, data, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(JSON.stringify(data));
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function imageLoginValid(username, password) {
  const expectedUser = process.env.IMAGE_ACCESS_USER || DEFAULT_IMAGE_USER;
  const expectedHash = process.env.IMAGE_ACCESS_PASSWORD
    ? createHash("sha256").update(process.env.IMAGE_ACCESS_PASSWORD).digest("hex")
    : DEFAULT_IMAGE_PASSWORD_SHA256;
  const suppliedHash = createHash("sha256").update(String(password || "")).digest("hex");
  return safeEqual(username, expectedUser) && safeEqual(suppliedHash, expectedHash);
}

function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map(x => x.trim().split("=")).filter(x => x.length === 2));
}

function imageAuthorized(req) {
  const token = cookies(req).kbit_image_session;
  const expires = token && imageSessions.get(token);
  if (!expires || expires < Date.now()) { if (token) imageSessions.delete(token); return false; }
  return true;
}

function imageSessionCookie(req, token) {
  const secure = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
  return `kbit_image_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${IMAGE_SESSION_MS / 1000}${secure ? "; Secure" : ""}`;
}

function cleanUsageValue(value, depth = 0) {
  if (depth > 4) return "[已截断]";
  if (typeof value === "string") return value.slice(0, 30000);
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map(x => cleanUsageValue(x, depth + 1));
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !/key|password|token|authorization|image|dataurl|base64/i.test(key)).slice(0, 100).map(([key, item]) => [key, cleanUsageValue(item, depth + 1)]));
  return String(value).slice(0, 1000);
}

async function recordUsage(type, detail = {}) {
  try {
    await mkdir(USAGE_ROOT, { recursive: true });
    const now = new Date();
    const entry = { id: randomBytes(8).toString("hex"), time: now.toISOString(), type, ...cleanUsageValue(detail) };
    await appendFile(join(USAGE_ROOT, `usage-${now.toISOString().slice(0, 10)}.jsonl`), `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) { console.error("写入使用记录失败：", error.message); }
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const requestOrigin = `${forwardedProto || "http"}://${req.headers.host}`;
  return origin === requestOrigin || origin === PUBLIC_ORIGIN || origin === `http://127.0.0.1:${PORT}` || origin === `http://localhost:${PORT}`;
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("上传内容超过 24MB");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?(?:;base64)?,(.*)$/s);
  if (!match) throw new Error("文件内容格式不正确");
  return { mime: match[1] || "application/octet-stream", buffer: Buffer.from(match[2], "base64") };
}

async function openAI(path, key, init = {}) {
  return openAIAt(getProviderConfig().baseUrl, path, key, init);
}

async function openAIAt(baseUrl, path, key, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${key}`, ...(init.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || (typeof data?.error === "string" ? data.error : "") || data?.message || data?.detail;
    throw new Error(detail || `OpenAI 请求失败（${response.status}）`);
  }
  return data;
}

async function generateDesignImage(payload) {
  const provider = getImageProviderConfig();
  if (!provider.key) throw new Error("尚未配置生图 API Key");
  const prompt = String(payload.prompt || "").trim().slice(0, 12000);
  if (!prompt) throw new Error("请先填写设计需求");
  const allowedSizes = new Set(["1024x1024", "1024x1536", "1536x1024"]);
  const size = allowedSizes.has(payload.size) ? payload.size : "1024x1536";
  const response = await fetch(`${provider.baseUrl}/images/generations`, {
    method: "POST",
    headers: { authorization: `Bearer ${provider.key}`, "content-type": "application/json", accept: "text/event-stream, application/json" },
    body: JSON.stringify({ model: provider.model, prompt, size, quality: provider.quality, n: 1, output_format: "png", stream: true, partial_images: 1 })
  });
  if (!response.ok) {
    const raw = await response.text();
    let data = {}; try { data = JSON.parse(raw); } catch {}
    const detail = data?.error?.message || (typeof data?.error === "string" ? data.error : "") || data?.message || data?.detail;
    throw new Error(detail || `OpenAI 请求失败（${response.status}）`);
  }
  const contentType = String(response.headers.get("content-type") || "");
  if (contentType.includes("text/event-stream") && response.body) {
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = "", latestImage = "";
    const readEvents = chunk => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/); buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const text = line.slice(5).trim();
        if (!text || text === "[DONE]") continue;
        try {
          const event = JSON.parse(text);
          const image = event.b64_json || event.image_base64 || event.partial_image_b64 || event?.data?.[0]?.b64_json;
          if (image) latestImage = image;
          if (event.error) throw new Error(event.error.message || event.error);
        } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
      }
    };
    while (true) { const { value, done } = await reader.read(); if (done) break; readEvents(decoder.decode(value, { stream: true })); }
    readEvents(decoder.decode());
    if (latestImage) return { image: `data:image/png;base64,${latestImage}`, model: provider.model, quality: provider.quality, size, streamed: true };
    throw new Error("流式生图完成，但接口未返回可用图片数据");
  }
  const result = await response.json().catch(() => ({}));
  const item = result?.data?.[0] || result?.output?.[0] || {};
  if (item.b64_json) return { image: `data:image/png;base64,${item.b64_json}`, model: provider.model, quality: provider.quality, size };
  if (item.url) return { image: item.url, model: provider.model, quality: provider.quality, size };
  const imageBase64 = result?.image_base64 || result?.b64_json;
  if (imageBase64) return { image: `data:image/png;base64,${imageBase64}`, model: provider.model, quality: provider.quality, size };
  throw new Error("生图接口未返回图片数据");
}

async function uploadFile(file, key) {
  const { mime, buffer } = parseDataUrl(file.dataUrl);
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append("file", new Blob([buffer], { type: mime }), file.name || "requirement-file");
  return openAI("/files", key, { method: "POST", body: form });
}

function outputText(response) {
  if (response.output_text) return response.output_text;
  return (response.output || []).flatMap(x => x.content || []).filter(x => x.type === "output_text").map(x => x.text).join("\n");
}

function parseModelJson(text) {
  const cleaned = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const starts = [...cleaned.matchAll(/\{\s*"fields"/g)].map(x => x.index).reverse();
  const ends = [...cleaned.matchAll(/\}/g)].map(x => x.index + 1).reverse();
  for (const start of starts) {
    for (const end of ends) {
      if (end <= start) continue;
      try {
        const parsed = JSON.parse(cleaned.slice(start, end));
        if (parsed && typeof parsed.fields === "object") return parsed;
      } catch {}
    }
  }
  if (process.env.DEBUG_AI_OUTPUT === "1") console.error("AI_DEBUG_OUTPUT:", cleaned.slice(0, 1200));
  throw new Error("AI 未返回可解析的字段 JSON");
}

async function extractRequirements(payload, key) {
  const files = Array.isArray(payload.files) ? payload.files.slice(0, 10) : [];
  if (!files.length) throw new Error("没有收到可识别文件");
  const uploadedIds = [];
  const content = [{
    type: "input_text",
    text: `你是政企、新闻与公共服务行业的高级设计需求分析师。请从附件中提取可用于 UI Design Brief 的信息，不要臆造。\n\n先逐个判断附件角色：业务需求/栏目规划、原型截图、已有设计稿、视觉参考、品牌素材、数据内容或其他。再判断最终要设计的交付物类型。设计类型只能输出以下一个标准值：小程序、原生 APP、Web 网站、H5 活动页、单个页面、Logo、Icon、数字 Banner、平面设计 / 海报、数据大屏、PPT、组件 / Design System。\n\n分类规则：\n- 海报、宣传单、折页、易拉宝、展板、画册、名片、包装、印刷物料、平面稿 → 平面设计 / 海报；\n- PPT、汇报、演示文稿、幻灯片、路演稿 → PPT；\n- 明确写微信/支付宝/抖音小程序，或出现明确的小程序胶囊/平台标识 → 小程序；\n- 明确要求 iOS、Android、手机客户端或原生系统能力 → 原生 APP；不要只因画面是手机比例或有 TabBar 就判为 APP；\n- H5、移动专题、微信活动页、浏览器移动服务页、落地页 → H5 活动页；\n- 网站、官网、门户、PC 网页、Web 应用、浏览器后台 → Web 网站；\n- 驾驶舱、指挥中心、LED 大屏、可视化大屏 → 数据大屏；\n- 单个数字广告横幅或社交配图 → 数字 Banner；Logo、Icon、组件系统分别按名称分类。\n如果一个附件是栏目/功能规划，另一个是效果参考，以栏目规划中明确的目标平台为准；效果参考不能覆盖目标类型。不要仅凭行业或图片宽高比判断类型。\n${TYPE_EXTRACTION_RULES}\n\n允许字段：${(payload.allowedFields || []).join("、")}。\n必须在 fields 中输出“设计类型”和“设计类型判断依据”；依据用一句话说明识别到的平台、载体或画布特征。栏目规划表中的“平台、版块、功能、功能描述”要归纳到该类型对应的页面、功能、路径和能力字段，不要整表塞进单一字段。颜色尽量输出十六进制；尺寸保留“名称 宽×高”的写法。\n\n只输出一个 JSON 对象，格式：{"fields":{"字段名":"字段值"},"notes":["附件角色：文件名—角色","缺少：关键字段"],"confidence":0到1}。字段名必须优先使用允许字段；无法判断的字段不要输出。`
  }];
  try {
    for (const file of files) {
      if (file.text) {
        content.push({ type: "input_text", text: `\n附件《${file.name}》：\n${String(file.text).slice(0, 120000)}` });
      } else if (file.dataUrl && String(file.mimeType).startsWith("image/")) {
        content.push({ type: "input_text", text: `\n附件《${file.name}》：图片${file.width && file.height ? `，原始尺寸 ${file.width}×${file.height}` : ""}。请先判断它是需求/原型/已有设计/视觉参考/品牌素材中的哪一种。` });
        content.push({ type: "input_image", image_url: file.dataUrl });
      } else if (file.dataUrl) {
        const uploaded = await uploadFile(file, key);
        uploadedIds.push(uploaded.id);
        content.push({ type: "input_file", file_id: uploaded.id });
      }
    }
    const response = await openAI("/responses", key, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: getProviderConfig().model,
        input: [{ role: "user", content }],
        text: { format: { type: "json_object" } }
      })
    });
    return parseModelJson(outputText(response));
  } finally {
    await Promise.allSettled(uploadedIds.map(id => openAI(`/files/${id}`, key, { method: "DELETE" })));
  }
}

async function serveFile(req, res) {
  const pathname = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`).pathname;
  const file = pathname === "/" ? HOME_FILE : pathname.slice(1);
  if (file.includes("..") || ![HOME_FILE, "favicon.ico", "favicon.svg"].includes(file)) return json(res, 404, { error: "未找到" });
  if (file === "favicon.ico") return res.writeHead(204).end();
  const data = await readFile(join(ROOT, file));
  res.writeHead(200, { "content-type": file.endsWith(".svg") ? "image/svg+xml; charset=utf-8" : "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!sameOrigin(req)) return json(res, 403, { error: "仅允许从本机需求表单调用" });
    if (req.method === "GET" && req.url === "/api/status") {
      const provider = getProviderConfig();
      const imageProvider = getImageProviderConfig();
      return json(res, 200, { ready: Boolean(getApiKey()), model: provider.model, provider: new URL(provider.baseUrl).hostname, imageModel: imageProvider.model, imageProvider: new URL(imageProvider.baseUrl).hostname });
    }
    if (req.method === "GET" && req.url === "/api/image-auth") {
      return json(res, 200, { authenticated: imageAuthorized(req) });
    }
    if (req.method === "POST" && req.url === "/api/image-login") {
      const client = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "local").split(",")[0].trim();
      const recent = (imageLoginAttempts.get(client) || []).filter(x => x > Date.now() - 15 * 60 * 1000);
      if (recent.length >= 8) return json(res, 429, { error: "尝试次数过多，请 15 分钟后再试" });
      const credentials = await readJson(req);
      if (!imageLoginValid(credentials.username, credentials.password)) {
        recent.push(Date.now()); imageLoginAttempts.set(client, recent);
        return json(res, 401, { error: "账号或密码不正确" });
      }
      imageLoginAttempts.delete(client);
      const token = randomBytes(32).toString("hex");
      imageSessions.set(token, Date.now() + IMAGE_SESSION_MS);
      return json(res, 200, { authenticated: true }, { "set-cookie": imageSessionCookie(req, token) });
    }
    if (req.method === "POST" && req.url === "/api/extract") {
      const now = Date.now();
      while (requests.length && requests[0] < now - 60 * 60 * 1000) requests.shift();
      if (requests.length >= 20) return json(res, 429, { error: "识别次数过多，请稍后再试" });
      requests.push(now);
      const key = getApiKey();
      if (!key) return json(res, 503, { error: "未在 macOS 钥匙串中找到 KBIT_OPENAI_API_KEY" });
      const payload = await readJson(req);
      try {
        const result = await extractRequirements(payload, key);
        await recordUsage("智能导入", { status: "success", model: getProviderConfig().model, files: (payload.files || []).map(x => x.name), fields: result.fields, notes: result.notes, confidence: result.confidence });
        return json(res, 200, result);
      } catch (error) {
        await recordUsage("智能导入", { status: "failed", model: getProviderConfig().model, files: (payload.files || []).map(x => x.name), error: error.message });
        throw error;
      }
    }
    if (req.method === "POST" && req.url === "/api/generate-image") {
      if (!imageAuthorized(req)) return json(res, 401, { error: "请先验证生图权限", authRequired: true });
      const payload = await readJson(req), provider = getImageProviderConfig();
      try {
        const result = await generateDesignImage(payload);
        await recordUsage("生成设计图", { status: "success", model: provider.model, quality: provider.quality, size: payload.size, prompt: payload.prompt, streamed: result.streamed });
        return json(res, 200, result);
      } catch (error) {
        await recordUsage("生成设计图", { status: "failed", model: provider.model, quality: provider.quality, size: payload.size, prompt: payload.prompt, error: error.message });
        throw error;
      }
    }
    if (req.method === "POST" && req.url === "/api/record") {
      const payload = await readJson(req);
      await recordUsage(String(payload.type || "页面操作").slice(0, 50), payload.detail || {});
      return json(res, 200, { recorded: true });
    }
    if (req.method === "GET") return await serveFile(req, res);
    return json(res, 405, { error: "不支持的请求" });
  } catch (error) {
    console.error(`[${new Date().toISOString()}]`, error.message);
    if (/524|timeout|timed out|超时/i.test(error.message)) return json(res, 504, { error: "图片通道生成超时。为避免重复扣费，系统没有自动重试；请稍后查看通道记录，或改用稳定模式后重新生成。" });
    return json(res, 500, { error: error.message || "处理失败" });
  }
});

server.listen(PORT, HOST, () => {
  const provider = getProviderConfig();
  console.log(`KBIT UI Design Brief 已启动：http://${HOST}:${PORT}`);
  console.log(getApiKey() ? `AI 识别已就绪（${provider.model} · ${new URL(provider.baseUrl).hostname}）` : "尚未配置 API Key，请先写入 macOS 钥匙串或 ~/.codex/auth.json");
});
