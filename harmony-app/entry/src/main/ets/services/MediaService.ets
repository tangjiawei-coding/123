import { common } from '@kit.AbilityKit';
import { camera, cameraPicker } from '@kit.CameraKit';
import { fileIo, fileUri, picker } from '@kit.CoreFileKit';
import { image } from '@kit.ImageKit';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { util } from '@kit.ArkTS';
import { systemShare } from '@kit.ShareKit';
import { uniformTypeDescriptor } from '@kit.ArkData';
import { AudioClip } from '../model/Postcard';

export class MediaService {
  static imageFileData(path: string): string {
    const file = fileIo.openSync(path, fileIo.OpenMode.READ_ONLY);
    try {
      const buffer = new ArrayBuffer(fileIo.statSync(file.fd).size);
      fileIo.readSync(file.fd, buffer);
      return 'data:image/png;base64,' + new util.Base64Helper().encodeToStringSync(new Uint8Array(buffer));
    } finally { fileIo.closeSync(file); }
  }

  static async choosePhoto(context: common.UIAbilityContext, takePhoto: boolean): Promise<string> {
    let uri = '';
    if (takePhoto) {
      const path = context.cacheDir + '/capture.jpg';
      const file = fileIo.openSync(path, fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE);
      fileIo.closeSync(file);
      const result = await cameraPicker.pick(context, [cameraPicker.PickerMediaType.PHOTO], {
        cameraPosition: camera.CameraPosition.CAMERA_POSITION_BACK, saveUri: fileUri.getUriFromPath(path)
      });
      if (result.resultCode !== 0) { return ''; }
      uri = result.resultUri;
    } else {
      const result = await new photoAccessHelper.PhotoViewPicker().select({
        MIMEType: photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE, maxSelectNumber: 1
      });
      uri = result.photoUris[0] || '';
    }
    if (!uri) { return ''; }
    const file = await fileIo.open(uri, fileIo.OpenMode.READ_ONLY);
    const source = image.createImageSource(file.fd);
    let pixels: image.PixelMap | undefined;
    const packer = image.createImagePacker();
    try {
      const info = await source.getImageInfo();
      const ratio = Math.min(1, 1600 / Math.max(info.size.width, info.size.height));
      pixels = await source.createPixelMap({ desiredSize: {
        width: Math.max(1, Math.round(info.size.width * ratio)), height: Math.max(1, Math.round(info.size.height * ratio))
      }});
      const buffer = await packer.packToData(pixels, { format: 'image/jpeg', quality: 88 });
      return 'data:image/jpeg;base64,' + new util.Base64Helper().encodeToStringSync(new Uint8Array(buffer));
    } finally {
      await packer.release();
      if (pixels) { await pixels.release(); }
      await source.release();
      await fileIo.close(file);
    }
  }

  static async cacheImage(context: common.UIAbilityContext, pixels: image.PixelMap): Promise<string> {
    const packer = image.createImagePacker();
    try {
      const bytes = await packer.packToData(pixels, { format: 'image/png', quality: 100 });
      const path = context.cacheDir + '/postcard-' + Date.now() + '.png';
      const file = fileIo.openSync(path, fileIo.OpenMode.CREATE | fileIo.OpenMode.WRITE_ONLY | fileIo.OpenMode.TRUNC);
      try { fileIo.writeSync(file.fd, bytes); } finally { fileIo.closeSync(file); }
      return path;
    } finally { await packer.release(); await pixels.release(); }
  }

  static async saveToAlbum(context: common.UIAbilityContext, path: string): Promise<boolean> {
    const helper = photoAccessHelper.getPhotoAccessHelper(context);
    try {
      const uris = await helper.showAssetsCreationDialog([fileUri.getUriFromPath(path)], [{
        title: '一张-' + Date.now(), fileNameExtension: 'png', photoType: photoAccessHelper.PhotoType.IMAGE
      }]);
      if (!uris.length) { return false; }
      const source = fileIo.openSync(path, fileIo.OpenMode.READ_ONLY);
      const target = fileIo.openSync(uris[0], fileIo.OpenMode.READ_WRITE);
      try { await fileIo.copyFile(source.fd, target.fd); }
      finally { fileIo.closeSync(source); fileIo.closeSync(target); }
      return true;
    } finally { await helper.release(); }
  }

  static async share(context: common.UIAbilityContext, path: string, link: boolean = false): Promise<void> {
    const data = new systemShare.SharedData(link ? {
      utd: uniformTypeDescriptor.UniformDataType.HYPERLINK, content: path, title: '给你的一张明信片'
    } : {
      utd: uniformTypeDescriptor.UniformDataType.PNG, uri: fileUri.getUriFromPath(path), title: '一张明信片'
    });
    await new systemShare.ShareController(data).show(context, { previewMode: systemShare.SharePreviewMode.DETAIL });
  }

  static readAudio(path: string, type: string, name: string, duration: number = 0): AudioClip {
    const file = fileIo.openSync(path, fileIo.OpenMode.READ_ONLY);
    try {
      const size = fileIo.statSync(file.fd).size;
      if (size > 10 * 1024 * 1024) { throw new Error('请选择 10MB 以内的音频'); }
      const buffer = new ArrayBuffer(size);
      fileIo.readSync(file.fd, buffer);
      return { url: 'data:' + type + ';base64,' + new util.Base64Helper().encodeToStringSync(new Uint8Array(buffer)), type, name, duration };
    } finally { fileIo.closeSync(file); }
  }

  static async chooseAudio(context: common.UIAbilityContext): Promise<AudioClip | undefined> {
    const uris = await new picker.DocumentViewPicker(context).select({ maxSelectNumber: 1,
      fileSuffixFilters: ['音频文件|.mp3,.m4a,.wav,.aac'] });
    if (!uris.length) { return undefined; }
    const name = decodeURIComponent(uris[0].split('/').pop() || '背景声音');
    const type = name.endsWith('.wav') ? 'audio/wav' : name.endsWith('.mp3') ? 'audio/mpeg' : name.endsWith('.aac') ? 'audio/aac' : 'audio/mp4';
    return MediaService.readAudio(uris[0], type, name);
  }
}
