import { draftPayload, createCardRenderer } from './v2-card.js';
import { exportPostcard, exportPoster, downloadBlob } from './v2-export.js';
import { readDataURL } from './v2-draft.js';

export function setupDelivery({ library, getDraft, isBusy, stopAudio, notice }) {
  const $ = id => document.getElementById(id);
  const template = $('postcard').cloneNode(true);
  const renderCard = createCardRenderer(template, notice);
  let snapshot, cardBlob, cardData, previewURL, version = 0, status = { emailReady: false, linksPublic: false };
  let linkAttempt, emailAttempt, receipt, receiptView, submitting = false;
  const randomId = () => crypto.randomUUID();
  function filename(kind) { return `postcard-${kind}-${new Date().toISOString().slice(0, 10)}.png`; }
  function choicesDisabled(disabled) { $('deliveryChoices').querySelectorAll('button').forEach(button => { button.disabled = disabled; }); }
  async function open(payload) {
    if (isBusy()) { notice('请等待录音或照片处理完成。'); return; }
    if (!payload?.image) { notice('先导入一张照片，再保存或寄送。'); return; }
    stopAudio(); snapshot = structuredClone(payload); const current = ++version;
    cardBlob = cardData = linkAttempt = emailAttempt = null;
    if (previewURL) URL.revokeObjectURL(previewURL);
    $('deliveryPreview').hidden = true; $('deliveryChoices').hidden = false; $('emailDeliveryForm').hidden = $('deliveryLinkBox').hidden = true;
    $('deliveryStatus').textContent = '正在准备高清卡片…'; choicesDisabled(true); $('deliveryDialog').showModal();
    const readiness = library.request('/api/delivery/status').catch(() => ({ emailReady: false, linksPublic: false }));
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
  function openMail() {
    library.requireUser(() => {
      $('deliveryChoices').hidden = true; $('emailDeliveryForm').hidden = false;
      $('senderSignature').value = library.getUser()?.signature || library.getUser()?.nickname || library.getUser()?.username || '';
      $('recipientEmail').value = ''; $('recipientName').value = ''; $('emailMessage').value = ''; $('keepMailRecord').checked = true;
      $('mailDeliveryError').textContent = ''; emailAttempt = null;
      $('mailAvailability').textContent = status.emailReady ? '对方会收到卡片预览和打开按钮；链接内保留原图与声音。' : '邮件寄送尚未开通，需要配置发信服务和外网网站地址。你仍可保存卡片图片。';
      $('sendPostcardEmail').disabled = !status.emailReady; $('sendPostcardEmail').textContent = '发送这张明信片';
    });
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
  $('openEmailForm').onclick = openMail;
  $('backToShareChoices').onclick = () => { $('emailDeliveryForm').hidden = true; $('deliveryChoices').hidden = false; };
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
  $('emailDeliveryForm').onsubmit = event => {
    event.preventDefault(); if (!status.emailReady || submitting) return;
    library.requireUser(async () => {
      const body = { ...snapshot, preview: cardData, toEmail: $('recipientEmail').value.trim(), toName: $('recipientName').value.trim(), fromName: $('senderSignature').value.trim(), message: $('emailMessage').value, keepRecord: $('keepMailRecord').checked };
      const signature = JSON.stringify(body);
      if (emailAttempt?.signature !== signature) emailAttempt = { signature, body: { ...body, requestId: randomId() } };
      submitting = true; $('mailDeliveryError').textContent = '';
      $('emailDeliveryForm').querySelectorAll('input,textarea,button').forEach(element => { element.disabled = true; });
      $('deliveryDialog').querySelector('[data-close]').disabled = true;
      try {
        const result = await library.request('/api/delivery/email', emailAttempt.body);
        showLink(result); $('emailDeliveryForm').hidden = true; $('deliveryChoices').hidden = false;
        $('deliveryStatus').textContent = '已提交至邮件服务，投递是否成功以邮件服务的结果为准。';
      } catch (error) { $('mailDeliveryError').textContent = error.message; $('sendPostcardEmail').textContent = '重试这次寄送'; }
      finally { submitting = false; $('emailDeliveryForm').querySelectorAll('input,textarea,button').forEach(element => { element.disabled = false; }); $('deliveryDialog').querySelector('[data-close]').disabled = false; }
    });
  };
  $('deliveryDialog').addEventListener('cancel', event => { if (submitting) event.preventDefault(); });
  $('deliveryDialog').addEventListener('close', () => { version++; if (previewURL) URL.revokeObjectURL(previewURL); previewURL = null; });
  $('retryDelivery').onclick = async () => {
    const item = library.getDetail(); if (!item?.code) return; $('retryDelivery').disabled = true;
    try { await library.request('/api/delivery/cards/' + encodeURIComponent(item.code) + '/retry', {}); notice('已提交至邮件服务。'); library.navigate('gallery'); }
    catch (error) { notice(error.message); } finally { $('retryDelivery').disabled = false; }
  };
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
