import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDays, validateEvent, reorder, clampPosition, remainingSeconds, loadState, saveState} from '../modules/core.js';
test('October 2026 starts Thursday and includes 31 dates',()=>{const days=calendarDays(2026,9); assert.equal(days[4],'2026-10-01'); assert.equal(days.filter(Boolean).length,31);});
test('rejects reversed time and blank titles',()=>{assert.ok(validateEvent({title:'',date:'2026-10-02',start:'09:00',end:'10:00'}));assert.ok(validateEvent({title:'test',date:'2026-10-02',start:'11:00',end:'10:00'}));assert.equal(validateEvent({title:'test',date:'2026-10-02',start:'09:00',end:'10:00'}),'');});
test('reordering preserves other items and ignores invalid destinations',()=>{assert.deepEqual(reorder(['a','b','c'],0,2),['b','c','a']);assert.deepEqual(reorder(['a','b'],0,-1),['a','b']);});
test('notes cannot leave board bounds',()=>{assert.deepEqual(clampPosition(-20,500,600,400,200,120),{x:0,y:280});});
test('timer uses deadline and stops at zero',()=>{assert.equal(remainingSeconds(10000,7500),3);assert.equal(remainingSeconds(10000,12000),0);});
test('saved empty collections stay empty after reload',()=>{const storage={value:null,getItem(){return this.value;},setItem(k,v){this.value=v;}};const state={events:[],todos:[],notes:[],mails:[]};saveState(storage,state);assert.deepEqual(loadState(storage,{events:[1]}),state);});
