import 'fake-indexeddb/auto';
import {afterEach,beforeEach,it,expect} from 'vitest';
import example from '../contracts/mindflow-card-example-v1.json';
import {MindDB,defaults,newReading,type StoredCard} from '../src/db';
import {validateCard,hash,MAX_BACKUP_BYTES} from '../src/model';
import {exportVolumes,restoreVolumes} from '../src/volumes';
let db:MindDB;
beforeEach(()=>{db=new MindDB(crypto.randomUUID());});afterEach(async()=>{await db.delete();});
async function seed(count:number,wide=false){
 const cards:StoredCard[]=[];
 for(let i=0;i<count;i++){
  const content=validateCard({...example,title:`B R3 boundary ${i}`,branches:[{id:'r',title:'根',summary:'摘要',content:'正文',children:wide?Array.from({length:64},(_,j)=>({id:`c${j}`,title:'节点',summary:'摘要',content:'x'.repeat(19000),children:[]})):[]}]});
  cards.push({id:crypto.randomUUID(),hash:await hash(content),createdAt:1,updatedAt:2,content});
 }
 await db.cards.bulkAdd(cards);await db.reading.bulkAdd(cards.map(c=>newReading(c.id)));
 await db.settings.put({...defaults,lastCardId:cards.at(-1)!.id,fontSize:'large'});return cards;
}
it('B-R3: exact 2000-card set roundtrips, altered manifest rejects, 2001 rejects without losing records',async()=>{
 const cards=await seed(2000);const files=await exportVolumes(db);const manifest=JSON.parse(files[0].text);
 expect(files).toHaveLength(5);expect(manifest.totalCards).toBe(2000);
 const before={cards:await db.cards.toArray(),reading:await db.reading.toArray(),settings:await db.settings.toArray()};
 const bad=structuredClone(files);const changed=JSON.parse(bad[0].text);changed.totalCards=1999;bad[0].text=JSON.stringify(changed);
 await expect(restoreVolumes(bad,db)).rejects.toThrow();expect(await db.cards.toArray()).toEqual(before.cards);
 await db.transaction('rw',db.cards,db.reading,db.settings,async()=>{await db.cards.clear();await db.reading.clear();await db.settings.clear();});
 await restoreVolumes(files.toReversed(),db);
 expect(await db.cards.toArray()).toEqual(before.cards);expect(await db.reading.toArray()).toEqual(before.reading);expect(await db.settings.toArray()).toEqual(before.settings);
 const extra={...cards[0],id:crypto.randomUUID(),content:{...cards[0].content,title:'B 2001'}};extra.hash=await hash(extra.content);
 await db.cards.add(extra);await db.reading.add(newReading(extra.id));
 await expect(exportVolumes(db)).rejects.toThrow(/2000/);expect(await db.cards.count()).toBe(2001);
});
it('B-R3: near-40MiB valid set restores, aggregate oversized export/restore explicitly reject atomically',async()=>{
 const cards=await seed(34,true);const files=await exportVolumes(db);
 const bytes=files.reduce((n,f)=>n+new TextEncoder().encode(f.text).length,0);
 expect(bytes).toBeGreaterThan(39*1024*1024);expect(bytes).toBeLessThanOrEqual(MAX_BACKUP_BYTES);
 await restoreVolumes(files,db);expect(await db.cards.count()).toBe(34);
 expect((await db.cards.toArray()).map(c=>c.hash)).toEqual(cards.toSorted((a,b)=>a.id.localeCompare(b.id)).map(c=>c.hash));
 const extra={...cards[0],id:crypto.randomUUID(),content:{...cards[0].content,title:'B over 40MiB'}};extra.hash=await hash(extra.content);
 await db.cards.add(extra);await db.reading.add(newReading(extra.id));
 await expect(exportVolumes(db)).rejects.toThrow(/40 MB/);expect(await db.cards.count()).toBe(35);
 const oversized=[{name:'oversize.json',text:' '.repeat(MAX_BACKUP_BYTES+1)},...files];
 await expect(restoreVolumes(oversized,db)).rejects.toThrow(/40 MB/);expect(await db.cards.count()).toBe(35);
},60000);
