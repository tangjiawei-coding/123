// 媒体与编辑状态一起落盘；仅在事务完成后提示保存成功。
const database = new Promise((resolve, reject) => {
  const request = indexedDB.open('postcard-studio-v2', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('drafts');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
database.catch(() => {});
export async function readDraft(key = 'current') {
  const db = await database;
  return new Promise((resolve, reject) => {
    const request = db.transaction('drafts').objectStore('drafts').get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function writeDraft(draft, key = 'current') {
  const snapshot = structuredClone(draft);
  const db = await database;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('drafts', 'readwrite');
    transaction.objectStore('drafts').put(snapshot, key);
    transaction.oncomplete = resolve;
    transaction.onerror = transaction.onabort = () => reject(transaction.error);
  });
}
export function readDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('文件读取失败，请重新选择。'));
    reader.readAsDataURL(blob);
  });
}
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片无法打开，请更换 JPG、PNG 或 WebP 图片。'));
    image.src = src;
  });
}
