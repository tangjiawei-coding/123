// 本地明信片生成服务器 —— 仅使用 Node 内置模块，无需 npm 安装任何依赖
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const config = require('./config.json');
// 优先从环境变量读取上游 API 密钥，避免明文写入 config.json
config.apiKey = process.env.POSTCARD_API_KEY || config.apiKey || '';
config.baseUrl = process.env.POSTCARD_API_BASE_URL || config.baseUrl;

const PORT = Number(process.env.PORT) || config.port || 5123;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.POSTCARD_DATA_DIR || path.join(__dirname, 'data');
const IMG_DIR = path.join(DATA_DIR, 'community_images');
const DB_FILE = path.join(DATA_DIR, 'community.json');
const CARDS_FILE = path.join(DATA_DIR, 'cards.json');
const MYWORKS_FILE = path.join(DATA_DIR, 'myworks.json');
const FOLLOWS_FILE = path.join(DATA_DIR, 'follows.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ posts: [], comments: [] }, null, 2));
if (!fs.existsSync(CARDS_FILE)) fs.writeFileSync(CARDS_FILE, JSON.stringify({ cards: [] }, null, 2));
if (!fs.existsSync(MYWORKS_FILE)) fs.writeFileSync(MYWORKS_FILE, JSON.stringify({ works: [] }, null, 2));
if (!fs.existsSync(FOLLOWS_FILE)) fs.writeFileSync(FOLLOWS_FILE, JSON.stringify({ relations: [] }, null, 2));
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, JSON.stringify({ sessions: {} }, null, 2));

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
// 寄送卡片读写
function loadCards() {
  try {
    const raw = fs.readFileSync(CARDS_FILE, 'utf8');
    const d = JSON.parse(raw);
    if (!d.cards) d.cards = [];
    return d;
  } catch (e) {
    console.error('[cards] 读取失败，重置为空', e.message);
    return { cards: [] };
  }
}
function saveCards(d) {
  fs.writeFileSync(CARDS_FILE, JSON.stringify(d, null, 2));
}
// 我的作品读写
function loadMyWorks() {
  try {
    const d = JSON.parse(fs.readFileSync(MYWORKS_FILE, 'utf8'));
    if (!d.works) d.works = [];
    return d;
  } catch (e) { console.error('[myworks] 读取失败，重置为空', e.message); return { works: [] }; }
}
function saveMyWorks(d) { fs.writeFileSync(MYWORKS_FILE, JSON.stringify(d, null, 2)); }
// 关注关系读写
function loadFollows() {
  try {
    const d = JSON.parse(fs.readFileSync(FOLLOWS_FILE, 'utf8'));
    if (!d.relations) d.relations = [];
    return d;
  } catch (e) { console.error('[follows] 读取失败，重置为空', e.message); return { relations: [] }; }
}
function saveFollows(d) { fs.writeFileSync(FOLLOWS_FILE, JSON.stringify(d, null, 2)); }
function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}
// 生成短邀请码（用于寄送链接，比完整 id 更友好）
function genInviteCode() {
  return 'pc' + crypto.randomBytes(16).toString('hex');
}

// ---------- 用户与会话 ----------
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 会话有效期 30 天
function loadUsers() {
  try {
    const d = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (!d.users) d.users = [];
    return d;
  } catch (e) { console.error('[users] 读取失败，重置为空', e.message); return { users: [] }; }
}
function saveUsers(d) { fs.writeFileSync(USERS_FILE, JSON.stringify(d, null, 2)); }
function loadSessions() {
  try {
    const d = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    if (!d.sessions) d.sessions = {};
    // 顺手清理过期会话
    const now = Date.now();
    for (const t of Object.keys(d.sessions)) {
      if (!d.sessions[t] || (d.sessions[t].expiresAt || 0) < now) delete d.sessions[t];
    }
    return d;
  } catch (e) { console.error('[sessions] 读取失败，重置为空', e.message); return { sessions: {} }; }
}
function saveSessions(d) { fs.writeFileSync(SESSIONS_FILE, JSON.stringify(d, null, 2)); }
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
function createSession(username) {
  const token = crypto.randomBytes(24).toString('hex');
  const d = loadSessions();
  d.sessions[token] = { user: username, expiresAt: Date.now() + SESSION_TTL_MS };
  saveSessions(d);
  return token;
}
// 从 Authorization: Bearer <token> 解析当前登录用户，未登录返回 null
function getAuthUser(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers['authorization'] || '');
  if (!m) return null;
  const d = loadSessions();
  const s = d.sessions[m[1].trim()];
  if (!s || (s.expiresAt || 0) < Date.now()) return null;
  return s.user;
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

// 每个入口都保存同一份卡片内容，原图、笔迹和声音不随发布方式丢失。
function cardContent(payload, previous = {}) {
  const value = { ...previous, ...payload };
  const image = source => {
    if (!source) return '';
    if (typeof source !== 'string') throw new Error('图片格式不正确');
    if (source.startsWith('data:image/')) return '/community_img/' + saveImageFromDataUrl(source);
    if (/^https?:\/\//.test(source) || /^\/community_img\/[\w.-]+$/.test(source)) return source;
    throw new Error('图片地址不正确');
  };
  if (!value.image) throw new Error('缺少图片');
  const sound = audio => {
    if (!audio) return null;
    if (typeof audio.url !== 'string' || audio.url.length > 14 * 1024 * 1024 ||
      !/^(data:audio\/|https?:\/\/|\/community_img\/)/.test(audio.url)) throw new Error('音频格式不正确或超过 10MB');
    return { url: audio.url, name: String(audio.name || '我的声音').slice(0, 80), type: String(audio.type || '').slice(0, 80), duration: Number(audio.duration) || 0 };
  };
  const editor = value.editor?.version === 1 ? value.editor : {};
  const bounded = (number, fallback) => Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
  const ink = editor.ink;
  return {
    image: image(value.image), originalImage: image(value.originalImage),
    handwriting: image(value.handwriting), sentence: String(value.sentence || '').slice(0, 1000),
    stamp: String(value.stamp || '').slice(0, 32),
    audio: sound(value.audio), backgroundAudio: sound(value.backgroundAudio),
    editor: {
      version: 1, font: ['hand', 'serif', 'script'].includes(editor.font) ? editor.font : 'hand',
      bilingual: !!editor.bilingual, stylized: editor.stylized !== false,
      stampColor: ['brown', 'red', 'blue'].includes(editor.stampColor) ? editor.stampColor : 'brown',
      createdAt: Number.isFinite(Date.parse(editor.createdAt)) ? editor.createdAt : new Date().toISOString(),
      ink: ink ? { x: bounded(ink.x, .57), y: bounded(ink.y, .69), w: bounded(ink.w, .28), h: bounded(ink.h, .22),
        strokes: Array.isArray(ink.strokes) ? ink.strokes.slice(0, 1000).filter(Array.isArray).map(stroke => stroke.slice(0, 10000).filter(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))) : [] } : null,
    },
    skill: String(value.skill || '').slice(0, 60), tone: String(value.tone || '').slice(0, 30),
  };
}

function profileFor(user) {
  return { username: user.username, nickname: user.profile?.nickname || user.username,
    bio: user.profile?.bio || '', email: user.profile?.email || '', signature: user.profile?.signature || '',
    preferences: { font: 'hand', bilingual: false, tone: 'poetic', ...user.profile?.preferences } };
}
function postForViewer(post, db, viewer) {
  const users = loadUsers().users;
  const author = users.find(user => user.username === post.author);
  const current = users.find(user => user.username === viewer);
  return { ...post, authorName: author?.profile?.nickname || post.author,
    authorBio: author?.profile?.bio || '', commentCount: db.comments.filter(comment => comment.postId === post.id).length,
    liked: (post.likers || []).includes(viewer), collected: (current?.favorites || []).includes(post.id) };
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
      port: u.port || undefined,
      path: u.pathname + u.search,
      headers: headers || {},
      timeout: t,
    };
    const req = (u.protocol === 'http:' ? http : https).request(options, (res) => {
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

// ---------- 文案风格（tone）定义 ----------
// 不同 tone 对应不同的 system message，前端通过下拉框选择
const TONES = {
  poetic: {
    label: '哲理诗意',
    system: 'You are a poetic editor. Look at the photograph. Write TWO beautiful, philosophical sentences '
      + 'that reflect the photo\'s real mood and the user\'s words: one in CHINESE and one in ENGLISH. '
      + 'The two sentences should NOT be literal translations of each other — each should feel natural and elegant in its own language, '
      + 'but both should respond to the same photograph and mood. Be concise.',
  },
  healing: {
    label: '治愈温柔',
    system: 'You are a gentle healing storyteller. Look at the photograph. Write TWO warm, comforting sentences '
      + 'that make the reader feel seen and at peace: one in CHINESE and one in ENGLISH. '
      + 'The tone should be soft, kind, like a friend whispering good night. '
      + 'The two sentences should NOT be literal translations — each should feel natural in its own language, '
      + 'but both respond to the same photograph and mood. Be concise.',
  },
  sassy: {
    label: '毒舌吐槽',
    system: 'You are a sharp-witted commentator. Look at the photograph. Write TWO snarky, sarcastic sentences '
      + 'with a playful bite: one in CHINESE and one in ENGLISH. '
      + 'The tone should be witty and teasing, like a friend roasting you affectionately — not cruel, just funny. '
      + 'The two sentences should NOT be literal translations — each should feel natural in its own language, '
      + 'but both respond to the same photograph. Be concise.',
  },
  love: {
    label: '情侣表白',
    system: 'You are a romantic poet writing for a lover. Look at the photograph. Write TWO tender, love-soaked sentences '
      + 'as if whispering to someone you adore: one in CHINESE and one in ENGLISH. '
      + 'The tone should be intimate and yearning, never cheesy. '
      + 'The two sentences should NOT be literal translations — each should feel natural in its own language, '
      + 'but both respond to the same photograph and mood. Be concise.',
  },
  travel: {
    label: '旅行日记',
    system: 'You are a travel diarist. Look at the photograph. Write TWO evocative sentences in the voice of a wanderer\'s journal: '
      + 'one in CHINESE and one in ENGLISH. '
      + 'The tone should capture distance, wind, road, and fleeting moments — like writing on a train. '
      + 'The two sentences should NOT be literal translations — each should feel natural in its own language, '
      + 'but both respond to the same photograph. Be concise.',
  },
  literary: {
    label: '文艺留白',
    system: 'You are a minimalist literary editor. Look at the photograph. Write TWO spare, allusive sentences with strong negative space: '
      + 'one in CHINESE and one in ENGLISH. '
      + 'The tone should hint rather than declare — unfinished, breathing, like a haiku-leaning fragment. '
      + 'The two sentences should NOT be literal translations — each should feel natural in its own language, '
      + 'but both respond to the same photograph. Be concise.',
  },
};

// ---------- 调用多模态文本 API：结合照片与用户文字，生成中英双语句子 ----------
// tone: poetic|healing|sassy|love|travel|literary
// 返回格式：单字符串，中文句 + "\n" + 英文句
async function generateSentence(imageDataUrl, userText, tone, bilingual = true) {
  const hasText = userText && userText.trim();
  const toneKey = TONES[tone] ? tone : 'poetic';
  const toneDef = TONES[toneKey];

  const systemMsg = bilingual ? toneDef.system
    + ' Output format: <Chinese sentence> then a single newline then <English sentence>. '
    + 'Do not add quotation marks, labels, "中文:"/"English:" prefixes, explanations, or any other text. '
    + 'Only the two sentences separated by one newline.'
    : '你是一位明信片文案作者。根据照片与用户的话，写一句简短自然的中文留言，语气为「'
      + toneDef.label + '」。只返回中文留言，不要英文、标题、引号或解释，最多 35 个字。';

  const userPrompt = hasText
    ? '用户对这张照片的描述：' + userText.trim()
    : '请依据照片本身生成留言。';

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
  // 兼容模型把双语分隔写成 \n、\r\n、多行空行或 "|"、"||" 的情况，统一归一化为单条 "\n"
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .flatMap(l => l.split(/\s*\|\|?\s*/)) // 也接受单/双竖线作为分隔
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.replace(/^[""''『「]+|[""''』」]+$/g, '').trim())
    .filter(Boolean);
  if (lines.length === 0) throw new Error('【哲理文案生成失败】解析后文本为空');
  // 仅取前两行（防止模型多写），少于两行也能容忍
  return lines.slice(0, bilingual ? 2 : 1).join('\n');
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
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // HTML 入口禁止缓存，避免页面改版后浏览器仍用旧版本（如按钮无响应）
    if (ext === '.html') headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
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

  if (req.method === 'GET' && url === '/api/community/favorites') {
    const username = getAuthUser(req);
    if (!username) return jsonErr(res, 401, '请先登录后查看收藏');
    const ids = loadUsers().users.find(user => user.username === username)?.favorites || [];
    const db = loadDB();
    return jsonOK(res, { posts: ids.slice().reverse().map(id => db.posts.find(post => post.id === id && !post.hidden)).filter(Boolean).map(post => postForViewer(post, db, username)) });
  }
  const favoriteMatch = url.match(/^\/api\/community\/posts\/([^/]+)\/favorite$/);
  if (req.method === 'POST' && favoriteMatch) {
    const username = getAuthUser(req);
    if (!username) return jsonErr(res, 401, '请先登录后收藏');
    const db = loadDB();
    if (!db.posts.some(post => post.id === favoriteMatch[1] && !post.hidden)) return jsonErr(res, 404, '作品已转为私有或不存在');
    const users = loadUsers();
    const user = users.users.find(user => user.username === username);
    if (!user) return jsonErr(res, 401, '请重新登录');
    user.favorites ||= [];
    const index = user.favorites.indexOf(favoriteMatch[1]);
    if (index >= 0) user.favorites.splice(index, 1); else user.favorites.push(favoriteMatch[1]);
    saveUsers(users);
    return jsonOK(res, { collected: index < 0 });
  }
  const detailMatch = url.match(/^\/api\/community\/posts\/([^/]+)$/);
  if (req.method === 'GET' && detailMatch) {
    const db = loadDB();
    const post = db.posts.find(post => post.id === detailMatch[1] && !post.hidden);
    if (!post) return jsonErr(res, 404, '作品已转为私有或不存在');
    return jsonOK(res, { post: postForViewer(post, db, getAuthUser(req)) });
  }

  // GET /api/community/posts —— 获取帖子列表（带分页、评论数统计、筛选、排序）
  // 参数：page, pageSize, sort=new|hot|week, tag=关键词, author=作者名
  if (req.method === 'GET' && url === '/api/community/posts') {
    const db = loadDB();
    const query = new URL(req.url, 'http://x').searchParams;
    const page = Math.max(1, parseInt(query.get('page') || '1'));
    const pageSize = Math.min(50, Math.max(1, parseInt(query.get('pageSize') || '10')));
    const sort = (query.get('sort') || 'new').toString();
    const tag = (query.get('tag') || '').toString().trim().toLowerCase();
    const author = (query.get('author') || '').toString().trim().toLowerCase();
    const start = (page - 1) * pageSize;

    // 先过滤
    let filtered = db.posts.filter(post => !post.hidden);
    if (author) {
      filtered = filtered.filter(p => (p.author || '').toLowerCase() === author);
    }
    if (tag) {
      // tag 在标题/描述/句子里搜索
      filtered = filtered.filter(p => {
        const hay = ((p.title || '') + ' ' + (p.description || '') + ' ' + (p.sentence || '')).toLowerCase();
        return hay.includes(tag);
      });
    }
    // 评论数映射，便于排序与展示
    const cmtCount = pid => db.comments.filter(c => c.postId === pid).length;
    // 排序
    if (sort === 'hot') {
      // 热门：likes 为主，评论数次之
      filtered.sort((a, b) => (b.likes||0) - (a.likes||0) || cmtCount(b.id) - cmtCount(a.id) || b.createdAt - a.createdAt);
    } else if (sort === 'week') {
      // 本周热门：7 天内的帖子按 likes 排
      const weekAgo = Date.now() - 7 * 86400000;
      filtered = filtered.filter(p => p.createdAt >= weekAgo);
      filtered.sort((a, b) => (b.likes||0) - (a.likes||0) || cmtCount(b.id) - cmtCount(a.id));
    } else {
      // 默认时间倒序
      filtered.sort((a, b) => b.createdAt - a.createdAt);
    }
    const total = filtered.length;
    const pagePosts = filtered.slice(start, start + pageSize).map(p => postForViewer(p, db, getAuthUser(req)));
    return jsonOK(res, { posts: pagePosts, total, page, pageSize });
  }

  // GET /api/community/authors/:name —— 作者主页信息（功能9）
  const authorMatch = url.match(/^\/api\/community\/authors\/([^/]+)$/);
  if (req.method === 'GET' && authorMatch) {
    const authorName = decodeURIComponent(authorMatch[1]);
    const db = loadDB();
    const posts = db.posts.filter(p => !p.hidden && (p.author || '').toLowerCase() === authorName.toLowerCase());
    if (posts.length === 0) return jsonOK(res, { author: authorName, posts: [], totalLikes: 0, totalComments: 0 });
    const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
    const postIds = new Set(posts.map(p => p.id));
    const totalComments = db.comments.filter(c => postIds.has(c.postId)).length;
    const postsWithCount = posts.map(p => ({ ...p, commentCount: db.comments.filter(c => c.postId === p.id).length }))
      .sort((a, b) => b.createdAt - a.createdAt);
    return jsonOK(res, {
      author: posts[0].author,
      avatar: (posts[0].author || '?').trim().charAt(0).toUpperCase(),
      postCount: posts.length,
      totalLikes,
      totalComments,
      posts: postsWithCount,
    });
  }

  // GET /api/community/tags —— 热门标签（功能8，从标题/描述提取高频词）
  if (req.method === 'GET' && url === '/api/community/tags') {
    const db = loadDB();
    // 简单分词：按空格/标点切，取长度≥2 的词，统计频次
    const freq = {};
    db.posts.filter(p => !p.hidden).forEach(p => {
      const text = ((p.title || '') + ' ' + (p.description || '')).toLowerCase();
      const words = text.split(/[\s，。、！？,.\?!;:；：""''""()（）\-—…]+/).filter(w => w.length >= 2);
      words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    });
    const tags = Object.entries(freq)
      .map(([name, count]) => ({ name, count }))
      .filter(t => t.count >= 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    return jsonOK(res, { tags });
  }

  // POST /api/community/posts —— 发布新帖子（分享明信片，需登录）
  if (req.method === 'POST' && url === '/api/community/posts') {
    const authUser = getAuthUser(req);
    if (!authUser) return jsonErr(res, 401, '请先登录后再发帖');
    return (async () => {
      try {
        const buf = await readBody(req, 80); // 图片可能较大
        const payload = JSON.parse(buf.toString('utf8'));
        const author = authUser; // 作者强制取登录用户名
        const title = (payload.title || '').toString().slice(0, 100).trim();
        const description = (payload.description || '').toString().slice(0, 500);
        const content = cardContent(payload);
        const post = {
          id: genId('post'),
          author,
          title,
          description,
          ...content,
          likes: 0,
          likers: [],
          createdAt: Date.now(),
          featured: false,
          featuredAt: null,
          featuredNote: '',
          challengeId: (payload.challengeId || '').toString().slice(0, 60) || null,
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
    const authUser = getAuthUser(req);
    if (!authUser) return jsonErr(res, 401, '请先登录后再点赞');
    return (async () => {
      try {
        const buf = await readBody(req, 1);
        const user = authUser; // 点赞人强制取登录用户名
        const postId = likeMatch[1];
        const db = loadDB();
        const post = db.posts.find(p => p.id === postId && !p.hidden);
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
    if (!db.posts.some(p => p.id === postId && !p.hidden)) return jsonErr(res, 404, '作品已转为私有或不存在');
    const comments = db.comments
      .filter(c => c.postId === postId)
      .sort((a, b) => a.createdAt - b.createdAt);
    return jsonOK(res, { comments }) || true;
  }

  // POST /api/community/posts/:id/comments —— 发表评论
  const cmtPostMatch = url.match(/^\/api\/community\/posts\/([^/]+)\/comments$/);
  if (req.method === 'POST' && cmtPostMatch) {
    const authUser = getAuthUser(req);
    if (!authUser) return jsonErr(res, 401, '请先登录后再评论');
    return (async () => {
      try {
        const buf = await readBody(req, 2);
        const payload = JSON.parse(buf.toString('utf8'));
        const postId = cmtPostMatch[1];
        const author = authUser; // 评论者强制取登录用户名
        const content = (payload.content || '').toString().slice(0, 500).trim();
        if (!content) return jsonErr(res, 400, '评论内容不能为空');
        const db = loadDB();
        const post = db.posts.find(p => p.id === postId && !p.hidden);
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

  // GET /api/community/featured —— 展览馆：精选作品（功能3）
  if (req.method === 'GET' && url === '/api/community/featured') {
    const db = loadDB();
    const cmtCount = pid => db.comments.filter(c => c.postId === pid).length;
    const featured = db.posts.filter(p => !p.hidden)
      .filter(p => p.featured === true)
      .sort((a, b) => (b.featuredAt || 0) - (a.featuredAt || 0))
      .map(p => ({ ...p, commentCount: cmtCount(p.id) }));
    return jsonOK(res, { posts: featured, total: featured.length });
  }

  // GET /api/community/feed?nick=xxx —— 关注流：关注的人的最新帖子（功能7）
  if (req.method === 'GET' && url === '/api/community/feed') {
    const query = new URL(req.url, 'http://x').searchParams;
    const nick = (query.get('nick') || '').toString().trim().toLowerCase();
    if (!nick) return jsonErr(res, 400, '缺少 nick 参数');
    const f = loadFollows();
    const followees = f.relations
      .filter(r => (r.follower || '').toLowerCase() === nick)
      .map(r => (r.followee || '').toLowerCase());
    if (followees.length === 0) return jsonOK(res, { posts: [], total: 0, following: 0 });
    const db = loadDB();
    const cmtCount = pid => db.comments.filter(c => c.postId === pid).length;
    const posts = db.posts
      .filter(p => !p.hidden && followees.includes((p.author || '').toLowerCase()))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50)
      .map(p => ({ ...p, commentCount: cmtCount(p.id) }));
    return jsonOK(res, { posts, total: posts.length, following: followees.length });
  }

  return false; // 未匹配到社区 API
}

// ---------- 主服务 ----------
const delivery = require('./delivery')({ getAuthUser, readBody, jsonOK, jsonErr, loadCards, saveCards, cardContent, saveImageFromDataUrl, httpsRequest });
const server = http.createServer(async (req, res) => {
  // 跨域（仅本地，方便调试）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url.split('?')[0];
  console.log('[req]', req.method, url);
  if (await delivery.handle(req, res)) return;

  // ----- 认证 API -----
  if (url.startsWith('/api/auth/')) {
    if (url === '/api/auth/profile' && ['GET', 'POST'].includes(req.method)) {
      const username = getAuthUser(req);
      if (!username) return jsonErr(res, 401, '请先登录');
      try {
        // 先收完请求体，再读取最新数据，避免覆盖同时发生的收藏操作。
        const payload = req.method === 'POST' ? JSON.parse((await readBody(req, 1)).toString('utf8')) : null;
        const users = loadUsers();
        const user = users.users.find(user => user.username === username);
        if (!user) return jsonErr(res, 401, '请重新登录');
        if (payload) {
          const profile = profileFor(user);
          for (const [field, limit] of [['nickname', 20], ['bio', 100], ['email', 120], ['signature', 30]]) {
            if (typeof payload[field] === 'string') profile[field] = payload[field].trim().slice(0, limit);
          }
          if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return jsonErr(res, 400, '请输入正确的邮箱地址');
          if (payload.preferences) {
            const preferences = payload.preferences;
            if (['hand', 'serif', 'script'].includes(preferences.font)) profile.preferences.font = preferences.font;
            if (typeof preferences.bilingual === 'boolean') profile.preferences.bilingual = preferences.bilingual;
            if (TONES[preferences.tone]) profile.preferences.tone = preferences.tone;
          }
          user.profile = profile; saveUsers(users);
        }
        return jsonOK(res, { profile: profileFor(user) });
      } catch (error) { return jsonErr(res, 400, '资料保存失败：' + error.message); }
    }
    // POST /api/auth/register —— 注册（成功即登录）
    if (req.method === 'POST' && url === '/api/auth/register') {
      try {
        const buf = await readBody(req, 1);
        const payload = JSON.parse(buf.toString('utf8') || '{}');
        const username = (payload.username || '').toString().trim();
        const password = (payload.password || '').toString();
        if (!username || username.length > 20) return jsonErr(res, 400, '用户名需为 1-20 个字符');
        if (/\s/.test(username)) return jsonErr(res, 400, '用户名不能包含空格');
        if (password.length < 6) return jsonErr(res, 400, '密码至少 6 位');
        const d = loadUsers();
        if (d.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
          return jsonErr(res, 409, '该用户名已被注册');
        }
        const salt = crypto.randomBytes(16).toString('hex');
        d.users.push({ username, salt, hash: hashPassword(password, salt), createdAt: Date.now() });
        saveUsers(d);
        const token = createSession(username);
        console.log('[auth] 新用户注册：' + username);
        return jsonOK(res, { ok: true, token, username });
      } catch (e) { return jsonErr(res, 500, '注册失败：' + e.message); }
    }
    // POST /api/auth/login —— 登录
    if (req.method === 'POST' && url === '/api/auth/login') {
      try {
        const buf = await readBody(req, 1);
        const payload = JSON.parse(buf.toString('utf8') || '{}');
        const username = (payload.username || '').toString().trim();
        const password = (payload.password || '').toString();
        if (!username || !password) return jsonErr(res, 400, '请输入用户名和密码');
        const d = loadUsers();
        const u = d.users.find(x => x.username.toLowerCase() === username.toLowerCase());
        if (!u) return jsonErr(res, 401, '用户名或密码错误');
        const hash = Buffer.from(hashPassword(password, u.salt), 'hex');
        const stored = Buffer.from(u.hash, 'hex');
        if (hash.length !== stored.length || !crypto.timingSafeEqual(hash, stored)) {
          return jsonErr(res, 401, '用户名或密码错误');
        }
        const token = createSession(u.username);
        console.log('[auth] 用户登录：' + u.username);
        return jsonOK(res, { ok: true, token, username: u.username });
      } catch (e) { return jsonErr(res, 500, '登录失败：' + e.message); }
    }
    // POST /api/auth/logout —— 登出（销毁会话）
    if (req.method === 'POST' && url === '/api/auth/logout') {
      const m = /^Bearer\s+(.+)$/i.exec(req.headers['authorization'] || '');
      if (m) {
        const d = loadSessions();
        delete d.sessions[m[1].trim()];
        saveSessions(d);
      }
      return jsonOK(res, { ok: true });
    }
    // GET /api/auth/me —— 校验 token，返回当前登录用户
    if (req.method === 'GET' && url === '/api/auth/me') {
      const user = getAuthUser(req);
      if (!user) return jsonErr(res, 401, '未登录');
      return jsonOK(res, { username: user });
    }
    return jsonErr(res, 404, '未知认证接口');
  }

  // ----- 社区 API -----
  if (url.startsWith('/api/community/')) {
    // 必须 await：POST 路由是异步的（需先 readBody），不 await 会在响应头发出前下落到 serveStatic 返回 404
    await handleCommunityAPI(req, res);
    if (res.headersSent) return;
  }

  // 生成接口（部分成功也返回，前端可单独重抽失败的项）
  if (req.method === 'POST' && ['/api/generate', '/api/generate-image', '/api/generate-sentence'].includes(url) && !config.apiKey) {
    return jsonErr(res, 503, 'AI 服务尚未配置，暂时无法生成画面或文字建议');
  }

  if (req.method === 'POST' && url === '/api/generate') {
    try {
      const buf = await readBody(req, 25);
      const payload = JSON.parse(buf.toString('utf8'));
      const dataUrl = payload.image || '';
      const userText = payload.text || '';
      const mode = payload.mode === 'quality' ? 'quality' : 'fast';
      const tone = (payload.tone || 'poetic').toString();
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
      console.log('[generate] skill=' + skillId + ' mode=' + mode + ' tone=' + tone + ' imageSize=' + imageSize);

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
      const MAX_ATTEMPTS = 3;
      const BASE_DELAY_MS = 3000;
      const t0 = Date.now();
      // 用 allSettled：任一失败也返回另一项的成功结果，前端可单独重抽
      const [imgRes, txtRes] = await Promise.allSettled([
        withRetry(
          () => generateEditorialImage(imageBuffer, mime, ext, userText, imageSize, skillId),
          MAX_ATTEMPTS, BASE_DELAY_MS, '图像生成'
        ),
        withRetry(
          () => generateSentence(dataUrl, userText, tone),
          MAX_ATTEMPTS, BASE_DELAY_MS, '文案生成'
        ),
      ]);
      const dt = Math.round((Date.now() - t0)/1000);
      console.log('[generate] 完成 image=' + (imgRes.status) + ' sentence=' + (txtRes.status) + ' 总耗时 ' + dt + 's');

      const out = {};
      if (imgRes.status === 'fulfilled') out.image = imgRes.value;
      else out.imageError = (imgRes.reason && imgRes.reason.message) || String(imgRes.reason);
      if (txtRes.status === 'fulfilled') out.sentence = txtRes.value;
      else out.sentenceError = (txtRes.reason && txtRes.reason.message) || String(txtRes.reason);
      out.elapsedSec = dt;

      // 两者都失败才返回 500，否则 200 带 partial 标记
      if (imgRes.status !== 'fulfilled' && txtRes.status !== 'fulfilled') {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        out.error = '图像与文案均失败：' + out.imageError + ' / ' + out.sentenceError;
      } else if (imgRes.status !== 'fulfilled' || txtRes.status !== 'fulfilled') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        out.partial = true;
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      }
      res.end(JSON.stringify(out));
    } catch (e) {
      console.error('[generate] 错误:', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: e.message || '生成失败' }));
    }
    return;
  }

  // 单独重抽图像（功能10）
  if (req.method === 'POST' && url === '/api/generate-image') {
    try {
      const buf = await readBody(req, 25);
      const payload = JSON.parse(buf.toString('utf8'));
      const dataUrl = payload.image || '';
      const userText = payload.text || '';
      const mode = payload.mode === 'quality' ? 'quality' : 'fast';
      const skillId = (payload.skill || 'photo-abstract-editorial').toString();
      const skillMeta = SKILLS.find(s => s.id === skillId);
      if (!skillMeta) return jsonErr(res, 400, '未知 skill: ' + skillId);
      const skillEntry = SKILL_PROMPTS.get(skillId);
      if (!skillEntry || !skillEntry.loaded) return jsonErr(res, 400, 'skill "' + skillId + '" 提示词未加载');
      const imageSize = mode === 'quality' ? (config.imageSize || '1024x1024') : (config.imageSizeFast || '768x768');
      const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s.exec(dataUrl);
      if (!m) return jsonErr(res, 400, '图片数据格式不正确');
      const mime = m[1];
      const imageBuffer = Buffer.from(m[2], 'base64');
      const ext = mime.split('/')[1] || 'jpg';
      const t0 = Date.now();
      const imageUrl = await withRetry(
        () => generateEditorialImage(imageBuffer, mime, ext, userText, imageSize, skillId),
        3, 3000, '图像重抽'
      );
      console.log('[generate-image] 完成 ' + Math.round((Date.now()-t0)/1000) + 's');
      return jsonOK(res, { image: imageUrl });
    } catch (e) {
      console.error('[generate-image] 错误:', e.message);
      return jsonErr(res, 500, e.message || '生成失败');
    }
  }

  // 单独重抽文案（功能10）
  if (req.method === 'POST' && url === '/api/generate-sentence') {
    try {
      const buf = await readBody(req, 25);
      const payload = JSON.parse(buf.toString('utf8'));
      const dataUrl = payload.image || '';
      const userText = payload.text || '';
      const tone = (payload.tone || 'poetic').toString();
      const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s.exec(dataUrl);
      if (!m) return jsonErr(res, 400, '图片数据格式不正确');
      const t0 = Date.now();
      const sentence = await withRetry(
        () => generateSentence(dataUrl, userText, tone, payload.bilingual !== false),
        3, 3000, '文案重抽'
      );
      console.log('[generate-sentence] 完成 ' + Math.round((Date.now()-t0)/1000) + 's');
      return jsonOK(res, { sentence });
    } catch (e) {
      console.error('[generate-sentence] 错误:', e.message);
      return jsonErr(res, 500, e.message || '生成失败');
    }
  }

  // ---------- 寄送卡片 API（功能7）----------
  // POST /api/cards —— 创建一张寄送明信片，返回专属邀请码与链接（需登录）
  if (req.method === 'POST' && url === '/api/cards') {
    const authUser = getAuthUser(req);
    if (!authUser) return jsonErr(res, 401, '请先登录后再寄送明信片');
    return (async () => {
      try {
        const buf = await readBody(req, 80);
        const payload = JSON.parse(buf.toString('utf8'));
        const fromName = (payload.fromName || '').toString().slice(0, 30).trim() || authUser;
        const toName = (payload.toName || '朋友').toString().slice(0, 30).trim() || '朋友';
        const message = (payload.message || '').toString().slice(0, 300);
        const content = cardContent(payload);
        const code = genInviteCode();
        const card = {
          id: genId('card'),
          code,
          fromName,
          toName,
          message,
          ...content,
          fromUser: authUser,
          createdAt: Date.now(),
          opened: false,
          openedAt: null,
        };
        const d = loadCards();
        d.cards.push(card);
        saveCards(d);
        console.log('[card] 新寄送：' + code + ' from ' + fromName + ' to ' + toName);
        return jsonOK(res, { ok: true, code, card });
      } catch (e) {
        console.error('[card] 创建失败:', e.message);
        return jsonErr(res, 500, '寄送失败：' + e.message);
      }
    })();
  }

  // GET /api/cards/:code —— 通过邀请码查看寄送明信片
  const cardMatch = url.match(/^\/api\/cards\/([^/]+)$/);
  if (req.method === 'GET' && cardMatch) {
    const code = decodeURIComponent(cardMatch[1]);
    const d = loadCards();
    const card = d.cards.find(c => c.code === code || c.id === code);
    if (!card) return jsonErr(res, 404, '这张明信片不存在或已撤回');
    // 标记已拆开（仅一次）
    if (!card.opened && !card.channel) {
      card.opened = true;
      card.openedAt = Date.now();
      saveCards(d);
    }
    return jsonOK(res, { card: delivery.publicCard(card) });
  }

  // 健康检查
  if (req.method === 'GET' && url.startsWith('/api/health')) {
    const db = loadDB();
    const d = loadCards();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      imageModel: config.imageModel,
      textModel: config.textModel,
      tones: Object.keys(TONES).map(k => ({ id: k, label: TONES[k].label })),
      community: { posts: db.posts.length, comments: db.comments.length },
      cards: d.cards.length,
    }));
    return;
  }

  // skill 列表（供前端下拉框用，不泄露提示词全文）
  if (req.method === 'GET' && url === '/api/skills') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(SKILLS.filter(s => SKILL_PROMPTS.get(s.id)?.loaded).map(s => ({ id: s.id, name: s.name, desc: s.desc }))));
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

  /* ============================================================
     功能1：我的作品
     ============================================================ */
  // POST /api/myworks —— 保存作品（生成成功后前端调用，需登录）
  if (req.method === 'POST' && url === '/api/myworks') {
    const authUser = getAuthUser(req);
    if (!authUser) return jsonErr(res, 401, '请先登录后再保存作品');
    return (async () => {
      try {
        const buf = await readBody(req, 80);
        const payload = JSON.parse(buf.toString('utf8'));
        const ownerNick = authUser; // 作者强制取登录用户名
        const title = (payload.title || '').toString().slice(0, 100).trim();
        const content = cardContent(payload);
        const visibility = payload.visibility === 'public' ? 'public' : 'private';
        const work = {
          id: genId('work'),
          ownerNick, title, ...content, visibility,
          postId: null,
          createdAt: Date.now(),
        };
        const d = loadMyWorks();
        d.works.push(work);
        saveMyWorks(d);
        console.log('[myworks] 新作品：' + work.id + ' 作者：' + ownerNick);
        return jsonOK(res, { ok: true, work });
      } catch (e) {
        console.error('[myworks] 保存失败:', e.message);
        return jsonErr(res, 500, '保存失败：' + e.message);
      }
    })();
  }
  // GET /api/myworks?nick=xxx —— 获取某用户的所有作品
  if (req.method === 'GET' && url === '/api/myworks') {
    const query = new URL(req.url, 'http://x').searchParams;
    const nick = (query.get('nick') || '').toString().trim().toLowerCase();
    if (!nick) return jsonErr(res, 400, '缺少 nick 参数');
    const d = loadMyWorks();
    const viewer = (getAuthUser(req) || '').toLowerCase();
    const works = d.works
      .filter(w => (w.ownerNick || '').toLowerCase() === nick &&
        (viewer === nick || w.visibility === 'public'))
      .sort((a, b) => b.createdAt - a.createdAt);
    return jsonOK(res, { works, total: works.length });
  }
  // POST /api/myworks/:id/update —— 更新卡片内容、可见性或标题
  const workUpdateMatch = url.match(/^\/api\/myworks\/([^/]+)\/update$/);
  if (req.method === 'POST' && workUpdateMatch) {
    const authUser = getAuthUser(req);
    if (!authUser) return jsonErr(res, 401, '请先登录');
    return (async () => {
      try {
        const buf = await readBody(req, 80);
        const payload = JSON.parse(buf.toString('utf8') || '{}');
        const d = loadMyWorks();
        const w = d.works.find(x => x.id === workUpdateMatch[1]);
        if (!w) return jsonErr(res, 404, '作品不存在');
        if ((w.ownerNick || '').toLowerCase() !== authUser.toLowerCase()) return jsonErr(res, 403, '无权操作他人作品');
        if (payload.visibility === 'public' || payload.visibility === 'private') w.visibility = payload.visibility;
        if (typeof payload.title === 'string') w.title = payload.title.slice(0, 100).trim();
        Object.assign(w, cardContent(payload, w), { updatedAt: Date.now() });
        if (w.postId) {
          const db = loadDB();
          const post = db.posts.find(post => post.id === w.postId);
          if (post) { Object.assign(post, cardContent(w), { title: w.title, hidden: w.visibility !== 'public' }); saveDB(db); }
        }
        saveMyWorks(d);
        return jsonOK(res, { ok: true, work: w });
      } catch (e) { return jsonErr(res, 500, '更新失败：' + e.message); }
    })();
  }
  // POST /api/myworks/:id/delete —— 删除作品
  const workDeleteMatch = url.match(/^\/api\/myworks\/([^/]+)\/delete$/);
  if (req.method === 'POST' && workDeleteMatch) {
    const authUser = getAuthUser(req);
    if (!authUser) return jsonErr(res, 401, '请先登录');
    const d = loadMyWorks();
    const idx = d.works.findIndex(x => x.id === workDeleteMatch[1]);
    if (idx < 0) return jsonErr(res, 404, '作品不存在');
    if ((d.works[idx].ownerNick || '').toLowerCase() !== authUser.toLowerCase()) return jsonErr(res, 403, '无权操作他人作品');
    const removed = d.works[idx];
    if (removed.postId) { const db = loadDB(); const post = db.posts.find(post => post.id === removed.postId); if (post) { post.hidden = true; saveDB(db); } }
    d.works.splice(idx, 1);
    saveMyWorks(d);
    return jsonOK(res, { ok: true });
  }
  // POST /api/myworks/:id/share —— 把作品分享到社区
  const workShareMatch = url.match(/^\/api\/myworks\/([^/]+)\/share$/);
  if (req.method === 'POST' && workShareMatch) {
    const authUser = getAuthUser(req);
    if (!authUser) return jsonErr(res, 401, '请先登录');
    return (async () => {
      try {
        const buf = await readBody(req, 5);
        const payload = JSON.parse(buf.toString('utf8') || '{}');
        const d = loadMyWorks();
        const w = d.works.find(x => x.id === workShareMatch[1]);
        if (!w) return jsonErr(res, 404, '作品不存在');
        if ((w.ownerNick || '').toLowerCase() !== authUser.toLowerCase()) return jsonErr(res, 403, '无权操作他人作品');
        const db = loadDB();
        const existing = db.posts.find(p => p.id === w.postId);
        const post = {
          id: existing?.id || genId('post'),
          author: authUser,
          title: (payload.title || w.title || '').toString().slice(0, 100).trim(),
          description: (payload.description || '').toString().slice(0, 500),
          ...cardContent(w),
          likes: existing?.likes || 0, likers: existing?.likers || [], hidden: false,
          createdAt: existing?.createdAt || Date.now(),
          featured: false, featuredAt: null, featuredNote: '',
          challengeId: (payload.challengeId || '').toString().slice(0, 60) || null,
        };
        if (existing) Object.assign(existing, post); else db.posts.push(post);
        saveDB(db);
        w.postId = post.id;
        w.visibility = 'public';
        saveMyWorks(d);
        console.log('[myworks] 分享到社区：' + post.id);
        return jsonOK(res, { ok: true, post });
      } catch (e) { return jsonErr(res, 500, '分享失败：' + e.message); }
    })();
  }

  /* ============================================================
     功能2：寄送箱
     ============================================================ */
  // GET /api/mailbox?nick=xxx —— 返回 {sent, received}
  if (req.method === 'GET' && url === '/api/mailbox') {
    const query = new URL(req.url, 'http://x').searchParams;
    const nick = (query.get('nick') || '').toString().trim().toLowerCase();
    if (!nick) return jsonErr(res, 400, '缺少 nick 参数');
    if ((getAuthUser(req) || '').toLowerCase() !== nick) return jsonErr(res, 403, '请登录自己的账户查看寄送箱');
    const d = loadCards();
    // 寄送箱只供本人查看，寄件身份与显示署名分开。
    const sent = d.cards
      .filter(c => (c.fromUser || c.fromName || '').toLowerCase() === nick && c.keepRecord !== false)
      .sort((a, b) => b.createdAt - a.createdAt);
    const received = d.cards
      .filter(c => c.channel ? (c.receivedBy || []).some(user => user.toLowerCase() === nick) : (c.toName || '').toLowerCase() === nick)
      .sort((a, b) => b.createdAt - a.createdAt);
    return jsonOK(res, { sent: sent.map(({ mailPayload, fingerprint, requestId, ...card }) => card), received: received.map(card => delivery.publicCard(card)), sentCount: sent.length, receivedCount: received.length });
  }

  /* ============================================================
     功能7：关注
     ============================================================ */
  // POST /api/follow —— 关注/取关（toggle，需登录）
  if (req.method === 'POST' && url === '/api/follow') {
    const authUser = getAuthUser(req);
    if (!authUser) return jsonErr(res, 401, '请先登录后再关注');
    return (async () => {
      try {
        const buf = await readBody(req, 1);
        const payload = JSON.parse(buf.toString('utf8'));
        const follower = authUser; // 关注人强制取登录用户名
        const followee = (payload.followee || '').toString().slice(0, 30).trim();
        if (!followee) return jsonErr(res, 400, '缺少 followee');
        if (follower === followee) return jsonErr(res, 400, '不能关注自己');
        const f = loadFollows();
        const idx = f.relations.findIndex(r => r.follower === follower && r.followee === followee);
        let following;
        if (idx >= 0) { f.relations.splice(idx, 1); following = false; }
        else { f.relations.push({ follower, followee, createdAt: Date.now() }); following = true; }
        saveFollows(f);
        return jsonOK(res, { ok: true, following });
      } catch (e) { return jsonErr(res, 500, '关注失败：' + e.message); }
    })();
  }
  // GET /api/following/:nick —— 该用户关注了谁
  const followingMatch = url.match(/^\/api\/following\/([^/]+)$/);
  if (req.method === 'GET' && followingMatch) {
    const nick = decodeURIComponent(followingMatch[1]).toLowerCase();
    const f = loadFollows();
    const followees = f.relations
      .filter(r => (r.follower || '').toLowerCase() === nick)
      .map(r => r.followee);
    // 统计粉丝数
    const followers = f.relations
      .filter(r => (r.followee || '').toLowerCase() === nick)
      .map(r => r.follower);
    return jsonOK(res, { following: followees, followingCount: followees.length, followers, followersCount: followers.length });
  }

  /* ============================================================
     功能3：展览馆 —— 管理员标记精选
     ============================================================ */
  // POST /api/admin/feature —— 标记/取消标记精选
  if (req.method === 'POST' && url === '/api/admin/feature') {
    return (async () => {
      try {
        const buf = await readBody(req, 5);
        const payload = JSON.parse(buf.toString('utf8'));
        const pwd = (payload.password || '').toString();
        if (pwd !== (config.adminPassword || '')) return jsonErr(res, 403, '管理员密码错误');
        const postId = (payload.postId || '').toString();
        const featuredNote = (payload.featuredNote || '').toString().slice(0, 200);
        if (!postId) return jsonErr(res, 400, '缺少 postId');
        const db = loadDB();
        const p = db.posts.find(x => x.id === postId);
        if (!p) return jsonErr(res, 404, '帖子不存在');
        if (payload.featured) {
          p.featured = true;
          p.featuredAt = Date.now();
          p.featuredNote = featuredNote;
        } else {
          p.featured = false;
          p.featuredAt = null;
          p.featuredNote = '';
        }
        saveDB(db);
        console.log('[admin] 精选标记：' + postId + ' -> ' + (p.featured ? 'ON' : 'OFF'));
        return jsonOK(res, { ok: true, post: p });
      } catch (e) { return jsonErr(res, 500, '标记失败：' + e.message); }
    })();
  }

  // 静态资源（防崩：若某 handler 已发 headers 却未 return，这里跳过避免 ERR_HTTP_HEADERS_SENT）
  if (res.headersSent) {
    console.error('[fallthrough] headers already sent for', req.method, url, '— skip serveStatic');
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
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
    if (!config.apiKey) { console.warn('  AI 接口尚未配置，请设置 POSTCARD_API_KEY 后重启。'); return; }
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
  // 自动打开浏览器：Windows 用 start 命令，URL 必须用引号包住避免被解析成窗口标题
  if (process.platform === 'win32' && process.env.POSTCARD_OPEN_BROWSER !== '0') exec('start "" "' + url + '"', (err) => {
    if (err) {
      console.warn('  ⚠ 自动打开浏览器失败：' + err.message);
      console.warn('    请手动访问： ' + url);
    } else {
      console.log('  ✓ 已自动打开浏览器');
    }
  });
});
