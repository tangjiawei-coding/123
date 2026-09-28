import { draftPayload, createCardRenderer } from './v2-card.js';
import { exportPostcard, exportPoster, downloadBlob } from './v2-export.js';
import { readDataURL } from './v2-draft.js';

export function setupDelivery({ library, getDraft, isBusy, stopAudio, notice }) {
  const $ = id => document.getElementById(id);
  const template = $('postcard').cloneNode(true);
  const renderCard = createCardRenderer(template, notice);
  let snapshot, cardBlob, cardData, previewURL, version = 0, status = { linksPublic: false };
  let linkAttempt, receipt, receiptView;
  const randomId = () => crypto.randomUUID();
  function filename(kind) { return `postcard-${kind}-${new Date().toISOString().slice(0, 10)}.png`; }
  function choicesDisabled(disabled) { $('deliveryChoices').querySelectorAll('button').forEach(button => { button.disabled = disabled; }); }
  async function open(payload) {
    if (isBusy()) { notice('请等待录音或照片处理完成。'); return; }
    if (!payload?.image) { notice('先导入一张照片，再保存或分享。'); return; }
    stopAudio(); snapshot = structuredClone(payload); const current = ++version;
    cardBlob = cardData = linkAttempt = null;
    if (previewURL) URL.revokeObjectURL(previewURL);
    $('deliveryPreview').hidden = true; $('deliveryChoices').hidden = false; $('deliveryLinkBox').hidden = true;
    $('deliveryStatus').textContent = '正在准备高清卡片…'; choicesDisabled(true); $('deliveryDialog').showModal();
    const readiness = library.request('/api/delivery/status').catch(() => ({ linksPublic: false }));
    try {
      const blob = await exportPostcard(snapshot, template);
      if (current !== version || !$('deliveryDialog').open) return;
      cardBlob = blob; cardData = await readDataURL(blob); status = await readiness;
      if (current !== version || !$('deliveryDialog').open) return;
      previewURL = URL.createObjectURL(blob); $('deliveryPreview').src = previewURL; $('deliveryPreview').hidden = false;
      $('deliveryStatus').textContent = '卡片已准备好 · 1400 × 900 PNG';
      $('createDeliveryLink').textContent = status.linksPublic ? '生成分享链接' : '生成本机预览链接'; choicesDisabled(false);
    } catch (error) { if (current === version) $('deliveryStatus').textContent = error.message; }
  }
  function showLink(result) {
    $('deliveryLink').value = new URL(result.url, location.origin).href;
    $('deliveryLinkBox').hidden = false;
    $('deliveryLinkHint').textContent = result.public ? '持有此链接的人可以查看原图、文字和播放声音，请只分享给你希望收到的人。' : '这是本机预览链接，其他人的设备无法通过它打开。分享给朋友前需要配置外网网站地址。';
  }
  async function shareFile(target) {
    if (!cardBlob) return;
    const file = new File([cardBlob], filename('card'), { type: 'image/png' });
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) { notice(`请先保存卡片图片，再打开${target}选择图片发送。`); return; }
    try { await navigator.share({ files: [file], title: snapshot.title || '一张明信片', text: '把生活，做成明信片。' }); }
    catch (error) { if (error.name !== 'AbortError') notice('当前浏览器未能分享，请保存图片后转发。'); }
  }
  $('finishPostcard').onclick = () => open({ ...draftPayload(getDraft()), title: getDraft().title || '' });
  $('shareDetail').onclick = () => open(library.getDetail());
  $('downloadPostcard').onclick = () => { if (cardBlob) downloadBlob(cardBlob, filename('card')); };
  $('downloadPoster').onclick = async () => {
    $('downloadPoster').disabled = true;
    try { const blob = await exportPoster(cardBlob); if (!blob) throw new Error('海报生成失败。'); downloadBlob(blob, filename('poster')); }
    catch (error) { notice(error.message); } finally { $('downloadPoster').disabled = false; }
  };
  $('shareWeChat').onclick = () => shareFile('微信'); $('shareQQ').onclick = () => shareFile('QQ');
  $('createDeliveryLink').onclick = () => library.requireUser(async () => {
    $('createDeliveryLink').disabled = true;
    try {
      linkAttempt ||= { ...snapshot, preview: cardData, fromName: library.getUser()?.signature || library.getUser()?.nickname, keepRecord: true, requestId: randomId() };
      showLink(await library.request('/api/delivery/link', linkAttempt));
    } catch (error) { notice(error.message); }
    finally { $('createDeliveryLink').disabled = false; }
  });
  $('copyDeliveryLink').onclick = async () => {
    try { await navigator.clipboard.writeText($('deliveryLink').value); notice(status.linksPublic ? '链接已复制。' : '本机预览链接已复制，仅限当前电脑访问。'); }
    catch { $('deliveryLink').focus(); $('deliveryLink').select(); notice('请手动复制已选中的链接。'); }
  };
  $('deliveryDialog').addEventListener('close', () => { version++; if (previewURL) URL.revokeObjectURL(previewURL); previewURL = null; });
  $('openReceivedCard').onclick = async () => {
    if (!receipt) return; $('openReceivedCard').disabled = true;
    try {
      await library.request('/api/delivery/cards/' + encodeURIComponent(receipt.code) + '/open', {});
      receiptView?.dispose(); receiptView = renderCard(receipt); $('receivedCard').replaceChildren(receiptView.element);
      $('receiptMessage').textContent = receipt.message || ''; $('receiptEnvelope').hidden = true; $('receiptContents').hidden = false; $('receiptStatus').textContent = '';
    } catch (error) { $('receiptStatus').textContent = error.message; }
    finally { $('openReceivedCard').disabled = false; }
  };
  $('keepReceivedCard').onclick = () => library.requireUser(async () => {
    $('keepReceivedCard').disabled = true;
    try { await library.request('/api/delivery/cards/' + encodeURIComponent(receipt.code) + '/collect', {}); $('keepReceivedCard').textContent = '已收进私有展览馆'; }
    catch (error) { notice(error.message); $('keepReceivedCard').disabled = false; }
  });
  $('downloadReceivedCard').onclick = async () => {
    $('downloadReceivedCard').disabled = true;
    try { downloadBlob(await exportPostcard(receipt, template), filename('received')); }
    catch (error) { notice(error.message); } finally { $('downloadReceivedCard').disabled = false; }
  };
  window.addEventListener('postcard:navigate', event => { if (event.detail !== 'receipt') receiptView?.dispose(); });
  const code = new URLSearchParams(location.search).get('card');
  if (code) {
    library.navigate('receipt');
    library.request('/api/delivery/cards/' + encodeURIComponent(code)).then(result => {
      receipt = result.card; $('receiptStatus').textContent = ''; $('receiptEnvelope').hidden = false;
      $('receiptFrom').textContent = (receipt.fromName || '一位朋友') + ' 寄来一张明信片'; $('receiptTo').textContent = '写给 ' + (receipt.toName || '你');
    }).catch(error => { $('receiptStatus').textContent = error.message; });
  }
}
