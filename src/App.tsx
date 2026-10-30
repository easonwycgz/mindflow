import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import example from '../contracts/mindflow-card-example-v1.json';
import { backup, db, defaults, importCard, newReading, restore, type Reading, type Settings, type StoredCard } from './db';
import { MAX_BYTES, type Branch } from './model';
const basis={conversation:'原对话',supplement:'补充说明',needs_verification:'待核实'};
function Tree({nodes,selected,onSelect}:{nodes:Branch[];selected:string|null;onSelect:(id:string)=>void}){
 return <ul className="tree">{nodes.map(n=><li key={n.id}><button aria-pressed={selected===n.id} onClick={()=>onSelect(n.id)}>{n.title}</button><p>{n.summary}</p>{n.children.length>0&&<Tree nodes={n.children} selected={selected} onSelect={onSelect}/>}</li>)}</ul>;
}
function findNode(nodes:Branch[],id:string|null):Branch|undefined{for(const n of nodes){if(n.id===id)return n;const child=findNode(n.children,id);if(child)return child;}}
export default function App(){
 const [cards,setCards]=useState<StoredCard[]>([]),[states,setStates]=useState<Reading[]>([]),[settings,setSettings]=useState<Settings>(defaults);
 const [active,setActive]=useState<string|null>(null),[query,setQuery]=useState(''),[favorites,setFavorites]=useState(false),[message,setMessage]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[online,setOnline]=useState(navigator.onLine);
 const [confirmRestore,setConfirmRestore]=useState(false);const restoreFile=useRef<HTMLInputElement>(null);
 const {offlineReady:[offlineReady],needRefresh:[needRefresh],updateServiceWorker}=useRegisterSW({onRegisterError:()=>setMessage('离线资源安装失败，请保持联网并重新打开。')});
 async function load(){const [c,r,s]=await Promise.all([db.cards.toArray(),db.reading.toArray(),db.settings.get('main')]);setCards(c);setStates(r);if(s){setSettings(s);setActive(s.lastCardId);}setReady(true);}
 useEffect(()=>{void load().catch(()=>{setMessage('无法打开本地数据库。请检查浏览器存储权限，勿清除已有数据。');});const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
 const card=cards.find(c=>c.id===active),reading=states.find(r=>r.cardId===active), node=card?findNode(card.content.branches,reading?.nodeId??null):undefined;
 // Persist scroll after scroll events; flush on pagehide as an additional best effort.
 const readingRef=useRef(reading); readingRef.current=reading;
 useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const save=()=>{const r=readingRef.current;if(r)void db.reading.update(r.cardId,{scroll:window.scrollY}).catch(()=>setMessage('阅读位置保存失败，请导出备份。'));};const scroll=()=>{clearTimeout(timer);timer=setTimeout(save,150);};window.addEventListener('scroll',scroll);window.addEventListener('pagehide',save);return()=>{clearTimeout(timer);window.removeEventListener('scroll',scroll);window.removeEventListener('pagehide',save);};},[]);
 useEffect(()=>{if(ready&&active){void db.reading.get(active).then(r=>window.scrollTo(0,r?.scroll??0));}},[active,ready]);
 async function action(fn:()=>Promise<void>){setBusy(true);try{await fn();}catch(e){setMessage(e instanceof Error?e.message:'操作失败；原数据保留。');}finally{setBusy(false);}}
 async function select(id:string){const s={...settings,lastCardId:id};await db.settings.put(s);setSettings(s);setActive(id);}
 async function state(change:Partial<Reading>){if(!active)return;const r={...(await db.reading.get(active)??newReading(active)),...change};await db.reading.put(r);setStates(prev=>[...prev.filter(x=>x.cardId!==active),r]);}
 async function file(event:ChangeEvent<HTMLInputElement>,isRestore=false){const f=event.target.files?.[0];event.target.value='';if(!f)return;await action(async()=>{if(f.size>(isRestore?40*1024*1024:MAX_BYTES))throw Error('文件过大');if(isRestore){await restore(await f.text());await load();setMessage('备份恢复成功');}else{const c=await importCard(await f.text());await load();await select(c.id);setMessage('卡片已安全导入');}});}
 const visible=cards.filter(c=>(!favorites||states.find(r=>r.cardId===c.id)?.favorite)&&[c.content.title,c.content.summary,...c.content.tags].join(' ').toLowerCase().includes(query.toLowerCase()));
 return <div className={settings.fontSize==='large'?'app large':'app'}>
 <header><a href="#main" className="skip">跳到阅读内容</a><div className="brand">◈ Mindflow <span>慢读，深想</span></div><span className="status">{!online?'离线模式':offlineReady?'可离线阅读':'仅本机存储'}</span></header>
 {needRefresh&&<aside className="notice">新版本已准备好。导入操作结束后可更新。<button disabled={busy} onClick={()=>void updateServiceWorker(true)}>更新应用</button></aside>}
 <div className="layout"><aside className="library"><p className="eyebrow">你的私人知识花园</p><h1>让好奇心<br/>继续生长。</h1><p className="muted">把值得留下的想法，变成随时可读的知识卡片。</p>
 <div className="tools"><label className="button primary">导入卡片<input aria-label="导入卡片" type="file" accept="application/json,.json" disabled={busy||!ready} onChange={e=>void file(e)}/></label><button disabled={busy||!ready} onClick={()=>void action(async()=>{const c=await importCard(JSON.stringify(example));await load();await select(c.id);setMessage('演示卡片已添加');})}>体验示例</button></div>
 <label className="search">搜索知识<input type="search" placeholder="标题、摘要或标签" value={query} onChange={e=>setQuery(e.target.value)}/></label>
 <div className="row"><button aria-pressed={favorites} onClick={()=>setFavorites(!favorites)}>★ 只看收藏</button><button disabled={visible.length<2} onClick={()=>void action(async()=>{const pool=visible.filter(c=>c.id!==active);await select(pool[Math.floor(Math.random()*pool.length)].id);})}>随机一张</button></div>
 <p className="count">{visible.length} 张卡片</p><nav aria-label="卡片列表">{visible.map(c=><button className={'card-link '+(active===c.id?'selected':'')} key={c.id} onClick={()=>void action(()=>select(c.id))}><span>{c.content.tags[0]}</span><strong>{c.content.title}</strong>{states.find(r=>r.cardId===c.id)?.favorite&&' ★'}</button>)}</nav>
 {!visible.length&&<p className="muted">{cards.length?'没有匹配的卡片。':'从一张卡片开始。导入文件，或体验公开示例。'}</p>}
 <details className="storage"><summary>备份、设置与隐私</summary><p>卡片仅保存在此浏览器。清除网站数据、卸载或系统回收存储都可能导致丢失。请定期导出备份。</p><button disabled={!ready||busy} onClick={()=>void action(async()=>{const blob=new Blob([await backup()],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mindflow-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('备份已生成，请妥善保管下载文件');})}>导出完整备份</button><button disabled={!ready||busy} onClick={()=>setConfirmRestore(true)}>恢复备份</button>
 {confirmRestore&&<div role="group" aria-label="确认恢复"><p>恢复将替换当前全部卡片、阅读状态和设置。请先导出备份。</p><button onClick={()=>{setConfirmRestore(false);restoreFile.current?.click();}}>选择备份并替换</button><button onClick={()=>setConfirmRestore(false)}>取消</button></div>}
 <input ref={restoreFile} aria-label="恢复备份文件" hidden type="file" accept=".json" onChange={e=>void file(e,true)}/>
 <label className="font">字号<select value={settings.fontSize} onChange={e=>{const fontSize=e.target.value as Settings['fontSize'];void action(async()=>{const s={...settings,fontSize};await db.settings.put(s);setSettings(s);});}}><option value="normal">标准</option><option value="large">大字</option></select></label><p>无账户、无 AI 调用、无数据上传。不加载远程图片。内容按纯文本安全显示，Markdown 标记会保留。</p></details></aside>
 <main id="main" tabIndex={-1}>{message&&<div role="status" className="notice">{message}<button aria-label="关闭提示" onClick={()=>setMessage('')}>×</button></div>}
 {card&&reading?<article><div className="row"><span className="eyebrow">KNOWLEDGE CARD / 知识卡片</span><button aria-pressed={reading.favorite} onClick={()=>void action(()=>state({favorite:!reading.favorite}))}>{reading.favorite?'★ 已收藏':'☆ 收藏'}</button></div><h2>{card.content.title}</h2><p className="hook">{card.content.hook}</p><div className="tags">{card.content.tags.map(t=><span key={t}>{t}</span>)}</div>
 <nav className="tabs" aria-label="阅读模式">{([['summary','30 秒摘要'],['tree','知识树'],['faq','常见问题']] as const).map(([section,label])=><button key={section} aria-pressed={reading.section===section} onClick={()=>void action(()=>state({section,scroll:0}))}>{label}</button>)}</nav>
 {reading.section==='summary'&&<><h3>01 / 先抓住核心</h3><p className="prose">{card.content.summary}</p><h3>值得带走的想法</h3><ol className="takeaways">{card.content.key_takeaways.map((t,i)=><li key={i}>{t}</li>)}</ol><button className="primary" onClick={()=>void action(()=>state({section:'tree',scroll:0}))}>继续探索知识树 →</button></>}
 {reading.section==='tree'&&<><h3>02 / 沿着问题深入</h3><Tree nodes={card.content.branches} selected={reading.nodeId} onSelect={id=>void action(()=>state({nodeId:id}))}/>{node&&<section className="node" aria-label="节点内容"><h3>{node.title}</h3><p className="prose">{node.content}</p></section>}</>}
 {reading.section==='faq'&&<><h3>03 / 再多问一步</h3>{card.content.faq.map((q,i)=><details className="faq" key={i}><summary>{q.question}</summary><p className="prose">{q.answer}</p><small>{basis[q.basis]}</small></details>)}</>}
 <footer>{card.content.caveats.length>0&&<details><summary>适用边界与提醒</summary>{card.content.caveats.map((c,i)=><p key={i}>{c}</p>)}</details>}<p>来源：{card.content.source.chat_title??'未注明'}{card.content.source.chat_url&&'（来源链接仅作记录，不自动打开）'}</p></footer></article>:<div className="empty"><span>✧</span><h2>为思考留一点空间</h2><p>从左侧导入一张知识卡片，<br/>以摘要开始，沿着知识树深入。</p><p className="muted">首次联网打开并缓存完成后，可离线阅读。</p></div>}
 </main></div><footer className="bottom">Mindflow V1 · 你的想法，留在你的设备上</footer></div>;
}
