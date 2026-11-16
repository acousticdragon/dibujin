#!/usr/bin/env node
/* Servidor Wi-Fi local de Dibuja y adivina — sin dependencias.
   Sirve el juego (carpeta www) y hace de "relé" WebSocket para que los celulares/PC de la misma red
   se conecten sin internet. Uso:  node server/lan-server.js [puerto] [carpeta]                       */
const http=require("http"),fs=require("fs"),path=require("path"),os=require("os"),crypto=require("crypto");
const QR=require("./vendor/QRCode"),QL=require("./vendor/QRCode/QRErrorCorrectLevel");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".css":"text/css",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".ico":"image/x-icon",".webmanifest":"application/manifest+json",".mp3":"audio/mpeg",".mp4":"video/mp4",".woff2":"font/woff2",".txt":"text/plain; charset=utf-8"};
const GUID="258EAFA5-E914-47DA-95CA-C5AB0DC85B11",MAXMSG=8*1024*1024;
function lanIPs(){const o=[],n=os.networkInterfaces();for(const k in n)for(const a of n[k]||[])if(a.family==="IPv4"&&!a.internal)o.push(a.address);return o}
function qrSvg(text){const q=new QR(-1,QL.M);q.addData(String(text).slice(0,300));q.make();const n=q.getModuleCount(),m=4,sz=n+2*m;let d="";for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(q.isDark(r,c))d+=`M${c+m} ${r+m}h1v1h-1z`;return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sz} ${sz}" shape-rendering="crispEdges"><rect width="${sz}" height="${sz}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`}
function frame(sock,op,p){if(sock.destroyed)return;const n=p.length;let h;if(n<126)h=Buffer.from([128|op,n]);else if(n<65536){h=Buffer.alloc(4);h[0]=128|op;h[1]=126;h.writeUInt16BE(n,2)}else{h=Buffer.alloc(10);h[0]=128|op;h[1]=127;h.writeBigUInt64BE(BigInt(n),2)}sock.write(Buffer.concat([h,p]))}
function readFrame(b){if(b.length<2)return null;const fin=!!(b[0]&128),op=b[0]&15,mask=!!(b[1]&128);let len=b[1]&127,off=2;
if(len==126){if(b.length<4)return null;len=b.readUInt16BE(2);off=4}else if(len==127){if(b.length<10)return null;len=Number(b.readBigUInt64BE(2));off=10}
if(len>MAXMSG)return{op:8,fin:true,payload:Buffer.alloc(0),len:b.length};
let mk=null;if(mask){if(b.length<off+4)return null;mk=b.slice(off,off+4);off+=4}
if(b.length<off+len)return null;let p=b.slice(off,off+len);if(mk){p=Buffer.from(p);for(let i=0;i<p.length;i++)p[i]^=mk[i&3]}
return{fin,op,payload:p,len:off+len}}
function start(opt){opt=opt||{};return new Promise((resolve,reject)=>{
const root=path.resolve(opt.root||path.join(__dirname,"..","www")),peers=new Map();let port=opt.port||8766,tries=0;
const server=http.createServer((req,rsp)=>{let u;try{u=decodeURIComponent((req.url||"/").split("?")[0])}catch(e){rsp.writeHead(400);return rsp.end()}
if(u=="/lan.json"){rsp.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});return rsp.end(JSON.stringify({app:"dibuja-lan",port:server.address().port,ips:lanIPs()}))}
if(u=="/qr.svg"){const t=new URL(req.url,"http://x").searchParams.get("u")||"";rsp.writeHead(200,{"content-type":"image/svg+xml","cache-control":"no-store"});return rsp.end(qrSvg(t))}
if(u.endsWith("/"))u+="index.html";const f=path.join(root,path.normalize(u));if(!f.startsWith(root)){rsp.writeHead(403);return rsp.end()}
fs.readFile(f,(e,b)=>{if(e){rsp.writeHead(404,{"content-type":"text/plain; charset=utf-8"});return rsp.end("No encontrado")}rsp.writeHead(200,{"content-type":MIME[path.extname(f).toLowerCase()]||"application/octet-stream","cache-control":"no-cache"});rsp.end(b)})});
function drop(me){if(!me.id||peers.get(me.id)!==me)return;peers.delete(me.id);me.links.forEach(o=>{const t=peers.get(o);if(t){t.links.delete(me.id);t.send({k:"cl",from:me.id})}})}
function onMsg(me,m){if(!m||typeof m!="object")return;
if(m.k=="reg"){if(me.id)return;const want=typeof m.id=="string"&&/^[\w.\-]{1,64}$/.test(m.id)?m.id:null;if(want&&peers.has(want)){me.send({k:"err",type:"unavailable-id"});return}if(peers.size>=500){me.send({k:"err",type:"server-error"});return}const id=want||crypto.randomBytes(5).toString("hex");me.id=id;peers.set(id,me);me.send({k:"open",id});return}
if(!me.id)return;
if(m.k=="conn"){const t=peers.get(m.to);if(!t||t===me){me.send({k:"err",type:"peer-unavailable"});return}t.links.add(me.id);me.links.add(t.id);t.send({k:"conn",from:me.id})}
else if(m.k=="ack"){const t=peers.get(m.to);if(t)t.send({k:"ack",from:me.id})}
else if(m.k=="d"){const t=peers.get(m.to);if(t&&me.links.has(t.id))t.send({k:"d",from:me.id,d:m.d})}
else if(m.k=="cl"){const t=peers.get(m.to);if(t){me.links.delete(m.to);t.links.delete(me.id);t.send({k:"cl",from:me.id})}}}
server.on("upgrade",(req,sock)=>{const key=req.headers["sec-websocket-key"];if(!/^\/ws\b/.test(req.url||"")||!key){sock.destroy();return}
sock.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: "+crypto.createHash("sha1").update(key+GUID).digest("base64")+"\r\n\r\n");
sock.setNoDelay(true);let buf=Buffer.alloc(0),frag=[],alive=true;const me={id:null,links:new Set(),send(o){frame(sock,1,Buffer.from(JSON.stringify(o)))}};
const iv=setInterval(()=>{if(!alive){sock.destroy();return}alive=false;frame(sock,9,Buffer.alloc(0))},25000),done=()=>{drop(me);clearInterval(iv)};
sock.on("data",d=>{buf=Buffer.concat([buf,d]);for(;;){const f=readFrame(buf);if(!f)break;buf=buf.slice(f.len);
if(f.op==8){frame(sock,8,Buffer.alloc(0));sock.end();return}if(f.op==9){frame(sock,10,f.payload);continue}if(f.op==10){alive=true;continue}
if(f.op==1)frag=[f.payload];else if(f.op==0)frag.push(f.payload);else continue;
if(f.fin){let m=null;try{m=JSON.parse(Buffer.concat(frag).toString("utf8"))}catch(e){}frag=[];onMsg(me,m)}}});
sock.on("close",done);sock.on("error",()=>{sock.destroy()})});
server.on("error",e=>{if(e.code=="EADDRINUSE"&&tries++<15){port++;server.listen(port,"0.0.0.0")}else reject(e)});
server.on("listening",()=>resolve({server,port:server.address().port,ips:lanIPs(),root,close:()=>{server.close()}}));
server.listen(port,"0.0.0.0")})}
module.exports={start,lanIPs};
if(require.main===module){start({port:+process.argv[2]||8766,root:process.argv[3]}).then(i=>{console.log("\n  DIBUJA Y ADIVINA — servidor Wi-Fi local activo\n");console.log("  En este equipo:        http://localhost:"+i.port);i.ips.forEach(ip=>console.log("  Que los demás abran:   http://"+ip+":"+i.port));console.log("\n  (Deja esta ventana abierta mientras juegan. Ctrl+C para cerrar)\n")}).catch(e=>{console.error("No se pudo iniciar:",e.message);process.exit(1)})}
