export function setupInk({ getInk, commit, notice }) {
  const $ = id => document.getElementById(id);
  const canvas = $('inkCanvas');
  const ctx = canvas.getContext('2d');
  let strokes = [], current = null;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = ctx.fillStyle = '#4a3c2b';
    ctx.lineWidth = 4; ctx.lineCap = ctx.lineJoin = 'round';
    for (const stroke of strokes) {
      ctx.beginPath();
      if (stroke.length === 1) { ctx.arc(stroke[0][0], stroke[0][1], 2, 0, Math.PI * 2); ctx.fill(); }
      else { stroke.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
    }
    $('undoInk').disabled = !strokes.length;
  }
  function open() {
    strokes = structuredClone(getInk()?.strokes || []);
    current = null; draw(); $('inkDialog').showModal();
  }
  for (const id of ['openInk', 'editInk', 'inkPreview']) $(id).onclick = open;
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    return [(event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height];
  };
  canvas.onpointerdown = event => {
    if (current || event.button !== 0) return;
    event.preventDefault(); canvas.setPointerCapture(event.pointerId);
    current = { id: event.pointerId, points: [point(event)] };
    strokes.push(current.points); draw();
  };
  canvas.onpointermove = event => {
    if (current?.id !== event.pointerId) return;
    current.points.push(point(event)); draw();
  };
  canvas.onpointerup = canvas.onpointercancel = () => { current = null; };
  $('undoInk').onclick = () => { strokes.pop(); draw(); };
  $('clearInk').onclick = () => { strokes = []; draw(); };
  $('cancelInk').onclick = () => $('inkDialog').close();
  $('finishInk').onclick = () => {
    commit(strokes.length ? { ...getInk(), strokes, image: canvas.toDataURL('image/png'), x: getInk()?.x ?? .57, y: getInk()?.y ?? .69, w: .28, h: .22 } : null);
    $('inkDialog').close();
    if (strokes.length) notice('笔迹已放到卡面，可拖动调整位置。');
  };
  $('removeInk').onclick = () => commit(null);
  const sticker = $('handwritingNote');
  let drag = null;
  sticker.onpointerdown = event => {
    if (!getInk() || event.button !== 0) return;
    const rect = $('postcard').getBoundingClientRect();
    drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: getInk().x, y: getInk().y, rect };
    sticker.setPointerCapture(event.pointerId); event.preventDefault();
  };
  function move(x, y, save) {
    const ink = getInk();
    ink.x = Math.max(.01, Math.min(1 - ink.w - .01, x));
    ink.y = Math.max(.01, Math.min(1 - ink.h - .01, y));
    sticker.style.left = ink.x * 100 + '%'; sticker.style.top = ink.y * 100 + '%';
    if (save) commit(ink);
  }
  sticker.onpointermove = event => {
    if (drag?.id !== event.pointerId) return;
    move(drag.x + (event.clientX - drag.startX) / drag.rect.width, drag.y + (event.clientY - drag.startY) / drag.rect.height, false);
  };
  sticker.onpointerup = sticker.onpointercancel = () => { if (drag) commit(getInk()); drag = null; };
  sticker.onkeydown = event => {
    const offset = { ArrowLeft: [-.01, 0], ArrowRight: [.01, 0], ArrowUp: [0, -.01], ArrowDown: [0, .01] }[event.key];
    if (!offset || !getInk()) return;
    event.preventDefault(); move(getInk().x + offset[0], getInk().y + offset[1], true);
  };
}
