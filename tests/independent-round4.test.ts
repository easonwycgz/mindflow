import 'fake-indexeddb/auto';
import {beforeEach,afterEach,it,expect} from 'vitest';
import example from '../contracts/mindflow-card-example-v1.json';
import {MindDB,defaults,newReading,type StoredCard} from '../src/db';
import {hash,validateCard,type Branch} from '../src/model';
import {MigrationWorkspace,exportPagedMigration,readExportFile,beginPagedRestore,stagePagedPart,commitPagedRestore,discardMigration} from '../src/pagedMigration';
let source:MindDB,target:MindDB,work:MigrationWorkspace;
beforeEach(()=>{source=new MindDB(crypto.randomUUID());target=new MindDB(crypto.randomUUID());work=new MigrationWorkspace(crypto.randomUUID());});
afterEach(async()=>{await source.delete();await target.delete();await work.delete();});
const snapshot=async(db:MindDB)=>({cards:await db.cards.toArray(),reading:await db.reading.toArray(),settings:await db.settings.toArray()});
async function seed(count:number,large=false){
 const records:StoredCard[]=[];
 for(let i=0;i<count;i++){
  const raw=validateCard({...example,title:`B R4 ${i} 汉字🚀`,branches:[{id:'root',title:'根',summary:'摘要',content:'正文',children:large?Array.from({length:64},(_,j)=>({id:`child${j}`,title:'非ASCII',summary:'摘要',content:'汉字🚀\n'.repeat(1900),children:[]})):[{id:'child0',title:'子',summary:'摘要',content:'内容',children:[]}]}]});
  if(large&&i===0){
   raw.branches[0].children.push(...Array.from({length:4500},(_,j)=>({id:`many${j}`,title:'小节点',summary:'摘要',content:'\\\"汉字🚀',children:[]})));
   const first={id:'chain2',title:'层2',summary:'摘要',content:'层2正文',children:[] as Branch[]};raw.branches[0].children.push(first);let node=first;
   for(let depth=3;depth<=16;depth++){const child={id:`chain${depth}`,title:`层${depth}`,summary:'摘要',content:'深层正文',children:[] as Branch[]};node.children=[child];node=child;}
  }
  const content=validateCard(raw);
  records.push({id:crypto.randomUUID(),content,hash:await hash(content),createdAt:i,updatedAt:i+1});
 }
 await source.cards.bulkAdd(records);await source.reading.bulkAdd(records.map((c,i)=>({...newReading(c.id),section:'tree' as const,nodeId:large&&i===0?'chain16':'child0',favorite:i%2===0,scroll:i})));
 await source.settings.put({...defaults,lastCardId:records.at(-1)!.id,fontSize:'large'});
}
async function roundtrip(){
 const before=await snapshot(source),job=await exportPagedMigration(source,work),manifest=await readExportFile(job.id,0,work);
 expect(new TextEncoder().encode(manifest.text).length).toBeLessThan(16384);
 const restore=await beginPagedRestore(manifest,work);
 for(let i=1;i<=job.parts;i++)await stagePagedPart(restore.id,await readExportFile(job.id,i,work),work);
 await commitPagedRestore(restore.id,target,work);
 expect(await snapshot(target)).toEqual(before);expect(await snapshot(source)).toEqual(before);
 console.log('B-R4 measured',JSON.stringify({cards:job.cards,parts:job.parts,volumeBytes:job.bytes,manifestBytes:new TextEncoder().encode(manifest.text).length,maxPart:job.maxPartBytes,maxBatch:job.maxBatchCards}));
 return job;
}
it('B-R4: independent count-only boundaries 501/2000/2001 preserve full ordered data',async()=>{
 for(const count of [501,2000,2001,10001]){
  await source.cards.clear();await source.reading.clear();await source.settings.clear();await seed(count);
  const job=await roundtrip();if(count<=2001)expect(job.bytes).toBeLessThan(40*1024*1024);expect(job.cards).toBe(count);if(count===10001)expect(job.parts).toBeGreaterThan(20);
 }
},120000);
it('B-R4: capacity-only Unicode libraries near 49MB and larger than stress case roundtrip completely',async()=>{
 for(const count of [34,60]){
  await source.cards.clear();await source.reading.clear();await source.settings.clear();await seed(count,true);
  const job=await roundtrip();expect(job.cards).toBeLessThan(2000);expect(job.bytes).toBeGreaterThan(40*1024*1024);
  if(count===60)expect(job.bytes).toBeGreaterThan(70*1024*1024);
  expect(job.maxPartBytes).toBeLessThanOrEqual(8*1024*1024);expect(job.maxBatchCards).toBeLessThanOrEqual(4);
 }
},120000);
it('B-R4: corrupted staged reading must reject promotion rather than silently change validated backup',async()=>{
 await seed(9);const job=await exportPagedMigration(source,work),restore=await beginPagedRestore(await readExportFile(job.id,0,work),work);
 for(let i=1;i<=job.parts;i++)await stagePagedPart(restore.id,await readExportFile(job.id,i,work),work);
 // Fault injection after verification: only a valid state value changes; original file/chain is unchanged.
 const r=(await work.reading.where('job').equals(restore.id).first())!;r.record.favorite=!r.record.favorite;await work.reading.put(r);
 const sentinel={...(await source.cards.toArray())[0],id:crypto.randomUUID()};await target.cards.add(sentinel);await target.reading.add(newReading(sentinel.id));await target.settings.put({...defaults,lastCardId:sentinel.id});
 const original=await snapshot(target),outcome=await Promise.allSettled([commitPagedRestore(restore.id,target,work)]),after=await snapshot(target);
 console.log('B-R4 staged reading fault',JSON.stringify({outcome:outcome[0].status,targetChanged:JSON.stringify(original)!==JSON.stringify(after),actualState:(await work.jobs.get(restore.id))?.state}));
 expect(outcome[0].status).toBe('rejected');expect(after).toEqual(original);
});
it('B-R4: interrupted sink and no-workspace quota retain source and publish no completion manifest',async()=>{
 await seed(501);const original=await snapshot(source),written:string[]=[];
 await expect(exportPagedMigration(source,work,{sink:async f=>{written.push(f.name);if(written.length===2)throw new DOMException('B disk full','QuotaExceededError');}})).rejects.toThrow();
 expect(written.some(n=>n.endsWith('manifest.json'))).toBe(false);expect(await snapshot(source)).toEqual(original);
 const quota=()=>{throw new DOMException('B staging quota full','QuotaExceededError');};work.jobs.hook('creating',quota);
 await expect(exportPagedMigration(source,work)).rejects.toThrow();expect(await snapshot(source)).toEqual(original);
 work.jobs.hook('creating').unsubscribe(quota);
 const job=await exportPagedMigration(source,work);await discardMigration(job.id,work);expect(await snapshot(source)).toEqual(original);
});
it('B-R4: concurrent duplicate promotion does not duplicate records and completed jobs reject resubmission',async()=>{
 await seed(9);const exported=await exportPagedMigration(source,work),restore=await beginPagedRestore(await readExportFile(exported.id,0,work),work);
 for(let i=1;i<=exported.parts;i++)await stagePagedPart(restore.id,await readExportFile(exported.id,i,work),work);
 const outcomes=await Promise.allSettled([commitPagedRestore(restore.id,target,work),commitPagedRestore(restore.id,target,work)]);
 expect(outcomes.some(r=>r.status==='fulfilled')).toBe(true);expect(await snapshot(target)).toEqual(await snapshot(source));
 await expect(commitPagedRestore(restore.id,target,work)).rejects.toThrow();expect(await target.cards.count()).toBe(9);
});
it('B-R4: a single record larger than the 8MiB volume is illegal under historical 2MiB rules and never truncated',async()=>{
 const content=validateCard({...example,title:'B oversized illegal record'});
 content.branches=[{id:'r',title:'根',summary:'摘要',content:'正文',children:Array.from({length:500},(_,i)=>({id:`b${i}`,title:'节点',summary:'摘要',content:'x'.repeat(19000),children:[]}))}];
 expect(new TextEncoder().encode(JSON.stringify(content)).length).toBeGreaterThan(8*1024*1024);
 const record={id:crypto.randomUUID(),hash:await hash(content),content,createdAt:1,updatedAt:2};await source.cards.add(record);await source.reading.add(newReading(record.id));
 await expect(exportPagedMigration(source,work)).rejects.toThrow(/2 MB/);expect(await source.cards.get(record.id)).toEqual(record);
 const job=(await work.jobs.toArray())[0];await expect(readExportFile(job.id,0,work)).rejects.toThrow(/未完成/);
});
