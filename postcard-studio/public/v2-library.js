import { createCardRenderer, draftPayload, workDraft, mediaSource } from './v2-card.js';

export function setupLibrary({ getDraft, loadDraft, markStored, applyPreferences, setStamp, isBusy, stopAudio, notice }) {
  const $ = id => document.getElementById(id);
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const renderCard = createCardRenderer($('postcard').cloneNode(true), notice);
  let token = '', user = null, screen = 'cover', scope = 'public', filter = 'hot', page = 1;
  let listVersion = 0, detailVersion = 0, detail = null, detailKind = '', cardView, storeView, storeSnapshot;
  let authMode = 'login', afterLogin, settingsMode = 'profile';
  try { token = localStorage.getItem('postcard_token') || ''; } catch {}
  const date = value => new Date(value || Date.now()).toLocaleDateString('zh-CN');
  const sameUser = name => !!user && name?.toLowerCase() === user.username.toLowerCase();
  function saveSession() {
    try {
      if (token) { localStorage.setItem('postcard_token', token); localStorage.setItem('postcard_nick', user.username); }
      else { localStorage.removeItem('postcard_token'); localStorage.removeItem('postcard_nick'); }
    } catch { notice('登录仅在本次页面内有效，浏览器未允许保存登录状态。'); }
  }
  async function request(path, body) {
    const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && !path.endsWith('/login')) { token = ''; user = null; saveSession(); renderProfile(); clearPrivateView(); }
      throw new Error(result.error || '暂时无法完成，请稍后重试。');
    }
    return result;
  }
  function clearPrivateView() {
    listVersion++; detailVersion++;
    if (scope === 'private') { $('galleryList').replaceChildren(); $('galleryMore').hidden = true; empty('请重新登录', '登录状态已结束，本机草稿仍然保留。', '登录 / 注册', () => requireUser(() => loadGallery())); }
    if (detailKind !== 'public') { cardView?.dispose(); $('detailCard').replaceChildren(); detail = null; if (screen === 'detail') navigate('profile'); }
  }
  function navigate(next) {
    if (screen === 'detail' && next !== 'detail') { cardView?.dispose(); cardView = null; detailVersion++; }
    stopAudio(); screen = next;
    for (const name of ['cover', 'create', 'gallery', 'profile', 'detail', 'receipt']) $(name + 'Screen').hidden = name !== next;
    document.querySelectorAll('[data-screen]').forEach(button => {
      const selected = button.dataset.screen === (next === 'detail' ? 'gallery' : next === 'cover' ? 'create' : next);
      button.classList.toggle('current', selected); selected ? button.setAttribute('aria-current', 'page') : button.removeAttribute('aria-current');
    });
    document.title = '一张 · ' + { cover: '创作', create: '编辑明信片', gallery: '展览馆', profile: '我的', detail: '明信片详情', receipt: '给你的一份心意' }[next];
    window.dispatchEvent(new CustomEvent('postcard:navigate', { detail: next }));
    if (next === 'gallery') loadGallery();
    if (next === 'profile') renderProfile();
    document.querySelector('.app-shell').scrollIntoView({ block: 'start' });
  }
  function requireUser(action) {
    if (user) { action(); return; }
    afterLogin = action; $('accountError').textContent = ''; $('accountPassword').value = '';
    $('accountDialog').showModal();
  }
  function renderProfile() {
    $('profileName').textContent = user?.nickname || '给生活，留一张纪念';
    $('profileAvatar').textContent = (user?.nickname || user?.username || '一').slice(0, 1);
    $('profileBio').textContent = user ? user.bio || '把生活，做成明信片。' : '登录后，收藏风景，也珍藏自己的心意。';
    $('profileLogin').hidden = !!user; $('logoutAccount').hidden = !user;
  }
  function empty(title, description, actionLabel, action) {
    const box = make('div', 'empty-state'); box.innerHTML = icon(scope === 'private' ? 'mail' : 'gallery');
    box.append(make('strong', '', title), make('p', '', description));
    if (actionLabel) { const button = make('button', '', actionLabel); button.onclick = action; box.append(button); }
    $('galleryStatus').replaceChildren(box);
  }
  function filters() {
    document.querySelectorAll('[data-gallery]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.gallery === scope)));
    const options = scope === 'public' ? [['hot', '热门'], ['new', '最新'], ['旅行', '旅行'], ['生活', '生活'], ['治愈', '治愈']] : [['all', '全部'], ['works', '我创作的'], ['sent', '寄件'], ['received', '收件'], ['favorites', '收藏']];
    $('galleryFilters').replaceChildren(...options.map(([id, label]) => {
      const button = make('button', '', label); button.setAttribute('aria-pressed', String(id === filter));
      button.onclick = () => { filter = id; loadGallery(); }; return button;
    }));
    $('galleryList').classList.toggle('private-list', scope === 'private');
    $('localDraftEntry').hidden = scope !== 'private' || !['all', 'works'].includes(filter);
    $('localDraftTools').hidden = $('localDraftEntry').hidden;
  }
  function listItem(item, kind) {
    const button = make('button', 'gallery-item');
    const image = make('img', 'cover'); image.src = mediaSource(item.image); image.alt = ''; image.loading = 'lazy';
    const copy = make('div', 'item-copy');
    copy.append(make('h3', '', item.title || (kind === 'sent' ? '寄给 ' + item.toName : kind === 'received' ? '来自 ' + item.fromName : '未命名的明信片')));
    copy.append(make('p', '', kind === 'public' ? item.authorName || item.author : date(item.createdAt) + (kind === 'sent' ? ' · 寄给 ' + item.toName : kind === 'received' ? ' · 来自 ' + item.fromName : ' · 我的创作')));
    if (kind === 'public') {
      const stats = make('div', 'item-stats');
      for (const [name, value] of [['heart', item.likes || 0], ['comment', item.commentCount || 0]]) { const stat = make('span'); stat.innerHTML = icon(name); stat.append(document.createTextNode(String(value))); stats.append(stat); }
      copy.append(stats);
    } else copy.append(make('span', 'visibility-badge', kind === 'work' ? item.visibility === 'public' ? '已公开' : '仅自己可见' : deliveryLabel(item)));
    button.append(image, copy); if (scope === 'private') { const arrow = make('span'); arrow.innerHTML = icon('chevron'); button.append(arrow); }
    button.onclick = () => openDetail(item, kind); return button;
  }
  async function loadGallery(more = false) {
    const version = ++listVersion;
    filters(); if (!more) { page = 1; $('galleryList').replaceChildren(); }
    $('galleryStatus').textContent = '正在收集这些心意…'; $('galleryMore').hidden = true;
    if (scope === 'private' && !user) { empty('这里，留给自己的心意', '登录后查看私有作品、寄收记录和收藏。', '登录 / 注册', () => requireUser(() => loadGallery())); return; }
    try {
      if (scope === 'public') {
        const query = new URLSearchParams({ page: String(page), pageSize: '12', sort: ['hot', 'new'].includes(filter) ? filter : 'new' });
        if (!['hot', 'new'].includes(filter)) query.set('tag', filter);
        const result = await request('/api/community/posts?' + query);
        if (version !== listVersion) return;
        $('galleryList').append(...result.posts.map(post => listItem(post, 'public')));
        $('galleryMore').hidden = page * 12 >= result.total;
        $('galleryStatus').textContent = '';
        if (!result.total) empty('等待第一张，来自生活的问候', '这里会展示大家主动公开的明信片。先写下你的这一张吧。', '去创作', () => navigate('create'));
      } else if (filter === 'favorites') {
        const result = await request('/api/community/favorites'); if (version !== listVersion) return;
        $('galleryList').append(...result.posts.map(post => listItem(post, 'public'))); $('galleryStatus').textContent = '';
        if (!result.posts.length) empty('把喜欢的风景，留在这里', '在公开明信片详情中点一下星星，就能收藏。', '逛逛公开展览馆', () => { scope = 'public'; filter = 'hot'; loadGallery(); });
      } else {
        const nick = encodeURIComponent(user.username);
        const results = await Promise.allSettled([
          ['all', 'works'].includes(filter) ? request('/api/myworks?nick=' + nick) : Promise.resolve({ works: [] }),
          filter !== 'works' ? request('/api/mailbox?nick=' + nick) : Promise.resolve({ sent: [], received: [] }),
        ]);
        if (version !== listVersion) return;
        const items = [], failures = [];
        if (results[0].status === 'fulfilled') items.push(...results[0].value.works.map(item => ({ item, kind: 'work' }))); else failures.push('作品加载失败');
        if (results[1].status === 'fulfilled') {
          if (['all', 'sent'].includes(filter)) items.push(...results[1].value.sent.map(item => ({ item, kind: 'sent' })));
          if (['all', 'received'].includes(filter)) items.push(...results[1].value.received.map(item => ({ item, kind: 'received' })));
        } else failures.push('寄收记录加载失败');
        items.sort((a, b) => b.item.createdAt - a.item.createdAt);
        $('galleryList').append(...items.map(({ item, kind }) => listItem(item, kind))); $('galleryStatus').textContent = failures.join('；');
        if (!items.length && !failures.length) empty(filter === 'sent' ? '还没有寄出的心意' : filter === 'received' ? '等待一封，写给你的信' : '好好收着，自己的每一张', filter === 'sent' ? '从卡片下方的「保存 / 分享」创建分享链接，记录会留在这里。' : filter === 'received' ? '打开收到的明信片，点「收进我的展览馆」，便能在这里珍藏。' : '完成卡片后，点上方「存为作品」，就能在这里继续编辑。');
      }
    } catch (error) { if (version === listVersion) empty('这次没能打开', error.message, '重新加载', () => loadGallery()); }
  }
  function socialState() {
    if (!detail) return;
    $('likePost').setAttribute('aria-pressed', String(!!detail.liked)); $('likePost').querySelector('span').textContent = String(detail.likes || 0);
    $('likePost').setAttribute('aria-label', (detail.liked ? '取消点赞' : '点赞') + '，' + (detail.likes || 0) + ' 人');
    $('favoritePost').setAttribute('aria-pressed', String(!!detail.collected)); $('favoritePost').querySelector('span').textContent = detail.collected ? '已收藏' : '收藏';
    $('commentCount').textContent = String(detail.commentCount || 0);
    $('focusComment').setAttribute('aria-label', '评论，' + (detail.commentCount || 0) + ' 条');
  }
  function deliveryLabel(item) {
    if (item.opened) return '已打开';
    return { link: '链接已创建', pending: '等待提交', accepted: '已提交寄送', failed: '寄送失败', unknown: '寄送待确认' }[item.deliveryStatus] || '未打开';
  }
  async function openDetail(item, kind) {
    cardView?.dispose(); detail = item; detailKind = kind; navigate('detail');
    const version = ++detailVersion;
    $('detailCard').replaceChildren(); $('commentsList').replaceChildren(); $('commentsStatus').textContent = ''; $('commentText').value = '';
    $('detailHint').textContent = '点击图片查看原图，点击唱片播放声音。';
    $('detailPrivateActions').hidden = kind !== 'work'; $('detailSocial').hidden = $('detailComments').hidden = kind !== 'public';
    $('followAuthor').hidden = true; $('detailTitle').textContent = item.title || '一张明信片';
    $('detailDescription').textContent = item.description || item.message || '';
    $('detailHeading').textContent = kind === 'public' ? '明信片 · 公开' : kind === 'work' ? '我的明信片' : kind === 'sent' ? '寄件记录' : '收件记录';
    $('detailVisibility').textContent = kind === 'public' || item.visibility === 'public' ? '公开作品' : '仅自己可见';
    $('detailDate').textContent = date(item.createdAt);
    if (kind === 'sent' || kind === 'received') $('detailVisibility').textContent = deliveryLabel(item) + (kind === 'sent' && item.recipientEmail ? ' · ' + item.recipientEmail : '');
    $('publishWork').hidden = item.visibility === 'public'; $('unpublishWork').hidden = item.visibility !== 'public';
    $('editWork').textContent = item.visibility === 'public' ? '复制后编辑' : '继续编辑';
    function draw() {
      cardView?.dispose(); cardView = renderCard(detail); $('detailCard').replaceChildren(cardView.element);
      const author = detail.authorName || detail.author || detail.ownerNick || detail.fromName || '一位朋友';
      $('detailAuthor').textContent = author; $('detailAuthor').title = detail.authorBio || ''; $('detailAvatar').textContent = author.slice(0, 1); socialState();
    }
    draw();
    if (kind !== 'public') return;
    try {
      const result = await request('/api/community/posts/' + encodeURIComponent(item.id));
      if (version !== detailVersion) return;
      detail = result.post; draw(); loadComments(detail.id, version);
      if (!sameUser(detail.author)) {
        $('followAuthor').hidden = false; $('followAuthor').textContent = '关注'; $('followAuthor').setAttribute('aria-pressed', 'false');
        if (user) {
          const following = await request('/api/following/' + encodeURIComponent(user.username));
          if (version !== detailVersion) return;
          const selected = following.following.includes(detail.author); $('followAuthor').textContent = selected ? '已关注' : '关注'; $('followAuthor').setAttribute('aria-pressed', String(selected));
        }
      }
    } catch (error) {
      if (version === detailVersion) { cardView?.dispose(); $('detailCard').replaceChildren(); $('detailHint').textContent = error.message; $('detailSocial').hidden = $('detailComments').hidden = true; }
    }
  }
  async function loadComments(id, version = detailVersion) {
    $('commentsStatus').textContent = '正在读取留言…';
    try {
      const result = await request('/api/community/posts/' + encodeURIComponent(id) + '/comments');
      if (version !== detailVersion) return;
      $('commentsList').replaceChildren(...result.comments.map(comment => {
        const row = make('article', 'comment'); row.append(make('strong', '', comment.author), make('small', '', date(comment.createdAt)), make('p', '', comment.content)); return row;
      }));
      $('commentsStatus').textContent = result.comments.length ? '' : '还没有留言，写下第一句问候吧。';
    } catch (error) { if (version === detailVersion) $('commentsStatus').textContent = error.message; }
  }
  async function socialAction(button, path, apply) {
    const version = detailVersion; button.disabled = true;
    try { const result = await request(path, {}); if (version === detailVersion) { apply(result); socialState(); } }
    catch (error) { notice(error.message); }
    finally { button.disabled = false; }
  }
  function openStore() {
    if (isBusy()) { notice('请等待录音或照片处理完成。'); return; }
    if (!getDraft().original) { notice('先导入一张照片，再存入展览馆。'); navigate('create'); return; }
    requireUser(() => {
      storeSnapshot = structuredClone(getDraft()); storeView?.dispose();
      storeView = renderCard(draftPayload(storeSnapshot), false); $('storePreview').replaceChildren(storeView.element);
      const updating = storeSnapshot.workId && sameUser(storeSnapshot.workOwner);
      $('storeTitle').textContent = updating ? '保存这张作品的修改' : '存入私有展览馆';
      $('workTitle').value = storeSnapshot.title || ''; $('storeError').textContent = ''; $('storeDialog').showModal();
    });
  }
  function openSettings(mode) {
    requireUser(() => {
      settingsMode = mode;
      $('settingsTitle').textContent = { profile: '个人资料', preferences: '偏好设置' }[mode];
      for (const [id, key] of [['profileFields', 'profile'], ['preferenceFields', 'preferences']]) $(id).hidden = mode !== key;
      $('nicknameField').value = user.nickname; $('bioField').value = user.bio;
      $('defaultFont').value = user.preferences.font; $('defaultTone').value = user.preferences.tone; $('defaultBilingual').checked = user.preferences.bilingual;
      $('settingsError').textContent = ''; $('settingsDialog').showModal();
    });
  }
  const preferences = () => ({ font: $('defaultFont').value, tone: $('defaultTone').value, bilingual: $('defaultBilingual').checked });
  document.querySelectorAll('[data-screen]').forEach(button => { button.onclick = () => navigate(button.dataset.screen === 'create' ? 'cover' : button.dataset.screen); });
  document.querySelectorAll('[data-gallery]').forEach(button => { button.onclick = () => { scope = button.dataset.gallery; filter = scope === 'public' ? 'hot' : 'all'; loadGallery(); }; });
  document.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => $(button.dataset.close).close(); });
  document.querySelectorAll('[data-settings]').forEach(button => { button.onclick = () => openSettings(button.dataset.settings); });
  $('refreshGallery').onclick = () => loadGallery();
  $('galleryMore').onclick = () => { page++; loadGallery(true); };
  $('backToGallery').onclick = () => navigate('gallery');
  $('resumeLocalDraft').onclick = () => navigate('create');
  $('storeLocalDraft').onclick = openStore;
  $('profileLogin').onclick = () => requireUser(() => renderProfile());
  $('myFavorites').onclick = () => { scope = 'private'; filter = 'favorites'; navigate('gallery'); };
  $('myStamps').onclick = () => $('stampsDialog').showModal();
  $('openHelp').onclick = () => $('helpDialog').showModal();
  document.querySelectorAll('[data-use-stamp]').forEach(button => { button.onclick = () => { setStamp(button.dataset.useStamp); $('stampsDialog').close(); navigate('create'); }; });
  $('applyPreferences').onclick = () => { applyPreferences(preferences()); notice('已应用到当前卡片，保存设置后也会用于下一张。'); };
  $('settingsForm').onsubmit = async event => {
    event.preventDefault(); $('settingsSubmit').disabled = true;
    const body = settingsMode === 'profile' ? { nickname: $('nicknameField').value, bio: $('bioField').value } : { preferences: preferences() };
    try { const result = await request('/api/auth/profile', body); user = result.profile; renderProfile(); $('settingsDialog').close(); notice('设置已保存。'); }
    catch (error) { $('settingsError').textContent = error.message; }
    finally { $('settingsSubmit').disabled = false; }
  };
  $('switchAccountMode').onclick = () => {
    authMode = authMode === 'login' ? 'register' : 'login'; const registering = authMode === 'register';
    $('accountTitle').textContent = registering ? '从第一张明信片开始' : '欢迎回来'; $('accountSubmit').textContent = registering ? '注册并登录' : '登录';
    $('switchAccountMode').textContent = registering ? '已有账号？去登录' : '还没有账号？注册一个'; $('accountPassword').autocomplete = registering ? 'new-password' : 'current-password'; $('accountError').textContent = '';
  };
  $('accountForm').onsubmit = async event => {
    event.preventDefault(); $('accountSubmit').disabled = true; $('accountError').textContent = '';
    try {
      const result = await request('/api/auth/' + authMode, { username: $('accountName').value.trim(), password: $('accountPassword').value });
      token = result.token;
      const profile = await request('/api/auth/profile'); user = profile.profile; saveSession(); renderProfile();
      $('accountDialog').close(); $('accountPassword').value = ''; const action = afterLogin; afterLogin = null; action?.();
    } catch (error) { $('accountError').textContent = error.message; }
    finally { $('accountSubmit').disabled = false; }
  };
  $('logoutAccount').onclick = async () => {
    $('logoutAccount').disabled = true;
    try { await request('/api/auth/logout', {}); token = ''; user = null; saveSession(); clearPrivateView(); renderProfile(); notice('已退出登录，本机草稿仍保留。'); }
    catch (error) { notice(error.message); }
    finally { $('logoutAccount').disabled = false; }
  };
  $('storeForm').onsubmit = async event => {
    event.preventDefault(); $('storeSubmit').disabled = true; $('storeError').textContent = '';
    try {
      const updating = storeSnapshot.workId && sameUser(storeSnapshot.workOwner);
      const result = await request(updating ? '/api/myworks/' + encodeURIComponent(storeSnapshot.workId) + '/update' : '/api/myworks', { ...draftPayload(storeSnapshot), title: $('workTitle').value.trim(), visibility: 'private' });
      markStored(result.work); $('storeDialog').close(); scope = 'private'; filter = 'works'; navigate('gallery'); notice('作品已存入私有展览馆。');
    } catch (error) { $('storeError').textContent = error.message; }
    finally { $('storeSubmit').disabled = false; }
  };
  $('storeDialog').addEventListener('close', () => storeView?.dispose());
  $('editWork').onclick = async () => {
    if (!detail || isBusy()) { notice('请先结束当前录音或文件处理。'); return; }
    try { await loadDraft(workDraft(detail)); navigate('create'); notice('已载入作品；上一份本机草稿已留作备份。'); }
    catch (error) { notice(error.message); }
  };
  $('publishWork').onclick = () => { $('publishDescription').value = ''; $('publishError').textContent = ''; $('publishDialog').showModal(); };
  $('publishForm').onsubmit = async event => {
    event.preventDefault(); $('confirmPublish').disabled = true;
    try {
      const result = await request('/api/myworks/' + encodeURIComponent(detail.id) + '/share', { description: $('publishDescription').value });
      $('publishDialog').close(); await openDetail(result.post, 'public'); notice('已在公开展览馆展示。');
    } catch (error) { $('publishError').textContent = error.message; }
    finally { $('confirmPublish').disabled = false; }
  };
  $('unpublishWork').onclick = async () => {
    $('unpublishWork').disabled = true;
    try { const result = await request('/api/myworks/' + encodeURIComponent(detail.id) + '/update', { visibility: 'private' }); await openDetail(result.work, 'work'); notice('已转为私有，公开展览馆不再展示。'); }
    catch (error) { notice(error.message); }
    finally { $('unpublishWork').disabled = false; }
  };
  $('likePost').onclick = () => requireUser(() => socialAction($('likePost'), '/api/community/posts/' + encodeURIComponent(detail.id) + '/like', result => { detail.likes = result.likes; detail.liked = result.liked; }));
  $('favoritePost').onclick = () => requireUser(() => socialAction($('favoritePost'), '/api/community/posts/' + encodeURIComponent(detail.id) + '/favorite', result => { detail.collected = result.collected; }));
  $('followAuthor').onclick = () => requireUser(async () => {
    $('followAuthor').disabled = true; const version = detailVersion;
    try { const result = await request('/api/follow', { followee: detail.author }); if (version === detailVersion) { $('followAuthor').textContent = result.following ? '已关注' : '关注'; $('followAuthor').setAttribute('aria-pressed', String(result.following)); } }
    catch (error) { notice(error.message); } finally { $('followAuthor').disabled = false; }
  });
  $('focusComment').onclick = () => $('commentText').focus();
  $('commentForm').onsubmit = event => {
    event.preventDefault(); requireUser(async () => {
      const content = $('commentText').value.trim(); if (!content) return;
      const id = detail.id, version = detailVersion; $('sendComment').disabled = true;
      try { await request('/api/community/posts/' + encodeURIComponent(id) + '/comments', { content }); if (version === detailVersion) { $('commentText').value = ''; detail.commentCount = (detail.commentCount || 0) + 1; socialState(); loadComments(id, version); } }
      catch (error) { notice(error.message); } finally { $('sendComment').disabled = false; }
    });
  };
  async function initialize() {
    if (!token) return;
    const initialToken = token;
    try { const result = await request('/api/auth/profile'); if (initialToken === token) { user = result.profile; renderProfile(); if (screen === 'gallery' && scope === 'private') loadGallery(); } }
    catch (error) { if (token) notice('账号暂时未能加载，可稍后重新登录。'); }
  }
  initialize(); renderProfile();
  return { navigate, getPreferences: () => user?.preferences, getUser: () => user, getDetail: () => detail, request, requireUser, openStore };
}
