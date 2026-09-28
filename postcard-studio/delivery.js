const crypto = require('crypto');

// 配置发信：POSTCARD_EMAIL_API_KEY（Resend）、POSTCARD_EMAIL_FROM（已验证域名）。
// POSTCARD_PUBLIC_URL 必须指向可从外网访问的 HTTPS 网站，不能是本机预览地址。
module.exports = function delivery({ getAuthUser, readBody, jsonOK, jsonErr, loadCards, saveCards, cardContent, saveImageFromDataUrl, httpsRequest }) {
  const active = new Set();
  const text = (value, length) => String(value || '').trim().slice(0, length);
  const escape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const publicURL = (() => {
    try {
      const url = new URL(process.env.POSTCARD_PUBLIC_URL);
      if (url.protocol !== 'https:' || url.username || url.password || /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[|.*\.local$)/i.test(url.hostname)) return '';
      return url.origin;
    } catch { return ''; }
  })();
  const emailReady = !!(publicURL && process.env.POSTCARD_EMAIL_API_KEY && process.env.POSTCARD_EMAIL_FROM);
  function publicCard(card) {
    const { recipientEmail, requestId, fingerprint, mailPayload, providerId, deliveryError, receivedBy, fromUser, keepRecord, ...visible } = card;
    return visible;
  }
  const linkFor = card => (publicURL || '') + '/v2.html?card=' + encodeURIComponent(card.code);
  function result(card) { return { code: card.code, url: linkFor(card), public: !!publicURL, status: card.deliveryStatus, card: publicCard(card) }; }
  function mailBody(card) {
    const url = linkFor(card), preview = publicURL + card.preview;
    return {
      from: process.env.POSTCARD_EMAIL_FROM, to: [card.recipientEmail], subject: card.fromName + ' 寄来一张明信片',
      text: `${card.fromName} 给你寄来一张明信片。\n${card.message}\n打开明信片：${url}\n打开后可查看原图、笔迹和播放声音。`,
      html: `<div style="background:#f6f1e7;padding:32px 16px;color:#5f4a35;font-family:serif"><div style="max-width:620px;margin:auto"><p style="font-size:12px;letter-spacing:3px">一张 · POSTCARDS</p><h1 style="font-size:24px;font-weight:normal">${escape(card.fromName)}，寄来一份心意</h1><p>写给 ${escape(card.toName)}：</p><img src="${escape(preview)}" alt="明信片预览" width="600" style="display:block;width:100%;height:auto;border:0"><p style="line-height:1.9;white-space:pre-wrap">${escape(card.message)}</p><p style="text-align:center;margin:28px 0"><a href="${escape(url)}" style="display:inline-block;background:#806650;color:white;padding:13px 28px;border-radius:24px;text-decoration:none">打开这张明信片</a></p><p style="font-size:12px;color:#a08e76">打开后可查看原图、笔迹和播放声音。请妥善保管此链接，持有链接的人可以查看卡片。</p></div></div>`,
    };
  }
  async function send(card) {
    if (card.deliveryStatus === 'accepted') return card;
    if (Date.now() - card.createdAt > 23 * 3600000) throw new Error('这次寄送已超过可安全重试的时间，请先核对收件情况。');
    if (active.has(card.code)) throw new Error('同一封邮件正在提交，请稍后查看寄件记录。');
    active.add(card.code);
    let status = 'unknown', providerId = '';
    try {
      const response = await httpsRequest('POST', 'https://api.resend.com/emails', {
        Authorization: 'Bearer ' + process.env.POSTCARD_EMAIL_API_KEY,
        'Content-Type': 'application/json', 'Idempotency-Key': 'postcard/' + card.code,
      }, Buffer.from(JSON.stringify(card.mailPayload)), 30000);
      let body; try { body = JSON.parse(response.body.toString('utf8')); } catch { throw new Error('寄送状态未确认，请使用同一条寄件记录重试。'); }
      if (response.statusCode < 200 || response.statusCode >= 300 || !body.id) {
        status = response.statusCode >= 400 && response.statusCode < 500 ? 'failed' : 'unknown';
        throw new Error(status === 'failed' ? '邮件服务拒绝了寄送，请检查发信配置或收件地址。' : '寄送状态未确认，请使用同一条寄件记录重试。');
      }
      status = 'accepted'; providerId = body.id;
    } catch (error) {
      if (status === 'unknown') throw new Error('寄送状态未确认，请使用同一条寄件记录重试。');
      throw error;
    } finally {
      // 请求期间可能有人打开卡片，落盘时合并最新的打开/收件状态。
      const data = loadCards(), current = data.cards.find(item => item.code === card.code);
      if (current) { current.deliveryStatus = status; current.providerId = providerId; current.updatedAt = Date.now(); saveCards(data); }
      active.delete(card.code);
    }
    return loadCards().cards.find(item => item.code === card.code);
  }
  async function handle(req, res) {
    const route = req.url.split('?')[0];
    if (!route.startsWith('/api/delivery/')) return false;
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET' && route === '/api/delivery/status') { jsonOK(res, { emailReady, linksPublic: !!publicURL }); return true; }
    const viewMatch = route.match(/^\/api\/delivery\/cards\/([a-zA-Z0-9_-]+)$/);
    if (req.method === 'GET' && viewMatch) {
      const card = loadCards().cards.find(item => item.code === viewMatch[1]);
      if (!card || card.revoked) jsonErr(res, 404, '这张明信片不存在或已撤回'); else jsonOK(res, { card: publicCard(card) });
      return true;
    }
    const openMatch = route.match(/^\/api\/delivery\/cards\/([a-zA-Z0-9_-]+)\/(open|collect)$/);
    if (req.method === 'POST' && openMatch) {
      const user = getAuthUser(req), data = loadCards(), card = data.cards.find(item => item.code === openMatch[1]);
      if (!card || card.revoked) { jsonErr(res, 404, '这张明信片不存在或已撤回'); return true; }
      if (openMatch[2] === 'collect') {
        if (!user) { jsonErr(res, 401, '请登录后收进展览馆'); return true; }
        card.receivedBy ||= []; if (!card.receivedBy.includes(user)) card.receivedBy.push(user);
      } else if (!card.opened) { card.opened = true; card.openedAt = Date.now(); }
      saveCards(data); jsonOK(res, { ok: true }); return true;
    }
    const user = getAuthUser(req);
    if (!user) { jsonErr(res, 401, '请登录后创建分享链接或寄送邮件'); return true; }
    try {
      const retry = route.match(/^\/api\/delivery\/cards\/([a-zA-Z0-9_-]+)\/retry$/);
      if (req.method === 'POST' && retry) {
        if (!emailReady) throw new Error('邮件寄送尚未开通，请先配置发信服务与网站地址。');
        const card = loadCards().cards.find(item => item.code === retry[1] && item.fromUser === user && item.channel === 'email');
        if (!card) { jsonErr(res, 404, '寄件记录不存在'); return true; }
        jsonOK(res, result(await send(card))); return true;
      }
      if (req.method !== 'POST' || !['/api/delivery/link', '/api/delivery/email'].includes(route)) { jsonErr(res, 404, '未找到这个寄送入口'); return true; }
      const channel = route.endsWith('/email') ? 'email' : 'link';
      if (channel === 'email' && !emailReady) { jsonErr(res, 503, '邮件寄送尚未开通，请先配置发信服务与网站地址。'); return true; }
      const payload = JSON.parse((await readBody(req, 85)).toString('utf8'));
      const requestId = text(payload.requestId, 100);
      if (!/^[\w-]{16,100}$/.test(requestId)) throw new Error('寄送请求标识不正确，请重新打开寄送面板。');
      const fingerprint = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      const data = loadCards();
      let card = data.cards.find(item => item.fromUser === user && item.requestId === requestId);
      if (card) {
        if (card.fingerprint !== fingerprint || card.channel !== channel) throw new Error('此寄送请求的内容已变化，请重新打开寄送面板。');
      } else {
        const recipientEmail = text(payload.toEmail, 120);
        if (channel === 'email' && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipientEmail)) throw new Error('请输入有效的收件邮箱。');
        if (typeof payload.preview !== 'string' || !/^data:image\/png;base64,/.test(payload.preview) || payload.preview.length > 12 * 1024 * 1024) throw new Error('请先生成卡片预览，再寄送。');
        card = { id: 'card_' + crypto.randomUUID(), code: 'pc' + crypto.randomBytes(16).toString('hex'),
          ...cardContent(payload), title: text(payload.title, 60), fromUser: user, fromName: text(payload.fromName, 30) || user,
          toName: text(payload.toName, 30) || '朋友', recipientEmail, message: text(payload.message, 300),
          preview: '/community_img/' + saveImageFromDataUrl(payload.preview), channel, requestId, fingerprint,
          keepRecord: payload.keepRecord !== false, deliveryStatus: channel === 'link' ? 'link' : 'pending',
          createdAt: Date.now(), opened: false, openedAt: null, receivedBy: [] };
        if (channel === 'email') card.mailPayload = mailBody(card);
        data.cards.push(card); saveCards(data);
      }
      if (channel === 'email') card = await send(card);
      jsonOK(res, result(card)); return true;
    } catch (error) { jsonErr(res, 400, error.message || '寄送未完成，请稍后重试。'); return true; }
  }
  return { handle, publicCard };
};
