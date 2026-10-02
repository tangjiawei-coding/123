// 用法：停止服务后，node scripts/seed-demo-postcards.cjs /path/to/manifest.json --apply
// manifest 的照片路径相对于 manifest 文件；素材和运行数据不进入 Git。
const fs = require('fs');
const path = require('path');

const manifestPath = path.resolve(process.argv[2]);
const items = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (items.length !== 20 || new Set(items.map(item => item.author)).size !== 20) {
  throw new Error('需要 20 张卡片和 20 个不同的虚拟作者');
}
const batch = 'gallery-demo-202610';
const dataDir = process.env.POSTCARD_DATA_DIR || path.resolve(__dirname, '../data');
const dbPath = path.join(dataDir, 'community.json');
const imageDir = path.join(dataDir, 'community_images');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const colors = ['#829D98', '#B48B7D', '#839AB1', '#ACA071', '#9285A8', '#719893', '#BD9770', '#A4808C', '#829C72', '#8F96AA'];
const now = Date.now();
const assets = [];
const posts = items.map((item, index) => {
  const id = batch + '-' + String(index + 1).padStart(2, '0');
  const previous = db.posts.find(post => post.id === id);
  if (previous && previous.demoBatch !== batch) throw new Error('帖子 ID 冲突');
  const source = path.resolve(path.dirname(manifestPath), item.photo);
  const ext = path.extname(source).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) throw new Error('请提供 JPG、PNG 或 WebP 照片');
  fs.accessSync(source);
  const photo = id + ext;
  const avatar = id + '-avatar.svg';
  const color = colors[index % colors.length];
  const sunX = 25 + (index * 11) % 55;
  const peak = 24 + (index * 7) % 25;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="${color}"/><circle cx="${sunX}" cy="30" r="${index < 10 ? 15 : 10}" fill="#F6EAD0"/><path d="M0 95L${peak} 48 66 86 98 59 120 83V120H0Z" fill="#FFF4DE" opacity=".6"/><path d="M0 102Q${sunX} 65 120 104V120H0Z" fill="#405D60" opacity=".65"/><path d="M8 110Q55 91 112 110" fill="none" stroke="#FFF4DE" stroke-width="2" opacity=".6"/></svg>`;
  assets.push({ source, photo, avatar, svg });
  const createdAt = previous?.createdAt || now - index * 3600000;
  return {
    ...previous, id, author: 'demo-author-' + String(index + 1).padStart(2, '0'),
    authorNickname: item.author, authorAvatar: '/community_img/' + avatar,
    authorBio: '用于作品演示的虚拟作者', demo: true, demoBatch: batch,
    title: item.title, description: item.description || '生活里的片刻，收进一张明信片。',
    image: '/community_img/' + photo, originalImage: '/community_img/' + photo,
    sentence: item.sentence, handwriting: '', audio: null, backgroundAudio: null,
    stamp: item.stamp || '一张', visibility: 'public', hidden: false,
    skill: 'photo-abstract-editorial', tone: 'healing',
    editor: { version: 1, font: 'hand', bilingual: false, stylized: false,
      layout: item.layout || ['split', 'stack', 'photo'][index % 3],
      stampColor: ['brown', 'red', 'blue', 'green', 'violet'][index % 5],
      createdAt: new Date(createdAt).toISOString(), ink: null },
    likes: previous?.likes || 0, likers: previous?.likers || [], createdAt,
    featured: false, featuredAt: null, featuredNote: '', challengeId: null
  };
});
console.log(JSON.stringify({ batch, posts: posts.length, authors: items.map(item => item.author) }));
if (!process.argv.includes('--apply')) process.exit(0);

// 同批次再次执行时更新内容，保留真实点赞、收藏引用以及所有评论。
const backup = dbPath + '.before-' + batch + '-' + now + '.bak';
fs.copyFileSync(dbPath, backup);
fs.mkdirSync(imageDir, { recursive: true });
for (const asset of assets) {
  fs.copyFileSync(asset.source, path.join(imageDir, asset.photo));
  fs.writeFileSync(path.join(imageDir, asset.avatar), asset.svg);
}
for (const post of posts) {
  const index = db.posts.findIndex(item => item.id === post.id);
  if (index === -1) db.posts.push(post); else db.posts[index] = post;
}
fs.writeFileSync(dbPath + '.tmp', JSON.stringify(db, null, 2));
fs.renameSync(dbPath + '.tmp', dbPath);
console.log('已写入 20 条演示帖子，原数据备份：' + backup);
