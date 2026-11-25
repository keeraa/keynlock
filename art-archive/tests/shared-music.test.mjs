import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getSharedMusicPlayer as corePlayer,MUSIC_STORAGE_KEYS} from '../../js/3d/core/audio/music-player.js';
import {getSharedMusicPlayer as archivePlayer} from '../vendor/shared-music/music-player.js';
import {musicTracksWithUrls} from '../vendor/shared-music/music-tracks.js';
import {mountMusicControls} from '../vendor/shared-music/music-controls.js';

function fixture(initial={}){
 const data=new Map(Object.entries(initial)),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
 const browser=new EventTarget(),doc=new EventTarget();browser.document=doc;doc.hidden=false;doc.activeElement=null;
 class Element extends EventTarget{
  constructor(tag){super();this.tagName=tag;this.ownerDocument=doc;this.dataset={};this.attrs={};this.classList={add(){}};this.children=[];}
  setAttribute(name,value){this.attrs[name]=String(value);}
  replaceChildren(...children){this.children=children;}
 }
 doc.createElement=tag=>new Element(tag);
 const audios=[];
 browser.Audio=class extends EventTarget{
  constructor(){super();this.currentTime=0;this.paused=true;this.readyState=1;this.duration=300;audios.push(this);}
  set src(value){this.url=value;this.currentTime=0;}
  play(){this.paused=false;this.dispatchEvent(new Event('play'));return Promise.resolve();}
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
 };
 const tracks=musicTracksWithUrls(file=>'assets/music/'+file);
 return {browser,doc,storage,data,audios,tracks};
}
test('archive vendors exactly the Lair player, controls, stylesheet, catalogue and recordings',()=>{
 for(const file of ['music-player.js','music-controls.js','music-tracks.js','music-controls.css'])
  assert.deepEqual(fs.readFileSync(new URL('../vendor/shared-music/'+file,import.meta.url)),fs.readFileSync(new URL('../../js/3d/core/audio/'+file,import.meta.url)),file);
 for(const {file} of musicTracksWithUrls(file=>file))
  assert.deepEqual(fs.readFileSync(new URL('../assets/music/'+file,import.meta.url)),fs.readFileSync(new URL('../../js/3d/scenes/key-archive/dist/assets/music/'+file,import.meta.url)),file);
});
test('the Lair module and static archive module return one player and preserve the saved pause/playhead',()=>{
 const file='chopin-nocturne-op9-no2.mp3';
 const f=fixture({[MUSIC_STORAGE_KEYS.position]:JSON.stringify({track:file,seconds:43.2}),[MUSIC_STORAGE_KEYS.volume]:'42',[MUSIC_STORAGE_KEYS.stopped]:'1'});
 const lair=corePlayer(f.browser,f.storage,{tracks:f.tracks}),archive=archivePlayer(f.browser,f.storage,{tracks:f.tracks});
 assert.equal(lair,archive);archive.start();assert.equal(f.audios.length,0);
 archive.play();assert.equal(f.audios.length,1);assert.equal(f.audios[0].currentTime,43.2);assert.equal(f.audios[0].volume,.42);
 lair.pause();assert.equal(archive.getState().stopped,true);assert.equal(f.audios[0].paused,true);
});
test('both control mounts operate the same music instance and follow track/volume changes',()=>{
 const f=fixture(),music=archivePlayer(f.browser,f.storage,{tracks:f.tracks});
 const top=f.doc.createElement('div'),panel=f.doc.createElement('div');
 const unmountTop=mountMusicControls(top,music),unmountPanel=mountMusicControls(panel,music,{volume:true});
 top.children[1].dispatchEvent(new Event('click')); // pause the shared player
 assert.equal(panel.children[1].attrs['aria-pressed'],'false');
 panel.children[1].dispatchEvent(new Event('click'));
 assert.equal(f.audios.length,1);assert.equal(top.children[1].attrs['aria-pressed'],'true');
 top.children[2].dispatchEvent(new Event('click'));
 assert.equal(top.children[3].textContent,panel.children[3].textContent);
 assert.equal(music.getState().track,1);
 f.doc.activeElement=panel.children[4];panel.children[4].value='60';panel.children[4].dispatchEvent(new Event('input'));
 assert.equal(music.getVolume(),60);assert.equal(f.audios[0].volume,.6);
 unmountTop();unmountPanel();assert.equal(f.audios[0].paused,false);
});
