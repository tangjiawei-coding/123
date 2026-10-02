import { common } from '@kit.AbilityKit';
import { fileIo } from '@kit.CoreFileKit';
import { util } from '@kit.ArkTS';
import { Postcard, LocalSession, DraftIndex, DraftEntry, ActiveDraft } from '../model/Postcard';

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

  loadDraft(): Postcard | undefined {
    const active = this.read<ActiveDraft>('draft-current');
    if (active) { return this.read<Postcard>('draft-' + active.id); }
    // 旧版只有一张草稿，第一次升级时迁移，保留旧文件。
    const legacy = this.read<Postcard>('draft');
    if (legacy) { this.saveDraft(legacy); }
    return legacy;
  }

  saveDraft(card: Postcard, activate: boolean = true): void {
    if (!card.draftId) { card.draftId = util.generateRandomUUID(); }
    const name = 'draft-' + card.draftId;
    const previous = this.read<Postcard>(name);
    const content = JSON.stringify(card);
    const index = this.read<DraftIndex[]>('draft-index') || [];
    const meaningful = !!(card.image || card.originalImage || card.sentence || card.handwriting || card.audio || card.backgroundAudio || card.title);
    if (content !== JSON.stringify(previous)) {
      this.write(name, content);
      const others = index.filter((item: DraftIndex) => item.id !== card.draftId);
      if (meaningful) { others.unshift({ id: card.draftId, title: card.title, updatedAt: Date.now() }); }
      this.write('draft-index', JSON.stringify(others));
    }
    if (activate) { const active: ActiveDraft = { id: card.draftId }; this.write('draft-current', JSON.stringify(active)); }
  }

  listDrafts(): DraftEntry[] {
    const index = this.read<DraftIndex[]>('draft-index') || [];
    const entries: DraftEntry[] = [];
    index.forEach((item: DraftIndex) => {
      const card = this.read<Postcard>('draft-' + item.id);
      if (card) { entries.push({ id: item.id, updatedAt: item.updatedAt, card: card }); }
    });
    return entries;
  }

  deleteDraft(id: string): void {
    const index = this.read<DraftIndex[]>('draft-index') || [];
    this.write('draft-index', JSON.stringify(index.filter((item: DraftIndex) => item.id !== id)));
    const path = this.context.filesDir + '/draft-' + id + '.json';
    if (fileIo.accessSync(path)) { fileIo.unlinkSync(path); }
  }
  saveSession(session: LocalSession): void { this.write('session', JSON.stringify(session)); }
  saveWork(card: Postcard): void {
    const works = this.read<Postcard[]>('works') || [];
    const index = works.findIndex((item: Postcard) => item.createdAt === card.createdAt);
    if (index >= 0) { works[index] = card; } else { works.unshift(card); }
    this.write('works', JSON.stringify(works));
  }
}
