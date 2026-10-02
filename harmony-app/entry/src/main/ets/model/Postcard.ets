export interface Choice { id: string; name: string; desc?: string; }
export interface AudioClip { url: string; name: string; type: string; duration: number; }
export interface InkLayout { x: number; y: number; w: number; h: number; strokes: number[][][];
  color?: string; lineWidth?: number; canvasWidth?: number; }
export interface Editor {
  version: number; font: string; bilingual: boolean; stylized: boolean;
  stampColor: string; createdAt: string; ink?: InkLayout; layout?: string;
}
export class Postcard {
  draftId: string = '';
  id: string = '';
  title: string = '';
  image: string = '';
  originalImage: string = '';
  sentence: string = '';
  handwriting: string = '';
  audio?: AudioClip;
  backgroundAudio?: AudioClip;
  skill: string = 'photo-abstract-editorial';
  tone: string = 'healing';
  stamp: string = '一张';
  visibility: string = 'private';
  ownerNick: string = '';
  author: string = '';
  authorNickname: string = '';
  authorAvatar: string = '';
  demo: boolean = false;
  likes: number = 0;
  liked: boolean = false;
  collected: boolean = false;
  commentCount: number = 0;
  createdAt: number = Date.now();
  editor: Editor = { version: 1, font: 'hand', bilingual: true, stylized: false,
    stampColor: 'brown', createdAt: new Date().toISOString() };
}
export interface GenerateRequest { image: string; text: string; skill: string; tone: string; mode: string; bilingual: boolean; }
export interface GenerateResult { image?: string; sentence?: string; imageError?: string; sentenceError?: string; }
export interface AuthRequest { username: string; password: string; }
export interface AuthResult { username: string; token: string; }
export interface WorkResult { work: Postcard; }
export interface WorksResult { works: Postcard[]; }
export interface PostsResult { posts: Postcard[]; total?: number; }
export interface PostResult { post: Postcard; }
export interface Comment { id: string; author: string; content: string; createdAt: number; }
export interface CommentsResult { comments: Comment[]; }
export interface CommentRequest { content: string; }
export interface Profile { nickname: string; bio: string; avatar?: string; }
export interface AvatarRequest { avatar: string; }
export interface ProfileResult { profile: Profile; }
export interface ApiError { error?: string; }
export interface LinkResult { url: string; public: boolean; }
export class LinkRequest extends Postcard { requestId: string = ''; keepRecord: boolean = true; preview: string = '';
  toName: string = ''; fromName: string = ''; }
export interface DraftIndex { id: string; title: string; updatedAt: number; }
export interface DraftEntry { id: string; updatedAt: number; card: Postcard; }
export interface ActiveDraft { id: string; }
export class Preferences {
  layout: string = 'split'; font: string = 'hand'; bilingual: boolean = true;
  tone: string = 'healing'; stampColor: string = 'brown'; stamp: string = '一张'; signature: string = '';
}
export const LAYOUTS: Choice[] = [
  { id: 'split', name: '左图右文', desc: '风景与心意，各占一面' },
  { id: 'stack', name: '上图下文', desc: '风景展开，心意落在下方' },
  { id: 'photo', name: '大幅留白', desc: '让照片铺满，留一角写字' }
];
export interface LocalSession { token: string; username: string; baseUrl: string; }
export const TONES: Choice[] = [
  { id: 'healing', name: '温暖' }, { id: 'literary', name: '文艺' },
  { id: 'poetic', name: '诗意' }, { id: 'love', name: '告白' },
  { id: 'travel', name: '旅行' }, { id: 'sassy', name: '俏皮' }
];
