// 使用临时数据目录验证苹果端所依赖的接口，不接触线上账号、不消耗生图额度。
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const net = require('node:net');
const root = path.resolve(__dirname, '..');
async function main() {
  const port = await new Promise(resolve => { const s=net.createServer(); s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));}); });
  const data = fs.mkdtempSync(path.join(os.tmpdir(),'yizhang-ios-check-'));
  const server = spawn(process.execPath, [path.join(root,'postcard-studio/server.js')], {env:{...process.env, PORT:String(port), POSTCARD_DATA_DIR:data, POSTCARD_OPEN_BROWSER:'0',POSTCARD_API_KEY:''},stdio:'pipe'});
  let log='';server.stdout.on('data',x=>log+=x);server.stderr.on('data',x=>log+=x);
  const base='http://127.0.0.1:'+port;
  let checks=0;
  async function request(route,body,token,expected=200) {
    const r=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const value=await r.json();assert.equal(r.status,expected,route+': '+JSON.stringify(value));checks++;return value;
  }
  try {
    let ready=false;
    for(let i=0;i<50;i++){try{const r=await fetch(base+'/api/health');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
    assert.ok(ready,log);
    const skills=await request('/api/skills');assert.equal(skills.length,10);
    const account=await request('/api/auth/register',{username:'ios_check',password:'local-only-password'});
    const token=account.token;assert.ok(token);
    const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ3sAAAAASUVORK5CYII=';
    const audio={url:'data:audio/mp4;base64,AAAA',name:'接口检查',type:'audio/mp4',duration:1};
    const card={image,originalImage:image,handwriting:image,sentence:'晚霞温柔，归途也会有光。',title:'苹果端接口检查',skill:skills[0].id,tone:'healing',stamp:'一张',audio,backgroundAudio:audio,visibility:'private',editor:{version:1,font:'hand',bilingual:true,stylized:true,layout:'stack',stampColor:'green',createdAt:new Date().toISOString(),ink:{x:.5,y:.6,w:.28,h:.2,color:'#594735',lineWidth:2.5,canvasWidth:600,strokes:[[[1,1],[20,20]]]}}};
    const profile=await request('/api/auth/profile',{nickname:'小汤',bio:'把生活做成明信片',avatar:image},token);assert.ok(profile.profile.avatar);
    const {work}=await request('/api/myworks',card,token);
    assert.equal(work.editor.layout,'stack');assert.equal(work.audio.url,audio.url);assert.ok(work.handwriting);
    assert.equal((await request('/api/myworks?nick=ios_check',undefined,token)).works.length,1);
    const {post}=await request('/api/myworks/'+work.id+'/share',{},token);
    assert.equal((await request('/api/community/posts?page=1&pageSize=12&sort=new')).posts.length,1);
    assert.equal((await request('/api/community/posts/'+post.id+'/like',{},token)).liked,true);
    assert.equal((await request('/api/community/posts/'+post.id+'/favorite',{},token)).collected,true);
    await request('/api/community/posts/'+post.id+'/comments',{content:'这张晚霞收到了'},token);
    const detail=await request('/api/community/posts/'+post.id,undefined,token);assert.equal(detail.post.likes,1);assert.equal(detail.post.commentCount,1);assert.ok(detail.post.collected);
    assert.equal((await request('/api/community/favorites',undefined,token)).posts.length,1);
    assert.equal((await request('/api/community/posts/'+post.id+'/comments')).comments.length,1);
    const payload={...card,preview:image,requestId:require('node:crypto').randomUUID(),keepRecord:true,toName:'朋友',fromName:'小汤'};
    const link=await request('/api/delivery/link',payload,token);
    assert.equal((await request('/api/delivery/link',payload,token)).url,link.url);
    const received=await request('/api/delivery/cards/'+link.code);assert.equal(received.card.toName,'朋友');assert.equal(received.card.audio.url,audio.url);
    await request('/api/delivery/cards/'+link.code+'/open',{});
    assert.equal((await fetch(base+link.url)).status,200);
    await request('/api/myworks/'+work.id+'/update',{visibility:'private'},token);
    await request('/api/community/posts/'+post.id,undefined,token,404);
    await request('/api/myworks/'+work.id+'/delete',{},token);
    assert.equal((await request('/api/myworks?nick=ios_check',undefined,token)).works.length,0);
    await request('/api/auth/logout',{},token);
    await request('/api/community/favorites',undefined,token,401);
    console.log('PASS: '+checks+' backend requests; 10 styles; auth/profile/works/social/link/privacy persistence.');
  } finally {
    server.kill();await new Promise(resolve=>server.once('exit',resolve));
    // 只清理本脚本创建的临时目录。
    if(path.dirname(data)===os.tmpdir() && path.basename(data).startsWith('yizhang-ios-check-')) fs.rmSync(data,{recursive:true,force:true});
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
