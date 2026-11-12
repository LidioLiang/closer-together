const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'index.html'),'utf8');
const topics=JSON.parse(html.match(/<script id="topic-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const friendTopics=JSON.parse(html.match(/<script id="friend-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const app=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const markup=html.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style>[\s\S]*?<\/style>/g,'');
assert.equal((markup.match(/data-level=/g)||[]).length,3);
assert.ok(!/[0-9]/.test(markup.replace(/<[^>]*>/g,'')),'No visible counts, IDs or progress numbers');
assert.ok(!/(?:src|href)="https?:/.test(html),'Standalone file');
class Element{
 constructor(){this.textContent='';this.children=[];this.dataset={};this.attrs={};this.style={};this.hidden=false;this.disabled=false;this.handlers={};const classes=new Set();this.classList={add:s=>classes.add(s),remove:s=>classes.delete(s),contains:s=>classes.has(s)};}
 focus(){this.focused=true;}
 setAttribute(k,v){this.attrs[k]=v;} addEventListener(k,v){this.handlers[k]=v;} replaceChildren(){this.children=[];} append(c){this.children.push(c);}
}
function boot(raw=null,blocked=false,AudioClass=null,startMode='couples',friendRaw=null){
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};get('topic-data').textContent=JSON.stringify(topics);get('friend-data').textContent=JSON.stringify(friendTopics);
 const buttons=['1','2','3'].map(level=>{const e=new Element();e.dataset.level=level;return e;});
 let seq=0;const intervals=new Map(),timeouts=new Map(),events={};const memory={value:raw,values:{'closer-topics-demo-v1':raw,'closer-friends-v1':friendRaw}};
 const modeButtons=['couples','friends'].map(mode=>{const e=get('choose-'+mode);e.dataset.mode=mode;return e;});
 const document={body:new Element(),hidden:false,getElementById:get,querySelectorAll:selector=>selector==='button[data-mode]'?modeButtons:buttons,createElement:()=>new Element(),addEventListener:(k,fn)=>events[k]=fn};
 const context=vm.createContext({console,document,window:{scrollTo(){},AudioContext:AudioClass,matchMedia:()=>({matches:true}),addEventListener:(k,fn)=>events[k]=fn},localStorage:{getItem(k){if(blocked)throw Error('blocked');return k==='closer-topics-sound'?memory.sound??null:memory.values[k]??null;},setItem(k,v){if(blocked)throw Error('blocked');if(k==='closer-topics-sound')memory.sound=v;else {memory.values[k]=v;if(k==='closer-topics-demo-v1')memory.value=v;}}},setInterval:(fn,ms)=>{const id=++seq;intervals.set(id,{fn,ms});return id;},clearInterval:id=>intervals.delete(id),setTimeout:(fn,ms)=>{const id=++seq;timeouts.set(id,{fn,ms});return id;},clearTimeout:id=>timeouts.delete(id)});
 vm.runInContext(app,context);if(startMode)vm.runInContext(`chooseMode('${startMode}')`,context);return {run:s=>vm.runInContext(s,context),get,memory,intervals,timeouts,events,document};
}
(async()=>{
 assert.equal(friendTopics.length,200);assert.equal(new Set(friendTopics.map(q=>q.question)).size,200);
 assert.deepEqual(friendTopics.map(q=>q.question),fs.readFileSync(require('node:path').join(__dirname,'friends-topics.txt'),'utf8').trim().split('\n'));
 assert.deepEqual([1,2,3].map(n=>friendTopics.filter(q=>q.level===n).length),[70,70,60]);
 let welcome=boot(null,false,null,null);assert.equal(welcome.run('view'),'welcome');assert.equal(welcome.intervals.size,0);await welcome.run('draw()');assert.equal(welcome.run('state.seen.length'),0);
 welcome.run("chooseMode('invalid')");assert.equal(welcome.run('view'),'welcome');
 let f=boot();await f.run('draw()');const coupleState=f.run('JSON.stringify(state)');f.run('showWelcome()');assert.equal(f.intervals.size,0);f.run("chooseMode('friends')");assert.equal(f.run('state.seen.length'),0);assert.equal(f.get('mode-title').textContent,'朋友之间');assert.equal(f.run("NAMES['3']"),'相处与期待');
 for(const [level,total] of [['1',70],['2',70],['3',60]]){f.run(`selectLevel('${level}')`);for(let i=0;i<total;i++)await f.run('draw()');assert.equal(f.run('remaining().length'),0);}
 assert.equal(f.run('new Set(state.seen).size'),200);await f.run('draw()');assert.equal(f.run('state.seen.length'),141);assert.equal(f.run("remaining('1').length"),0);assert.equal(f.run("remaining('2').length"),0);
 const friendState=f.run('JSON.stringify(state)');f.run('showWelcome()');f.run("chooseMode('couples')");assert.equal(f.run('JSON.stringify(state)'),coupleState);f.run("chooseMode('friends')");assert.equal(f.run('JSON.stringify(state)'),friendState);
 let restored=boot(coupleState,false,null,'friends',friendState);assert.equal(restored.run('JSON.stringify(state)'),friendState);restored.run("chooseMode('couples')");assert.equal(restored.run('JSON.stringify(state)'),coupleState);
 let blockedFriend=boot(null,true);await blockedFriend.run('draw()');const blockedCouple=blockedFriend.run('state.currentId');blockedFriend.run("chooseMode('friends')");await blockedFriend.run('draw()');blockedFriend.run("chooseMode('couples')");assert.equal(blockedFriend.run('state.currentId'),blockedCouple);blockedFriend.run("chooseMode('friends')");assert.equal(blockedFriend.run('state.seen.length'),1);
 f.run('window.matchMedia=()=>({matches:false})');let completeFriend;f.get('track').animate=()=>({finished:new Promise(resolve=>completeFriend=resolve),cancel(){}});const inFlight=f.run('draw()');f.run('showWelcome()');f.run("chooseMode('couples')");assert.equal(f.run('mode'),'friends');assert.equal(f.run('view'),'chat');assert.equal(f.get('back-home').disabled,true);completeFriend();await inFlight;assert.equal(f.get('back-home').disabled,false);f.run('showWelcome()');assert.equal(f.intervals.size,0);assert.equal(f.get('chat').hidden,true);assert.equal(f.get('sound-toggle').hidden,true);
 console.log('PASS: 200 exact friend questions, 70/70/60 levels, welcome routing, separate progress, legacy couple preservation, blocked-storage mode retention, mode switch during roll guarded.');
 let t=boot();assert.equal(topics.length,199);assert.equal(t.run('remaining().length'),56);assert.equal(t.intervals.size,1);assert.equal([...t.intervals.values()][0].ms,15000);
 for(const [level,total] of [['1',56],['2',82],['3',61]]){
  t.run(`selectLevel('${level}')`);
  for(let i=0;i<total;i++){await t.run('draw()');assert.equal(t.run('BY_ID.get(state.currentId).level'),Number(level));}
  assert.equal(t.run('remaining().length'),0);assert.equal(t.get('draw').textContent,'再聊一轮');
 }
 assert.equal(t.run('new Set(state.seen).size'),199);
 await t.run('draw()');assert.equal(t.run('state.seen.length'),139);assert.equal(t.run('remaining().length'),60);assert.equal(t.run("remaining('1').length"),0);
 const saved=t.memory.value;const current=t.run('state.currentId');t=boot(saved);assert.equal(t.run('state.currentId'),current);
 t.run('rotateTip()');assert.equal(t.get('gentle-text').textContent,'不着急，慢慢来');
 for(let i=0;i<7;i++)t.run('rotateTip()');assert.equal(t.run('tipIndex'),0);
 t.run('window.matchMedia=()=>({matches:false})');t.run('rotateTip()');assert.equal(t.timeouts.size,1);assert.ok(t.get('gentle-text').classList.contains('changing'));
 t.run('rotateTip()');assert.equal(t.timeouts.size,1);const pending=[...t.timeouts.values()][0];pending.fn();assert.equal(t.run('tipIndex'),1);assert.ok(!t.get('gentle-text').classList.contains('changing'));t.timeouts.clear();
 t.run('rotateTip()');assert.equal(t.timeouts.size,1);t.document.hidden=true;t.events.visibilitychange();assert.equal(t.intervals.size,0);assert.equal(t.timeouts.size,0);assert.ok(!t.get('gentle-text').classList.contains('changing'));
 t.document.hidden=false;t.events.visibilitychange();t.events.pageshow();assert.equal(t.intervals.size,1);
 let finish;t.get('track').animate=()=>({finished:new Promise(resolve=>{finish=resolve;}),cancel(){}});
 const spinning=t.run('draw()');assert.equal(t.run('spinning'),true);assert.equal(t.intervals.size,0);const oldTip=t.run('tipIndex');t.run('rotateTip()');assert.equal(t.run('tipIndex'),oldTip);
 const oldSize=t.run('state.seen.length');await t.run('draw()');t.run("selectLevel('1')");assert.equal(t.run('state.level'),'3');finish();await spinning;assert.equal(t.run('state.seen.length'),oldSize+1);assert.equal(t.intervals.size,1);
 assert.equal(t.get('track').children[21].textContent,t.get('question').textContent);
 t=boot('{bad json');await t.run('draw()');assert.equal(t.run('state.seen.length'),1);
 t=boot(null,true);await t.run('draw()');assert.equal(t.get('storage-note').hidden,false);assert.match(t.get('storage-note').textContent,/无法保存/);
 t=boot(JSON.stringify({version:1,level:'all',seen:[4,4,999,'4'],currentId:4}));assert.equal(t.run('state.level'),'1');assert.equal(t.run('state.seen.length'),1);
 console.log('PASS: 199-question dedup, 3-layer selection, per-layer restart, restore, legacy migration, blocked storage, animation guard, final reel position, 15-second tip loop, fade and visibility lifecycle.');
 console.log('PASS: No visible numbers/counters; only same-origin assets.');
 let created=0;const tones=[];
 const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
 class AudioMock{constructor(){created++;this.state='suspended';this.currentTime=10;this.destination={};}resume(){this.state='running';return Promise.resolve();}createGain(){return{gain:param(),connect(){},disconnect(){}};}createOscillator(){const node={frequency:param(),connect(){},disconnect(){},start(time){this.startTime=time;tones.push(this);},stop(time){if(time===undefined)this.stopped=true;}};return node;}}
 t=boot(null,false,AudioMock);assert.equal(created,0,'No autoplay before a gesture');
 await t.run('draw()');await new Promise(setImmediate);assert.ok(tones.length>0,'Reduced-motion button still clicks');
 t.run('window.matchMedia=()=>({matches:false})');let endRoll;
 t.get('track').animate=()=>({currentTime:0,finished:new Promise(resolve=>endRoll=resolve),cancel(){}});
 const soundDraw=t.run('draw()');await Promise.resolve();await Promise.resolve();
 const times=Array.from(t.run('reelTickTimes()'));assert.equal(times.length,20);assert.ok(times.every((x,i)=>!i||x>times[i-1]));assert.ok(times[18]-times[17]>times[2]-times[1]);
 assert.ok(t.run('soundingNodes.size')>10,'Scheduled synchronized roll clicks');
 await t.run('toggleSound()');assert.equal(t.run('soundingNodes.size'),0);assert.equal(t.memory.sound,'off');assert.equal(t.get('sound-toggle').attrs['aria-pressed'],'false');
 await t.run('toggleSound()');assert.ok(t.run('soundingNodes.size')>10,'Re-enabling resumes remaining roll sounds');
 t.document.hidden=true;t.events.visibilitychange();assert.equal(t.run('soundingNodes.size'),0);
 endRoll();await soundDraw;assert.equal(t.run('soundingNodes.size'),0,'No landing sound in background');
 t.document.hidden=false;t.events.visibilitychange();await t.run('toggleSound()');const beforeMuted=tones.length;await t.run("selectLevel('2')");await Promise.resolve();assert.equal(tones.length,beforeMuted);
 class BrokenAudio{constructor(){throw Error('audio unavailable');}}
 t=boot(null,false,BrokenAudio);await t.run('draw()');assert.equal(t.run('state.seen.length'),1);
 console.log('PASS: Gesture-only audio, reduced-motion click, decelerating reel synchronization, mute persistence, mid-roll mute/unmute, background cancellation, graceful audio failure.');
})().catch(e=>{console.error(e);process.exit(1);});
