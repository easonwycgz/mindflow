import 'fake-indexeddb/auto';
import {afterEach,beforeEach,expect,it} from 'vitest';
import example from '../contracts/mindflow-card-example-v1.json';
import {assertCapacity,backup,defaults,importCard,MindDB,restore,type StoredCard} from '../src/db';
import {MAX_LIBRARY_CARDS,MAX_BACKUP_BYTES} from '../src/model';
let db:MindDB;beforeEach(()=>{db=new MindDB(crypto.randomUUID());});afterEach(async()=>{await db.delete();});
it('QA-001: wide multi-card export -> clear all stores -> restore preserves every byte and reference',async()=>{
 for(let j=0;j<2;j++){
  const c=structuredClone(example);c.title='round2-'+j;c.branches=[{id:'root',title:'根',summary:'摘要',content:'正文',children:Array.from({length:4500},(_,i)=>({id:'node'+i,title:'节点',summary:'摘要',content:'内容',children:[]}))}];
  const stored=await importCard(JSON.stringify(c),db);await db.reading.update(stored.id,{favorite:true,section:'tree',nodeId:'node4499',scroll:222});await db.settings.put({...defaults,fontSize:'large',lastCardId:stored.id});
 }
 const before=await backup(db);await db.transaction('rw',db.cards,db.reading,db.settings,async()=>{await db.cards.clear();await db.reading.clear();await db.settings.clear();});await restore(before,db);expect(await backup(db)).toBe(before);expect(await db.cards.count()).toBe(2);expect((await db.cards.toArray())[0].content.branches[0].children).toHaveLength(4500);
});
it('QA-001: restore interruption at final settings write rolls all stores back',async()=>{
 const c=await importCard(JSON.stringify(example),db);await db.settings.put({...defaults,lastCardId:c.id});const before=await backup(db);
 const hook=()=>{throw Error('interrupted final write');};db.settings.hook('creating',hook);await expect(restore(before,db)).rejects.toThrow('interrupted');db.settings.hook('creating').unsubscribe(hook);expect(await backup(db)).toBe(before);
});
it('QA-001: count/byte capacity is shared and rejects unsafe exports before success',async()=>{
 const c=await importCard(JSON.stringify(example),db);
 expect(()=>assertCapacity(Array.from({length:MAX_LIBRARY_CARDS},()=>c))).not.toThrow();
 expect(()=>assertCapacity(Array.from({length:MAX_LIBRARY_CARDS+1},()=>c))).toThrow(/500/);
 const huge={...c,content:{...example,summary:'x'.repeat(MAX_BACKUP_BYTES)}} as StoredCard;expect(()=>assertCapacity([huge])).toThrow(/40 MB/);
 await db.cards.bulkAdd(Array.from({length:MAX_LIBRARY_CARDS},(_,i)=>({...c,id:crypto.randomUUID(),hash:String(i).padStart(64,'0')})));
 await expect(importCard(JSON.stringify({...example,title:'over limit'}),db)).rejects.toThrow(/500/);expect(await db.cards.count()).toBe(MAX_LIBRARY_CARDS+1);await expect(backup(db)).rejects.toThrow();
});
