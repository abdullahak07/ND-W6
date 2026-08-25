import { readFile, writeFile } from 'node:fs/promises';

const file = new URL('./dist/index.html', import.meta.url);
let html = await readFile(file, 'utf8');

const soundCss = `
/* Week 6 sound control */
.sound-toggle{
  flex:0 0 auto;width:42px;height:42px;display:inline-grid;place-items:center;
  border:1px solid var(--line);background:rgba(12,31,49,.76);color:var(--muted);
  border-radius:50%;padding:0;font:700 1rem var(--font-pixel);cursor:pointer;
  transition:.18s ease;box-shadow:none
}
.sound-toggle:hover{color:#fff;border-color:rgba(79,216,255,.58);background:rgba(79,216,255,.10);transform:translateY(-1px)}
.sound-toggle.on{color:var(--green);border-color:rgba(78,224,181,.50);background:rgba(78,224,181,.10)}
.sound-toggle span{line-height:1;filter:saturate(.9)}
@media(max-width:760px){.sound-toggle{width:38px;height:38px}}
`;
if (!html.includes('/* Week 6 sound control */')) {
  html = html.replace('</style>', `${soundCss}\n</style>`);
}

if (!html.includes('id="soundToggle"')) {
  html = html.replace(
    /(<div class="cart-row" id="cartRow">[\s\S]*?<\/div>)/,
    `$1\n    <button class="sound-toggle on" id="soundToggle" type="button" aria-pressed="true" aria-label="Mute game sound" title="Sound"><span id="soundIcon" aria-hidden="true">🔊</span></button>`
  );
}

const audioBlock = `/* ================= AUDIO — restored game sound effects ================= */
let actx = null;
let masterGain = null;
let soundEnabled = true;

async function ensureAudio(){
  try{
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if(!AudioCtx) return false;
    if(!actx){
      actx = new AudioCtx({latencyHint:'interactive'});
      masterGain = actx.createGain();
      masterGain.gain.value = 0.95;
      masterGain.connect(actx.destination);
    }
    if(actx.state !== 'running') await actx.resume();
    return actx.state === 'running';
  }catch(e){
    return false;
  }
}

async function beep(freq,dur,type='sine',volume=.12,glideTo=null){
  if(!soundEnabled) return;
  if(!(await ensureAudio())) return;
  try{
    const now = actx.currentTime + .005;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq,now);
    if(glideTo && glideTo>0) osc.frequency.exponentialRampToValueAtTime(glideTo,now+dur);
    gain.gain.setValueAtTime(Math.max(.001,volume),now);
    gain.gain.exponentialRampToValueAtTime(.0001,now+dur);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(now); osc.stop(now+dur+.02);
  }catch(e){}
}

function sfxClick(){ beep(520,.055,'sine',.10,680); }
function sfxFlip(){ beep(610,.045,'sine',.085,790); }
function sfxStep(){ beep(285,.035,'triangle',.065,325); }
function sfxHit(){ beep(820,.075,'sine',.14,1120); setTimeout(()=>beep(1240,.07,'sine',.11),55); }
function sfxMiss(){ beep(190,.17,'sawtooth',.11,105); }
function sfxWin(){ beep(620,.11,'sine',.13); setTimeout(()=>beep(880,.13,'sine',.13),115); setTimeout(()=>beep(1320,.20,'sine',.15),245); }
function sfxLose(){ beep(260,.22,'triangle',.12,175); setTimeout(()=>beep(120,.34,'sawtooth',.10),145); }
function sfxCoin(){ beep(900,.065,'sine',.13,1240); setTimeout(()=>beep(1580,.11,'sine',.12),70); }
function sfxTone(freq){ beep(freq,.28,'sine',.12); }

function syncSoundUI(){
  const b=document.getElementById('soundToggle');
  const icon=document.getElementById('soundIcon');
  if(!b) return;
  b.classList.toggle('on',soundEnabled);
  b.setAttribute('aria-pressed',String(soundEnabled));
  b.setAttribute('aria-label',soundEnabled?'Mute game sound':'Enable game sound');
  b.title=soundEnabled?'Mute sound':'Enable sound';
  if(icon) icon.textContent=soundEnabled?'🔊':'🔇';
}

async function toggleSound(){
  if(soundEnabled){
    soundEnabled=false;
    syncSoundUI();
    return;
  }
  soundEnabled=true;
  syncSoundUI();
  await ensureAudio();
  sfxCoin();
}

window.addEventListener('DOMContentLoaded',()=>{
  syncSoundUI();
  document.getElementById('soundToggle')?.addEventListener('click',toggleSound);
});

/* Explicitly unlock Web Audio on the first real user gesture. */
document.addEventListener('pointerdown',()=>{ if(soundEnabled) ensureAudio(); },{once:true,capture:true});
document.addEventListener('keydown',()=>{ if(soundEnabled) ensureAudio(); },{once:true,capture:true});

/* Every challenge/restart button gets an audible acknowledgement. */
document.addEventListener('click',e=>{
  if(e.target.closest('.px-btn')) sfxCoin();
});
`;

if (!html.includes('AUDIO — restored game sound effects')) {
  html = html.replace('/* ---------- star/grid background ---------- */', `${audioBlock}\n\n/* ---------- star/grid background ---------- */`);
}

function patch(from,to){
  if(html.includes(from) && !html.includes(to)) html = html.replace(from,to);
}

/* L1 — Memory Match */
patch(
  "if(locked||card.classList.contains('flipped')||card.classList.contains('matched'))return;\n    card.classList.add('flipped');open.push(card);",
  "if(locked||card.classList.contains('flipped')||card.classList.contains('matched'))return;\n    sfxFlip();\n    card.classList.add('flipped');open.push(card);"
);
patch(
  "if(open[0].dataset.pair===open[1].dataset.pair){\n        open.forEach(c=>c.classList.add('matched'));",
  "if(open[0].dataset.pair===open[1].dataset.pair){\n        sfxHit();\n        open.forEach(c=>c.classList.add('matched'));"
);
patch(
  "}else setTimeout(()=>{open.forEach(c=>c.classList.remove('flipped'));open=[];locked=false;},700);",
  "}else {sfxMiss();setTimeout(()=>{open.forEach(c=>c.classList.remove('flipped'));open=[];locked=false;},700);}"
);
patch(
  "function finish(){\n    ov.style.display='flex';ov.innerHTML='<h3>MEMORY CLEARED</h3>",
  "function finish(){\n    sfxWin();\n    ov.style.display='flex';ov.innerHTML='<h3>MEMORY CLEARED</h3>"
);

/* L2 — Conveyor */
patch(
  "if(x>stage.clientWidth-120){clearInterval(timer);lives--;document.getElementById('l2Lives').textContent=lives;spawn();}",
  "if(x>stage.clientWidth-120){clearInterval(timer);sfxMiss();lives--;document.getElementById('l2Lives').textContent=lives;spawn();}"
);
patch(
  "function judge(type){if(!current)return;clearInterval(timer);if(type===current.dataset.type){score+=10;document.getElementById('l2Score').textContent=score;}else{lives--;document.getElementById('l2Lives').textContent=lives;}spawn();}",
  "function judge(type){if(!current)return;clearInterval(timer);if(type===current.dataset.type){sfxHit();score+=10;document.getElementById('l2Score').textContent=score;}else{sfxMiss();lives--;document.getElementById('l2Lives').textContent=lives;}spawn();}"
);
patch(
  "function finish(){clearInterval(timer);if(current)current.remove();ov.style.display='flex';ov.innerHTML='<h3>CONVEYOR COMPLETE</h3>",
  "function finish(){clearInterval(timer);if(current)current.remove();if(lives>0)sfxWin();else sfxLose();ov.style.display='flex';ov.innerHTML='<h3>CONVEYOR COMPLETE</h3>"
);

/* L3 — Source Maze */
patch(
  "if(!active)return;const nr=r+dr,nc=c+dc;if(layout[nr][nc]==='#')return;r=nr;c=nc;place();",
  "if(!active)return;const nr=r+dr,nc=c+dc;if(layout[nr][nc]==='#'){sfxMiss();return;}r=nr;c=nc;place();sfxStep();"
);
patch(
  "if(ch==='G'){score+=20;document.getElementById('l3Score').textContent=score;}",
  "if(ch==='G'){sfxHit();score+=20;document.getElementById('l3Score').textContent=score;}"
);
patch(
  "if(ch==='B'){trust=Math.max(0,trust-25);document.getElementById('l3Trust').textContent=trust;}",
  "if(ch==='B'){sfxMiss();trust=Math.max(0,trust-25);document.getElementById('l3Trust').textContent=trust;}"
);
patch(
  "function finish(){active=false;ov.style.display='flex';ov.innerHTML='<h3>MAZE COMPLETE</h3>",
  "function finish(){active=false;sfxWin();ov.style.display='flex';ov.innerHTML='<h3>MAZE COMPLETE</h3>"
);

/* L4 — Signal Decoder / Simon */
patch(
  "async function flash(){accept=false;input=[];for(const i of seq){pads[i].classList.add('lit');await wait(450);pads[i].classList.remove('lit');await wait(180);}accept=true;}",
  "async function flash(){accept=false;input=[];for(const i of seq){pads[i].classList.add('lit');sfxTone([392,523,659,784][i]);await wait(450);pads[i].classList.remove('lit');await wait(180);}accept=true;}"
);
patch(
  "async function press(i){if(!accept)return;pads[i].classList.add('lit');",
  "async function press(i){if(!accept)return;sfxTone([392,523,659,784][i]);pads[i].classList.add('lit');"
);
patch(
  "function fail(){accept=false;ov.style.display='flex';",
  "function fail(){accept=false;sfxLose();ov.style.display='flex';"
);
patch(
  "function finish(){accept=false;ov.style.display='flex';ov.innerHTML='<h3>SIGNAL DECODED</h3>",
  "function finish(){accept=false;sfxWin();ov.style.display='flex';ov.innerHTML='<h3>SIGNAL DECODED</h3>"
);

/* L5 — Whack the Gap */
patch(
  "function hit(h){if(!active)return;const m=h.querySelector('.whack-mole.up');if(!m)return;if(m.dataset.kind==='gap')score+=10;else score=Math.max(0,score-10);document.getElementById('l5Score').textContent=score;m.classList.remove('up');}",
  "function hit(h){if(!active)return;const m=h.querySelector('.whack-mole.up');if(!m)return;if(m.dataset.kind==='gap'){sfxHit();score+=10;}else{sfxMiss();score=Math.max(0,score-10);}document.getElementById('l5Score').textContent=score;m.classList.remove('up');}"
);
patch(
  "function finish(){active=false;clearInterval(run);clearInterval(clock);[...grid.children].forEach(h=>h.innerHTML='');ov.style.display='flex';",
  "function finish(){active=false;clearInterval(run);clearInterval(clock);sfxWin();[...grid.children].forEach(h=>h.innerHTML='');ov.style.display='flex';"
);

/* L6 — Boss */
patch(
  "function answer(j,b,opts,a){[...opts.children].forEach(x=>x.disabled=true);if(j===a){b.classList.add('correct');boss=Math.max(0,boss-14);}else{b.classList.add('incorrect');opts.children[a].classList.add('correct');player=Math.max(0,player-20);}i++;setTimeout(draw,650);}",
  "function answer(j,b,opts,a){[...opts.children].forEach(x=>x.disabled=true);if(j===a){sfxHit();b.classList.add('correct');boss=Math.max(0,boss-14);}else{sfxMiss();b.classList.add('incorrect');opts.children[a].classList.add('correct');player=Math.max(0,player-20);}i++;setTimeout(draw,650);}"
);
patch(
  "function finish(){arena.querySelectorAll('.boss-ui').forEach(x=>x.remove());ov.style.display='flex';const win=player>0&&boss<=0||player>0&&i>=qs.length;ov.innerHTML=",
  "function finish(){arena.querySelectorAll('.boss-ui').forEach(x=>x.remove());ov.style.display='flex';const win=player>0&&boss<=0||player>0&&i>=qs.length;if(win)sfxWin();else sfxLose();ov.innerHTML="
);

await writeFile(file, html, 'utf8');
console.log('Week 6 game sounds injected into Vercel build.');
