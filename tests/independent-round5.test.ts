import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import example from '../contracts/mindflow-card-example-v1.json';
import {MindDB,defaults,newReading} from '../src/db';
import {hash,validateCard} from '../src/model';
import {MigrationWorkspace,exportPagedMigration,readExportFile,beginPagedRestore,stagePagedPart,commitPagedRestore} from '../src/pagedMigration';
let source:MindDB,target:MindDB,work:MigrationWorkspace;
beforeEach(()=>{source=new MindDB(crypto.randomUUID());target=new MindDB(crypto.randomUUID());work=new MigrationWorkspace(crypto.randomUUID());});
afterEach(async()=>{vi.restoreAllMocks();await source.delete();await target.delete();await work.delete();});
const snapshot=async(db:MindDB)=>({cards:await db.cards.toArray(),reading:await db.reading.toArray(),settings:await db.settings.toArray()});
async function prepare(){
 for(let i=0;i<9;i++){
  const content=validateCard({...example,title:`B R5 ${i}`}),id=crypto.randomUUID();
  await source.cards.add({id,hash:await hash(content),content,createdAt:i,updatedAt:i+1});
  await source.reading.add({...newReading(id),favorite:i%2===0,section:'tree',nodeId:'b1-1'});
 }
 const first=(await source.cards.toArray())[0];await source.settings.put({...defaults,fontSize:'large',lastCardId:first.id});
 const sentinel={...first,id:crypto.randomUUID()};await target.cards.add(sentinel);await target.reading.add(newReading(sentinel.id));await target.settings.put({...defaults,lastCardId:sentinel.id});
 const exported=await exportPagedMigration(source,work),job=await beginPagedRestore(await readExportFile(exported.id,0,work),work);
 for(let i=1;i<=exported.parts;i++)await stagePagedPart(job.id,await readExportFile(exported.id,i,work),work);
 return job;
}
it('B-R5: real staged mutation after preflight but before destination transaction rejects with exact rollback',async()=>{
 const job=await prepare(),before=await snapshot(target),originalTransaction=target.transaction.bind(target);
 const intercepted=vi.spyOn(target,'transaction');let changed=false;
 intercepted.mockImplementationOnce((...args:Parameters<typeof target.transaction>)=>{
  return Dexie.Promise.resolve((async()=>{const row=(await work.reading.where('job').equals(job.id).first())!;row.record.favorite=!row.record.favorite;await work.reading.put(row);changed=true;})()).then(()=>originalTransaction(...args));
 });
 await expect(commitPagedRestore(job.id,target,work)).rejects.toThrow(/完整性/);expect(changed).toBe(true);expect(await snapshot(target)).toEqual(before);
});
it('B-R5: after private batch validation, committed external content+reading mutation cannot pollute actual writes',async()=>{
 const job=await prepare(),expected=await snapshot(source),peer=new MigrationWorkspace(work.name);await peer.open();
 const add=target.reading.bulkAdd.bind(target.reading);let changed=false;
 vi.spyOn(target.reading,'bulkAdd').mockImplementationOnce((...args)=>Dexie.Promise.resolve(Dexie.waitFor(Dexie.ignoreTransaction(async()=>{
  const card=(await peer.cards.where('job').equals(job.id).first())!,state=(await peer.reading.get([job.id,card.id]))!;
  card.record.content.branches[0].children[0].content+='后快照变化';card.record.updatedAt+=10;card.record.hash=await hash(card.record.content);card.hash=card.record.hash;
  state.record.favorite=!state.record.favorite;state.record.scroll=991;
  await peer.transaction('rw',peer.cards,peer.reading,async()=>{await peer.cards.put(card);await peer.reading.put(state);});changed=true;
 }))).then(()=>add(...args)));
 await commitPagedRestore(job.id,target,work);expect(changed).toBe(true);expect(await snapshot(target)).toEqual(expected);peer.close();
});
it('B-R5: after final proof verification, external proof changes do not replace the already verified settings snapshot',async()=>{
 const job=await prepare(),expected=await snapshot(source),put=target.settings.put.bind(target.settings);let changed=false;
 vi.spyOn(target.settings,'put').mockImplementationOnce((...args)=>Dexie.Promise.resolve(Dexie.waitFor(Dexie.ignoreTransaction(async()=>{
  const row=(await work.files.get([job.id,0]))!,root=JSON.parse(row.text);root.settings.fontSize='normal';const {checksum:_old,...body}=root;void _old;root.checksum=await hash(body);row.text=JSON.stringify(root);await work.files.put(row);changed=true;
 }))).then(()=>put(...args)));
 await commitPagedRestore(job.id,target,work);expect(changed).toBe(true);expect(await snapshot(target)).toEqual(expected);
});
it('B-R5: cancel after real batch writes rolls back all destination stores and permits pristine retry',async()=>{
 const job=await prepare(),before=await snapshot(target),controller=new AbortController();let writes=0;target.cards.hook('creating',()=>{writes++;});
 await expect(commitPagedRestore(job.id,target,work,{signal:controller.signal,onProgress:()=>controller.abort()})).rejects.toThrow(/取消/);
 expect(writes).toBeGreaterThan(0);expect(await snapshot(target)).toEqual(before);
 await commitPagedRestore(job.id,target,work);expect(await snapshot(target)).toEqual(await snapshot(source));
});
