export interface Choice { id: string; name: string; desc?: string; }
export interface AudioClip { url: string; name: string; type: string; duration: number; }
export interface InkLayout { x: number; y: number; w: number; h: number; strokes: number[][][]; }
export interface Editor {
  version: number; font: string; bilingual: boolean; stylized: boolean;
  stampColor: string; createdAt: string; ink?: InkLayout;
}
export class Postcard {
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
export interface Profile { nickname: string; bio: string; }
export interface ProfileResult { profile: Profile; }
export interface ApiError { error?: string; }
export interface LinkResult { url: string; public: boolean; }
export class LinkRequest extends Postcard { requestId: string = ''; keepRecord: boolean = true; preview: string = ''; }
export interface LocalSession { token: string; username: string; baseUrl: string; }
export const TONES: Choice[] = [
  { id: 'healing', name: '温暖' }, { id: 'literary', name: '文艺' },
  { id: 'poetic', name: '诗意' }, { id: 'love', name: '告白' },
  { id: 'travel', name: '旅行' }, { id: 'sassy', name: '俏皮' }
];
