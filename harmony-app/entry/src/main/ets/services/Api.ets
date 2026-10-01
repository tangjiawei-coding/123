import { http } from '@kit.NetworkKit';
import { util } from '@kit.ArkTS';
import { ApiError } from '../model/Postcard';

export class Api {
  baseUrl: string = 'http://120.55.251.74:5123';
  token: string = '';

  absolute(source: string): string {
    if (!source || /^(https?:|data:|file:)/.test(source)) { return source; }
    return this.baseUrl.replace(/\/+$/, '') + '/' + source.replace(/^\/+/, '');
  }

  async imageData(source: string): Promise<string> {
    if (source.startsWith('data:image/')) { return source; }
    const connection = http.createHttp();
    try {
      const response = await connection.request(this.absolute(source), {
        method: http.RequestMethod.GET, expectDataType: http.HttpDataType.ARRAY_BUFFER,
        connectTimeout: 15000, readTimeout: 60000
      });
      if (response.responseCode !== 200) { throw new Error('原照片下载失败，请检查网络'); }
      const headers = response.header as Record<string, string>;
      const mime = (headers['content-type'] || headers['Content-Type'] || 'image/jpeg').split(';')[0];
      if (!mime.startsWith('image/')) { throw new Error('原照片格式不正确'); }
      const bytes = new Uint8Array(response.result as ArrayBuffer);
      return 'data:' + mime + ';base64,' + new util.Base64Helper().encodeToStringSync(bytes);
    } finally { connection.destroy(); }
  }

  async request<T>(path: string, body?: string): Promise<T> {
    const connection = http.createHttp();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) { headers['Authorization'] = 'Bearer ' + this.token; }
    try {
      const response = await connection.request(this.absolute(path), {
        method: body === undefined ? http.RequestMethod.GET : http.RequestMethod.POST,
        header: headers, extraData: body, expectDataType: http.HttpDataType.STRING,
        connectTimeout: 15000, readTimeout: 480000, usingCache: false
      });
      const text = response.result as string;
      if (response.responseCode < 200 || response.responseCode >= 300) {
        let message = '请求失败（' + response.responseCode + '）';
        try { message = (JSON.parse(text) as ApiError).error || message; } catch (_) {}
        throw new Error(message);
      }
      return JSON.parse(text) as T;
    } finally { connection.destroy(); }
  }
}
