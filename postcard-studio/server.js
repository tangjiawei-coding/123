// 本地明信片生成服务器 —— 仅使用 Node 内置模块，无需 npm 安装任何依赖
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const config = require('./config.json');

const PORT = config.port || 5123;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const IMG_DIR = path.join(DATA_DIR, 'community_images');
const DB_FILE = path.join(DATA_DIR, 'community.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ posts: [], comments: [] }, null, 2));

// ---------- 社区数据读写 ----------
function loadDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data.posts) data.posts = [];
    if (!data.comments) data.comments = [];
    return data;
  } catch (e) {
    console.error('[db] 读取失败，重置为空库', e.message);
    return { posts: [], comments: [] };
  }
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}
// 把 dataURL 保存为图片文件，返回相对路径 ID
function saveImageFromDataUrl(dataUrl) {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('图片格式不正确');
  const mime = m[1];
  const ext = mime === 'image/png' ? 'png' : (mime === 'image/webp' ? 'webp' : 'jpg');
  const id = genId('img') + '.' + ext;
  const buf = Buffer.from(m[2], 'base64');
  fs.writeFileSync(path.join(IMG_DIR, id), buf);
  return id;
}

// ---------- 6 个 Codex skill 注册表 ----------
// 每个 skill 的提示词文件运行时读取进内存；读取失败只记录不崩，其他 skill 仍可用
const SKILLS_ROOT = path.join(require('os').homedir(), '.codex', 'skills');
const SKILLS = [
  {
    id: 'photo-abstract-editorial',
    name: '象牙抽象编辑',
    desc: '象牙底抽象面板 + 英文标题，不含原图（默认）',
    dir: path.join(SKILLS_ROOT, 'photo-abstract-editorial'),
    promptFile: 'references/photo-abstract-editorial-prompt.en.md',
    // 保留 ./skill/prompt.en.md 兜底，维持原有行为
    localFallback: path.join(__dirname, 'skill', 'prompt.en.md'),
    // directive 保留原值，确保该 skill 行为不变
    directive: 'Treat the attached image as the uploaded photograph to ANALYZE, not to reproduce. OVERRIDE: do NOT include, show, copy, or reproduce the original photograph anywhere in the output. Produce ONLY an original abstract editorial artwork: a flat, uniform ivory (#F3F0E8) panel filled with sparse, minimal abstract marks extracted solely from the photo\'s spatial, tonal and color relationships, plus one poetic 2-5 word English title. Ignore any instruction in the skill below that asks you to preserve or display the original photograph; keep all other abstract-panel, mark, color, whitespace and title rules.',
    headerLabel: 'PHOTO ABSTRACT EDITORIAL SKILL PROMPT',
  },
  {
    id: 'scenes-gathered-zine-v1-3',
    name: '实景拼贴 Zine',
    desc: '保留原图为视觉锚点 + 撕纸边抽象延伸',
    dir: path.join(SKILLS_ROOT, 'scenes-gathered-zine-v1-3'),
    promptFile: 'SKILL.md',
    directive: 'Treat the attached image as the source photograph to PRESERVE as a truthful visual anchor. Generate a vertical 3:5 Gathered Scenes Zine poster that keeps the original photographed scene inside a spacious source-derived abstract illustration field with one added high-chroma hue and a visible hand-torn fibrous paper edge, following the skill spec below.',
    headerLabel: 'SKILL PROMPT: scenes-gathered-zine-v1-3',
  },
  {
    id: 'scene-distillation-zine-v1-3',
    name: '影像蒸馏 Zine',
    desc: '不含原图，从照片提取语义核心重创插画',
    dir: path.join(SKILLS_ROOT, 'scene-distillation-zine-v1-3'),
    promptFile: 'SKILL.md',
    directive: 'Treat the attached image as a semantic reference only; do NOT reproduce, embed, crop, trace, or retain any photographic pixels. Distill its semantic nucleus into an original paper-poster illustration with one central tension, one source-derived visual metaphor, and high-chroma accent, following the skill spec below.',
    headerLabel: 'SKILL PROMPT: scene-distillation-zine-v1-3',
  },
  {
    id: 'gc-minimal-zine-poster',
    name: '极简 Zine 海报',
    desc: '大留白 + 单一视觉事件 + 高彩度锚色',
    dir: path.join(SKILLS_ROOT, 'gc-minimal-zine-poster'),
    promptFile: 'references/style-system.md',
    directive: 'Treat the attached image as the source content for a sparse vertical 3:5 paper zine poster. Generate one clear visual event with 70-90% open paper, warm paper texture, restrained typography, and one high-chroma color accent; you may preserve a faded photo fragment as the focal element or reinterpret it as a printed illustration, following the skill spec below.',
    headerLabel: 'SKILL PROMPT: gc-minimal-zine-poster',
  },
  {
    id: 'heytea-style',
    name: '喜茶风格',
    desc: '保留实物照片 + 黑线小人涂鸦互动',
    dir: path.join(SKILLS_ROOT, 'heytea-style'),
    promptFile: 'references/style-guide.md',
    directive: 'Treat the attached image as the source photograph. PRESERVE the main photographed object as a real object anchor on a clean white background, then add primitive black-line micro-worker doodles interacting with it, following the skill spec below.',
    headerLabel: 'SKILL PROMPT: heytea-style',
  },
  {
    id: 'ian-xiaohei-illustrations',
    name: '小黑怪诞配图',
    desc: '白底手绘小黑怪诞配图（照片作主题源）',
    dir: path.join(SKILLS_ROOT, 'ian-xiaohei-illustrations'),
    promptFile: 'references/prompt-template.md',
    directive: 'Treat the attached image as the content/theme source; do NOT reproduce the original photograph. Generate a pure-white-background minimalist black hand-drawn illustration featuring 小黑 (a small solid-black absurd creature with white dot eyes) performing a core conceptual action inspired by the photo, following the skill spec below.',
    headerLabel: 'SKILL PROMPT: ian-xiaohei-illustrations',
  },
];

// 启动时把每个 skill 的提示词内容读进内存：id -> { content, source, loaded }
const SKILL_PROMPTS = new Map();
for (const s of SKILLS) {
  // photo-abstract-editorial 保留 localFallback 兜底；其余 skill 只读 dir+promptFile
  const candidates = [path.join(s.dir, s.promptFile)];
  if (s.localFallback) candidates.push(s.localFallback);
  let loaded = false;
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8').trim();
        SKILL_PROMPTS.set(s.id, { content, source: p, loaded: true });
        console.log('[skill] 加载成功: ' + s.id + ' (' + content.length + ' 字节, 来源: ' + p + ')');
        loaded = true;
        break;
      }
    } catch (e) { /* 试下一个候选路径 */ }
  }
  if (!loaded) {
    SKILL_PROMPTS.set(s.id, { content: '', source: candidates[0], loaded: false });
    console.warn('[skill] 加载失败: ' + s.id + ' (尝试路径: ' + candidates.join(' / ') + ')');
  }
}

// ---------- 工具：发起 HTTPS 请求，返回 { statusCode, body } ----------
// timeoutMs 可传，图像生成允许更长超时（默认 120s），文本生成 60s
function httpsRequest(method, urlStr, headers, bodyBuffer, timeoutMs) {
  const t = timeoutMs || 120000;
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const options = {
      method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: headers || {},
      timeout: t,
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ statusCode: res.statusCode, headers: res.headers, body: buf });
      });
    });
    req.on('error', reject);
    req.setTimeout(t, () => req.destroy(new Error('请求超时（' + Math.round(t/1000) + 's）——上游 API 无响应，请稍后重试')));
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

// ---------- 工具：带指数退避的重试包装器 ----------
// fn: 异步函数；maxAttempts: 最大尝试次数；baseDelayMs: 初始等待；label: 日志标签
async function withRetry(fn, maxAttempts, baseDelayMs, label) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) console.log('[retry] ' + label + ' 第' + attempt + '次尝试 ✓ 成功');
      return result;
    } catch (e) {
      lastErr = e;
      const msg = e.message || String(e);
      console.error('[retry] ' + label + ' 第' + attempt + '/' + maxAttempts + '次失败: ' + msg.slice(0, 200));
      if (attempt < maxAttempts) {
        // 指数退避 + 随机抖动: 第1次等待 baseDelayMs, 第2次 2*baseDelayMs ±20%
        const delay = Math.round(baseDelayMs * Math.pow(2, attempt - 1) * (0.8 + Math.random() * 0.4));
        console.log('[retry] ' + label + ' ' + Math.round(delay/1000) + ' 秒后自动重试…');
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ---------- 工具：构建 multipart/form-data 请求体 ----------
function buildMultipart(fields, file) {
  const boundary = '----TraeBoundary' + Math.random().toString(36).slice(2);
  const parts = [];
  const CRLF = '\r\n';
  const push = (s) => parts.push(Buffer.from(s, 'utf8'));

  for (const [name, value] of Object.entries(fields)) {
    push('--' + boundary + CRLF);
    push('Content-Disposition: form-data; name="' + name + '"' + CRLF + CRLF);
    push(String(value) + CRLF);
  }
  if (file) {
    push('--' + boundary + CRLF);
    push('Content-Disposition: form-data; name="image"; filename="' + file.filename + '"' + CRLF);
    push('Content-Type: ' + file.mime + CRLF + CRLF);
    parts.push(file.buffer);
    push(CRLF);
  }
  push('--' + boundary + '--' + CRLF);

  return { body: Buffer.concat(parts), contentType: 'multipart/form-data; boundary=' + boundary };
}

// ---------- 调用图像编辑 API：以用户照片为输入，生成编辑式作品 ----------
async function generateEditorialImage(imageBuffer, mime, ext, userText, size, skillId) {
  // 根据 skillId 取对应 skill 的 directive 与提示词内容
  const skill = SKILLS.find(s => s.id === skillId) || SKILLS[0];
  const entry = SKILL_PROMPTS.get(skill.id);
  if (!entry || !entry.loaded || !entry.content) {
    throw new Error('skill "' + skill.id + '" 提示词未加载，无法生成');
  }
  const directive = skill.directive;
  const skillCore = entry.content;
  const mood = userText && userText.trim()
    ? '\n\nReflect this user mood/context in the composition and title: ' + userText.trim()
    : '';
  const fullPrompt = directive + '\n\n===== ' + skill.headerLabel + ' =====\n' + skillCore + '\n===== END SKILL PROMPT =====' + mood;

  const effectiveSize = size || config.imageSize || '1024x1024';
  console.log('[image] skill=' + skill.id + ' 生成尺寸=' + effectiveSize);
  const fields = {
    model: config.imageModel,
    prompt: fullPrompt,
    n: '1',
    size: effectiveSize,
  };
  const ext2 = ext && ext.length ? ext.replace('.', '') : 'jpg';
  const file = {
    filename: 'photo.' + ext2,
    mime: mime || 'image/jpeg',
    buffer: imageBuffer,
  };
  const { body, contentType } = buildMultipart(fields, file);

  // 图像生成本身较慢，使用 120s 超时
  const res = await httpsRequest('POST', config.baseUrl + '/images/edits', {
    Authorization: 'Bearer ' + config.apiKey,
    'Content-Type': contentType,
  }, body, 120000);

  if (res.statusCode !== 200) {
    const errBody = res.body.toString('utf8').slice(0, 500);
    // 尝试识别常见错误类型，给用户更友好的提示
    let hint = '';
    if (res.statusCode === 429) hint = '（请求过于频繁，上游限流）';
    else if (res.statusCode === 401 || res.statusCode === 403) hint = '（API Key 无效或无权限）';
    else if (res.statusCode >= 500) hint = '（上游服务器内部错误，通常稍后重试即可恢复）';
    throw new Error('【抽象图生成失败】' + hint + ' HTTP ' + res.statusCode + ': ' + errBody);
  }
  let json;
  try {
    json = JSON.parse(res.body.toString('utf8'));
  } catch (e) {
    throw new Error('【抽象图生成失败】上游返回非 JSON 数据');
  }
  const item = json.data && json.data[0];
  if (!item) throw new Error('【抽象图生成失败】上游返回 data 为空');
  if (item.b64_json) return 'data:image/png;base64,' + item.b64_json;
  if (item.url) return item.url;
  throw new Error('【抽象图生成失败】返回格式无法识别');
}

// ---------- 调用多模态文本 API：结合照片与用户文字，生成一句哲理话 ----------
async function generateSentence(imageDataUrl, userText) {
  const hasText = userText && userText.trim();
  const langRule = 'Write the sentence in the SAME language as the user description below '
    + '(Chinese if the user writes Chinese, English if English). If the description is empty, write in Chinese.';

  const systemMsg = 'You are a poetic editor. Look at the photograph. Write exactly ONE beautiful, philosophical sentence '
    + 'that reflects the photo\'s real mood and the user\'s words. Be concise and elegant. '
    + langRule + ' Output only the single sentence itself — no quotation marks, no labels, no explanation, no line breaks.';

  const userPrompt = hasText
    ? '用户对这张照片的描述：' + userText.trim()
    : '（用户未提供描述，请仅依据照片本身）';

  const body = JSON.stringify({
    model: config.textModel,
    messages: [
      { role: 'system', content: systemMsg },
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
    temperature: 0.8,
  });

  // 文本生成较快，使用 60s 超时
  const res = await httpsRequest('POST', config.baseUrl + '/chat/completions', {
    Authorization: 'Bearer ' + config.apiKey,
    'Content-Type': 'application/json',
  }, Buffer.from(body, 'utf8'), 60000);

  if (res.statusCode !== 200) {
    const errBody = res.body.toString('utf8').slice(0, 500);
    let hint = '';
    if (res.statusCode === 429) hint = '（请求过于频繁，上游限流）';
    else if (res.statusCode === 401 || res.statusCode === 403) hint = '（API Key 无效或无权限）';
    else if (res.statusCode >= 500) hint = '（上游服务器内部错误，通常稍后重试即可恢复）';
    throw new Error('【哲理文案生成失败】' + hint + ' HTTP ' + res.statusCode + ': ' + errBody);
  }
  let json;
  try {
    json = JSON.parse(res.body.toString('utf8'));
  } catch (e) {
    throw new Error('【哲理文案生成失败】上游返回非 JSON 数据');
  }
  const text = (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || '';
  if (!text.trim()) throw new Error('【哲理文案生成失败】上游返回文本为空');
  return text.trim().replace(/^[""''『「]+|[""''』」]+$/g, '');
}

// ---------- 静态文件服务 ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveStaticDir(dir, req, res) {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const filePath = path.join(dir, p);
  if (!filePath.startsWith(dir)) {
    res.writeHead(403); res.end('Forbidden'); return false;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
    return true;
  } catch (e) {
    return false;
  }
}

function serveStatic(req, res) {
  // 先尝试社区图片目录
  if (req.url.startsWith('/community_img/')) {
    const p = decodeURIComponent(req.url.split('?')[0]).replace('/community_img/', '');
    const filePath = path.join(IMG_DIR, p);
    if (!filePath.startsWith(IMG_DIR)) { res.writeHead(403); res.end('Forbidden'); return true; }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
      return true;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found: ' + req.url);
    return true;
  }
  // 再尝试 public 目录
  const ok = serveStaticDir(PUBLIC_DIR, req, res);
  if (!ok) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found: ' + req.url);
  }
  return true;
}

// ---------- 读取请求体 ----------
function readBody(req, limitMB) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const limit = limitMB * 1024 * 1024;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { req.destroy(); reject(new Error('请求体过大（上限 ' + limitMB + 'MB）')); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function jsonOK(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
function jsonErr(res, status, msg) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: msg }));
}

// ---------- 社区 API 处理 ----------
function handleCommunityAPI(req, res) {
  const url = req.url.split('?')[0];

  // GET /api/community/posts —— 获取帖子列表（带分页、评论数统计）
  if (req.method === 'GET' && url === '/api/community/posts') {
    const db = loadDB();
    const query = new URL(req.url, 'http://x').searchParams;
    const page = Math.max(1, parseInt(query.get('page') || '1'));
    const pageSize = Math.min(50, Math.max(1, parseInt(query.get('pageSize') || '10')));
    const start = (page - 1) * pageSize;
    // 按时间倒序
    const sorted = [...db.posts].sort((a, b) => b.createdAt - a.createdAt);
    const total = sorted.length;
    const pagePosts = sorted.slice(start, start + pageSize).map(p => ({
      ...p,
      commentCount: db.comments.filter(c => c.postId === p.id).length,
    }));
    return jsonOK(res, { posts: pagePosts, total, page, pageSize });
  }

  // POST /api/community/posts —— 发布新帖子（分享明信片）
  if (req.method === 'POST' && url === '/api/community/posts') {
    return (async () => {
      try {
        const buf = await readBody(req, 20); // 图片可能较大
        const payload = JSON.parse(buf.toString('utf8'));
        const author = (payload.author || '匿名用户').toString().slice(0, 30).trim() || '匿名用户';
        const title = (payload.title || '').toString().slice(0, 100).trim();
        const description = (payload.description || '').toString().slice(0, 500);
        const sentence = (payload.sentence || '').toString().slice(0, 300);
        const imageDataUrl = payload.image || '';
        if (!imageDataUrl) return jsonErr(res, 400, '缺少图片');

        // 如果是 dataURL 就保存到本地；如果是外部 URL 就直接记录
        let imageUrl = imageDataUrl;
        if (imageDataUrl.startsWith('data:image/')) {
          const imgId = saveImageFromDataUrl(imageDataUrl);
          imageUrl = '/community_img/' + imgId;
        }

        const post = {
          id: genId('post'),
          author,
          title,
          description,
          sentence,
          image: imageUrl,
          likes: 0,
          likers: [],
          createdAt: Date.now(),
        };
        const db = loadDB();
        db.posts.push(post);
        saveDB(db);
        console.log('[community] 新帖子发布：' + post.id + ' 作者：' + author);
        return jsonOK(res, { ok: true, post });
      } catch (e) {
        console.error('[community] 发布失败：', e.message);
        return jsonErr(res, 500, '发布失败：' + e.message);
      }
    })();
  }

  // POST /api/community/posts/:id/like —— 点赞/取消点赞
  const likeMatch = url.match(/^\/api\/community\/posts\/([^/]+)\/like$/);
  if (req.method === 'POST' && likeMatch) {
    return (async () => {
      try {
        const buf = await readBody(req, 1);
        const payload = JSON.parse(buf.toString('utf8') || '{}');
        const user = (payload.user || 'visitor').toString().slice(0, 30) || 'visitor';
        const postId = likeMatch[1];
        const db = loadDB();
        const post = db.posts.find(p => p.id === postId);
        if (!post) return jsonErr(res, 404, '帖子不存在');
        if (!Array.isArray(post.likers)) post.likers = [];
        const idx = post.likers.indexOf(user);
        if (idx >= 0) {
          post.likers.splice(idx, 1);
          post.likes = Math.max(0, (post.likes || 0) - 1);
        } else {
          post.likers.push(user);
          post.likes = (post.likes || 0) + 1;
        }
        saveDB(db);
        return jsonOK(res, { ok: true, likes: post.likes, liked: idx < 0 });
      } catch (e) {
        return jsonErr(res, 500, '点赞失败：' + e.message);
      }
    })();
  }

  // GET /api/community/posts/:id/comments —— 获取帖子评论
  const cmtGetMatch = url.match(/^\/api\/community\/posts\/([^/]+)\/comments$/);
  if (req.method === 'GET' && cmtGetMatch) {
    const postId = cmtGetMatch[1];
    const db = loadDB();
    const comments = db.comments
      .filter(c => c.postId === postId)
      .sort((a, b) => a.createdAt - b.createdAt);
    return jsonOK(res, { comments }) || true;
  }

  // POST /api/community/posts/:id/comments —— 发表评论
  const cmtPostMatch = url.match(/^\/api\/community\/posts\/([^/]+)\/comments$/);
  if (req.method === 'POST' && cmtPostMatch) {
    return (async () => {
      try {
        const buf = await readBody(req, 2);
        const payload = JSON.parse(buf.toString('utf8'));
        const postId = cmtPostMatch[1];
        const author = (payload.author || '匿名用户').toString().slice(0, 30).trim() || '匿名用户';
        const content = (payload.content || '').toString().slice(0, 500).trim();
        if (!content) return jsonErr(res, 400, '评论内容不能为空');
        const db = loadDB();
        const post = db.posts.find(p => p.id === postId);
        if (!post) return jsonErr(res, 404, '帖子不存在');
        const comment = {
          id: genId('cmt'),
          postId,
          author,
          content,
          createdAt: Date.now(),
        };
        db.comments.push(comment);
        saveDB(db);
        console.log('[community] 新评论：' + comment.id + ' 帖子：' + postId);
        return jsonOK(res, { ok: true, comment });
      } catch (e) {
        return jsonErr(res, 500, '评论失败：' + e.message);
      }
    })();
  }

  return false; // 未匹配到社区 API
}

// ---------- 主服务 ----------
const server = http.createServer(async (req, res) => {
  // 跨域（仅本地，方便调试）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url.split('?')[0];
  console.log('[req]', req.method, url);

  // ----- 社区 API -----
  if (url.startsWith('/api/community/')) {
    // 用 headersSent 判断：只要社区 handler 已发响应头即结束，避免下落到 serveStatic 触发 ERR_HTTP_HEADERS_SENT
    handleCommunityAPI(req, res);
    if (res.headersSent) return;
  }

  // 生成接口
  if (req.method === 'POST' && url.startsWith('/api/generate')) {
    try {
      const buf = await readBody(req, 25);
      const payload = JSON.parse(buf.toString('utf8'));
      const dataUrl = payload.image || '';
      const userText = payload.text || '';
      const mode = payload.mode === 'quality' ? 'quality' : 'fast';
      // 读取可选的 skill 字段，默认 photo-abstract-editorial
      const skillId = (payload.skill || 'photo-abstract-editorial').toString();
      const skillMeta = SKILLS.find(s => s.id === skillId);
      if (!skillMeta) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: '未知 skill: ' + skillId }));
        return;
      }
      const skillEntry = SKILL_PROMPTS.get(skillId);
      if (!skillEntry || !skillEntry.loaded) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'skill "' + skillId + '" 提示词未加载' }));
        return;
      }
      const imageSize = mode === 'quality'
        ? (config.imageSize || '1024x1024')
        : (config.imageSizeFast || '768x768');
      console.log('[generate] skill=' + skillId + ' mode=' + mode + ' imageSize=' + imageSize);

      const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s.exec(dataUrl);
      if (!m) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: '图片数据格式不正确' }));
        return;
      }
      const mime = m[1];
      const imageBuffer = Buffer.from(m[2], 'base64');
      const ext = mime.split('/')[1] || 'jpg';

      // 两路并行：左图 + 右句；各自独立自动重试，缓解上游间歇性报错
      // 图像：max 3 次尝试，首次等待 3s（指数退避后第二次 6s）
      // 文案：max 3 次尝试，首次等待 3s
      const MAX_ATTEMPTS = 3;
      const BASE_DELAY_MS = 3000;
      const t0 = Date.now();
      const [imageUrl, sentence] = await Promise.all([
        withRetry(
          () => generateEditorialImage(imageBuffer, mime, ext, userText, imageSize, skillId),
          MAX_ATTEMPTS, BASE_DELAY_MS, '图像生成'
        ),
        withRetry(
          () => generateSentence(dataUrl, userText),
          MAX_ATTEMPTS, BASE_DELAY_MS, '文案生成'
        ),
      ]);
      console.log('[generate] 全部完成，总耗时 ' + Math.round((Date.now() - t0)/1000) + 's');

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ image: imageUrl, sentence }));
    } catch (e) {
      console.error('[generate] 错误:', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: e.message || '生成失败' }));
    }
    return;
  }

  // 健康检查
  if (req.method === 'GET' && url.startsWith('/api/health')) {
    const db = loadDB();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      imageModel: config.imageModel,
      textModel: config.textModel,
      community: { posts: db.posts.length, comments: db.comments.length },
    }));
    return;
  }

  // skill 列表（供前端下拉框用，不泄露提示词全文）
  if (req.method === 'GET' && url === '/api/skills') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(SKILLS.map(s => ({ id: s.id, name: s.name, desc: s.desc }))));
    return;
  }

  // 所有 skill 加载状态（调试用，返回每个 skill 是否加载成功）
  if (req.method === 'GET' && url.startsWith('/api/skill')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      skills: SKILLS.map(s => {
        const e = SKILL_PROMPTS.get(s.id) || {};
        return {
          id: s.id,
          name: s.name,
          loaded: !!(e && e.loaded),
          source: (e && e.source) || '',
          length: (e && e.content) ? e.content.length : 0,
        };
      }),
    }));
    return;
  }

  // 静态资源（防崩：若某 handler 已发 headers 却未 return，这里跳过避免 ERR_HTTP_HEADERS_SENT）
  if (res.headersSent) {
    console.error('[fallthrough] headers already sent for', req.method, url, '— skip serveStatic');
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  const url = 'http://127.0.0.1:' + PORT;
  console.log('================================================');
  console.log('  明信片生成服务已启动');
  console.log('  地址： ' + url);
  console.log('  浏览器将自动打开。按 Ctrl + C 可停止服务');
  const loadedCount = SKILLS.filter(s => (SKILL_PROMPTS.get(s.id) || {}).loaded).length;
  console.log('  skill 加载：' + loadedCount + '/' + SKILLS.length + ' 个');
  SKILLS.forEach(s => {
    const e = SKILL_PROMPTS.get(s.id) || {};
    console.log('    - ' + s.id + ': ' + (e.loaded ? 'OK (' + (e.content || '').length + ' 字节)' : '失败'));
  });
  const db = loadDB();
  console.log('  社区数据：帖子 ' + db.posts.length + ' · 评论 ' + db.comments.length);
  console.log('  上游 API： ' + config.baseUrl);
  console.log('------------------------------------------------');
  console.log('  正在检测上游 API 连通性…');
  // 异步检测，不阻塞服务启动
  (async () => {
    try {
      const t0 = Date.now();
      const res = await httpsRequest('GET', config.baseUrl + '/models', {
        Authorization: 'Bearer ' + config.apiKey,
      }, null, 10000);
      const dt = Math.round(Date.now() - t0);
      if (res.statusCode === 200) {
        console.log('  ✓ 上游 API 可达 (HTTP 200, 延迟 ' + dt + 'ms) —— 可以正常生成');
      } else {
        console.warn('  ⚠ 上游 API 返回异常 HTTP ' + res.statusCode + ' —— 生成可能失败，服务仍会自动重试 3 次');
        console.warn('    响应片段: ' + res.body.toString('utf8').slice(0, 120));
      }
    } catch (e) {
      console.warn('  ⚠ 上游 API 当前不可达: ' + (e.message || String(e)).slice(0, 120));
      console.warn('    （间歇性故障属正常现象，生成时服务会自动重试 3 次，间隔 3s/6s 指数退避）');
      console.warn('    若持续失败，请检查网络或稍后再试');
    }
    console.log('================================================');
  })();
  exec('start "" ' + url, () => {});
});
