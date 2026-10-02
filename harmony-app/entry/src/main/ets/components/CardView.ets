import { Postcard } from '../model/Postcard';

@Component
export struct CardView {
  @Prop card: Postcard = new Postcard();
  @Prop original: boolean = false;
  showHints: boolean = true;
  @State cardWidth: number = 350;
  baseUrl: string = '';
  onPhoto: () => void = () => {};
  draggableInk: boolean = false;
  onInkMove: (x: number, y: number) => void = () => {};
  @State draggingInk: boolean = false;
  @State dragInkX: number = 0.57;
  @State dragInkY: number = 0.69;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private inkStartX: number = 0.57;
  private inkStartY: number = 0.69;

  private source(value: string): string {
    return /^(https?:|data:|file:)/.test(value) ? value : this.baseUrl + value;
  }

  @Builder
  layoutPhoto() {
    if (this.card.image || this.card.originalImage) {
      Image(this.source(this.original ? this.card.originalImage || this.card.image : this.card.image || this.card.originalImage))
        .width('100%').height('100%').objectFit(!this.original && this.card.editor?.stylized ? ImageFit.Contain : ImageFit.Cover).backgroundColor('#F3F0E8')
    } else {
      Text('导入一张照片').fontSize(this.cardWidth * 0.038).fontColor('#9E8C79')
        .width('100%').height('100%').textAlign(TextAlign.Center).backgroundColor('#EEE8DB')
    }
  }

  @Builder
  layoutStamp() {
    Stack() {
      Image($rawfile('postage-' + (this.card.editor?.stampColor || 'brown') + '.svg'))
        .width(this.cardWidth * 0.20).height(this.cardWidth * 0.16).opacity(0.7)
      Text(this.card.stamp || '一张').fontSize(this.cardWidth * 0.022).fontFamily('PostcardHand').fontColor('#82654D')
        .width(this.cardWidth * 0.09).textAlign(TextAlign.Center)
        .position({ x: this.cardWidth * 0.03, y: this.cardWidth * 0.058 })
    }.width(this.cardWidth * 0.20).height(this.cardWidth * 0.16)
  }

  @Builder
  layoutCopy() {
    Text(this.card.sentence || (this.showHints ? '这一面，留给你的话。' : ''))
      .fontColor(this.card.sentence ? '#514335' : '#B5A795')
      .fontFamily(this.card.editor?.font === 'serif' ? 'serif' : this.card.editor?.font === 'sans' ? 'HarmonyOS Sans' : 'PostcardHand')
      .fontSize(this.cardWidth * 0.033).minFontSize(this.cardWidth * 0.019).maxFontSize(this.cardWidth * 0.033)
      .maxLines(10).heightAdaptivePolicy(TextHeightAdaptivePolicy.MIN_FONT_SIZE_FIRST)
      .layoutWeight(1).width('100%')
  }

  @Builder
  layoutDate() {
    Text(new Date(this.card.editor?.createdAt || this.card.createdAt || Date.now()).toLocaleDateString())
      .fontSize(this.cardWidth * 0.018).letterSpacing(2).fontColor('#A7947D').width('100%')
  }

  build() {
    Stack() {
      Image($rawfile('paper.svg')).width('100%').height('100%').objectFit(ImageFit.Fill).opacity(0.5)
      if (this.card.editor?.layout === 'stack') {
        Column({ space: this.cardWidth * 0.025 }) {
          Stack() { this.layoutPhoto() }.width('100%').height('56%').onClick(() => this.onPhoto())
          Row({ space: this.cardWidth * 0.025 }) {
            Column({ space: 4 }) { this.layoutCopy(); this.layoutDate() }.layoutWeight(1).height('100%')
            this.layoutStamp()
          }.width('100%').layoutWeight(1).alignItems(VerticalAlign.Top)
        }.padding(this.cardWidth * 0.04).width('100%').height('100%')
      } else if (this.card.editor?.layout === 'photo') {
        Stack({ alignContent: Alignment.TopEnd }) {
          Stack() { this.layoutPhoto() }.width('100%').height('100%').onClick(() => this.onPhoto())
          this.layoutStamp()
          Column({ space: 4 }) { this.layoutCopy(); this.layoutDate() }
            .width('58%').height('42%').padding(this.cardWidth * 0.022).backgroundColor('#EDFFF9EA')
            .position({ x: this.cardWidth * 0.33, y: this.cardWidth * 0.32 })
        }.padding(this.cardWidth * 0.04).width('100%').height('100%')
      } else {
      Row({ space: this.cardWidth * 0.034 }) {
        Stack({ alignContent: Alignment.BottomStart }) {
          if (this.card.image || this.card.originalImage) {
            Image(this.source(this.original ? this.card.originalImage || this.card.image : this.card.image || this.card.originalImage))
              .width('100%').height('100%').objectFit(!this.original && this.card.editor?.stylized ? ImageFit.Contain : ImageFit.Cover).backgroundColor('#F3F0E8')
          } else {
            Column({ space: 12 }) {
              Image($rawfile('i-image.svg')).width(27).height(27).opacity(0.6)
              Text('导入一张照片').fontSize(this.cardWidth * 0.038).fontColor('#9E8C79').lineHeight(23).textAlign(TextAlign.Center)
              Text('把生活的瞬间，变成明信片').fontSize(this.cardWidth * 0.022).fontColor('#A3947E')
            }.width('100%').height('100%').justifyContent(FlexAlign.Center).backgroundColor('#EEE8DB')
              .border({ width: 1, color: '#D6C6AC', style: BorderStyle.Dashed })
          }
        }.layoutWeight(52).height('100%').onClick(() => this.onPhoto())
        Stack({ alignContent: Alignment.BottomEnd }) {
        Image($rawfile('letter-lines.svg')).width('100%').height('100%').objectFit(ImageFit.Fill).opacity(0.35)
        Column({ space: 8 }) {
          Row() {
            Blank()
            Stack() {
              Image($rawfile('postage-' + (this.card.editor?.stampColor || 'brown') + '.svg')).width(this.cardWidth * 0.23).height(this.cardWidth * 0.185).opacity(0.65)
              Text(this.card.stamp || '一张').fontSize(this.cardWidth * 0.026).fontFamily('PostcardHand').fontColor('#82654D')
                .width(this.cardWidth * 0.105).textAlign(TextAlign.Center).position({ x: this.cardWidth * 0.036, y: this.cardWidth * 0.067 })
            }.width(this.cardWidth * 0.23).height(this.cardWidth * 0.185).rotate({ angle: 9 })
          }.width('100%')
          Text(this.card.sentence || (this.showHints ? '这一面，留给你的话。\n\n也可以什么都不写。' : ''))
            .fontColor(this.card.sentence ? '#514335' : '#B5A795')
            .fontFamily(this.card.editor?.font === 'serif' ? 'serif' : this.card.editor?.font === 'sans' ? 'HarmonyOS Sans' : 'PostcardHand')
            .fontSize(this.cardWidth * 0.035).minFontSize(this.cardWidth * 0.025).maxFontSize(this.cardWidth * 0.035).maxLines(10)
            .heightAdaptivePolicy(TextHeightAdaptivePolicy.MIN_FONT_SIZE_FIRST)
            .layoutWeight(1).width('100%').lineHeight(this.cardWidth * 0.065)
          Text(new Date(this.card.editor?.createdAt || this.card.createdAt || Date.now()).toLocaleDateString())
            .fontSize(this.cardWidth * 0.018).letterSpacing(2).fontColor('#A7947D').width('100%')
        }.width('100%').height('100%')
        if (this.card.audio || this.card.backgroundAudio) {
          Image($rawfile('record.svg')).width(this.cardWidth * 0.12).height(this.cardWidth * 0.12).margin({ right: 3, bottom: 12 })
        }
        }.layoutWeight(48).height('100%')
      }.padding(this.cardWidth * 0.04).width('100%').height('100%')
      }
      if (this.card.editor?.layout !== 'split' && this.card.editor?.layout && (this.card.audio || this.card.backgroundAudio)) {
        Image($rawfile('record.svg')).width(this.cardWidth * 0.10).height(this.cardWidth * 0.10)
          .position({ x: this.cardWidth * 0.055, y: this.cardWidth * 0.49 })
      }
      if (this.card.handwriting) {
        Image(this.source(this.card.handwriting)).objectFit(ImageFit.Contain)
          .draggable(false)
          .width(this.cardWidth * (this.card.editor?.ink?.w ?? 0.28))
          .height(this.cardWidth * 9 / 14 * (this.card.editor?.ink?.h ?? 0.22))
          .position({ x: this.cardWidth * (this.draggingInk ? this.dragInkX : (this.card.editor?.ink?.x ?? 0.57)),
            y: this.cardWidth * 9 / 14 * (this.draggingInk ? this.dragInkY : (this.card.editor?.ink?.y ?? 0.69)) })
          .border({ width: this.draggingInk ? 1 : 0, color: '#AA967A' })
          .onTouch((event: TouchEvent) => {
            if (!this.draggableInk) { return; }
            if (event.type === TouchType.Down && event.touches.length) {
              const point = event.touches[0];
              this.touchStartX = point.windowX; this.touchStartY = point.windowY;
              this.inkStartX = this.card.editor?.ink?.x ?? 0.57;
              this.inkStartY = this.card.editor?.ink?.y ?? 0.69;
              this.dragInkX = this.inkStartX; this.dragInkY = this.inkStartY;
              this.draggingInk = true;
            } else if (event.type === TouchType.Move && this.draggingInk && event.touches.length) {
              const point = event.touches[0];
              const w = this.card.editor?.ink?.w ?? 0.28;
              const h = this.card.editor?.ink?.h ?? 0.22;
              this.dragInkX = Math.max(0, Math.min(1 - w, this.inkStartX + (point.windowX - this.touchStartX) / this.cardWidth));
              this.dragInkY = Math.max(0, Math.min(1 - h, this.inkStartY + (point.windowY - this.touchStartY) / (this.cardWidth * 9 / 14)));
            } else if ((event.type === TouchType.Up || event.type === TouchType.Cancel) && this.draggingInk) {
              this.onInkMove(this.dragInkX, this.dragInkY);
              this.draggingInk = false;
            }
          })
      }
    }.width('100%').aspectRatio(14 / 9).backgroundColor('#FFF9EA')
      .clip(true).borderRadius(3).border({ width: 1, color: '#E4D9C9' })
      .onAreaChange((oldArea: Area, area: Area) => { this.cardWidth = Number(area.width); })
  }
}
