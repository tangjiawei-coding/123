const crypto = require('crypto');

// POSTCARD_PUBLIC_URL 必须指向可从外网访问的 HTTPS 网站，不能是本机预览地址。
module.exports = function delivery({ getAuthUser, readBody, jsonOK, jsonErr, loadCards, saveCards, cardContent, saveImageFromDataUrl }) {
  const text = (value, length) => String(value || '').trim().slice(0, length);
  const publicURL = (() => {
    try {
      const url = new URL(process.env.POSTCARD_PUBLIC_URL);
      if (url.protocol !== 'https:' || url.username || url.password || /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[|.*\.local$)/i.test(url.hostname)) return '';
      return url.origin;
    } catch { return ''; }
  })();
  function publicCard(card) {
    const { recipientEmail, requestId, fingerprint, mailPayload, providerId, deliveryError, receivedBy, fromUser, keepRecord, ...visible } = card;
    return visible;
  }
  const linkFor = card => (publicURL || '') + '/v2.html?card=' + encodeURIComponent(card.code);
  function result(card) { return { code: card.code, url: linkFor(card), public: !!publicURL, status: card.deliveryStatus, card: publicCard(card) }; }
  async function handle(req, res) {
    const route = req.url.split('?')[0];
    if (!route.startsWith('/api/delivery/')) return false;
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET' && route === '/api/delivery/status') { jsonOK(res, { linksPublic: !!publicURL }); return true; }
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
    if (req.method !== 'POST' || route !== '/api/delivery/link') { jsonErr(res, 404, '未找到这个分享入口'); return true; }
    const user = getAuthUser(req);
    if (!user) { jsonErr(res, 401, '请登录后创建分享链接'); return true; }
    try {
      const channel = 'link';
      const payload = JSON.parse((await readBody(req, 85)).toString('utf8'));
      const requestId = text(payload.requestId, 100);
      if (!/^[\w-]{16,100}$/.test(requestId)) throw new Error('寄送请求标识不正确，请重新打开寄送面板。');
      const fingerprint = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      const data = loadCards();
      let card = data.cards.find(item => item.fromUser === user && item.requestId === requestId);
      if (card) {
        if (card.fingerprint !== fingerprint || card.channel !== channel) throw new Error('此寄送请求的内容已变化，请重新打开寄送面板。');
      } else {
        if (typeof payload.preview !== 'string' || !/^data:image\/png;base64,/.test(payload.preview) || payload.preview.length > 12 * 1024 * 1024) throw new Error('请先生成卡片预览，再寄送。');
        card = { id: 'card_' + crypto.randomUUID(), code: 'pc' + crypto.randomBytes(16).toString('hex'),
          ...cardContent(payload), title: text(payload.title, 60), fromUser: user, fromName: text(payload.fromName, 30) || user,
          toName: text(payload.toName, 30) || '朋友', message: text(payload.message, 300),
          preview: '/community_img/' + saveImageFromDataUrl(payload.preview), channel, requestId, fingerprint,
          keepRecord: payload.keepRecord !== false, deliveryStatus: 'link',
          createdAt: Date.now(), opened: false, openedAt: null, receivedBy: [] };
        data.cards.push(card); saveCards(data);
      }
      jsonOK(res, result(card)); return true;
    } catch (error) { jsonErr(res, 400, error.message || '寄送未完成，请稍后重试。'); return true; }
  }
  return { handle, publicCard };
};
