import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import example from '../contracts/mindflow-card-example-v1.json';
import { cardBoundary, hash, MAX_BYTES, parseJSON } from '../src/model';
import { backup, defaults, importCard, MindDB, restore } from '../src/db';
type Envelope = {version:number;checksum:string;payload:{cards:{content:{title:string}}[];reading:unknown[]}};
const clone=()=>structuredClone(example);
let db:MindDB;
beforeEach(()=>{db=new MindDB(crypto.randomUUID());});afterEach(async()=>{await db.delete();});
describe('authoritative contract',()=>{
 it('preserves original bytes',()=>{for(const f of ['mindflow-card-schema-v1.json','mindflow-card-example-v1.json'])expect(readFileSync('contracts/'+f)).toEqual(readFileSync(f));});
 it('accepts example and rejects missing, extra, type and URI errors',()=>{
 expect(cardBoundary.parse(example)).toEqual(example);
 for(const patch of [{title:undefined},{extra:1},{title:3},{schema_version:'2.0'},{source:{chat_title:null,chat_url:'not a URI'}}])expect(()=>cardBoundary.parse({...example,...patch})).toThrow();
 });
 it('rejects duplicate IDs, malformed trees and overdeep trees',()=>{
 const c=clone();c.branches[1].id=c.branches[0].id;expect(()=>cardBoundary.parse(c)).toThrow(/重复/);
 expect(()=>cardBoundary.parse({...example,branches:[{}]})).toThrow();
 const deep=clone();let b=deep.branches[0];for(let i=0;i<17;i++){const child={...structuredClone(b),id:'deep'+i,children:[]};b.children=[child];b=child;}expect(()=>cardBoundary.parse(deep)).toThrow(/深度/);
 });
 it('rejects invalid JSON and oversized input',()=>{expect(()=>parseJSON('{')).toThrow();expect(()=>parseJSON(' '.repeat(MAX_BYTES+1))).toThrow(/过大/);});
 it('hash is independent of key order',async()=>{expect(await hash({a:1,b:2})).toBe(await hash({b:2,a:1}));});
});
describe('IndexedDB integration',()=>{
 it('imports atomically and deduplicates without touching reading state',async()=>{
 const c=await importCard(JSON.stringify(example),db);await db.reading.update(c.id,{favorite:true});
 await expect(importCard(JSON.stringify(example),db)).rejects.toThrow(/已存在/);
 await expect(importCard('{}',db)).rejects.toThrow();expect(await db.cards.count()).toBe(1);expect((await db.reading.get(c.id))?.favorite).toBe(true);
 });
 it('accepts new content as a separate version preserving the original',async()=>{
 const old=await importCard(JSON.stringify(example),db);const next=clone();next.summary+=' 新版本';const updated=await importCard(JSON.stringify(next),db);expect(updated.id).not.toBe(old.id);expect(await db.cards.count()).toBe(2);expect((await db.cards.get(old.id))?.content.summary).toBe(example.summary);
 });
 it('roundtrips all content, reading and settings',async()=>{
 const c=await importCard(JSON.stringify(example),db);await db.reading.update(c.id,{favorite:true,section:'tree',nodeId:'b1-1',scroll:123});await db.settings.put({...defaults,fontSize:'large',lastCardId:c.id});
 const text=await backup(db);await db.cards.clear();await restore(text,db);expect(await backup(db)).toBe(text);
 });
 it('rejects corrupt, unsupported and dangling backups without changing data',async()=>{
 await importCard(JSON.stringify(example),db);const original=await backup(db);
 for(const mutate of [(b:Envelope)=>{b.version=2;},(b:Envelope)=>{b.payload.cards[0].content.title='tampered';},(b:Envelope)=>{b.payload.reading=[];},(b:Envelope)=>{b.payload.cards.push(b.payload.cards[0]);}]){
 const b=JSON.parse(original);mutate(b);if(b.version===1)b.checksum=await hash(b.payload);await expect(restore(JSON.stringify(b),db)).rejects.toThrow();expect(await backup(db)).toBe(original);
 }
 const bad=JSON.parse(original);bad.checksum='0'.repeat(64);await expect(restore(JSON.stringify(bad),db)).rejects.toThrow(/完整性/);
 });
 it('rolls back if a database write fails mid-restore',async()=>{
 await importCard(JSON.stringify(example),db);const text=await backup(db);const hook=()=>{throw Error('simulated storage failure');};db.reading.hook('creating',hook);await expect(restore(text,db)).rejects.toThrow();db.reading.hook('creating').unsubscribe(hook);expect(await backup(db)).toBe(text);
 });
});
