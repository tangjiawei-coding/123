// 列表、详情和保存预览共用同一张卡面，避免存档后丢失排版。
export function draftPayload(draft) {
  return { image: draft.image || draft.original, originalImage: draft.original,
    sentence: draft.text, handwriting: draft.ink?.image || '', audio: draft.voice,
    backgroundAudio: draft.music, skill: draft.skill, tone: draft.tone, stamp: draft.stamp.text,
    editor: { version: 1, font: draft.font, bilingual: draft.bilingual, stylized: !!draft.image,
      stampColor: draft.stamp.color, createdAt: draft.createdAt,
      ink: draft.ink ? { x: draft.ink.x, y: draft.ink.y, w: draft.ink.w, h: draft.ink.h, strokes: draft.ink.strokes } : null } };
}
export function workDraft(work) {
  const editor = work.editor || {};
  return { version: 1, original: work.originalImage || work.image, image: editor.stylized === false ? '' : work.image,
    text: work.sentence || '', font: editor.font || 'hand', bilingual: !!editor.bilingual,
    tone: work.tone || 'poetic', skill: work.skill || 'photo-abstract-editorial',
    ink: work.handwriting ? { ...editor.ink, image: work.handwriting,
      x: editor.ink?.x ?? .57, y: editor.ink?.y ?? .69, w: editor.ink?.w ?? .28, h: editor.ink?.h ?? .22, strokes: editor.ink?.strokes || [] } : null,
    voice: work.audio || null, music: work.backgroundAudio || null,
    stamp: { text: work.stamp || '一张', color: editor.stampColor || 'brown' },
    createdAt: editor.createdAt || new Date(work.createdAt || Date.now()).toISOString(),
    workId: work.visibility === 'private' ? work.id : null, workOwner: work.ownerNick, title: work.title || '' };
}
export function mediaSource(source) {
  return typeof source === 'string' && /^(data:(image|audio)\/|https?:\/\/|\/community_img\/|v2-assets\/)/.test(source) ? source : '';
}
export function createCardRenderer(template, notice) {
  return function renderCard(work, interactive = true) {
    const card = template.cloneNode(true);
    card.removeAttribute('id'); card.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    card.querySelectorAll('[tabindex]').forEach(node => node.removeAttribute('tabindex'));
    card.querySelectorAll('[style]').forEach(node => node.removeAttribute('style'));
    card.querySelectorAll('button').forEach(button => { button.disabled = !interactive; button.removeAttribute('aria-busy'); });
    const editor = work.editor || {};
    card.dataset.stamp = editor.stampColor || 'brown';
    card.querySelector('.postage-mark img').src = 'v2-assets/stamps/' + card.dataset.stamp + '.svg';
    const photo = card.querySelector('.card-photo'), image = photo.querySelector('img'), badge = photo.querySelector('.photo-edition');
    photo.querySelector('.photo-placeholder').hidden = true;
    image.src = mediaSource(work.image); image.hidden = false; image.alt = work.title || '明信片画面';
    const canFlip = editor.stylized !== false && !!work.originalImage && work.originalImage !== work.image;
    let original = false;
    badge.hidden = !interactive;
    const updatePhoto = () => {
      image.src = mediaSource(original ? work.originalImage : work.image);
      badge.textContent = canFlip ? original ? '原图 · 点击返回' : '点击看原图' : editor.stylized === false ? '原图' : '明信片画面';
      photo.setAttribute('aria-label', canFlip ? original ? '返回明信片画面' : '查看原图' : '明信片画面');
    };
    updatePhoto(); photo.onclick = () => { if (canFlip) { original = !original; updatePhoto(); } };
    card.querySelector('.blank-message').hidden = true;
    const copy = card.querySelector('.card-copy');
    copy.hidden = !work.sentence; copy.textContent = work.sentence || '';
    copy.classList.toggle('long-copy', (work.sentence || '').length > 38);
    copy.style.fontFamily = { hand: 'var(--hand)', serif: 'PostcardSerif, SimSun, serif', script: 'PostcardScript, var(--hand)' }[editor.font] || 'var(--hand)';
    const stamp = card.querySelector('.postage-large'); stamp.textContent = work.stamp || '一张'; stamp.style.fontSize = (work.stamp || '').length > 4 ? '6px' : '9px';
    card.querySelector('.card-date').textContent = new Date(editor.createdAt || work.createdAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    const ink = card.querySelector('.handwriting-note'); ink.hidden = !work.handwriting; ink.removeAttribute('role'); ink.removeAttribute('aria-label'); ink.style.pointerEvents = 'none';
    if (work.handwriting) {
      ink.querySelector('img').src = mediaSource(work.handwriting);
      Object.assign(ink.style, { left: (editor.ink?.x ?? .57) * 100 + '%', top: (editor.ink?.y ?? .69) * 100 + '%', width: (editor.ink?.w ?? .28) * 100 + '%', height: (editor.ink?.h ?? .22) * 100 + '%' });
    }
    const voice = new Audio(), music = new Audio(), sound = card.querySelector('.sound-sticker');
    sound.hidden = !(work.audio || work.backgroundAudio); sound.setAttribute('aria-label', '播放卡片声音'); sound.setAttribute('aria-pressed', 'false');
    const seconds = Math.round((work.audio || work.backgroundAudio)?.duration || 0);
    sound.querySelector('.sound-duration').textContent = seconds ? `▶ ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '▶ 播放';
    const stop = () => { voice.pause(); music.pause(); sound.setAttribute('aria-pressed', 'false'); };
    sound.onclick = async () => {
      if (!voice.paused || !music.paused) { stop(); return; }
      try {
        if (work.audio) { voice.src = mediaSource(work.audio.url); await voice.play(); }
        if (work.backgroundAudio) { music.src = mediaSource(work.backgroundAudio.url); music.volume = work.audio ? .22 : 1; music.loop = !!work.audio; await music.play(); }
        sound.setAttribute('aria-pressed', 'true');
      } catch { stop(); notice('这段声音暂时无法播放。'); }
    };
    voice.onended = stop; music.onended = () => { if (voice.paused) stop(); };
    voice.onerror = music.onerror = stop;
    const observer = new ResizeObserver(() => {
      if (!copy.clientHeight || copy.hidden) return;
      copy.style.fontSize = (work.sentence || '').length > 38 ? '3cqw' : '3.5cqw';
      let size = parseFloat(getComputedStyle(copy).fontSize);
      while (copy.scrollHeight > copy.clientHeight + 1 && size > card.clientWidth * .021) { size -= .4; copy.style.fontSize = size + 'px'; }
    });
    observer.observe(card);
    return { element: card, dispose: () => { stop(); observer.disconnect(); } };
  };
}
