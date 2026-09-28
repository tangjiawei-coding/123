// 创作状态与卡片展示共用一份内容；切换图片不会切走文字和声音。
let handwritingData = '';
let inkHistory = [];
let inkEraser = false;
let inkDrawing = false;
let audioEncoding = false;
let imageRequest = null;
let photoRevision = 0;

function cardPayload() {
  return {
    ...lastGenerated,
    sentence: $('personalMessage').value,
    handwriting: handwritingData,
    stamp: postcardStamp,
    audio: audioState.url ? { url: audioState.url, name: audioState.name, type: audioState.type } : null,
  };
}

function audioReady() {
  if (audioEncoding || (audioState.recorder && audioState.recorder.state !== 'inactive')) {
    toast('请先停止录音，等声音准备好后再保存或寄出', 'err');
    return false;
  }
  return true;
}

function createCardView(card) {
  const view = document.createElement('article');
  view.className = 'letter-card';
  const photo = document.createElement('button');
  photo.type = 'button'; photo.className = 'letter-photo';
  const img = document.createElement('img'); img.src = card.image || ''; img.alt = '寄件人选择的 AI 画面';
  const caption = document.createElement('span'); caption.className = 'photo-caption';
  photo.append(img, caption);
  let original = false;
  function label() {
    caption.textContent = card.originalImage ? (original ? '原图 · 点击回到 AI 画面' : 'AI 画面 · 点击查看原图') : '明信片画面';
    photo.setAttribute('aria-label', caption.textContent);
    photo.setAttribute('aria-pressed', String(original));
  }
  label(); photo.disabled = !card.originalImage;
  photo.addEventListener('click', () => {
    original = !original;
    img.src = original ? card.originalImage : card.image;
    img.alt = original ? '寄件人的原始照片' : '寄件人选择的 AI 画面';
    label();
  });
  const body = document.createElement('div'); body.className = 'letter-body';
  const mark = document.createElement('span'); mark.className = 'letter-mark'; mark.textContent = 'POSTCARD';
  const message = document.createElement('p'); message.className = 'letter-message'; message.textContent = card.sentence || '';
  const ink = document.createElement('img'); ink.className = 'letter-ink'; ink.alt = '寄件人的亲笔留言';
  if (card.handwriting) ink.src = card.handwriting; else ink.hidden = true;
  const sound = document.createElement('div'); sound.className = 'letter-sound';
  const soundName = document.createElement('span');
  const player = document.createElement('audio'); player.controls = true; player.preload = 'metadata';
  if (card.audio?.url) { player.src = card.audio.url; soundName.textContent = card.audio.name || '我的声音'; } else sound.hidden = true;
  sound.append(soundName, player);
  const stamp = document.createElement('div'); stamp.className = 'letter-stamp'; stamp.textContent = card.stamp || ''; stamp.hidden = !card.stamp;
  const date = document.createElement('time'); date.className = 'letter-date'; date.textContent = new Date(card.createdAt || Date.now()).toLocaleDateString('zh-CN');
  body.append(mark, message, ink, sound, stamp, date);
  view.append(photo, body);
  return view;
}

function refreshCardPreview() {
  if (!lastGenerated?.image) return;
  const card = cardPayload();
  Object.assign(lastGenerated, card);
  const host = $('composedPreview');
  const view = host.firstElementChild;
  // 编辑文字、邮戳或笔迹时保留正在播放的录音与当前图片视角。
  if (view && view.dataset.image === card.image) {
    view.querySelector('.letter-message').textContent = card.sentence;
    const ink = view.querySelector('.letter-ink'); ink.hidden = !card.handwriting;
    if (card.handwriting && ink.getAttribute('src') !== card.handwriting) ink.src = card.handwriting;
    const stamp = view.querySelector('.letter-stamp'); stamp.hidden = !card.stamp; stamp.textContent = card.stamp;
    const sound = view.querySelector('.letter-sound'); sound.hidden = !card.audio;
    const player = sound.querySelector('audio');
    if (player.getAttribute('src') !== (card.audio?.url || null)) {
      player.pause();
      if (card.audio) player.src = card.audio.url; else { player.removeAttribute('src'); player.load(); }
    }
    sound.querySelector('span').textContent = card.audio?.name || '';
  } else {
    const next = createCardView(card); next.dataset.image = card.image;
    host.replaceChildren(next);
  }
}

function invalidateCardImage() {
  photoRevision++;
  $('messageSuggestion').hidden = true;
  if (imageRequest) imageRequest.abort();
  lastGenerated = null; lastAutoWorkId = null;
  $('result').classList.remove('show');
  $('composedPreview').querySelectorAll('audio').forEach(a => a.pause());
  $('composedPreview').replaceChildren();
  clearSendLink();
}

function adoptGeneratedImage(image, originalImage, skill) {
  lastGenerated = { image, originalImage, skill, tone: toneSel.value, createdAt: Date.now() };
  lastAutoWorkId = null;
  $('saveWorkBtn').textContent = '保存到我的作品';
  $('result').classList.add('show');
  refreshCardPreview();
  clearSendLink();
}

async function generateCardImage() {
  if (!currentDataUrl) { toast('先选一张照片吧', 'err'); return; }
  if (imageRequest) return;
  const revision = photoRevision;
  const original = currentRawUrl || currentDataUrl;
  const selectedSkill = skillSel.value;
  const controller = new AbortController(); imageRequest = controller;
  genBtn.disabled = true;
  const start = Date.now();
  const update = () => { statusEl.textContent = `画面生成中 · ${Math.floor((Date.now() - start) / 1000)} 秒。可以继续写字、录音或手写。`; };
  update(); const ticker = setInterval(update, 1000);
  const timeout = setTimeout(() => controller.abort(), 420000);
  try {
    let source = currentDataUrl;
    // 从已保存作品继续编辑时，原图是本地媒体地址。
    if (!source.startsWith('data:')) {
      const response = await fetch(source, { signal: controller.signal });
      if (!response.ok) throw new Error('原图加载失败');
      source = (await compressImage(await response.blob())).dataUrl;
    }
    const response = await fetch('/api/generate-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ image: source, text: getCombinedText(), mode: currentMode, skill: selectedSkill }),
    });
    const data = await response.json();
    if (!response.ok || !data.image) throw new Error(data.error || '没有收到生成画面');
    if (revision !== photoRevision) return;
    adoptGeneratedImage(data.image, original, selectedSkill);
    statusEl.textContent = '画面准备好了，完成留言后就可以寄出。';
  } catch (error) {
    if (revision === photoRevision) statusEl.textContent = controller.signal.aborted ? '生成已停止，可以重新尝试。' : '生成失败：' + error.message;
  } finally {
    clearInterval(ticker); clearTimeout(timeout);
    imageRequest = null; genBtn.disabled = false;
  }
}

async function suggestMessage() {
  if (!currentDataUrl) { toast('先选一张照片，让 AI 看看这一刻', 'err'); return; }
  const btn = $('suggestBtn'); btn.disabled = true; btn.textContent = '正在想一句话…';
  const revision = photoRevision;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    let source = currentDataUrl;
    if (!source.startsWith('data:')) {
      const response = await fetch(source, { signal: controller.signal });
      if (!response.ok) throw new Error('原图加载失败');
      source = (await compressImage(await response.blob())).dataUrl;
    }
    const response = await fetch('/api/generate-sentence', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ image: source, text: $('personalMessage').value || getCombinedText(), tone: toneSel.value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '暂时无法生成建议');
    if (revision !== photoRevision) return;
    $('suggestionText').textContent = data.sentence || '';
    $('messageSuggestion').hidden = false;
  } catch (error) { toast('文字建议生成失败：' + error.message, 'err'); }
  finally { clearTimeout(timeout); btn.disabled = false; btn.textContent = '再给我一句建议'; }
}

async function saveCardDraft() {
  if (!lastGenerated?.image || !audioReady()) return;
  if (!requireLogin('登录后就能把这张明信片保存下来')) return;
  const btn = $('saveWorkBtn'); btn.disabled = true;
  const draft = lastGenerated;
  const id = lastAutoWorkId;
  try {
    const payload = cardPayload();
    if (!id) payload.visibility = 'private';
    const response = await fetch(id ? `/api/myworks/${id}/update` : '/api/myworks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '保存失败');
    if (lastGenerated === draft) {
      lastAutoWorkId = data.work.id;
      btn.textContent = '保存修改';
    }
    toast('已保存到「我的作品」' + (data.work.visibility === 'private' ? '，仅自己可见' : ''), 'ok');
  } catch (error) { toast(error.message, 'err'); }
  finally { btn.disabled = false; }
}

async function editCardDraft(work) {
  if (!audioReady()) return;
  invalidateCardImage();
  $('text').value = '';
  $('stampPlace').value = ''; $('stampMoment').value = ''; $('stampTheme').value = '';
  currentRawUrl = work.originalImage || null;
  currentDataUrl = currentRawUrl;
  $('personalMessage').value = work.sentence || '';
  handwritingData = work.handwriting || ''; inkHistory = [];
  await paintHandwriting(handwritingData);
  setPrivateStamp(work.stamp || '');
  setPostcardAudio(work.audio || { url: '', name: '', type: '' });
  if (work.skill) selectSkill(work.skill);
  adoptGeneratedImage(work.image, work.originalImage, work.skill);
  lastGenerated.createdAt = work.createdAt;
  lastAutoWorkId = work.id;
  $('saveWorkBtn').textContent = '保存修改';
  $('preview').classList.toggle('show', !!currentRawUrl);
  if (currentRawUrl) { $('pvImg').src = currentRawUrl; $('pvName').textContent = '已保存的原图'; $('pvSize').textContent = '继续编辑这张明信片'; }
  switchView('gen');
  $('messageSection').scrollIntoView({ block: 'start' });
}

function loadCardImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image); image.onerror = () => reject(new Error('图片加载失败'));
    image.src = src;
  });
}

async function paintHandwriting(src) {
  const canvas = $('handwritingCanvas'); const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (src) {
    try { context.drawImage(await loadCardImage(src), 0, 0, canvas.width, canvas.height); }
    catch (error) { toast('笔迹加载失败，请重新打开作品', 'err'); }
  }
}

async function exportCardImage(card) {
  if (!card?.image) return;
  try {
    const image = await loadCardImage(card.image);
    const ink = card.handwriting ? await loadCardImage(card.handwriting) : null;
    await document.fonts.ready;
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
    const width = 1400, photoWidth = 720, textWidth = 560;
    ctx.font = `28px ${fontEn}, ${fontCn}, serif`;
    const lines = [];
    for (const paragraph of String(card.sentence || '').split('\n')) {
      let line = '';
      for (const char of paragraph) {
        if (line && ctx.measureText(line + char).width > textWidth) { lines.push(line); line = ''; }
        line += char;
      }
      lines.push(line);
    }
    canvas.width = width; canvas.height = Math.max(900, 230 + lines.length * 44 + (ink ? 240 : 0));
    ctx.fillStyle = '#F3F0E8'; ctx.fillRect(0, 0, width, canvas.height);
    const scale = Math.min(photoWidth / image.width, canvas.height / image.height);
    ctx.drawImage(image, (photoWidth - image.width * scale) / 2, (canvas.height - image.height * scale) / 2, image.width * scale, image.height * scale);
    ctx.strokeStyle = '#D8D1C4'; ctx.beginPath(); ctx.moveTo(photoWidth, 50); ctx.lineTo(photoWidth, canvas.height - 50); ctx.stroke();
    const x = photoWidth + 60;
    ctx.fillStyle = '#746557'; ctx.font = '18px Georgia'; ctx.fillText('POSTCARD', x, 70);
    ctx.fillStyle = '#2B2A28'; ctx.font = `28px ${fontEn}, ${fontCn}, serif`;
    lines.forEach((line, index) => ctx.fillText(line, x, 140 + index * 44));
    if (ink) ctx.drawImage(ink, x, 160 + lines.length * 44, textWidth, textWidth * ink.height / ink.width);
    ctx.fillStyle = '#7A5A3A'; ctx.font = '20px Microsoft YaHei, sans-serif';
    ctx.fillText(card.stamp || '', x, canvas.height - 60, textWidth);
    ctx.font = `16px ${fontDate}`;
    ctx.fillText(new Date(card.createdAt || Date.now()).toLocaleDateString('zh-CN'), x, canvas.height - 30);
    const link = document.createElement('a'); link.download = `postcard-${Date.now()}.png`; link.href = canvas.toDataURL('image/png'); link.click();
  } catch (error) { toast('导出失败：' + error.message, 'err'); }
}

window.addEventListener('DOMContentLoaded', () => {
  $('personalMessage').addEventListener('input', refreshCardPreview);
  $('suggestBtn').addEventListener('click', suggestMessage);
  $('acceptSuggestion').addEventListener('click', () => {
    $('personalMessage').value = $('suggestionText').textContent.slice(0, 1000);
    $('messageSuggestion').hidden = true; refreshCardPreview();
  });
  $('dismissSuggestion').addEventListener('click', () => { $('messageSuggestion').hidden = true; });
  const canvas = $('handwritingCanvas'), ctx = canvas.getContext('2d');
  const point = event => { const rect = canvas.getBoundingClientRect(); return [(event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height]; };
  canvas.addEventListener('pointerdown', event => {
    if (inkDrawing || event.button !== 0) return;
    event.preventDefault(); canvas.setPointerCapture(event.pointerId); inkDrawing = true;
    inkHistory.push(handwritingData); if (inkHistory.length > 20) inkHistory.shift();
    ctx.globalCompositeOperation = inkEraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = '#34322E'; ctx.lineWidth = inkEraser ? 32 : 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const [x, y] = point(event); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + .1, y + .1); ctx.stroke();
  });
  canvas.addEventListener('pointermove', event => {
    if (!inkDrawing || !canvas.hasPointerCapture(event.pointerId)) return;
    ctx.lineTo(...point(event)); ctx.stroke();
  });
  function finish() {
    if (!inkDrawing) return;
    inkDrawing = false; ctx.globalCompositeOperation = 'source-over';
    handwritingData = canvas.toDataURL('image/png'); refreshCardPreview();
  }
  canvas.addEventListener('pointerup', finish); canvas.addEventListener('pointercancel', finish); canvas.addEventListener('lostpointercapture', finish);
  function mode(erase) {
    inkEraser = erase; $('inkPen').setAttribute('aria-pressed', String(!erase)); $('inkEraser').setAttribute('aria-pressed', String(erase));
  }
  $('inkPen').addEventListener('click', () => mode(false)); $('inkEraser').addEventListener('click', () => mode(true));
  $('inkUndo').addEventListener('click', async () => { if (!inkHistory.length) return; handwritingData = inkHistory.pop(); await paintHandwriting(handwritingData); refreshCardPreview(); });
  $('inkClear').addEventListener('click', () => { inkHistory.push(handwritingData); handwritingData = ''; ctx.clearRect(0, 0, canvas.width, canvas.height); refreshCardPreview(); });
});
