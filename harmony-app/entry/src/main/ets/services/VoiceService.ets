import { abilityAccessCtrl, common } from '@kit.AbilityKit';
import { media } from '@kit.MediaKit';
import { fileIo } from '@kit.CoreFileKit';
import { util } from '@kit.ArkTS';
import { AudioClip } from '../model/Postcard';
import { MediaService } from './MediaService';

export class VoiceService {
  static current?: VoiceService;
  private recorder?: media.AVRecorder;
  private recordingFile?: fileIo.File;
  private started: number = 0;
  private players: media.AVPlayer[] = [];
  private files: fileIo.File[] = [];
  private epoch: number = 0;
  onSuspend: () => void = () => {};

  private context: common.UIAbilityContext;
  constructor(context: common.UIAbilityContext) { this.context = context; VoiceService.current = this; }

  async start(): Promise<void> {
    await this.stopPlayback();
    const result = await abilityAccessCtrl.createAtManager().requestPermissionsFromUser(this.context, ['ohos.permission.MICROPHONE']);
    if (result.authResults[0] !== 0) { throw new Error('麦克风未获授权，请在系统设置中允许“一张”使用麦克风'); }
    try {
      this.recordingFile = await fileIo.open(this.context.cacheDir + '/voice.m4a',
        fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC);
      this.recorder = await media.createAVRecorder();
      await this.recorder.prepare({ audioSourceType: media.AudioSourceType.AUDIO_SOURCE_TYPE_MIC,
        profile: { audioBitrate: 96000, audioChannels: 1, audioCodec: media.CodecMimeType.AUDIO_AAC,
          audioSampleRate: 44100, fileFormat: media.ContainerFormatType.CFT_MPEG_4A },
        url: 'fd://' + this.recordingFile.fd });
      await this.recorder.start();
      this.started = Date.now();
    } catch (error) { await this.releaseRecorder(); throw new Error((error as Error).message || '无法开启录音'); }
  }

  async finish(): Promise<AudioClip> {
    if (!this.recorder) { throw new Error('当前没有录音'); }
    try { await this.recorder.stop(); }
    finally { await this.releaseRecorder(); }
    return MediaService.readAudio(this.context.cacheDir + '/voice.m4a', 'audio/mp4', '我的声音', (Date.now() - this.started) / 1000);
  }

  private async releaseRecorder(): Promise<void> {
    const recorder = this.recorder;
    this.recorder = undefined;
    try { if (recorder) { await recorder.release(); } }
    finally {
      if (this.recordingFile) { await fileIo.close(this.recordingFile); this.recordingFile = undefined; }
    }
  }

  async play(voice: AudioClip | undefined, music: AudioClip | undefined, absolute: (url: string) => string, ended: () => void): Promise<void> {
    await this.stopPlayback();
    const epoch = this.epoch;
    const clips: AudioClip[] = [];
    if (voice) { clips.push(voice); }
    if (music) { clips.push(music); }
    for (let index = 0; index < clips.length; index++) {
      const clip = clips[index];
      const player = await media.createAVPlayer();
      if (epoch !== this.epoch) { await player.release(); return; }
      this.players.push(player);
      const background = !!voice && index === 1;
      player.on('stateChange', (state: string) => {
        if (epoch !== this.epoch) { return; }
        if (state === 'initialized') { player.prepare().catch(() => { this.stopPlayback(); ended(); }); }
        if (state === 'prepared') {
          player.loop = background;
          player.setVolume(background ? 0.22 : 1);
          player.play().catch(() => { this.stopPlayback(); ended(); });
        }
        if (state === 'completed' && !background) { this.stopPlayback(); ended(); }
      });
      player.on('error', () => { this.stopPlayback(); ended(); });
      if (clip.url.startsWith('data:')) {
        const bytes = new util.Base64Helper().decodeSync(clip.url.substring(clip.url.indexOf(',') + 1));
        const path = this.context.cacheDir + '/play-' + index + '.audio';
        const file = fileIo.openSync(path, fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC);
        fileIo.writeSync(file.fd, bytes.buffer as ArrayBuffer);
        this.files.push(file);
        player.fdSrc = { fd: file.fd, offset: 0, length: bytes.byteLength };
      } else { player.url = absolute(clip.url); }
    }
  }

  async stopPlayback(): Promise<void> {
    this.epoch++;
    const players: media.AVPlayer[] = this.players;
    const files: fileIo.File[] = this.files;
    this.players = []; this.files = [];
    for (const player of players) {
      await new Promise<void>((resolve) => { player.release(() => resolve()); });
    }
    for (const file of files) { try { await fileIo.close(file); } catch (_) {} }
  }

  suspend(): void {
    this.stopPlayback();
    this.onSuspend();
  }
}
