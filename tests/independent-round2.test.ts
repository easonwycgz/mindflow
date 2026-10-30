import 'fake-indexeddb/auto';
import {beforeEach,afterEach,it,expect} from 'vitest';
import example from '../contracts/mindflow-card-example-v1.json';
import {MindDB,importCard,backup,restore,defaults} from '../src/db';
import {hash,validateCard} from '../src/model';
let db:MindDB;
beforeEach(()=>{db=new MindDB(crypto.randomUUID());});
afterEach(async()=>{await db.delete();});
it('B-R2: wide library clears all stores and restores exact data; corrupt variants preserve original',async()=>{
 for(let j=0;j<2;j++){
  const c=structuredClone(example);c.title=`B independent ${j}`;
  c.branches=[{id:'r',title:'根',summary:'摘要',content:'正文',children:Array.from({length:4500},(_,i)=>({id:`n${i}`,title:`节点${i}`,summary:'摘要',content:`合成内容${j}/${i}`,children:[]}))}];
  const card=await importCard(JSON.stringify(c),db);
  await db.reading.update(card.id,{favorite:j===1,section:'tree',nodeId:'n4499',scroll:123+j});
  await db.settings.put({...defaults,lastCardId:card.id,fontSize:'large'});
 }
 const snapshot=async()=>({cards:await db.cards.toArray(),reading:await db.reading.toArray(),settings:await db.settings.toArray()});
 const expected=await snapshot(),text=await backup(db);
 await db.transaction('rw',db.cards,db.reading,db.settings,async()=>{await db.cards.clear();await db.reading.clear();await db.settings.clear();});
 expect(await snapshot()).toEqual({cards:[],reading:[],settings:[]});
 await restore(text,db);expect(await snapshot()).toEqual(expected);
 for(const kind of ['version','checksum','hash','reference']){
  const b=JSON.parse(text);
  if(kind==='version')b.version=2;
  if(kind==='checksum')b.checksum='0'.repeat(64);
  if(kind==='hash')b.payload.cards[0].hash='0'.repeat(64);
  if(kind==='reference')b.payload.reading[0].nodeId='nonexistent';
  if(kind==='hash'||kind==='reference')b.checksum=await hash(b.payload);
  await expect(restore(JSON.stringify(b),db)).rejects.toThrow();expect(await snapshot()).toEqual(expected);
 }
 const hook=()=>{throw Error('B final transaction interruption');};db.settings.hook('creating',hook);
 await expect(restore(text,db)).rejects.toThrow();db.settings.hook('creating').unsubscribe(hook);
 expect(await snapshot()).toEqual(expected);
});
it('B-R2: legacy over-capacity library stays stored but UI backup has no export path',async()=>{
 const seed=await importCard(JSON.stringify(example),db);
 // Model a valid old IndexedDB v1 library; old import had no total card cap.
 await db.cards.clear();await db.reading.clear();
 for(let i=0;i<501;i++){
  const content=validateCard({...example,title:`Legacy synthetic ${i}`});const id=crypto.randomUUID();
  await db.cards.add({...seed,id,content,hash:await hash(content)});
  await db.reading.add({cardId:id,favorite:false,section:'summary',nodeId:null,scroll:0});
 }
 await expect(backup(db)).rejects.toThrow(/500/);
 expect(await db.cards.count()).toBe(501);expect(await db.reading.count()).toBe(501);
});
