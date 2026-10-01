import { common } from '@kit.AbilityKit';
import { fileIo } from '@kit.CoreFileKit';
import { Postcard, LocalSession } from '../model/Postcard';

export class LocalStore {
  private context: common.UIAbilityContext;
  constructor(context: common.UIAbilityContext) { this.context = context; }

  read<T>(name: string): T | undefined {
    const path = this.context.filesDir + '/' + name + '.json';
    if (!fileIo.accessSync(path)) { return undefined; }
    return JSON.parse(fileIo.readTextSync(path)) as T;
  }

  write(name: string, value: string): void {
    const path = this.context.filesDir + '/' + name + '.json';
    // 写完临时文件再替换，避免退出时留下半份草稿。
    const temp = path + '.tmp';
    const file = fileIo.openSync(temp, fileIo.OpenMode.CREATE | fileIo.OpenMode.WRITE_ONLY | fileIo.OpenMode.TRUNC);
    try { fileIo.writeSync(file.fd, value); } finally { fileIo.closeSync(file); }
    fileIo.renameSync(temp, path);
  }

  saveDraft(card: Postcard): void { this.write('draft', JSON.stringify(card)); }
  saveSession(session: LocalSession): void { this.write('session', JSON.stringify(session)); }
  saveWork(card: Postcard): void {
    const works = this.read<Postcard[]>('works') || [];
    const index = works.findIndex((item: Postcard) => item.createdAt === card.createdAt);
    if (index >= 0) { works[index] = card; } else { works.unshift(card); }
    this.write('works', JSON.stringify(works));
  }
}
