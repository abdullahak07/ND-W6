import { readFile, writeFile } from 'node:fs/promises';

const file = new URL('./dist/index.html', import.meta.url);
let html = await readFile(file, 'utf8');

const soundCss = `
/* Week 6 sound control */
.sound-toggle{
  flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;
  border:1px solid var(--line);background:rgba(12,31,49,.76);color:var(--muted);
  border-radius:999px;padding:9px 13px;font:700 .72rem var(--font-pixel);cursor:pointer;
  transition:.18s ease;white-space:nowrap
}
.sound-toggle:hover{color:#fff;border-color:rgba(79,216,255,.52);background:rgba(79,216,255,.08)}
.sound-toggle.on{color:var(--green);border-color:rgba(78,224,181,.42);background:rgba(78,224,181,.08)}
.sound-toggle .sound-dot{width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 12px currentColor}
@media(max-width:760px){.sound-toggle{padding:8px 10px}.sound-toggle #soundLabel{display:none}}
`;
if (!html.includes('.sound-toggle{')) {
  html = html.replace('</style>', `${soundCss}\n</style>`);
}

if (!html.includes('id="soundToggle"')) {
  html = html.replace(
    /(<div class="cart-row" id="cartRow">[\s\S]*?<\/div>)/,
    `$1\n    <button class="sound-toggle on" id="soundToggle" type="button" aria-pressed="true" aria-label="Toggle game sound"><span class="sound-dot"></span><span id="soundLabel">Sound on</span></button>`
  );
}

const audioBlock = `/* ================= AUDIO — restored game sound effects ================= */
let actx = null;
let soundEnabled = localStorage.getItem("ndw6-sound") !== "off";
let masterGain = null;
function ensureAudio(){
  try{
    if(!actx){
      actx = new (window.AudioContext||window.webkitAudioContext)();
      masterGain = actx.createGain();
      masterGain.gain.value = 0.78;
      masterGain.connect(actx.destination);
    }
    if(actx.state === "suspended") actx.resume();
    return true;
  }catch(e){ return false; }
}
function beep(freq, dur, type, volume=0.07, glideTo=null){
  if(!soundEnabled || !ensureAudio()) return;
  try{
    const now=actx.currentTime;
    const osc=actx.createOscillator();
    const gain=actx.createGain();
    osc.type=type||"sine";
    osc.frequency.setValueAtTime(freq,now);
    if(glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo,now+dur);
    gain.gain.setValueAtTime(Math.max(volume,0.0002),now);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+dur);
    osc.connect(gain); gain.connect(masterGain||actx.destination);
    osc.start(now); osc.stop(now+dur+0.015);
  }catch(e){}
}
function sfxFlip(){ beep(520,0.045,"sine",0.04,690); }
function sfxStep(){ beep(260,0.025,"sine",0.02,285); }
function sfxHit(){ beep(780,0.065,"sine",0.065,1080); setTimeout(()=>beep(1180,0.055,"sine",0.04),45); }
function sfxMiss(){ beep(190,0.14,"sawtooth",0.05,105); }
function sfxWin(){ beep(660,0.10,"sine",0.06); setTimeout(()=>beep(880,0.12,"sine",0.06),105); setTimeout(()=>beep(1320,0.18,"sine",0.07),225); }
function sfxLose(){ beep(260,0.20,"triangle",0.055,180); setTimeout(()=>beep(135,0.28,"sawtooth",0.04),130); }
function sfxCoin(){ beep(880,0.055,"sine",0.055,1200); setTimeout(()=>beep(1568,0.09,"sine",0.05),58); }
function sfxTone(freq){ beep(freq,0.25,"sine",0.05); }
function syncSoundUI(){
  const b=document.getElementById("soundToggle"), label=document.getElementById("soundLabel");
  if(!b) return;
  b.classList.toggle("on",soundEnabled);
  b.setAttribute("aria-pressed",String(soundEnabled));
  if(label) label.textContent=soundEnabled?"Sound on":"Sound off";
}
function toggleSound(){
  soundEnabled=!soundEnabled;
  localStorage.setItem("ndw6-sound",soundEnabled?"on":"off");
  syncSoundUI();
  if(soundEnabled){ ensureAudio(); sfxCoin(); }
}
window.addEventListener("DOMContentLoaded",()=>{
  syncSoundUI();
  document.getElementById("soundToggle")?.addEventListener("click",toggleSound);
});
document.addEventListener("pointerdown",()=>{ if(soundEnabled) ensureAudio(); },{once:true,capture:true});
document.addEventListener("keydown",()=>{ if(soundEnabled) ensureAudio(); },{once:true,capture:true});
`;

const audioRe = /\/\* ================= AUDIO \(tiny synthesized beeps\) ================= \*\/[\s\S]*?\/\* ================= HUD SCROLL SPY \+ PROGRESS ================= \*\//;
if (audioRe.test(html)) {
  html = html.replace(audioRe, `${audioBlock}\n/* ================= HUD SCROLL SPY + PROGRESS ================= */`);
}

if (!html.includes('sfxFlip();\n    card.classList.add("flipped")')) {
  html = html.replace(
    'if(lock || card.classList.contains("flipped") || card.classList.contains("matched") || flipped.length>=2) return;\n    card.classList.add("flipped");',
    'if(lock || card.classList.contains("flipped") || card.classList.contains("matched") || flipped.length>=2) return;\n    sfxFlip();\n    card.classList.add("flipped");'
  );
}
if (!html.includes('pos = {x:nx,y:ny};\n    sfxStep();')) {
  html = html.replace(
    'pos = {x:nx,y:ny};\n    updatePlayerPos();',
    'pos = {x:nx,y:ny};\n    sfxStep();\n    updatePlayerPos();'
  );
}

await writeFile(file, html, 'utf8');
console.log('Week 6 sound effects restored.');
