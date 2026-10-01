import { createCardRenderer } from './v2-card.js';

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片无法导出，请重新导入照片；外部图片需允许跨域读取。'));
    image.src = source;
  });
}
// 根据同一张卡片的实际布局绘制高清 PNG，不包含编辑按钮和原图切换提示。
export async function exportPostcard(payload, template) {
  const renderer = createCardRenderer(template, () => {});
  const view = renderer(payload, false);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:1400px;pointer-events:none';
  host.setAttribute('aria-hidden', 'true'); host.inert = true;
  host.append(view.element); document.body.append(host);
  try {
    await document.fonts.ready;
    const copy = view.element.querySelector('.card-copy');
    await document.fonts.load(getComputedStyle(copy).font, payload.sentence || '一张');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const card = view.element, bounds = card.getBoundingClientRect();
    const rect = selector => {
      const element = typeof selector === 'string' ? card.querySelector(selector) : selector;
      const box = element.getBoundingClientRect();
      return { element, x: box.left - bounds.left, y: box.top - bounds.top, w: box.width, h: box.height };
    };
    const canvas = document.createElement('canvas'); canvas.width = 1400; canvas.height = 900;
    const ctx = canvas.getContext('2d');
    const polygon = getComputedStyle(card).clipPath.match(/^polygon\((.*)\)$/);
    if (polygon) {
      ctx.beginPath();
      polygon[1].split(',').forEach((point, index) => {
        const [x, y] = point.trim().split(/\s+/);
        const px = parseFloat(x) * (x.endsWith('%') ? 14 : 1), py = parseFloat(y) * (y.endsWith('%') ? 9 : 1);
        index ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.closePath(); ctx.clip();
    }
    ctx.fillStyle = '#fff9ea'; ctx.fillRect(0, 0, 1400, 900);
    const paper = await loadImage('v2-assets/paper.svg'); ctx.drawImage(paper, 0, 0, 1400, 900);
    const photo = rect('.card-photo'), image = await loadImage(payload.image);
    const scale = Math.max(photo.w / image.width, photo.h / image.height);
    ctx.save(); ctx.beginPath(); ctx.rect(photo.x, photo.y, photo.w, photo.h); ctx.clip();
    ctx.drawImage(image, photo.x + (photo.w - image.width * scale) * .46, photo.y + (photo.h - image.height * scale) / 2, image.width * scale, image.height * scale); ctx.restore();
    const message = rect('.card-message');
    ctx.strokeStyle = '#b5a78930'; ctx.lineWidth = 1;
    for (let y = message.y + message.h * .14; y < message.y + message.h; y += message.h * .143) { ctx.beginPath(); ctx.moveTo(message.x, y); ctx.lineTo(message.x + message.w, y); ctx.stroke(); }
    // 用浏览器排好的字符位置绘制，保存换行、字体和长文缩字号结果。
    const drawText = element => {
      if (element.hidden || !element.textContent) return;
      const style = getComputedStyle(element), fontSize = parseFloat(style.fontSize);
      ctx.font = style.font; ctx.fillStyle = style.color; ctx.textBaseline = 'alphabetic';
      const node = element.firstChild; if (!node || node.nodeType !== Node.TEXT_NODE) return;
      const range = document.createRange(); let offset = 0;
      const clip = rect(element); ctx.save(); ctx.beginPath(); ctx.rect(clip.x, clip.y, clip.w, clip.h); ctx.clip();
      for (const char of node.textContent) {
        range.setStart(node, offset); offset += char.length; range.setEnd(node, offset);
        if (char === '\n') continue;
        const box = range.getBoundingClientRect();
        const metrics = ctx.measureText(char);
        const ascent = metrics.fontBoundingBoxAscent || fontSize * .8;
        const descent = metrics.fontBoundingBoxDescent || fontSize * .2;
        ctx.fillText(char, box.left - bounds.left, box.top - bounds.top + (box.height - ascent - descent) / 2 + ascent);
      }
      ctx.restore();
    };
    drawText(copy); drawText(card.querySelector('.card-date'));
    const mark = card.querySelector('.postage-mark');
    const mw = mark.clientWidth, mh = mark.clientHeight, s = Math.min(mw / 94, mh / 76);
    ctx.save(); ctx.translate(message.x + mark.offsetLeft + mw / 2, message.y + mark.offsetTop + mh / 2); ctx.rotate(9 * Math.PI / 180);
    ctx.translate(-94 * s / 2, -76 * s / 2); ctx.scale(s, s);
    ctx.drawImage(await loadImage(mark.querySelector('img').src), 0, 0, 94, 76);
    ctx.fillStyle = getComputedStyle(mark).color; ctx.textAlign = 'center';
    ctx.font = `${(payload.stamp || '').length > 4 ? 6 : 9}px 'LXGW WenKai GB Screen R', KaiTi, serif`; ctx.fillText(payload.stamp || '一张', 36, 38); ctx.restore();
    if (payload.handwriting) {
      const ink = rect('.handwriting-note'), inkImage = await loadImage(payload.handwriting);
      const factor = Math.min(ink.w / inkImage.width, ink.h / inkImage.height);
      ctx.drawImage(inkImage, ink.x + (ink.w - inkImage.width * factor) / 2, ink.y + (ink.h - inkImage.height * factor) / 2, inkImage.width * factor, inkImage.height * factor);
    }
    if (payload.audio || payload.backgroundAudio) {
      const record = rect('.sound-sticker .record'), x = record.x + record.w / 2, y = record.y + record.h / 2, radius = record.w / 2;
      const gradient = ctx.createRadialGradient(x - radius / 3, y - radius / 3, 0, x, y, radius); gradient.addColorStop(0, '#55534d'); gradient.addColorStop(1, '#171716');
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#ffffff22'; ctx.lineWidth = 1;
      for (let r = radius * .4; r < radius * .92; r += 4) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#c39a60'; ctx.beginPath(); ctx.arc(x, y, radius * .31, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff5dd'; ctx.beginPath(); ctx.arc(x, y, radius * .05, 0, Math.PI * 2); ctx.fill();
      const duration = rect('.sound-duration'); ctx.fillStyle = '#80694e'; ctx.font = '18px Georgia'; ctx.textAlign = 'center'; ctx.fillText(duration.element.textContent, duration.x + duration.w / 2, duration.y + duration.h * .8);
    }
    return await new Promise((resolve, reject) => {
      try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片生成失败，请重试。')), 'image/png'); }
      catch { reject(new Error('外部图片不允许导出，请使用本地照片或重新生成的图片。')); }
    });
  } finally { view.dispose(); host.remove(); }
}
export async function exportPoster(cardBlob) {
  const url = URL.createObjectURL(cardBlob);
  try {
    const image = await loadImage(url), canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 2000;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f6f1e6'; ctx.fillRect(0, 0, 1600, 2000);
    ctx.drawImage(await loadImage('v2-assets/paper.svg'), 0, 0, 1600, 2000);
    ctx.textAlign = 'center'; ctx.fillStyle = '#6f573d'; ctx.font = '76px "LXGW WenKai GB Screen R", KaiTi, serif'; ctx.fillText('一张，给世界的温柔', 800, 310);
    ctx.font = '30px "LXGW WenKai GB Screen R", KaiTi, serif'; ctx.fillStyle = '#a08a6b'; ctx.fillText('把生活，做成明信片。', 800, 390);
    ctx.save(); ctx.shadowColor = '#82633b33'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 16; ctx.drawImage(image, 100, 590, 1400, 900); ctx.restore();
    ctx.font = '33px "LXGW WenKai GB Screen R", KaiTi, serif'; ctx.fillText('每一张明信片，都是一次温柔的连接。', 800, 1700);
    ctx.font = '38px PostcardScript, cursive'; ctx.fillText('Postcards for a gentler world.', 800, 1790);
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
