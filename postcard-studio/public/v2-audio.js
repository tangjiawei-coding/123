import { readDataURL } from './v2-draft.js';

export function setupAudio({ getDraft, commit, setBusy, notice }) {
  const $ = id => document.getElementById(id);
  const voice = new Audio(), music = new Audio();
  let recorder, stream, timer, chunks = [], started = 0, recordingError = false, busy = false;
  const duration = seconds => `${Math.floor(Math.round(seconds) / 60)}:${String(Math.round(seconds) % 60).padStart(2, '0')}`;
  function stopPlayback() {
    voice.pause(); music.pause(); voice.currentTime = music.currentTime = 0;
    $('soundSticker').setAttribute('aria-pressed', 'false');
    $('playMusic').textContent = '试听背景声';
  }
  function lock(value) {
    busy = value; setBusy(value);
    for (const id of ['uploadVoice', 'chooseMusic', 'deleteVoice', 'deleteMusic']) $(id).disabled = value;
  }
  function render() {
    const draft = getDraft();
    const sound = draft.voice || draft.music;
    $('soundSticker').hidden = !sound;
    $('soundSticker').setAttribute('aria-label', draft.voice ? '播放原声留言' : '播放背景声音');
    $('soundSticker').querySelector('.sound-duration').textContent = sound ? '▶ ' + duration(sound.duration) : '';
    $('deleteVoice').hidden = !draft.voice;
    $('playMusic').hidden = $('deleteMusic').hidden = !draft.music;
    $('musicLabel').textContent = draft.music ? '背景声音：' + draft.music.name : '背景声音：关闭';
    if (!busy) $('recordStatus').textContent = draft.voice ? '原声 ' + duration(draft.voice.duration) + ' · ' + draft.voice.name : '最长 3 分钟，也可以上传音频。';
  }
  async function play(backgroundOnly = false) {
    if (!voice.paused || !music.paused) { stopPlayback(); return; }
    const draft = getDraft();
    try {
      if (draft.voice && !backgroundOnly) { voice.src = draft.voice.url; await voice.play(); }
      if (draft.music) { music.src = draft.music.url; music.volume = draft.voice && !backgroundOnly ? .22 : 1; music.loop = !!draft.voice && !backgroundOnly; await music.play(); }
      if (!backgroundOnly) $('soundSticker').setAttribute('aria-pressed', 'true');
      else $('playMusic').textContent = '停止试听';
    } catch { stopPlayback(); notice('音频无法播放，请换一个文件。'); }
  }
  voice.onended = stopPlayback;
  music.onended = () => { if (voice.paused) stopPlayback(); };
  voice.onerror = music.onerror = () => { stopPlayback(); notice('音频读取失败，请重新上传。'); };
  $('soundSticker').onclick = () => play();
  $('playMusic').onclick = () => play(true);
  $('recordVoice').onclick = async () => {
    if (recorder?.state === 'recording') { recorder.stop(); return; }
    if (busy) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { notice('当前浏览器无法录音，请上传音频或使用 HTTPS / 本机地址。'); return; }
    stopPlayback(); lock(true); $('recordVoice').disabled = true;
    $('recordStatus').textContent = '等待麦克风权限…';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream); chunks = []; recordingError = false;
      let bytes = 0;
      recorder.ondataavailable = event => {
        if (event.data.size) { chunks.push(event.data); bytes += event.data.size; }
        if (bytes > 8 * 1024 * 1024 && recorder.state === 'recording') recorder.stop();
      };
      recorder.onerror = () => { recordingError = true; if (recorder.state !== 'inactive') recorder.stop(); };
      recorder.onstop = async () => {
        clearInterval(timer); stream.getTracks().forEach(track => track.stop());
        $('recordVoice').disabled = true; $('recordStatus').textContent = '正在保存录音…';
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType });
          if (recordingError || !blob.size || blob.size > 10 * 1024 * 1024) throw new Error('录音未能保存，请重新录制。');
          const seconds = Math.max(1, (Date.now() - started) / 1000);
          const url = await readDataURL(blob);
          commit('voice', { url, type: blob.type, name: '我的原声', duration: seconds });
          notice('录音已成为卡面上的唱片，点击即可播放。');
        } catch (error) { notice(error.message); }
        finally { chunks = []; lock(false); $('recordVoice').disabled = false; $('recordVoice').textContent = '录一段话'; render(); }
      };
      recorder.start(1000); started = Date.now();
      $('recordVoice').disabled = false; $('recordVoice').textContent = '停止录音';
      timer = setInterval(() => {
        const seconds = (Date.now() - started) / 1000;
        $('recordStatus').textContent = '录音中 ' + duration(seconds) + ' / 3:00';
        if (seconds >= 180 && recorder.state === 'recording') recorder.stop();
      }, 250);
    } catch {
      stream?.getTracks().forEach(track => track.stop());
      lock(false); $('recordVoice').disabled = false; render(); notice('无法使用麦克风。请允许录音权限，或上传音频。');
    }
  };
  async function importAudio(file, kind) {
    if (!file || busy) return;
    if (file.size > 10 * 1024 * 1024) { notice('请选择 10 MB 以内的音频。'); return; }
    stopPlayback(); lock(true); $('recordVoice').disabled = true;
    const url = URL.createObjectURL(file), probe = new Audio();
    try {
      const seconds = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => finish(new Error('音频读取超时。')), 10000);
        function finish(error) { clearTimeout(timeout); probe.onloadedmetadata = probe.onerror = null; error ? reject(error) : resolve(probe.duration); }
        probe.onloadedmetadata = () => finish(Number.isFinite(probe.duration) && probe.duration > 0 ? null : new Error('无法读取音频时长，请更换文件。'));
        probe.onerror = () => finish(new Error('不支持这段音频，请使用 MP3、M4A、WAV 或 WebM。'));
        probe.src = url;
      });
      if (kind === 'voice' && seconds > 180) throw new Error('原声留言请控制在 3 分钟以内。');
      commit(kind, { url: await readDataURL(file), name: file.name, type: file.type, duration: seconds });
    } catch (error) { notice(error.message); }
    finally { probe.removeAttribute('src'); probe.load(); URL.revokeObjectURL(url); lock(false); $('recordVoice').disabled = false; render(); }
  }
  $('uploadVoice').onclick = () => $('voiceFile').click();
  $('chooseMusic').onclick = () => $('musicFile').click();
  for (const [kind, input] of [['voice', 'voiceFile'], ['music', 'musicFile']]) {
    $(input).onchange = event => { const file = event.target.files[0]; event.target.value = ''; importAudio(file, kind); };
    $(kind === 'voice' ? 'deleteVoice' : 'deleteMusic').onclick = () => { stopPlayback(); commit(kind, null); render(); };
  }
  window.addEventListener('pagehide', () => { clearInterval(timer); if (recorder?.state === 'recording') recorder.stop(); stream?.getTracks().forEach(track => track.stop()); stopPlayback(); });
  return { render, stopPlayback };
}
