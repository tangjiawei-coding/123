// 停止服务后运行：node scripts/style-demo-postcards.cjs /path/to/styled/manifest.json --apply
// 只更新同批次作品的画面；原图、作者、点赞和评论保持不变。
const fs = require('fs');
const path = require('path');
const manifestPath = path.resolve(process.argv[2]);
const items = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const dataDir = process.env.POSTCARD_DATA_DIR || path.resolve(__dirname, '../data');
const dbPath = path.join(dataDir, 'community.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const batch = 'gallery-demo-202610';
if (items.length !== 20 || new Set(items.map(item => item.id)).size !== 20) throw new Error('需要 20 张不同的成品');
const assets = items.map(item => {
  const post = db.posts.find(post => post.id === item.id && post.demoBatch === batch);
  if (!post || !post.originalImage || !item.skill) throw new Error('作品或原图缺失：' + item.id);
  const source = path.resolve(path.dirname(manifestPath), item.image);
  fs.accessSync(source);
  const filename = item.id + '-styled' + path.extname(source);
  post.image = '/community_img/' + filename;
  post.skill = item.skill;
  post.editor = { ...post.editor, stylized: true, layout: 'split' };
  return { source, filename };
});
console.log(JSON.stringify({ posts: items.length, styles: [...new Set(items.map(item => item.skill))] }));
if (!process.argv.includes('--apply')) process.exit(0);
fs.copyFileSync(dbPath, dbPath + '.before-styled-' + Date.now() + '.bak');
const imageDir = path.join(dataDir, 'community_images');
fs.mkdirSync(imageDir, { recursive: true });
for (const asset of assets) fs.copyFileSync(asset.source, path.join(imageDir, asset.filename));
fs.writeFileSync(dbPath + '.tmp', JSON.stringify(db, null, 2));
fs.renameSync(dbPath + '.tmp', dbPath);
console.log('已更新 20 张风格成品');
