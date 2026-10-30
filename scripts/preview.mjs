// Production-only test server that applies the same headers shipped to Cloudflare Pages.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('dist');const rules=[];
for(const line of (await readFile(resolve(root,'_headers'),'utf8')).split('\n')){
 if(!line.trim())continue;
 if(!/^\s/.test(line))rules.push({path:line.trim(),headers:{}});
 else {const index=line.indexOf(':');rules.at(-1).headers[line.slice(0,index).trim()]=line.slice(index+1).trim();}
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 let file=resolve(root,'.'+pathname);if(!file.startsWith(root+'/'))file=resolve(root,'index.html');
 if(!(await stat(file).catch(()=>null))?.isFile())file=resolve(root,'index.html');
 for(const rule of rules)if(rule.path==='/*'||rule.path===pathname||rule.path==='/index.html'&&file.endsWith('/index.html'))for(const [name,value] of Object.entries(rule.headers))res.setHeader(name,value);
 res.setHeader('Content-Type',mime[extname(file)]??'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(500);res.end('Preview error');}}).listen(4173,'0.0.0.0');
