import { readDraft, writeDraft, readDataURL, loadImage } from './v2-draft.js';
import { setupInk } from './v2-ink.js';
import { setupAudio } from './v2-audio.js';
import { setupLibrary } from './v2-library.js';
import { setupDelivery } from './v2-delivery.js';

const $ = id => document.getElementById(id);
// 前六张使用 Pexels 免费照片经对应画风生成；照片页对应 id 顺序：
// 37186482、2808320、30315828、26968200、18011893、33117562。
// 来源：https://www.pexels.com/photo/<id>/；打包的是生成后的缩略图。
// 新增四张的照片来源、上游版本和实际生成提示词见 skills/samples.json。
const styles = [
  ['photo-abstract-editorial', '象牙抽象编辑'],
  ['scenes-gathered-zine-v1-3', '实景拼贴 Zine'],
  ['scene-distillation-zine-v1-3', '影像蒸馏 Zine'],
  ['gc-minimal-zine-poster', '极简 Zine 海报'],
  ['heytea-style', '喜茶风格'],
  ['ian-xiaohei-illustrations', '小黑怪诞配图'],
  ['postmark-watercolor', '水彩邮记'],
  ['ukiyoe-picture', '木版旅绘'],
  ['mono-color', '双色印刷'],
  ['layered-sticker', '贴纸手账'],
];
const fonts = { sans: ['简洁', 'var(--ui)'], hand: ['霞鹜文楷', 'var(--hand)'], serif: ['宋体', 'PostcardSerif, SimSun, serif'], script: ['手写体', 'PostcardScript, var(--hand)'] };
let draft = { version: 1, layout: 'split', original: '', image: '', skill: styles[0][0], text: '', font: 'hand', bilingual: false, tone: 'poetic', ink: null, voice: null, music: null, stamp: { color: 'brown', text: '一张' }, createdAt: new Date().toISOString() };
const blankDraft = structuredClone(draft);
let noticeTimer, saveTimer, revision = 0, savedRevision = 0, audioBusy = false, photoBusy = false, showingOriginal = false;
let imageRequest, textRequest, importVersion = 0, suggestion = '', previousText = null, liveZoom = false;
let audio;
function fitCopy() {
  const copy = $('cardCopy');
  if (!draft.text || !copy.clientHeight) { $('copyOverflow').hidden = true; return; }
  copy.style.fontSize = draft.text.length > 38 ? '3cqw' : '3.5cqw';
  const minimum = $('postcard').clientWidth * .021;
  let size = parseFloat(getComputedStyle(copy).fontSize);
  while (copy.scrollHeight > copy.clientHeight + 1 && size > minimum) {
    size -= .4; copy.style.fontSize = size + 'px';
  }
  $('copyOverflow').hidden = copy.scrollHeight <= copy.clientHeight + 1;
}
function notice(message) {
  (document.querySelector('dialog[open]') || document.body).appendChild($('notice'));
  clearTimeout(noticeTimer); $('notice').textContent = message; $('notice').hidden = false;
  noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 5000);
}
function updateBusy() { $('saveDraft').disabled = $('clearDraft').disabled = audioBusy || photoBusy; }
function changed() {
  revision++; $('draftLabel').textContent = '正在保存到本机…';
  clearTimeout(saveTimer); saveTimer = setTimeout(() => save(false), 700);
}
async function save(explicit = false) {
  if (audioBusy || photoBusy) { if (explicit) notice('请等待录音或文件处理完成。'); return; }
  const version = revision;
  try {
    await writeDraft({ ...draft, updatedAt: new Date().toISOString() });
    savedRevision = Math.max(savedRevision, version);
    if (revision === version) $('draftLabel').textContent = '草稿已存到本机';
    if (explicit) notice('已保存到当前浏览器，下次打开可继续编辑。');
  } catch { $('draftLabel').textContent = '保存失败，请勿关闭页面'; notice('本机存储不可用或空间不足，草稿尚未保存。'); }
}
function selectTool(name, focus = false) {
  document.querySelectorAll('[data-tool]').forEach(button => {
    const selected = button.dataset.tool === name;
    button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  });
  document.querySelectorAll('[role=tabpanel]').forEach(panel => { panel.hidden = panel.id !== 'panel-' + name; });
}
function render() {
  const image = showingOriginal ? draft.original : draft.image || draft.original;
  $('photoImage').hidden = !image;
  $('photoImage').style.objectFit = !showingOriginal && draft.image ? 'contain' : 'cover';
  $('photoImage').style.backgroundColor = '#f3f0e8';
  if (image && $('photoImage').getAttribute('src') !== image) $('photoImage').src = image;
  if (!image) $('photoImage').removeAttribute('src');
  $('photoPlaceholder').hidden = !!image; $('photoBadge').hidden = !image;
  $('photoBadge').textContent = draft.image ? showingOriginal ? '原图 · 点击看 AI 画面' : 'AI 画面 · 点击看原图' : '原图 · 尚未风格化';
  $('photoButton').setAttribute('aria-label', !image ? '导入照片' : draft.image ? showingOriginal ? '显示 AI 画面' : '查看原图' : '当前为原图');
  $('regenerate').hidden = !draft.original;
  $('cardCopy').textContent = draft.text; $('cardCopy').hidden = !draft.text;
  $('blankMessage').hidden = !!draft.text;
  $('cardCopy').style.fontFamily = (fonts[draft.font] || fonts.hand)[1];
  $('cardCopy').style.fontSize = draft.text.length > 65 ? '2.65cqw' : draft.text.length > 38 ? '3cqw' : '3.5cqw';
  $('cardCopy').classList.toggle('long-copy', draft.text.length > 38);
  if ($('messagePreview').value !== draft.text) $('messagePreview').value = draft.text;
  $('bilingual').setAttribute('aria-pressed', String(draft.bilingual));
  $('textTone').value = draft.tone;
  document.querySelectorAll('[data-font]').forEach(button => { button.classList.toggle('selected', button.dataset.font === draft.font); button.setAttribute('aria-pressed', String(button.dataset.font === draft.font)); });
  document.querySelector('.font-label').textContent = (fonts[draft.font] || fonts.hand)[0];
  document.querySelectorAll('[data-skill]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.skill === draft.skill)));
  $('postcard').dataset.stamp = draft.stamp.color;
  $('postcard').dataset.layout = ['split', 'stack', 'photo'].includes(draft.layout) ? draft.layout : 'split';
  $('postageImage').src = 'v2-assets/stamps/' + draft.stamp.color + '.svg';
  document.querySelector('#postcard .postage-large').textContent = draft.stamp.text;
  document.querySelector('#postcard .postage-large').style.fontSize = draft.stamp.text.length > 4 ? '6px' : '9px';
  $('stampText').value = draft.stamp.text;
  document.querySelectorAll('.stamp-options [data-stamp]').forEach(button => { const selected = button.dataset.stamp === draft.stamp.color; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
  $('handwritingNote').hidden = !draft.ink;
  if (draft.ink) {
    $('inkImage').src = draft.ink.image;
    Object.assign($('handwritingNote').style, { left: draft.ink.x * 100 + '%', top: draft.ink.y * 100 + '%', width: draft.ink.w * 100 + '%', height: draft.ink.h * 100 + '%' });
    const preview = document.createElement('img'); preview.src = draft.ink.image; preview.alt = '我的笔迹'; $('inkPreview').replaceChildren(preview);
  } else $('inkPreview').textContent = '点击写下你的话';
  $('removeInk').disabled = !draft.ink;
  $('cardDate').textContent = new Date(draft.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  audio?.render();
  requestAnimationFrame(fitCopy);
}
async function api(path, payload, signal) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '服务暂时不可用，请稍后再试。');
  return result;
}
async function generateImage() {
  if (!draft.original) { notice('先导入一张照片，再选择画风。'); return; }
  imageRequest?.abort();
  const request = new AbortController(); imageRequest = request;
  const original = draft.original, skill = draft.skill;
  $('generationStatus').textContent = '正在绘制，完成后自动显示 AI 画面…';
  $('regenerate').textContent = '重新开始'; $('photoButton').setAttribute('aria-busy', 'true');
  try {
    const image = await prepareImage(original);
    if (request.signal.aborted) return;
    const result = await api('/api/generate-image', { image, skill }, request.signal);
    if (!result.image) throw new Error('服务没有返回图片，请重试。');
    await loadImage(result.image);
    if (request !== imageRequest || request.signal.aborted) return;
    draft.image = result.image; showingOriginal = false; render(); changed();
    $('generationStatus').textContent = '已完成，点击卡片左侧可查看原图。';
  } catch (error) {
    if (request !== imageRequest || error.name === 'AbortError') return;
    $('generationStatus').textContent = error.message; notice(error.message);
  } finally {
    if (request === imageRequest) { $('photoButton').setAttribute('aria-busy', 'false'); $('regenerate').textContent = '重新生成'; }
  }
}
async function importPhoto(file) {
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 20 * 1024 * 1024) { notice('请选择 20 MB 以内的 JPG、PNG 或 WebP 图片。'); return; }
  const version = ++importVersion; photoBusy = true; updateBusy();
  try {
    const original = await readDataURL(file);
    await loadImage(original);
    if (version !== importVersion) return;
    // 原图完整保留，生成请求单独压缩，避免请求体过大。
    imageRequest?.abort(); textRequest?.abort();
    draft.original = original; draft.image = ''; draft.text = ''; showingOriginal = false;
    suggestion = ''; previousText = null; $('suggestedCopy').value = '';
    $('textSuggestion').hidden = true; render(); changed();
    generateImage();
  } catch (error) { notice(error.message); }
  finally { if (version === importVersion) { photoBusy = false; updateBusy(); save(false); } }
}
// 生成接口保留原有 25 MB 请求上限；仅为 API 缩小照片，原图仍保存完整文件。
async function prepareImage(src) {
  const image = await loadImage(src), scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', .9);
}
async function suggestText() {
  if (!draft.original) { notice('导入照片后，AI 才能结合画面帮你写。'); return; }
  textRequest?.abort(); const request = new AbortController(); textRequest = request;
  $('suggestText').disabled = true; $('suggestText').textContent = '正在想一句话…';
  $('textSuggestion').hidden = true;
  const payload = { image: draft.original, text: draft.text, tone: draft.tone, bilingual: draft.bilingual };
  try {
    payload.image = await prepareImage(payload.image);
    if (request.signal.aborted) return;
    const result = await api('/api/generate-sentence', payload, request.signal);
    if (request !== textRequest || request.signal.aborted) return;
    suggestion = (result.sentence || '').trim();
    if (!suggestion) throw new Error('没有生成文案，请重试。');
    $('suggestedCopy').value = suggestion; $('textSuggestion').hidden = false;
    $('applySuggestion').disabled = suggestion.length > 100;
    if (suggestion.length > 100) notice('这段建议超过 100 字，可在建议框内精简后采用。');
  } catch (error) { if (error.name !== 'AbortError') notice(error.message); }
  finally { if (request === textRequest) { $('suggestText').disabled = false; $('suggestText').textContent = 'AI 帮我写'; } }
}
function openZoom(example = false) {
  liveZoom = !example;
  if (example) {
    const card = $('postcard').cloneNode(true);
    card.querySelector('#photoImage').src = 'v2-assets/coast-study.svg'; card.querySelector('#photoImage').hidden = false;
    card.querySelector('#photoPlaceholder').hidden = true; card.querySelector('#photoBadge').textContent = '构图示意 · 非 AI 生成'; card.querySelector('#photoBadge').hidden = false;
    card.querySelector('#blankMessage').hidden = true;
    const copy = card.querySelector('#cardCopy'); copy.textContent = '愿我们在不同的日子里，\n都能看到同一片海。'; copy.hidden = false; copy.removeAttribute('style');
    const ink = card.querySelector('#handwritingNote'); ink.hidden = false; ink.style.cssText = 'left:57%;top:69%;width:28%;height:22%'; ink.querySelector('img').src = 'v2-assets/handwriting.svg';
    card.querySelector('#soundSticker').hidden = true;
    card.querySelectorAll('[id]').forEach(node => node.removeAttribute('id')); card.removeAttribute('id');
    card.querySelectorAll('button').forEach(button => button.disabled = true); card.querySelector('[role="button"]').removeAttribute('tabindex');
    $('zoomContent').replaceChildren(card);
  } else $('zoomContent').replaceChildren($('postcard'));
  $('zoomTitle').textContent = example ? '完成示例 · 不会覆盖草稿' : '明信片 · 放大编辑';
  $('zoomHint').textContent = example ? '仅展示构图与手写位置，海岸插画不是 AI 生成结果。' : '点击图片查看原图；拖动笔迹调整位置。';
  $('zoomDialog').showModal();
}

// 先恢复草稿，再允许编辑，避免加载结果覆盖用户刚输入的内容。
document.querySelector('.app-shell').inert = true;
try {
  const saved = await readDraft();
  if (saved?.version === 1) { draft = saved; $('draftLabel').textContent = '已恢复本机草稿'; }
  else $('draftLabel').textContent = '未写完的明信片';
} catch { notice('无法读取本机草稿，可以继续编辑，但保存可能不可用。'); }
audio = setupAudio({ getDraft: () => draft, commit: (kind, value) => { draft[kind] = value; render(); changed(); }, setBusy: value => { audioBusy = value; updateBusy(); if (!value && revision !== savedRevision) save(false); }, notice });
setupInk({ getInk: () => draft.ink, commit: ink => { draft.ink = ink; render(); changed(); }, notice });
styles.forEach(([id, name]) => {
  const button = document.createElement('button'); button.className = 'style-choice'; button.dataset.skill = id;
  button.innerHTML = '<span class="style-thumb"><img src="v2-assets/style-' + id + '.jpg" alt=""></span><span class="style-title"></span>';
  button.querySelector('.style-title').textContent = name; button.setAttribute('aria-label', name);
  button.onclick = () => { if (draft.skill !== id) { draft.skill = id; draft.image = ''; showingOriginal = false; render(); changed(); } generateImage(); };
  $('styleStrip').appendChild(button);
});
fetch('/api/skills').then(response => response.json()).then(available => {
  if (!Array.isArray(available)) return;
  document.querySelectorAll('[data-skill]').forEach(button => {
    if (!available.some(skill => skill.id === button.dataset.skill)) { button.disabled = true; button.title = '暂未配置'; }
  });
}).catch(() => {});
document.querySelectorAll('[data-tool]').forEach((button, index, all) => {
  button.onclick = () => selectTool(button.dataset.tool);
  button.onkeydown = event => {
    const next = { ArrowRight: (index + 1) % all.length, ArrowLeft: (index + all.length - 1) % all.length, Home: 0, End: all.length - 1 }[event.key];
    if (next !== undefined) { event.preventDefault(); selectTool(all[next].dataset.tool, true); }
  };
});
document.addEventListener('click', event => { const button = event.target.closest('[data-unavailable]'); if (button) notice(button.dataset.unavailable); });
$('saveDraft').onclick = () => save(true);
$('changePhoto').onclick = () => $('photoFile').click();
$('photoFile').onchange = event => { const file = event.target.files[0]; event.target.value = ''; importPhoto(file); };
$('photoButton').onclick = () => {
  if (!draft.original) { $('photoFile').click(); return; }
  if (!draft.image) { notice('当前展示的是原图，AI 画面尚未生成。'); return; }
  showingOriginal = !showingOriginal; render();
};
$('regenerate').onclick = generateImage;
$('blankMessage').onclick = () => { if ($('zoomDialog').open) $('zoomDialog').close(); selectTool('text'); $('messagePreview').focus(); };
$('messagePreview').oninput = event => { draft.text = event.target.value; previousText = null; $('undoText').hidden = true; render(); changed(); };
$('suggestText').onclick = suggestText;
$('suggestedCopy').oninput = event => { suggestion = event.target.value; $('applySuggestion').disabled = !suggestion.trim() || suggestion.length > 100; };
$('bilingual').onclick = () => { draft.bilingual = !draft.bilingual; textRequest?.abort(); $('textSuggestion').hidden = true; render(); changed(); };
$('textTone').onchange = event => { draft.tone = event.target.value; textRequest?.abort(); $('textSuggestion').hidden = true; changed(); };
$('applySuggestion').onclick = () => { previousText = draft.text; draft.text = suggestion; $('undoText').hidden = false; $('textSuggestion').hidden = true; render(); changed(); };
$('dismissSuggestion').onclick = () => { $('textSuggestion').hidden = true; };
$('undoText').onclick = () => { if (previousText !== null) { draft.text = previousText; previousText = null; $('undoText').hidden = true; render(); changed(); } };
document.querySelectorAll('[data-font]').forEach(button => { button.onclick = () => { draft.font = button.dataset.font; render(); changed(); }; });
document.querySelectorAll('.stamp-options [data-stamp]').forEach(button => { button.onclick = () => { draft.stamp.color = button.dataset.stamp; render(); changed(); }; });
$('stampText').oninput = event => { draft.stamp.text = event.target.value; render(); changed(); };
$('expandCard').onclick = () => openZoom();
$('closeZoom').onclick = () => $('zoomDialog').close();
$('zoomDialog').addEventListener('close', () => { if (liveZoom) $('cardStage').appendChild($('postcard')); $('zoomContent').replaceChildren(); liveZoom = false; });
document.querySelector('[data-state="complete"]').onclick = () => openZoom(true);
document.querySelector('[data-state="blank"]').onclick = () => { selectTool('style'); notice('正在编辑你的本机草稿。'); };
window.addEventListener('beforeunload', event => { if (revision !== savedRevision || audioBusy || photoBusy) { event.preventDefault(); event.returnValue = ''; } });
render(); selectTool('style'); document.querySelector('.app-shell').inert = false;
new ResizeObserver(fitCopy).observe($('postcard'));
if (draft.original) $('generationStatus').textContent = draft.image ? '点击卡片左侧，可在 AI 画面与原图间切换。' : '已恢复原图，可以选择画风或重新生成。';
if (new URLSearchParams(location.search).get('state') === 'complete') openZoom(true);

async function replaceDraft(next) {
  if (audioBusy || photoBusy) throw new Error('请先结束录音或文件处理。');
  clearTimeout(saveTimer);
  await writeDraft(draft, 'previous');
  imageRequest?.abort(); textRequest?.abort(); imageRequest = null;
  audio.stopPlayback(); draft = next; showingOriginal = false;
  $('photoButton').setAttribute('aria-busy', 'false'); $('regenerate').textContent = '重新生成';
  $('textSuggestion').hidden = $('undoText').hidden = true; previousText = null;
  $('generationStatus').textContent = draft.original ? '已载入卡片，可以继续编辑。' : '导入照片后，选择一种画风。';
  $('restorePreviousDraft').hidden = false;
  render(); changed(); await save(false);
}
const library = setupLibrary({
  getDraft: () => draft, loadDraft: replaceDraft,
  markStored: work => { draft.workId = work.id; draft.workOwner = work.ownerNick; draft.title = work.title; changed(); },
  applyPreferences: preferences => { draft.font = preferences.font; draft.tone = preferences.tone; draft.bilingual = preferences.bilingual; render(); changed(); },
  setStamp: color => { draft.stamp.color = color; render(); changed(); selectTool('stamp'); },
  isBusy: () => audioBusy || photoBusy, stopAudio: () => audio.stopPlayback(), notice,
});
let coverAnimation;
$('clearDraft').onclick = () => $('clearDraftDialog').showModal();
$('confirmClearDraft').onclick = async () => {
  $('confirmClearDraft').disabled = true;
  try {
    await replaceDraft({ ...structuredClone(blankDraft), createdAt: new Date().toISOString() });
    selectTool('style'); $('clearDraftDialog').close(); notice('当前草稿已清空。');
  } catch (error) { notice(error.message); }
  finally { $('confirmClearDraft').disabled = false; }
};
window.addEventListener('postcard:navigate', () => {
  coverAnimation?.cancel(); coverAnimation = undefined; $('openCreator').disabled = false;
});
$('openCreator').onclick = async () => {
  if (coverAnimation) return;
  const button = $('openCreator'); button.disabled = true;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  coverAnimation = button.animate([
    { transform: 'perspective(900px) rotate(-5deg) rotateY(0deg)', opacity: 1 },
    { transform: 'perspective(900px) rotate(0deg) rotateY(-72deg) scale(1.06)', opacity: 0 }
  ], { duration: reduced ? 0 : 420, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
  try { await coverAnimation.finished; library.navigate('create'); } catch { /* 离开封面时取消展开。 */ }
};
$('backToCover').onclick = async () => {
  if (audioBusy || photoBusy) { notice('请先结束录音或文件处理。'); return; }
  await save(false); library.navigate('cover');
};
function showDraftRow(draft, imageId, summaryId) {
  const image = $(imageId), source = draft.image || draft.original;
  image.hidden = !source;
  if (source) image.src = source; else image.removeAttribute('src');
  $(summaryId).textContent = draft.text?.trim() || (source ? '已选照片，继续完善' : '还没有添加照片');
}
$('myDrafts').onclick = async () => {
  await save(false);
  showDraftRow(draft, 'currentDraftImage', 'currentDraftSummary');
  try {
    const previous = await readDraft('previous');
    $('previousDraftRow').hidden = !previous;
    if (previous) showDraftRow(previous, 'previousDraftImage', 'previousDraftSummary');
  } catch { $('previousDraftRow').hidden = true; }
  $('draftsDialog').showModal();
};
$('continueCurrentDraft').onclick = () => { $('draftsDialog').close(); library.navigate('create'); };
$('restoreFromMy').onclick = async () => {
  try {
    const previous = await readDraft('previous');
    if (!previous) return;
    await replaceDraft(previous); $('draftsDialog').close(); library.navigate('create');
    notice('已恢复上一份草稿。');
  } catch (error) { notice(error.message); }
};
$('newPostcard').onclick = async () => {
  try { await replaceDraft({ ...structuredClone(blankDraft), ...library.getPreferences(), createdAt: new Date().toISOString() }); library.navigate('create'); notice('新卡片已准备好，上一份草稿可在私有展览馆恢复。'); }
  catch (error) { notice(error.message); }
};
$('restorePreviousDraft').onclick = async () => {
  try { const previous = await readDraft('previous'); if (!previous) return; await replaceDraft(previous); library.navigate('create'); notice('已恢复上一份草稿。'); }
  catch (error) { notice(error.message); }
};
readDraft('previous').then(previous => { $('restorePreviousDraft').hidden = !previous; }).catch(() => {});
document.querySelector('[data-state="blank"]').onclick = () => { library.navigate('create'); selectTool('style'); };
setupDelivery({ library, getDraft: () => draft, isBusy: () => audioBusy || photoBusy, stopAudio: () => audio.stopPlayback(), notice });
