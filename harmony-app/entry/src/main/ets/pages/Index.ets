import { common } from '@kit.AbilityKit';
import { util } from '@kit.ArkTS';
import { Api } from '../services/Api';
import { LocalStore } from '../services/LocalStore';
import { MediaService } from '../services/MediaService';
import { VoiceService } from '../services/VoiceService';
import { CardView } from '../components/CardView';
import { Postcard, Choice, GenerateRequest, GenerateResult, AuthRequest, AuthResult, LocalSession,
  WorkResult, WorksResult, PostsResult, PostResult, CommentsResult, Comment, CommentRequest,
  Profile, ProfileResult, AvatarRequest, LinkResult, LinkRequest, TONES, LAYOUTS, DraftEntry, Preferences } from '../model/Postcard';

@Entry
@Component
struct Index {
  @State tab: number = 0;
  @State editorOpen: boolean = false;
  @State coverOpening: boolean = false;
  @State tool: number = 0;
  @State card: Postcard = new Postcard();
  @State original: boolean = false;
  @State busy: boolean = false;
  @State status: string = '';
  @State styles: Choice[] = [];
  @State gallery: Postcard[] = [];
  @State scope: number = 0;
  @State page: number = 1;
  @State hasMore: boolean = false;
  @State detail: Postcard | undefined = undefined;
  @State detailPublic: boolean = false;
  @State detailOriginal: boolean = false;
  @State comments: Comment[] = [];
  @State commentText: string = '';
  @State username: string = '';
  @State loginName: string = '';
  @State password: string = '';
  @State register: boolean = false;
  @State nickname: string = '';
  @State bio: string = '';
  @State avatar: string = '';
  @State serverUrl: string = 'http://120.55.251.74:5123';
  @State connected: boolean = false;
  @State recording: boolean = false;
  @State recordSeconds: number = 0;
  @State playing: boolean = false;
  @State inkVisible: boolean = false;
  @State panelVisible: boolean = false;
  @State panelMode: string = '';
  @State drafts: DraftEntry[] = [];
  @State preferences: Preferences = new Preferences();
  @State renameId: string = '';
  @State renameTitle: string = '';
  @State toName: string = '';
  @State fromName: string = '';
  @State inkColor: string = '#594735';
  @State inkLineWidth: number = 2.5;
  private inkSourceWidth: number = 0;
  private api: Api = new Api();
  private store?: LocalStore;
  private voice?: VoiceService;
  private timer: number = -1;
  private saveTimer: number = -1;
  private coverTimer: number = -1;
  private galleryVersion: number = 0;
  private inkContext: CanvasRenderingContext2D = new CanvasRenderingContext2D(new RenderingContextSettings(true));
  private inkStrokes: number[][][] = [];
  private inkWidth: number = 1;
  private inkHeight: number = 160;
  private linkRequestId: string = '';
  private linkPayload?: LinkRequest;
  private shareUrl: string = '';
  private exportSource: Postcard = new Postcard();
  private exportOriginal: boolean = false;

  private context(): common.UIAbilityContext { return this.getUIContext().getHostContext() as common.UIAbilityContext; }
  private tip(message: string): void { this.status = message; }
  private clone(value: Postcard): Postcard { return JSON.parse(JSON.stringify(value)) as Postcard; }

  aboutToAppear(): void {
    this.getUIContext().getFont().registerFont({ familyName: 'PostcardHand', familySrc: $rawfile('WenKai.ttf') });
    this.store = new LocalStore(this.context());
    this.voice = new VoiceService(this.context());
    this.voice.onSuspend = () => {
      this.playing = false;
      if (this.recording) { this.run('正在收好录音…', async () => { await this.finishRecording(); }); }
    };
    try {
      const session = this.store.read<LocalSession>('session');
      if (session) {
        this.username = session.username; this.api.token = session.token;
        this.serverUrl = session.baseUrl; this.api.baseUrl = session.baseUrl;
      }
      this.preferences = this.store.read<Preferences>('preferences') || new Preferences();
      this.card = this.store.loadDraft() || this.freshCard();
    } catch (_) { this.tip('本机草稿未能恢复，可以重新导入照片。'); }
    this.connect();
  }

  aboutToDisappear(): void {
    clearTimeout(this.saveTimer); clearTimeout(this.coverTimer); clearInterval(this.timer);
    this.voice?.suspend();
    try { this.store?.saveDraft(this.card); } catch (_) {}
  }

  onBackPress(): boolean {
    if (this.panelVisible) { this.panelVisible = false; return true; }
    if (this.inkVisible) { this.inkVisible = false; return true; }
    if (this.detail) { this.detail = undefined; this.stopAudio(); return true; }
    if (this.tab !== 0 || this.editorOpen) { this.returnToCover(); return true; }
    return false;
  }

  private async run(message: string, action: () => Promise<void>): Promise<void> {
    if (this.busy) { return; }
    this.busy = true; this.status = message;
    try { await action(); if (this.status === message) { this.status = ''; } }
    catch (error) { this.tip((error as Error).message || '暂时未能完成，请重试'); }
    finally { this.busy = false; }
  }

  private changed(): void {
    this.card = this.clone(this.card); this.linkRequestId = '';
    this.linkPayload = undefined; this.shareUrl = '';
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try { this.store?.saveDraft(this.card); }
      catch (_) { this.tip('草稿未能保存，请检查手机存储空间'); }
    }, 350);
  }

  private async connect(): Promise<void> {
    try { this.styles = await this.api.request<Choice[]>('/api/skills'); this.connected = true; }
    catch (_) { this.connected = false; this.tip('暂时连不上服务器，本机编辑和草稿仍可使用。可到“我的”重新连接。'); }
  }

  private navigate(tab: number): void {
    if (this.recording || this.busy) { this.tip('请先完成当前操作'); return; }
    clearTimeout(this.coverTimer); this.coverOpening = false;
    if (tab === 0) { this.editorOpen = true; }
    this.stopAudio(); this.tab = tab; this.detail = undefined; this.status = '';
    if (tab === 1) { this.loadGallery(); }
    if (tab === 2 && this.username) { this.loadProfile(); }
  }

  private returnToCover(): void {
    if (this.recording || this.busy) { this.tip('请先完成当前操作'); return; }
    clearTimeout(this.coverTimer); this.coverOpening = false;
    this.stopAudio(); this.tab = 0; this.detail = undefined; this.editorOpen = false; this.status = '';
    try { this.store?.saveDraft(this.card); } catch (_) { this.tip('草稿暂时未能保存'); }
  }

  private openCreator(): void {
    if (this.coverOpening) { return; }
    this.coverOpening = true;
    this.coverTimer = setTimeout(() => { this.navigate(0); }, 420);
  }

  private async pickPhoto(camera: boolean): Promise<void> {
    await this.run('正在导入照片…', async () => {
      const data = await MediaService.choosePhoto(this.context(), camera);
      if (!data) { return; }
      this.card.originalImage = data; this.card.image = ''; this.card.sentence = ''; this.card.editor.stylized = false;
      this.original = false; this.changed(); this.tip('照片已导入，选择画风后生成。');
    });
  }

  private async generate(textOnly: boolean = false): Promise<void> {
    if (!this.card.originalImage) { this.tip('先导入一张照片'); return; }
    await this.run(textOnly ? '正在写一句话…' : '正在把风景画成明信片，可能需要几分钟…', async () => {
      const originalImage = await this.api.imageData(this.card.originalImage);
      // 整张生成只参考当前照片，避免把上一轮文案画进新图片；单独写文案时才参考现有文字。
      const request: GenerateRequest = { image: originalImage, text: textOnly ? this.card.sentence : '',
        skill: this.card.skill, tone: this.card.tone, mode: 'fast', bilingual: this.card.editor.bilingual };
      // 两个独立接口让中英双语开关生效，单项失败时也保留另一项成果。
      let result: GenerateResult;
      if (textOnly) { result = await this.api.request<GenerateResult>('/api/generate-sentence', JSON.stringify(request)); }
      else {
        const outcomes = await Promise.allSettled([
          this.api.request<GenerateResult>('/api/generate-image', JSON.stringify(request)),
          this.api.request<GenerateResult>('/api/generate-sentence', JSON.stringify(request))
        ]);
        result = {};
        const picture = outcomes[0]; const words = outcomes[1];
        if (picture.status === 'fulfilled') { result.image = picture.value.image; }
        else { result.imageError = (picture.reason as Error).message; }
        if (words.status === 'fulfilled') { result.sentence = words.value.sentence; }
        else { result.sentenceError = (words.reason as Error).message; }
        if (!result.image && !result.sentence) { throw new Error(result.imageError || result.sentenceError || '生成未完成，请重试'); }
      }
      if (result.image) { this.card.image = result.image; this.card.editor.stylized = true; this.original = false; }
      if (result.sentence) { this.card.sentence = result.sentence; }
      this.changed();
      this.tip(result.imageError ? '文字已生成，画面生成失败：' + result.imageError : result.sentenceError ?
        '画面已生成，文字生成失败，可点击“帮我写一句”。' : '已完成，点击卡片照片可以查看原图。');
    });
  }

  private async saveWork(): Promise<void> {
    if (!(this.card.image || this.card.originalImage)) { this.tip('先导入照片再保存'); return; }
    await this.run('正在保存作品…', async () => {
      this.store?.saveWork(this.card);
      if (!this.username) { this.tip('已保存在本机作品中，登录后可再保存到云端。'); return; }
      const payload = this.clone(this.card);
      payload.image = payload.image || payload.originalImage;
      const path = payload.id && payload.ownerNick === this.username ? '/api/myworks/' + encodeURIComponent(payload.id) + '/update' : '/api/myworks';
      try {
        const result = await this.api.request<WorkResult>(path, JSON.stringify(payload));
        // 保留本机图片数据，网络不可用时仍能继续编辑。
        this.card.id = result.work.id; this.card.ownerNick = this.username;
        this.store?.saveWork(this.card); this.changed(); this.tip('作品已保存到本机与云端。');
      } catch (error) { throw new Error('本机已保存；云端保存失败：' + (error as Error).message); }
    });
  }

  private async exportCard(share: boolean): Promise<void> {
    const card = this.detail || this.card;
    if (!(card.image || card.originalImage)) { this.tip('先导入照片再保存或分享'); return; }
    await this.run('正在准备卡片图片…', async () => {
      const path = await this.renderImage(card, this.detail ? this.detailOriginal : this.original);
      if (share) { await MediaService.share(this.context(), path); this.tip('已打开系统分享面板'); }
      else { this.tip(await MediaService.saveToAlbum(this.context(), path) ? '明信片已保存到相册' : '已取消保存'); }
    });
  }

  @Builder
  exportPreview() {
    Column() {
      CardView({ card: this.exportSource, original: this.exportOriginal, baseUrl: this.api.baseUrl, showHints: false })
    }.width(560).height(360).backgroundColor('#FFFCF4')
  }

  private async renderImage(card: Postcard, original: boolean): Promise<string> {
    this.exportSource = this.clone(card); this.exportOriginal = original;
    // 离屏渲染完整卡面，避免滚动到按钮时截图被屏幕边缘裁切。
    const pixels = await this.getUIContext().getComponentSnapshot().createFromBuilder(() => {
      this.exportPreview();
    }, 300, true, { scale: 2 });
    return MediaService.cacheImage(this.context(), pixels);
  }

  private async createLink(): Promise<void> {
    if (!this.username) { this.panelMode = 'account'; this.tip('登录后可生成分享链接'); return; }
    if (!(this.card.image || this.card.originalImage)) { this.tip('先导入一张照片'); return; }
    await this.run('正在生成分享链接…', async () => {
      if (!this.shareUrl) {
        if (!this.linkPayload) {
          const request = this.clone(this.card) as LinkRequest;
          request.image = request.image || request.originalImage;
          this.linkRequestId = util.generateRandomUUID();
          request.requestId = this.linkRequestId; request.keepRecord = true;
          request.toName = this.toName.trim(); request.fromName = this.fromName.trim();
          const previewPath = await this.renderImage(this.card, false);
          request.preview = MediaService.imageFileData(previewPath);
          this.linkPayload = request;
        }
        const result = await this.api.request<LinkResult>('/api/delivery/link', JSON.stringify(this.linkPayload));
        this.shareUrl = this.api.absolute(result.url);
      }
      await MediaService.share(this.context(), this.shareUrl, true);
    });
  }

  private async loadGallery(more: boolean = false): Promise<void> {
    const version = ++this.galleryVersion;
    if (!more) { this.page = 1; this.gallery = []; }
    this.status = '正在打开这些心意…'; this.hasMore = false;
    try {
      let items: Postcard[] = [];
      if (this.scope === 2) { items = this.store?.read<Postcard[]>('works') || []; }
      else if (this.scope === 1) {
        if (!this.username) { this.tip('登录后查看云端作品，也可以查看本机作品。'); return; }
        items = (await this.api.request<WorksResult>('/api/myworks?nick=' + encodeURIComponent(this.username))).works;
      } else {
        if (this.scope === 3 && !this.username) { this.tip('登录后查看收藏'); return; }
        const response = await this.api.request<PostsResult>(this.scope === 3 ? '/api/community/favorites' : '/api/community/posts?page=' + this.page + '&pageSize=12&sort=new');
        items = response.posts;
        if (version !== this.galleryVersion) { return; }
        this.hasMore = this.scope === 0 && this.page * 12 < (response.total || 0);
      }
      if (version !== this.galleryVersion) { return; }
      this.gallery = more ? this.gallery.concat(items) : items;
      this.tip(this.gallery.length ? '' : '还没有作品，写下你的第一张吧。');
    } catch (error) { if (version === this.galleryVersion) { this.tip((error as Error).message); } }
  }

  private async openDetail(card: Postcard): Promise<void> {
    this.detail = this.clone(card); this.detailPublic = this.scope === 0 || this.scope === 3;
    this.detailOriginal = false; this.comments = []; this.commentText = ''; this.status = '';
    if (this.detailPublic) {
      await this.run('正在打开明信片…', async () => {
        const result = await this.api.request<PostResult>('/api/community/posts/' + encodeURIComponent(card.id));
        this.detail = result.post;
        this.comments = (await this.api.request<CommentsResult>('/api/community/posts/' + encodeURIComponent(card.id) + '/comments')).comments;
      });
    }
  }

  private async editWork(): Promise<void> {
    if (!this.detail) { return; }
    const work = this.clone(this.detail);
    await this.run('正在取回原照片和画面…', async () => {
      work.originalImage = await this.api.imageData(work.originalImage || work.image);
      if (work.image) { work.image = await this.api.imageData(work.image); }
      if (work.handwriting) { work.handwriting = await this.api.imageData(work.handwriting); }
      if (!work.editor) { work.editor = new Postcard().editor; }
      clearTimeout(this.saveTimer); this.store?.saveDraft(this.card);
      work.draftId = util.generateRandomUUID();
      this.card = work; this.original = false; this.detail = undefined; this.tab = 0; this.editorOpen = true; this.stopAudio(); this.changed();
    });
  }

  private newCard(): void {
    this.getUIContext().showAlertDialog({ title: '开始新的一张？', message: '当前明信片会保留在“我的草稿”里，之后可以继续编辑。',
      primaryButton: { value: '继续这一张', action: () => {} },
      secondaryButton: { value: '新建明信片', action: () => {
        try {
          this.startNewDraft();
        } catch (_) { this.tip('当前作品未能保存，暂未新建。'); }
      } } });
  }

  private clearDraft(): void {
    if (this.busy || this.recording) { this.tip('请先完成当前操作'); return; }
    this.getUIContext().showAlertDialog({ title: '清空当前草稿？', message: '当前卡片会恢复为空白，照片、文字、手写和声音都会移除。',
      primaryButton: { value: '取消', action: () => {} },
      secondaryButton: { value: '清空草稿', action: () => {
        if (this.busy || this.recording) { this.tip('请先完成当前操作'); return; }
        try {
          const blank = this.freshCard(); blank.draftId = this.card.draftId;
          this.store?.saveDraft(blank);
          clearTimeout(this.saveTimer); this.stopAudio();
          this.card = blank; this.original = false; this.tool = 0; this.inkStrokes = [];
          this.changed(); this.tip('当前草稿已清空');
        } catch (_) { this.tip('草稿未能清空，请重试'); }
      } } });
  }

  private async social(action: string): Promise<void> {
    if (!this.detail || !this.username) { this.tip('请先到“我的”登录'); return; }
    const id = this.detail.id;
    await this.run('正在保存…', async () => {
      const payload: CommentRequest = { content: this.commentText.trim() };
      if (action === 'comments' && !payload.content) { this.tip('写下评论再发送'); return; }
      await this.api.request<Object>('/api/community/posts/' + encodeURIComponent(id) + '/' + action, action === 'comments' ? JSON.stringify(payload) : '{}');
      const updated = (await this.api.request<PostResult>('/api/community/posts/' + encodeURIComponent(id))).post;
      this.gallery = this.gallery.map((item: Postcard) => item.id === id ? updated : item);
      if (this.scope === 3 && !updated.collected) { this.gallery = this.gallery.filter((item: Postcard) => item.id !== id); }
      if (this.detail?.id !== id) { return; }
      this.detail = updated;
      if (action === 'comments') {
        this.comments = (await this.api.request<CommentsResult>('/api/community/posts/' + encodeURIComponent(id) + '/comments')).comments;
        this.commentText = '';
      }
      this.tip(action === 'comments' ? '评论已发表' : action === 'like' ? (updated.liked ? '已点赞' : '已取消点赞') : (updated.collected ? '已收藏' : '已取消收藏'));
    });
  }

  private publish(): void {
    if (!this.detail || !this.detail.id || this.detail.ownerNick !== this.username) { this.tip('先登录并将作品保存到云端'); return; }
    const work = this.clone(this.detail);
    this.getUIContext().showAlertDialog({ title: '公开这张明信片？', message: '公开后，其他人可以看到照片、文字和听到声音。',
      primaryButton: { value: '再想想', action: () => {} }, secondaryButton: { value: '公开到展览馆', action: () => {
        this.run('正在公开作品…', async () => {
          await this.api.request<PostResult>('/api/myworks/' + encodeURIComponent(work.id) + '/share', '{}');
          if (this.detail) { this.detail.visibility = 'public'; this.detail = this.clone(this.detail); }
          this.tip('已公开到展览馆');
        });
      } } });
  }

  private async privatize(): Promise<void> {
    if (!this.detail || !this.detail.id || this.detail.ownerNick !== this.username) { return; }
    const work = this.clone(this.detail); work.visibility = 'private';
    await this.run('正在设为私有…', async () => {
      this.detail = (await this.api.request<WorkResult>('/api/myworks/' + encodeURIComponent(work.id) + '/update', JSON.stringify(work))).work;
      this.tip('已设为私有，展览馆中的公开内容已隐藏');
    });
  }

  private async authenticate(): Promise<void> {
    await this.run('正在登录…', async () => {
      const payload: AuthRequest = { username: this.loginName.trim(), password: this.password };
      const result = await this.api.request<AuthResult>('/api/auth/' + (this.register ? 'register' : 'login'), JSON.stringify(payload));
      this.api.token = result.token; this.username = result.username; this.password = '';
      this.persistSession(); await this.loadProfile(); this.tip('已登录，网站与鸿蒙版共用此账号。');
    });
  }

  private persistSession(): void {
    this.store?.saveSession({ username: this.username, token: this.api.token, baseUrl: this.api.baseUrl });
  }

  private async loadProfile(): Promise<void> {
    try { const result = await this.api.request<ProfileResult>('/api/auth/profile'); this.nickname = result.profile.nickname; this.bio = result.profile.bio; this.avatar = result.profile.avatar || ''; }
    catch (error) { this.tip((error as Error).message); }
  }

  private async importAvatar(): Promise<void> {
    if (!this.username) { this.panelMode = 'account'; this.panelVisible = true; return; }
    await this.run('正在导入头像…', async () => {
      const data = await MediaService.choosePhoto(this.context(), false, 512);
      if (!data) { return; }
      const payload: AvatarRequest = { avatar: data };
      const result = await this.api.request<ProfileResult>('/api/auth/profile', JSON.stringify(payload));
      this.avatar = result.profile.avatar || '';
      this.tip('头像已更新');
    });
  }

  private async logout(): Promise<void> {
    await this.run('正在退出…', async () => {
      await this.api.request<Object>('/api/auth/logout', '{}');
      this.username = ''; this.api.token = ''; this.nickname = ''; this.bio = ''; this.avatar = ''; this.gallery = []; this.resetShare();
      this.persistSession();
    });
  }

  private async record(): Promise<void> {
    await this.run(this.recording ? '正在保存声音…' : '正在打开麦克风…', async () => {
      if (this.recording) { await this.finishRecording(); return; }
      await this.voice?.start(); this.recording = true; this.recordSeconds = 0;
      this.timer = setInterval(() => {
        this.recordSeconds++;
        if (this.recordSeconds >= 180) { this.record(); }
      }, 1000);
      this.tip('录音中，点击停止后会附在明信片上。');
    });
  }

  private async finishRecording(): Promise<void> {
    clearInterval(this.timer); this.recording = false;
    this.card.audio = await this.voice?.finish(); this.changed(); this.tip('声音已保存到草稿');
  }

  private stopAudio(): void { this.voice?.stopPlayback(); this.playing = false; }

  private async play(card: Postcard): Promise<void> {
    if (this.playing) { this.stopAudio(); return; }
    await this.run('正在打开声音…', async () => {
      this.playing = true;
      try { await this.voice?.play(card.audio, card.backgroundAudio, (url: string) => this.api.absolute(url), () => { this.playing = false; }); }
      catch (error) { this.playing = false; throw new Error((error as Error).message || '声音暂时无法播放'); }
    });
  }

  private drawInk(): void {
    this.inkContext.clearRect(0, 0, this.inkWidth, this.inkHeight);
    this.inkContext.strokeStyle = this.inkColor; this.inkContext.fillStyle = this.inkColor;
    this.inkContext.lineWidth = this.inkLineWidth;
    this.inkContext.lineCap = 'round'; this.inkContext.lineJoin = 'round';
    this.inkStrokes.forEach((stroke: number[][]) => {
      this.inkContext.beginPath();
      if (stroke.length === 1) {
        this.inkContext.arc(stroke[0][0], stroke[0][1], this.inkLineWidth / 2, 0, Math.PI * 2);
        this.inkContext.fill(); return;
      }
      stroke.forEach((point: number[], index: number) => {
        if (!index) { this.inkContext.moveTo(point[0], point[1]); }
        else { this.inkContext.lineTo(point[0], point[1]); }
      });
      this.inkContext.stroke();
    });
  }

  private freshCard(): Postcard {
    const card = new Postcard();
    card.editor.layout = this.preferences.layout; card.editor.font = this.preferences.font;
    card.editor.bilingual = this.preferences.bilingual; card.tone = this.preferences.tone;
    card.editor.stampColor = this.preferences.stampColor; card.stamp = this.preferences.stamp;
    return card;
  }

  private savePreferences(): void {
    this.preferences = JSON.parse(JSON.stringify(this.preferences)) as Preferences;
    try { this.store?.write('preferences', JSON.stringify(this.preferences)); }
    catch (_) { this.tip('偏好暂未保存，请检查手机存储空间'); }
  }

  private openDrafts(): void {
    try {
      clearTimeout(this.saveTimer); this.store?.saveDraft(this.card);
      this.drafts = this.store?.listDrafts() || []; this.panelMode = 'drafts'; this.panelVisible = true;
    } catch (_) { this.tip('暂时无法打开草稿'); }
  }

  private startNewDraft(): void {
    clearTimeout(this.saveTimer); this.store?.saveDraft(this.card); this.stopAudio();
    this.card = this.freshCard(); this.store?.saveDraft(this.card);
    this.original = false; this.tool = 0; this.panelVisible = false;
    this.navigate(0); this.changed(); this.tip('新的一张，等你写下。');
  }

  private resumeDraft(entry: DraftEntry): void {
    try {
      clearTimeout(this.saveTimer); this.store?.saveDraft(this.card); this.stopAudio();
      this.card = this.clone(entry.card); this.store?.saveDraft(this.card);
      this.original = false; this.tool = 0; this.panelVisible = false; this.navigate(0); this.changed();
    } catch (_) { this.tip('草稿暂时无法打开'); }
  }

  private copyDraft(entry: DraftEntry): void {
    try {
      const copy = this.clone(entry.card); copy.draftId = util.generateRandomUUID();
      copy.id = ''; copy.ownerNick = ''; copy.visibility = 'private'; copy.createdAt = Date.now();
      copy.title = (copy.title || '未命名明信片') + ' · 副本';
      this.store?.saveDraft(copy, false); this.drafts = this.store?.listDrafts() || [];
      this.tip('已复制，可以分别继续创作');
    } catch (_) { this.tip('草稿未能复制'); }
  }

  private renameDraft(): void {
    const entry = this.drafts.find((item: DraftEntry) => item.id === this.renameId);
    if (!entry) { return; }
    try {
      const renamed = this.clone(entry.card); renamed.title = this.renameTitle.trim();
      this.store?.saveDraft(renamed, false);
      if (this.card.draftId === entry.id) { this.card.title = renamed.title; this.changed(); }
      this.drafts = this.store?.listDrafts() || []; this.panelMode = 'drafts'; this.tip('名称已保存');
    } catch (_) { this.tip('名称暂未保存'); }
  }

  private deleteDraft(entry: DraftEntry): void {
    this.getUIContext().showAlertDialog({ title: '删除这张草稿？',
      message: '删除后无法恢复。已保存的作品不受影响。',
      primaryButton: { value: '取消', action: () => {} },
      secondaryButton: { value: '删除', action: () => {
        try {
          clearTimeout(this.saveTimer);
          if (this.card.draftId === entry.id) {
            this.stopAudio(); this.card = this.freshCard(); this.store?.saveDraft(this.card);
            this.original = false; this.changed();
          }
          this.store?.deleteDraft(entry.id); this.drafts = this.store?.listDrafts() || [];
          this.tip('草稿已删除');
        } catch (_) { this.tip('草稿暂未删除'); }
      } } });
  }

  private openInk(): void {
    this.inkStrokes = JSON.parse(JSON.stringify(this.card.editor.ink?.strokes || [])) as number[][][];
    this.inkColor = this.card.editor.ink?.color || '#594735';
    this.inkLineWidth = this.card.editor.ink?.lineWidth || 2.5;
    this.inkSourceWidth = this.card.editor.ink?.canvasWidth || this.inkWidth;
    this.inkVisible = true;
  }

  private resizeInk(value: number): void {
    const ink = this.card.editor.ink;
    if (!ink) { return; }
    const width = value / 100;
    ink.h = Math.min(0.85, ink.h * width / ink.w); ink.w = width;
    ink.x = Math.min(ink.x, 1 - ink.w); ink.y = Math.min(ink.y, 1 - ink.h);
    this.changed();
  }

  private resetShare(): void { this.linkPayload = undefined; this.shareUrl = ''; this.linkRequestId = ''; }

  @Builder
  action(label: string, callback: () => void, primary: boolean = false) {
    Button(label, { type: ButtonType.Normal }).height(34).borderRadius(18)
      .fontSize(12).fontWeight(FontWeight.Normal).fontColor(primary ? '#FFFDF8' : '#735C47')
      .backgroundColor(primary ? '#80664F' : '#EEE8DF').enabled(!this.busy)
      .onClick(callback)
  }

  // 在组件更新时读取状态，避免 Builder 的字符串参数固定在首次绘制。
  @Builder
  dynamicAction(label: () => string, callback: () => void, primary: () => boolean = () => false) {
    Button(label(), { type: ButtonType.Normal }).height(34).borderRadius(18)
      .fontSize(12).fontWeight(FontWeight.Normal).fontColor(primary() ? '#FFFDF8' : '#735C47')
      .backgroundColor(primary() ? '#80664F' : '#EEE8DF').enabled(!this.busy)
      .onClick(callback)
  }

  @Builder
  heading(title: string, subtitle: string) {
    Column({ space: 7 }) {
      Text(title).fontSize(18).fontFamily('serif').fontWeight(FontWeight.Medium).fontColor('#594735')
      Text(subtitle).fontSize(12).fontColor('#9C8B76').letterSpacing(1)
    }.alignItems(HorizontalAlign.Start).width('100%').margin({ bottom: 20 })
  }

  @Builder
  panelHeading(title: string) {
    Text(title).fontSize(12).fontColor('#38332C').width('100%')
  }

  @Builder
  recordDisc() {
    Image($rawfile('record.svg')).width(61).height(61)
  }

  @Builder
  coverPage() {
    Column() {
      Blank()
      Column({ space: 16 }) {
        Text('把生活，做成明信片。').fontSize(12).fontFamily('PostcardHand').fontColor('#A18E76').letterSpacing(2)
        Text('有些瞬间，\n值得寄给一个人。').fontSize(29).fontFamily('PostcardHand').fontColor('#65503B').lineHeight(48).letterSpacing(2)
      }.alignItems(HorizontalAlign.Start).width('100%').margin({ bottom: 44 })
      Stack() {
        Row().width('96%').height('96%').backgroundColor('#EAE0CC').border({ width: 1, color: '#DED1B9' }).rotate({ angle: 4 })
        Stack() {
          Image($rawfile('paper.svg')).width('100%').height('100%').objectFit(ImageFit.Fill).opacity(0.6)
          Row({ space: 12 }) {
            Image($rawfile('coast-study.svg')).width('48%').height('100%').objectFit(ImageFit.Cover)
            Column() {
              Image($rawfile('postage-brown.svg')).width(65).height(48).alignSelf(ItemAlign.End).opacity(0.7)
              Blank()
              Text('给生活，\n留一张纪念。').fontSize(17).fontFamily('PostcardHand').fontColor('#715C43').lineHeight(31)
              Blank()
              Text('WITH LOVE').fontSize(8).fontFamily('serif').fontColor('#AA967B').letterSpacing(2)
            }.layoutWeight(1).height('100%').alignItems(HorizontalAlign.Start).padding({ left: 12 })
              .border({ width: { left: 1 }, color: '#DED2BD' })
          }.width('100%').height('100%').padding(13)
        }.width('100%').height('100%').backgroundColor('#FFF9EA').border({ width: 1, color: '#E4D9C9' }).borderRadius(3)
          .shadow({ radius: 18, color: '#25695333', offsetY: 12 }).rotate({ angle: -5 })
      }.width('100%').aspectRatio(14 / 9)
        .rotate({ x: 0, y: 1, z: 0, angle: this.coverOpening ? -72 : 0, perspective: 900 })
        .scale({ x: this.coverOpening ? 1.06 : 1, y: this.coverOpening ? 1.06 : 1 })
        .opacity(this.coverOpening ? 0 : 1).animation({ duration: 420, curve: Curve.EaseInOut })
        .accessibilityText('打开明信片，开始创作').onClick(() => this.openCreator())
      Text('轻触明信片，开始写下这一刻  ↗').fontSize(11).fontFamily('PostcardHand').fontColor('#9A856A').letterSpacing(1).margin({ top: 40 })
      Blank()
      Text('Postcards for a Gentler World.').fontSize(13).fontFamily('serif').fontColor('#BAA58A').margin({ bottom: 30 })
    }.width('100%').layoutWeight(1).padding({ left: 32, right: 32, top: 16 })
  }

  @Builder
  editor() {
    Column() {
      Row() {
        Text('·  未写完的明信片').fontSize(10).fontColor('#9C8F7D')
        Blank()
        Text('版式').fontSize(10).fontColor('#806650').padding({ left: 12, right: 18, top: 8, bottom: 8 })
          .enabled(!this.busy).onClick(() => { this.panelMode = 'layout'; this.panelVisible = true; })
        Text('放大看').fontSize(10).fontColor('#9C8F7D')
          .onClick(() => { this.panelMode = 'preview'; this.panelVisible = true; })
        Image($rawfile('i-expand.svg')).width(13).height(13).margin({ left: 5 })
      }.width('100%').margin({ bottom: 13 })
      CardView({ card: this.card, original: this.original, baseUrl: this.api.baseUrl,
        onPhoto: () => { if (!this.card.originalImage) { this.pickPhoto(false); } else if (this.card.image) { this.original = !this.original; } },
        draggableInk: true, onInkMove: (x: number, y: number) => {
          if (this.card.editor.ink) { this.card.editor.ink.x = x; this.card.editor.ink.y = y; this.changed(); }
        } }).id('editorCard')
      Row() {
        Text('保存 / 分享 ↗').fontSize(10).fontColor('#8C7A62').padding({ top: 16, bottom: 16 })
          .onClick(() => { this.panelMode = 'save'; this.panelVisible = true; })
        Blank()
        Image($rawfile('i-image.svg')).width(13).height(13).margin({ right: 5 })
        Text('换张照片').fontSize(10).fontColor('#8C7A62').padding({ top: 16, bottom: 16 })
          .onClick(() => this.pickPhoto(false))
      }.width('100%').enabled(!this.busy && !this.recording)
      Blank()
    }.width('100%').layoutWeight(1).padding({ left: 18, right: 18, top: 12 }).constraintSize({ minHeight: 285 })
    Column() {
      Row() {
        ForEach(['风格', '文字', '手写', '声音', '邮戳'], (name: string, index: number) => {
          Column({ space: 6 }) {
            Image($rawfile(['i-style.svg', 'i-text.svg', 'i-pen.svg', 'i-mic.svg', 'i-stamp.svg'][index])).width(22).height(22)
            Text(name).fontSize(11).fontColor(this.tool === index ? '#594532' : '#9C8F7D')
            Row().width(17).height(2).backgroundColor(this.tool === index ? '#806650' : Color.Transparent)
          }.layoutWeight(1).padding({ top: 13, bottom: 9 }).opacity(this.tool === index ? 1 : 0.65)
            .onClick(() => { if (!this.busy && !this.recording) { this.tool = index; } })
        }, (name: string) => name)
      }.width('100%').padding({ left: 13, right: 13 })
      Scroll() {
    Column({ space: 14 }) {
      if (this.tool === 0) {
        this.panelHeading('给风景，另一种表达')
        Scroll() {
          Row({ space: 13 }) {
            ForEach(this.styles, (style: Choice) => {
              Column({ space: 8 }) {
                Image($rawfile('style-' + style.id + '.jpg')).width(66).height(66).objectFit(ImageFit.Contain)
                  .backgroundColor('#F0EADF')
                  .borderRadius(4).border({ width: this.card.skill === style.id ? 2 : 1,
                    color: this.card.skill === style.id ? '#806650' : '#E6DFD2' })
                Text(style.name).fontSize(9).fontColor('#8C8376').maxLines(2).height(26).textAlign(TextAlign.Center)
              }.width(70).enabled(!this.busy).onClick(() => { this.card.skill = style.id; this.changed(); })
            }, (style: Choice) => style.id)
          }.padding(3)
        }.scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Off).width('100%')
        if (!this.styles.length) { this.action('重新加载画风', () => this.connect()) }
        this.dynamicAction(() => this.card.image ? '按所选画风重新生成' : '生成我的明信片', () => this.generate(), () => true)
      } else if (this.tool === 1) {
        this.panelHeading('想对 Ta 说些什么？')
        TextArea({ text: this.card.sentence, placeholder: '写下这一刻的心情…' }).height(80).maxLength(200).borderRadius(6).border({ width: 1, color: '#E6DFD2' })
          .fontSize(14).fontFamily('PostcardHand').fontColor('#594735').backgroundColor('#F9F6F0').enabled(!this.busy)
          .onChange((value: string) => { this.card.sentence = value; this.changed(); })
        Row({ space: 10 }) {
          this.action('AI 帮我写', () => this.generate(true))
          Blank()
          Text('中英双语').fontSize(10).fontColor('#998E7C')
          Toggle({ type: ToggleType.Switch, isOn: this.card.editor.bilingual }).width(32).height(20).selectedColor('#9A8267')
            .onChange((value: boolean) => { this.card.editor.bilingual = value; this.changed(); })
        }.width('100%')
        Row({ space: 9 }) {
          Text('文案语气').fontSize(10).fontColor('#998E7C')
          Select(TONES.map((tone: Choice): SelectOption => ({ value: tone.name })))
            .selected(TONES.findIndex((tone: Choice) => tone.id === this.card.tone)).value(TONES.find((tone: Choice) => tone.id === this.card.tone)?.name || '温暖').font({ size: 11 })
            .onSelect((index: number) => { this.card.tone = TONES[index].id; this.changed(); })
          Blank()
          ForEach(['hand', 'serif', 'sans'], (font: string) => {
            Text('Aa').fontSize(14).fontFamily(font === 'hand' ? 'PostcardHand' : font === 'serif' ? 'serif' : 'HarmonyOS Sans')
              .width(30).height(27).textAlign(TextAlign.Center).borderRadius(5)
              .border({ width: 1, color: this.card.editor.font === font ? '#AE9275' : '#EEE7DC' })
              .onClick(() => { this.card.editor.font = font; this.changed(); })
          }, (font: string) => font)
        }.width('100%')
      } else if (this.tool === 2) {
        this.panelHeading('留下你的笔迹')
        if (this.card.handwriting) { Image(this.card.handwriting).width(140).height(65).objectFit(ImageFit.Contain) }
        Row({ space: 10 }) {
          this.dynamicAction(() => this.card.handwriting ? '继续写 / 换笔色' : '写一段手写文字', () => this.openInk())
          if (this.card.handwriting) { this.action('移除手写', () => { this.card.handwriting = ''; this.card.editor.ink = undefined; this.changed(); }) }
        }
        if (this.card.handwriting) {
          Row({ space: 8 }) {
            Text('大小').fontSize(11).fontColor('#998E7C')
            Slider({ value: (this.card.editor.ink?.w || 0.28) * 100, min: 18, max: 55, step: 1 })
              .layoutWeight(1).selectedColor('#927752').onChange((value: number) => this.resizeInk(value))
          }.width('100%')
          Text('在卡片上拖动笔迹，调整位置').fontSize(10).fontColor('#A3947E')
        }
      } else if (this.tool === 3) {
        this.panelHeading('让 Ta 听见你的声音')
        Row({ space: 16 }) {
          this.recordDisc()
          Column({ space: 7 }) {
            Text('有些话，想亲口说').fontSize(16).fontFamily('PostcardHand').fontColor('#685847')
            Text('声音会成为卡片上的一枚唱片。').fontSize(10).fontColor('#A3947E')
          }.alignItems(HorizontalAlign.Start)
        }
        Text(this.recording ? '录音中 · ' + this.recordSeconds + ' 秒 / 180 秒' : '让明信片，也留住你的声音。').fontSize(13).fontColor('#8D7963')
        Row({ space: 10 }) {
          this.dynamicAction(() => this.recording ? '停止录音' : '录一段话', () => this.record(), () => this.recording)
          if (!this.recording) {
            this.action('添加背景声音', () => this.run('正在选择声音…', async () => {
              const audio = await MediaService.chooseAudio(this.context());
              if (audio) { this.card.backgroundAudio = audio; this.changed(); }
            }))
          }
        }
        if (this.card.audio) {
          Row() {
            Text('我的声音 · ' + Math.round(this.card.audio.duration) + ' 秒').fontSize(12).fontColor('#8D7963').layoutWeight(1)
            Text('移除').fontSize(12).fontColor('#9D6A50').onClick(() => { this.stopAudio(); this.card.audio = undefined; this.changed(); })
          }.width('100%').enabled(!this.recording)
        }
        if (this.card.backgroundAudio) {
          Row() {
            Text(this.card.backgroundAudio.name).fontSize(12).fontColor('#8D7963').maxLines(1).layoutWeight(1)
            Text('移除').fontSize(12).fontColor('#9D6A50').onClick(() => { this.stopAudio(); this.card.backgroundAudio = undefined; this.changed(); })
          }.width('100%').enabled(!this.recording)
        }
        if ((this.card.audio || this.card.backgroundAudio) && !this.recording) { this.dynamicAction(() => this.playing ? '停止播放' : '听一听', () => this.play(this.card)) }
      } else {
        this.panelHeading('给这一刻，盖个纪念')
        Row({ space: 5 }) {
          ForEach(['brown', 'red', 'blue', 'green', 'violet'], (color: string) => {
            Image($rawfile('postage-' + color + '.svg')).width(54).height(54)
              .border({ width: this.card.editor.stampColor === color ? 1 : 0, color: '#BEA98E' }).borderRadius(6)
              .onClick(() => { this.card.editor.stampColor = color; this.changed(); })
          }, (color: string) => color)
        }
        TextInput({ text: this.card.stamp, placeholder: '邮戳文字' }).maxLength(8).backgroundColor('#F4EFE7')
          .onChange((value: string) => { this.card.stamp = value; this.changed(); })
      }
    }.width('100%').padding({ left: 20, right: 20, top: 15, bottom: 16 }).alignItems(HorizontalAlign.Start)
      }.width('100%').height(this.tool === 1 ? 255 : 225).align(Alignment.Top).scrollBar(BarState.Off)
        .border({ width: { top: 1 }, color: '#EEE7DC' })
    }.width('100%').backgroundColor('#FFFCF7').borderRadius({ topLeft: 22, topRight: 22 })
      .border({ width: { top: 1 }, color: '#E9E2D6' })
  }

  @Builder
  galleryPage() {
    Row() {
      ForEach(['公开', '私有'], (title: string, index: number) => {
        Text(title).layoutWeight(1).fontSize(12).textAlign(TextAlign.Center).padding(7).borderRadius(18)
          .backgroundColor((this.scope === 0 ? 0 : 1) === index ? '#FFFDF8' : Color.Transparent).fontColor('#8C8376')
          .onClick(() => { this.scope = index === 0 ? 0 : 2; this.loadGallery(); })
      }, (title: string) => title)
    }.width('100%').padding(3).backgroundColor('#EEE9DF').borderRadius(20).margin({ bottom: 16 })
    if (this.scope !== 0) {
      Row({ space: 8 }) {
        ForEach(['我的云端', '本机作品', '收藏'], (title: string, index: number) => {
          Text(title).fontSize(10).padding({ left: 12, right: 12, top: 6, bottom: 6 }).borderRadius(14)
            .backgroundColor(this.scope === index + 1 ? '#ECE4D6' : Color.Transparent).fontColor('#927752')
            .onClick(() => { this.scope = index + 1; this.loadGallery(); })
        }, (title: string) => title)
      }.width('100%').margin({ bottom: 18 })
    } else { Text('最新明信片').fontSize(10).fontColor('#927752').width('100%').margin({ bottom: 18 }) }
    if (this.scope === 0 || this.scope === 3) {
      GridRow({ columns: 2, gutter: 12 }) {
        ForEach(this.gallery, (card: Postcard) => {
          GridCol() {
            Column({ space: 7 }) {
              Image(this.api.absolute(card.image || card.originalImage)).width('100%').aspectRatio(1.18).objectFit(card.editor?.stylized ? ImageFit.Contain : ImageFit.Cover).backgroundColor('#F3F0E8')
              Text(card.title || '一张，来自生活').fontSize(13).fontColor('#594532').maxLines(1).width('90%')
              Row({ space: 5 }) {
                this.authorAvatar(card, 20)
                Text(card.authorNickname || card.author || '一份心意').fontSize(9).fontColor('#9C907D').maxLines(1).layoutWeight(1)
              }.width('90%')
              Text('♡ ' + (card.likes || 0) + '      ◌ ' + (card.commentCount || 0)).fontSize(9).fontColor('#A09480').width('90%').margin({ bottom: 9 })
            }.width('100%').backgroundColor('#FFFCF6').borderRadius(5).clip(true).margin({ bottom: 16 })
              .onClick(() => this.openDetail(card))
          }
        }, (card: Postcard) => JSON.stringify(card))
      }.width('100%')
    } else {
      ForEach(this.gallery, (card: Postcard) => {
        Row({ space: 10 }) {
          Image(this.api.absolute(card.image || card.originalImage)).width(74).height(66).objectFit(ImageFit.Cover).borderRadius(3)
          Column({ space: 7 }) {
            Text(card.title || '一张，来自生活').fontSize(13).fontColor('#594532').maxLines(1)
            Text(new Date(card.createdAt).toLocaleDateString()).fontSize(10).fontColor('#9C907D')
            Text(card.visibility === 'public' ? '已公开' : '私有珍藏').fontSize(9).fontColor('#927752')
          }.layoutWeight(1).alignItems(HorizontalAlign.Start)
          Image($rawfile('i-chevron.svg')).width(14).height(14).opacity(0.5)
        }.width('100%').padding(10).backgroundColor('#FFFCF6')
          .border({ width: { bottom: 1 }, color: '#EEE7DC' }).onClick(() => this.openDetail(card))
      }, (card: Postcard) => JSON.stringify(card))
    }
    if (!this.gallery.length) {
      Column({ space: 14 }) {
        Image($rawfile('i-gallery.svg')).width(36).height(36).opacity(0.4)
        Text('等一张明信片，慢慢到来').fontSize(18).fontColor('#8C7456')
        Text('写下你的第一张，收好生活里的温柔。').fontSize(11).fontColor('#AC9E89')
      }.width('100%').padding({ top: 50, bottom: 40 })
    }
    if (this.hasMore) { this.action('再看一些', () => { this.page++; this.loadGallery(true); }) }
  }

  @Builder
  authorAvatar(card: Postcard, size: number) {
    if (card.authorAvatar) {
      Image(this.api.absolute(card.authorAvatar)).width(size).height(size).borderRadius(size / 2).objectFit(ImageFit.Cover)
    } else {
      Text((card.authorNickname || card.author || '一').slice(0, 1)).fontSize(size * 0.46).fontColor('#806650')
        .width(size).height(size).textAlign(TextAlign.Center).borderRadius(size / 2).backgroundColor('#E9DFCE')
    }
  }

  @Builder
  detailPage() {
    if (this.detail) {
      Text(this.detail.title || '一张，来自生活').fontSize(18).fontColor('#594735').width('100%').margin({ bottom: 12 })
      Row({ space: 9 }) {
        this.authorAvatar(this.detail, 32)
        Column({ space: 4 }) {
          Text(this.detail.authorNickname || this.detail.author || '我的珍藏').fontSize(12).fontColor('#806650')
          Text(new Date(this.detail.createdAt).toLocaleDateString() + (this.detail.demo ? ' · 演示作品' : ''))
            .fontSize(10).fontColor('#A3947E')
        }.alignItems(HorizontalAlign.Start)
      }.width('100%').margin({ bottom: 18 })
      CardView({ card: this.detail, original: this.detailOriginal, baseUrl: this.api.baseUrl, showHints: false,
        onPhoto: () => { this.detailOriginal = !this.detailOriginal; } }).id('detailCard')
      Text('点击照片，切换原图与画面').fontSize(11).fontColor('#A08B73').margin(14)
      if (this.detail.audio || this.detail.backgroundAudio) { this.dynamicAction(() => this.playing ? '停止播放' : '听听卡片的声音', () => { if (this.detail) { this.play(this.detail); } }) }
      Row({ space: 10 }) {
        this.action('保存到相册', () => this.exportCard(false))
        this.action('分享图片', () => this.exportCard(true))
      }.margin({ top: 14, bottom: 14 })
      if (!this.detailPublic) {
        this.action('继续编辑', () => this.editWork(), true)
        if (this.scope === 1) {
          if (this.detail.visibility === 'public') { this.action('设为私有', () => this.privatize()) }
          else { this.action('公开到展览馆', () => this.publish()) }
        }
      } else {
        Row({ space: 12 }) {
          this.dynamicAction(() => (this.detail?.liked ? '♥ ' : '♡ ') + (this.detail?.likes || 0), () => this.social('like'))
          this.dynamicAction(() => this.detail?.collected ? '★ 已收藏' : '☆ 收藏', () => this.social('favorite'))
        }
        TextArea({ text: this.commentText, placeholder: '给这张明信片留句话…' }).height(90).maxLength(300).margin({ top: 18 })
          .onChange((value: string) => { this.commentText = value; })
        this.action('发表评论', () => this.social('comments'))
        ForEach(this.comments, (comment: Comment) => {
          Column({ space: 7 }) {
            Text(comment.author).fontColor('#9C7D60').fontSize(12)
            Text(comment.content).fontColor('#5E4C3C').fontSize(14)
          }.width('100%').alignItems(HorizontalAlign.Start).padding(14).backgroundColor('#FFFCF7').borderRadius(10).margin({ top: 10 })
        }, (comment: Comment) => comment.id)
      }
    }
  }

  @Builder
  accountPanel() {
    this.heading(this.username ? '你好，' + (this.nickname || this.username) : '留一个名字给生活。', '我的  /  把心意好好收藏')
    Column({ space: 14 }) {
      if (!this.username) {
        Text(this.register ? '注册一个账号' : '登录你的账号').fontSize(18).fontColor('#735B44')
        Text('与网站共用账号，作品可以在两端查看。').fontSize(12).fontColor('#A08B73')
        TextInput({ text: this.loginName, placeholder: '用户名' }).maxLength(20).onChange((value: string) => { this.loginName = value; })
        TextInput({ text: this.password, placeholder: '密码（至少 6 位）' }).type(InputType.Password).onChange((value: string) => { this.password = value; })
        this.dynamicAction(() => this.register ? '注册并登录' : '登录', () => this.authenticate(), () => true)
        Text(this.register ? '已有账号，去登录' : '没有账号，去注册').fontSize(13).fontColor('#9C7D60').padding(10).onClick(() => { this.register = !this.register; })
      } else {
        Row({ space: 14 }) {
          this.profileAvatar()
          this.action('从相册导入头像', () => this.importAvatar())
        }.width('100%')
        TextInput({ text: this.nickname, placeholder: '昵称' }).maxLength(20).onChange((value: string) => { this.nickname = value; })
        TextArea({ text: this.bio, placeholder: '介绍一下自己' }).height(90).maxLength(100).onChange((value: string) => { this.bio = value; })
        this.action('保存个人资料', () => this.run('正在保存资料…', async () => {
          const profile: Profile = { nickname: this.nickname, bio: this.bio };
          await this.api.request<ProfileResult>('/api/auth/profile', JSON.stringify(profile)); this.tip('资料已保存');
        }), true)
        this.action('退出登录', () => this.logout())
      }
    }.padding(20).width('100%').backgroundColor('#FFFCF7').borderRadius(16)
  }

  @Builder
  connectionPanel() {
    Column({ space: 12 }) {
      Text(this.connected ? '服务已连接' : '服务暂未连接').fontSize(13).fontColor(this.connected ? '#738B6D' : '#AD7C57')
      TextInput({ text: this.serverUrl, placeholder: '服务器地址' }).fontSize(12).onChange((value: string) => { this.serverUrl = value; })
      this.action('保存并重新连接', () => this.run('正在连接服务…', async () => {
        const url = this.serverUrl.trim().replace(/\/+$/, '');
        if (!/^https?:\/\//.test(url)) { throw new Error('请输入 http:// 或 https:// 开头的地址'); }
        if (url !== this.api.baseUrl) { this.api.token = ''; this.username = ''; this.nickname = ''; this.bio = ''; this.avatar = ''; this.resetShare(); }
        this.api.baseUrl = url; this.serverUrl = url; this.persistSession(); await this.connect();
        if (this.connected) { this.tip('服务连接成功'); }
      }))
      Text('一张 · 鸿蒙版 1.0\n每一张明信片，都是一次温柔的连接。').fontSize(11).fontColor('#AD9B86').lineHeight(20).textAlign(TextAlign.Center)
    }.padding(20).width('100%').margin({ top: 20 })
  }

  @Builder
  profileAvatar() {
    Stack() {
      if (this.avatar) {
        Image(this.api.absolute(this.avatar)).width(66).height(66).objectFit(ImageFit.Cover).borderRadius(33)
      } else {
        Text((this.nickname || this.username || '一').slice(0, 1)).fontSize(31).fontColor('#A08664')
      }
    }.width(66).height(66).borderRadius(33).backgroundColor('#E9DFCE')
      .accessibilityText('从相册导入头像').enabled(!this.busy).onClick(() => this.importAvatar())
  }

  @Builder
  profilePage() {
    Row({ space: 16 }) {
      this.profileAvatar()
      Column({ space: 9 }) {
        Text(this.nickname || this.username || '未登录').fontSize(19).fontColor('#38332C')
        Text(this.bio || '把生活，做成明信片。').fontSize(11).fontColor('#9A8A74')
        Text(this.username ? '编辑个人资料' : '登录 / 注册').fontSize(11).fontColor('#927752')
          .onClick(() => { this.panelMode = 'account'; this.panelVisible = true; })
      }.alignItems(HorizontalAlign.Start)
    }.width('100%').padding({ top: 20, bottom: 35 })
    Column() {
      ForEach(['我的草稿', '我的作品', '我的邮戳', '个人资料', '我的收藏', '偏好设置', '使用帮助'], (name: string, index: number) => {
        Row({ space: 10 }) {
          Image($rawfile(['i-text.svg', 'i-gallery.svg', 'i-stamp.svg', 'i-person.svg', 'i-star.svg', 'i-settings.svg', 'i-comment.svg'][index])).width(19).height(19)
          Text(name).fontSize(12).fontColor('#38332C').layoutWeight(1)
          Image($rawfile('i-chevron.svg')).width(13).height(13).opacity(0.5)
        }.width('100%').height(53).border({ width: { bottom: index === 6 ? 0 : 1 }, color: '#EEE8DC' })
          .onClick(() => {
            if (index === 0) { this.openDrafts(); }
            else if (index === 1 || index === 4) { this.scope = index === 1 ? 2 : 3; this.navigate(1); }
            else { this.panelMode = index === 2 ? 'stamps' : index === 3 ? 'account' : index === 5 ? 'preferences' : 'help'; this.panelVisible = true; }
          })
      }, (name: string) => name)
    }.width('100%').padding({ left: 13, right: 13 }).backgroundColor('#FFFCF6').borderRadius(8)
      .border({ width: 1, color: '#ECE3D5' })
    Text('把生活，做成明信片。').fontSize(16).fontFamily('PostcardHand').fontColor('#B4A084').margin({ top: 56 })
    Text('Postcards for a Gentler World.').fontSize(13).fontFamily('serif').fontColor('#BEA98E').margin({ top: 9 })
  }

  @Builder
  draftsPanel() {
    this.heading('我的草稿', '保存在此手机，随时接着写')
    this.action('新建明信片', () => {
      try { this.startNewDraft(); } catch (_) { this.tip('当前草稿未能保存，暂未新建'); }
    }, true)
    if (!this.drafts.length) {
      Text('还没有未完成的心意。创作时会自动存入这里。').fontSize(13).lineHeight(24).fontColor('#A3947E').padding(24)
    }
    ForEach(this.drafts, (entry: DraftEntry) => {
      Column({ space: 12 }) {
        Row({ space: 12 }) {
          if (entry.card.image || entry.card.originalImage) {
            Image(this.api.absolute(entry.card.image || entry.card.originalImage)).width(76).height(64).objectFit(ImageFit.Cover).borderRadius(4)
          } else {
            Image($rawfile('i-pen.svg')).width(76).height(64).padding(20).backgroundColor('#EEE8DB').borderRadius(4)
          }
          Column({ space: 7 }) {
            Text(entry.card.title || '未命名明信片').fontSize(14).fontColor('#594532').maxLines(1)
            Text(new Date(entry.updatedAt).toLocaleString()).fontSize(10).fontColor('#9C907D')
            Text(entry.id === this.card.draftId ? '正在编辑' : '未完成的心意').fontSize(10).fontColor('#927752')
          }.layoutWeight(1).alignItems(HorizontalAlign.Start)
        }.width('100%').onClick(() => this.resumeDraft(entry))
        Row({ space: 7 }) {
          this.action('继续写', () => this.resumeDraft(entry), true)
          this.action('重命名', () => { this.renameId = entry.id; this.renameTitle = entry.card.title; this.panelMode = 'rename'; })
          this.action('复制', () => this.copyDraft(entry))
          this.action('删除', () => this.deleteDraft(entry))
        }.width('100%')
      }.width('100%').padding(12).backgroundColor('#FFFCF6').borderRadius(8)
    }, (entry: DraftEntry) => entry.id + ':' + entry.updatedAt)
    Text('草稿不自动同步。完成后可保存为本机或云端作品。').fontSize(11).fontColor('#A3947E')
  }

  @Builder
  layoutPanel() {
    this.heading('给心意，选个版式', '切换版式会保留照片、文字和笔迹')
    CardView({ card: this.card, original: this.original, baseUrl: this.api.baseUrl, showHints: false })
    Row({ space: 10 }) {
      ForEach(LAYOUTS, (layout: Choice) => {
        Column({ space: 9 }) {
          Stack({ alignContent: Alignment.TopStart }) {
            if (layout.id === 'split') {
              Row().width('47%').height('88%').backgroundColor('#B8C9C7').position({ x: '6%', y: '6%' })
              Row().width('31%').height('3%').backgroundColor('#B6A286').position({ x: '61%', y: '45%' })
              Row().width('25%').height('3%').backgroundColor('#B6A286').position({ x: '61%', y: '60%' })
            } else if (layout.id === 'stack') {
              Row().width('88%').height('53%').backgroundColor('#B8C9C7').position({ x: '6%', y: '6%' })
              Row().width('65%').height('3%').backgroundColor('#B6A286').position({ x: '6%', y: '72%' })
              Row().width('48%').height('3%').backgroundColor('#B6A286').position({ x: '6%', y: '84%' })
            } else {
              Row().width('88%').height('88%').backgroundColor('#B8C9C7').position({ x: '6%', y: '6%' })
              Row().width('50%').height('35%').backgroundColor('#FFF9EA').position({ x: '39%', y: '53%' })
            }
          }.width('100%').aspectRatio(14 / 9).backgroundColor('#FFF9EA').borderRadius(3)
            .border({ width: (this.card.editor.layout || 'split') === layout.id ? 2 : 1, color: '#BEA98E' })
          Text(layout.name).fontSize(11).fontColor('#806650')
        }.layoutWeight(1).onClick(() => { this.card.editor.layout = layout.id; this.changed(); })
      }, (layout: Choice) => layout.id)
    }.width('100%')
    Text(LAYOUTS.find((layout: Choice) => layout.id === (this.card.editor.layout || 'split'))?.desc || '')
      .fontSize(12).fontColor('#9C8F7D')
    this.action('选好了', () => { this.panelVisible = false; }, true)
  }

  @Builder
  preferencesPanel() {
    this.heading('创作偏好', '用于以后新建的明信片，保存在此手机')
    Column({ space: 20 }) {
      Row() {
        Text('默认版式').fontSize(13).fontColor('#735B44').layoutWeight(1)
        Select(LAYOUTS.map((layout: Choice): SelectOption => ({ value: layout.name })))
          .selected(LAYOUTS.findIndex((layout: Choice) => layout.id === this.preferences.layout))
          .value(LAYOUTS.find((layout: Choice) => layout.id === this.preferences.layout)?.name || '左图右文')
          .onSelect((index: number) => { this.preferences.layout = LAYOUTS[index].id; this.savePreferences(); })
      }.width('100%')
      Row({ space: 12 }) {
        Text('默认字体').fontSize(13).fontColor('#735B44').layoutWeight(1)
        ForEach(['hand', 'serif', 'sans'], (font: string, index: number) => {
          Text(['手写', '宋体', '简洁'][index]).fontSize(12).padding(8).borderRadius(6)
            .backgroundColor(this.preferences.font === font ? '#E6DAC8' : '#F5EFE5')
            .onClick(() => { this.preferences.font = font; this.savePreferences(); })
        }, (font: string) => font)
      }.width('100%')
      Row() {
        Text('默认中英双语').fontSize(13).fontColor('#735B44').layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.preferences.bilingual }).selectedColor('#9A8267')
          .onChange((value: boolean) => { this.preferences.bilingual = value; this.savePreferences(); })
      }.width('100%')
      Row() {
        Text('默认文案语气').fontSize(13).fontColor('#735B44').layoutWeight(1)
        Select(TONES.map((tone: Choice): SelectOption => ({ value: tone.name })))
          .selected(TONES.findIndex((tone: Choice) => tone.id === this.preferences.tone))
          .value(TONES.find((tone: Choice) => tone.id === this.preferences.tone)?.name || '温暖')
          .onSelect((index: number) => { this.preferences.tone = TONES[index].id; this.savePreferences(); })
      }.width('100%')
      TextInput({ text: this.preferences.signature, placeholder: '分享时的默认署名（可选）' }).maxLength(30)
        .onChange((value: string) => { this.preferences.signature = value; this.savePreferences(); })
      Text('修改后自动保存，不改变正在写的卡片。').fontSize(11).fontColor('#A3947E')
    }.width('100%').padding(16).backgroundColor('#FFFCF6').borderRadius(8)
    this.action('服务连接', () => { this.panelMode = 'connection'; })
  }

  @Builder
  stampsPanel() {
    this.heading('我的邮戳', '选一枚，作为新明信片的默认邮戳')
    GridRow({ columns: 3, gutter: 12 }) {
      ForEach(['brown', 'red', 'blue', 'green', 'violet'], (color: string, index: number) => {
        GridCol() {
          Column({ space: 8 }) {
            Image($rawfile('postage-' + color + '.svg')).width('100%').height(80)
            Text(['旅途', '花信', '远山', '林间', '星夜'][index]).fontSize(12).fontColor('#806650')
          }.width('100%').padding(8).margin({ bottom: 12 }).borderRadius(6)
            .border({ width: this.preferences.stampColor === color ? 2 : 1, color: '#D6C6AC' })
            .onClick(() => { this.preferences.stampColor = color; this.savePreferences(); })
        }
      }, (color: string) => color)
    }.width('100%')
    TextInput({ text: this.preferences.stamp, placeholder: '默认邮戳文字' }).maxLength(8)
      .onChange((value: string) => { this.preferences.stamp = value; this.savePreferences(); })
    this.action('也用于当前明信片', () => {
      this.card.editor.stampColor = this.preferences.stampColor; this.card.stamp = this.preferences.stamp;
      this.changed(); this.tip('当前明信片的邮戳已更新');
    }, true)
  }

  @Builder
  utilityPanel() {
    Scroll() {
      Column({ space: 16 }) {
        if (this.panelMode === 'account') { this.accountPanel() }
        else if (this.panelMode === 'drafts') { this.draftsPanel() }
        else if (this.panelMode === 'rename') {
          this.heading('给草稿起个名字', '方便下次找到它')
          TextInput({ text: this.renameTitle, placeholder: '未命名明信片' }).maxLength(50)
            .onChange((value: string) => { this.renameTitle = value; })
          this.action('保存名称', () => this.renameDraft(), true)
          this.action('返回草稿', () => { this.panelMode = 'drafts'; })
        }
        else if (this.panelMode === 'layout') { this.layoutPanel() }
        else if (this.panelMode === 'preferences') { this.preferencesPanel() }
        else if (this.panelMode === 'stamps') { this.stampsPanel() }
        else if (this.panelMode === 'connection') { this.connectionPanel() }
        else if (this.panelMode === 'link') {
          this.heading('把这张，送给你', '称呼与署名会显示在分享链接的信封上')
          CardView({ card: this.card, baseUrl: this.api.baseUrl, showHints: false })
          TextInput({ text: this.toName, placeholder: '给谁（可选）' }).maxLength(30).enabled(!this.busy)
            .onChange((value: string) => { this.toName = value; this.resetShare(); })
          TextInput({ text: this.fromName, placeholder: '署名（可选）' }).maxLength(30).enabled(!this.busy)
            .onChange((value: string) => { this.fromName = value; this.resetShare(); })
          Text('卡片日期 · ' + new Date(this.card.editor.createdAt || this.card.createdAt).toLocaleDateString())
            .fontSize(12).fontColor('#9C8F7D')
          this.dynamicAction(() => this.shareUrl ? '再次分享链接' : '生成并分享链接', () => this.createLink(), () => true)
          this.action('返回保存 / 分享', () => { this.panelMode = 'save'; })
          Text('持有链接的人可以查看卡片、原图和声音。').fontSize(11).fontColor('#A3947E')
        }
        else if (this.panelMode === 'preview') {
          Text('明信片').fontSize(15).fontColor('#38332C')
          CardView({ card: this.card, original: this.original, baseUrl: this.api.baseUrl, showHints: false,
            onPhoto: () => { if (this.card.image) { this.original = !this.original; } } })
        } else if (this.panelMode === 'help') {
          Text('使用帮助').fontSize(18).fontColor('#38332C')
          Text('导入照片，选择画风，再写下你的心意。点击卡片照片可查看原图。\n\n草稿自动保存在本机；登录后可保存云端作品。声音通过分享链接收听。').fontSize(14).lineHeight(25).fontColor('#8C8376')
        } else {
          Text('保存 / 分享').fontSize(18).fontColor('#38332C')
          CardView({ card: this.card, original: this.original, baseUrl: this.api.baseUrl, showHints: false })
          TextInput({ text: this.card.title, placeholder: '给作品起个名字（可选）' }).maxLength(50)
            .onChange((value: string) => { this.card.title = value; this.changed(); })
          this.action('保存作品', () => this.saveWork(), true)
          Row({ space: 10 }) {
            this.action('保存到相册', () => this.exportCard(false))
            this.action('分享图片', () => this.exportCard(true))
            this.action('分享链接', () => { this.fromName = this.preferences.signature || this.nickname || this.username; this.toName = ''; this.resetShare(); this.panelMode = 'link'; })
          }
          Text('图片保存当前卡面；声音通过分享链接播放。').fontSize(10).fontColor('#A3947E')
          this.action('拍一张照片', () => { this.panelVisible = false; this.pickPhoto(true); })
          Text('开始新的一张').fontSize(12).fontColor('#927752').padding(12)
            .onClick(() => { this.panelVisible = false; this.newCard(); })
        }
        if (this.status) { Text(this.status).fontSize(12).fontColor('#806650') }
      }.width('100%').padding(24)
    }.width('100%').height('100%').scrollBar(BarState.Off)
  }

  @Builder
  inkSheet() {
    Column({ space: 18 }) {
      Text('写下你的心意').fontSize(21).fontColor('#614A36').margin({ top: 18 })
      Row({ space: 14 }) {
        ForEach(['#594735', '#435B73', '#9D6257', '#63785C'], (color: string) => {
          Row().width(28).height(28).backgroundColor(color).borderRadius(14)
            .border({ width: this.inkColor === color ? 3 : 0, color: '#D8C9B4' })
            .accessibilityText(['#594735', '#435B73', '#9D6257', '#63785C'].indexOf(color) === 0 ? '棕色笔' : '选择笔色')
            .onClick(() => { this.inkColor = color; this.drawInk(); })
        }, (color: string) => color)
        Blank()
        ForEach([1.5, 2.5, 4], (width: number, index: number) => {
          Text(['细', '中', '粗'][index]).fontSize(12).padding(8).borderRadius(12)
            .backgroundColor(this.inkLineWidth === width ? '#E6DAC8' : '#F5EFE5')
            .onClick(() => { this.inkLineWidth = width; this.drawInk(); })
        }, (width: number) => String(width))
      }.width('100%')
      Canvas(this.inkContext).width('100%').height(160).backgroundColor('#FBF3DF').borderRadius(8)
        .onAreaChange((oldArea: Area, area: Area) => {
          const width = Number(area.width);
          if (this.inkSourceWidth > 1 && width > 0 && this.inkSourceWidth !== width) {
            const scale = width / this.inkSourceWidth;
            this.inkStrokes = this.inkStrokes.map((stroke: number[][]) => stroke.map((point: number[]) => [point[0] * scale, point[1]]));
          }
          this.inkWidth = width; this.inkSourceWidth = width; this.drawInk();
        })
        .onReady(() => this.drawInk())
        .onTouch((event: TouchEvent) => {
          if (!event.touches.length) { return; }
          const point = event.touches[0];
          if (event.type === TouchType.Down) { this.inkStrokes.push([[point.x, point.y]]); this.drawInk(); }
          if (event.type === TouchType.Move && this.inkStrokes.length) {
            this.inkStrokes[this.inkStrokes.length - 1].push([point.x, point.y]); this.drawInk();
          }
        })
      Row({ space: 12 }) {
        this.action('撤销', () => { this.inkStrokes.pop(); this.drawInk(); })
        this.action('清空', () => { this.inkStrokes = []; this.drawInk(); })
        this.action('放上卡片', () => {
          if (!this.inkStrokes.length) { this.card.handwriting = ''; this.card.editor.ink = undefined; this.changed(); this.inkVisible = false; return; }
          this.card.handwriting = this.inkContext.toDataURL('image/png');
          this.card.editor.ink = { x: this.card.editor.ink?.x ?? 0.57, y: this.card.editor.ink?.y ?? 0.69,
            w: this.card.editor.ink?.w ?? 0.28, h: this.card.editor.ink?.h ?? 0.22, strokes: this.inkStrokes,
            color: this.inkColor, lineWidth: this.inkLineWidth, canvasWidth: this.inkWidth };
          this.changed(); this.inkVisible = false;
        }, true)
      }
    }.padding(22).width('100%')
  }

  build() {
    Column() {
      Row() {
        if (this.detail || (this.tab === 0 && this.editorOpen)) {
          Image($rawfile('i-back.svg')).width(20).height(20).margin({ left: 6, right: 14 })
            .onClick(() => { if (this.detail) { this.detail = undefined; this.stopAudio(); this.loadGallery(); } else { this.returnToCover(); } })
        } else { Text('一张').fontSize(19).fontColor('#A59178').width(60) }
        Text(this.detail ? '明信片' : [this.editorOpen ? '编辑明信片' : '创作', '展览馆', '我的'][this.tab])
          .fontSize(15).fontColor('#38332C').layoutWeight(1).textAlign(TextAlign.Center)
        if (!this.detail && this.tab === 0 && this.editorOpen) {
          Text('清空草稿').fontSize(10).fontColor('#9A7D65').padding({ left: 8, right: 9, top: 9, bottom: 9 })
            .enabled(!this.busy && !this.recording).onClick(() => this.clearDraft())
          Text('保存草稿').fontSize(10).fontColor('#FFFCF7').backgroundColor('#806650').borderRadius(14)
            .padding({ left: 9, right: 9, top: 7, bottom: 7 }).onClick(() => {
              try { this.store?.saveDraft(this.card); this.tip('草稿已保存'); } catch (_) { this.tip('草稿保存失败'); }
            })
        } else {
          Text(this.tab === 1 && !this.detail ? '刷新' : '').fontSize(11).fontColor('#927752').width(60).textAlign(TextAlign.End)
            .onClick(() => { if (this.tab === 1 && !this.detail) { this.loadGallery(); } })
        }
      }.width('100%').height(64).padding({ left: 16, right: 16 })
      if (!this.detail && this.tab === 0) {
        if (this.editorOpen) { this.editor() } else { this.coverPage() }
      }
      else {
        Scroll() {
          Column() {
            if (this.detail) { this.detailPage() }
            else if (this.tab === 1) { this.galleryPage() }
            else { this.profilePage() }
          }.width('100%').padding({ left: 20, right: 20, bottom: 24 }).constraintSize({ maxWidth: 650 })
        }.layoutWeight(1).width('100%').align(Alignment.Top).scrollBar(BarState.Off)
      }
      if (this.status) {
        Text(this.status).width('100%').padding({ left: 20, right: 20, top: 6, bottom: 6 })
          .fontSize(11).fontColor('#806650').backgroundColor('#F0EADF').maxLines(2)
      }
      Row() {
        ForEach(['创作', '展览馆', '我的'], (name: string, index: number) => {
          Column({ space: 5 }) {
            Image($rawfile(['i-home.svg', 'i-gallery.svg', 'i-person.svg'][index])).width(20).height(20)
            Text(name).fontSize(10).fontColor(this.tab === index ? '#594532' : '#9C907C')
          }.height(62).layoutWeight(1).justifyContent(FlexAlign.Center).opacity(this.tab === index ? 1 : 0.6)
            .onClick(() => { if (index === 0) { this.returnToCover(); } else { this.navigate(index); } })
        }, (name: string) => name)
      }.width('100%').padding({ left: 30, right: 30 }).backgroundColor('#FCFAF5')
        .border({ width: { top: 1 }, color: '#E9E0D4' })
        .bindSheet($$this.inkVisible, this.inkSheet(), { height: 410, backgroundColor: '#FFFCF7', showClose: true })
    }.width('100%').height('100%').backgroundColor('#F8F5EE')
      .bindSheet($$this.panelVisible, this.utilityPanel(), { height: '85%', backgroundColor: '#F8F5EE', showClose: true })
  }
}
