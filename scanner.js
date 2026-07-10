// 24/7 Crypto signály – běží na GitHub Actions, posílá do Telegramu (skupiny).
// Node 18+ (vestavěné fetch). Bez závislostí.
const fs = require('fs');

// ===== NASTAVENÍ =====
const COINS = ['BTCUSDT','ETHUSDT','SOLUSDT','BANANAUSDT','LTCUSDT','HMSTRUSDT','AAVEUSDT',
  'APEUSDT','ARBUSDT','XRPUSDT','PUMPUSDT','DOGEUSDT','DYDXUSDT','ZECUSDT','LITUSDT','SUIUSDT',
  'LDOUSDT','PAXGUSDT','NEARUSDT','PENDLEUSDT','HYPEUSDT','JUPUSDT','BNBUSDT','GRAMUSDT','UNIUSDT',
  'ADAUSDT','WLDUSDT','TIAUSDT','VVVUSDT','MONUSDT','SKYUSDT','KAITOUSDT','BLURUSDT','TNSRUSDT',
  'CELOUSDT','MANTAUSDT','GASUSDT','FOGOUSDT','WLFIUSDT','MORPHOUSDT'];
const MIN_WIN = 58;                 // posílat slušné signály – úspěšnost >= 58 % (realistické)
const COOLDOWN_MS = 3*60*60*1000;   // stejný signál znovu až po 3 h (ať to nespamuje)
const STATE_FILE = 'state.json';

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT  = process.env.TELEGRAM_CHAT;

// ===== indikátory (stejné jako v appce) =====
function ema(v,p){const k=2/(p+1);let e=v[0];const o=[e];for(let i=1;i<v.length;i++){e=v[i]*k+e*(1-k);o.push(e)}return o}
function rsi(c,p=14){let g=0,l=0;for(let i=1;i<=p;i++){const d=c[i]-c[i-1];d>=0?g+=d:l-=d}
  let ag=g/p,al=l/p;const o=new Array(p).fill(null);o.push(100-100/(1+ag/(al||1e-9)));
  for(let i=p+1;i<c.length;i++){const d=c[i]-c[i-1];ag=(ag*(p-1)+(d>0?d:0))/p;al=(al*(p-1)+(d<0?-d:0))/p;o.push(100-100/(1+ag/(al||1e-9)))}return o}
function macd(c){const a=ema(c,12),b=ema(c,26);const line=c.map((_,i)=>a[i]-b[i]);const s=ema(line,9);return{hist:line.map((v,i)=>v-s[i])}}
function atr(h,l,c,p=14){const tr=[h[0]-l[0]];for(let i=1;i<c.length;i++)tr.push(Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])));return ema(tr,p)}
function avg(a){return a.reduce((s,x)=>s+x,0)/a.length}
function fmt(n){if(n>=1000)return n.toLocaleString('en-US',{maximumFractionDigits:0});if(n>=1)return n.toFixed(2);return n.toPrecision(4)}
function fmtTime(h){if(h<1)return Math.round(h*60)+' min';if(h<48)return h.toFixed(1)+' h';return (h/24).toFixed(1)+' dní'}

function analyze(K,nudge){
  nudge=nudge||0;
  const{c,h,l,v}=K,i=c.length-1,price=c[i];
  const e20=ema(c,20),e50=ema(c,50),e200=ema(c,200),R=rsi(c),M=macd(c),A=atr(h,l,c);
  const rN=R[i],mH=M.hist[i],mHp=M.hist[i-1],aN=A[i];
  const vel3=(price-c[i-3])/c[i-3];
  const volSpike=v[i]/(avg(v.slice(-21,-1))||1);
  const swingHi=Math.max(...h.slice(i-20,i)), swingLo=Math.min(...l.slice(i-20,i));
  const C4=[],H4=[],L4=[];
  for(let j=0;j<c.length;j+=4){const cc=c.slice(j,j+4);if(!cc.length)break;
    C4.push(cc[cc.length-1]);H4.push(Math.max(...h.slice(j,j+4)));L4.push(Math.min(...l.slice(j,j+4)));}
  const e4=ema(C4,Math.min(30,Math.max(2,C4.length-1)));
  const htf=C4[C4.length-1]>e4[e4.length-1]?1:-1;
  const win=c.slice(-20), sma=avg(win), sd=Math.sqrt(avg(win.map(x=>(x-sma)*(x-sma))))||1e-9;
  const bbUp=sma+2*sd, bbLo=sma-2*sd;
  const bearDiv=price>c[i-14]&&rN<R[i-14]&&rN>58, bullDiv=price<c[i-14]&&rN>R[i-14]&&rN<42;
  let s=0;
  s+=e20[i]>e50[i]?1:-1; s+=price>e200[i]?1:-1; s+=htf*1.5; s+=mH>0?1:-1; s+=mH>mHp?0.5:-0.5;
  s+=rN>70?-1:rN<30?1:(rN>55?0.5:rN<45?-0.5:0);
  if(price>=bbUp)s-=0.5; if(price<=bbLo)s+=0.5;
  s+=nudge; // funding rate (perp): extrémní funding = přeplněný trade → contrarian
  if(bearDiv)s-=1.5; else if(bullDiv)s+=1.5;
  else if(vel3<-0.05&&rN<38&&volSpike>1.6)s+=1.5;
  else if(vel3>0.05&&rN>66&&volSpike>1.6)s-=1.5;
  const strength=Math.min(1,Math.abs(s)/6.5), conf=Math.round(55+strength*40);
  const dir=s>0?'LONG':s<0?'SHORT':(htf>0?'LONG':'SHORT');
  const tDist=aN*(2+strength*1.5), sDist=aN*1.2;
  const stop=dir==='SHORT'?price+sDist:price-sDist;
  const spd=Math.max(aN*0.5,(Math.abs(c[i]-c[i-1])+Math.abs(c[i-1]-c[i-2])+Math.abs(c[i-2]-c[i-3]))/3);
  const scAt=j=>{let x=0;x+=e20[j]>e50[j]?1:-1;x+=c[j]>e200[j]?1:-1;x+=M.hist[j]>0?1:-1;
    x+=M.hist[j]>M.hist[j-1]?0.5:-0.5;x+=R[j]>70?-1:R[j]<30?1:(R[j]>55?0.5:R[j]<45?-0.5:0);
    x+=(c[j]-c[j-3])/c[j-3]>0?1:-1;return x;};
  const HZ=12;let wL=0,lL=0,wS=0,lS=0;
  for(let j=40;j<c.length-HZ;j++){
    const x=scAt(j);if(Math.abs(x)<2.5)continue;
    const lo=x>0,ent=c[j],aa=A[j]||aN,tp=ent+(lo?1:-1)*aa*2,sl=ent-(lo?1:-1)*aa*1.2;let res=0;
    for(let k=j+1;k<=j+HZ;k++){
      if(lo){if(l[k]<=sl){res=-1;break}if(h[k]>=tp){res=1;break}}
      else{if(h[k]>=sl){res=-1;break}if(l[k]<=tp){res=1;break}}
    }
    if(res===1)lo?wL++:wS++;else if(res===-1)lo?lL++:lS++;
  }
  let winPct=conf;
  if(dir==='LONG'&&wL+lL>=8)winPct=Math.round(100*wL/(wL+lL));
  else if(dir==='SHORT'&&wS+lS>=8)winPct=Math.round(100*wS/(wS+lS));
  winPct=Math.max(35,Math.min(90,winPct));
  return{price,dir,winPct,stop,hours:tDist/(spd||1e-9),htf};
}

async function klines(sym){
  // Binance FUTURES (perp) data – to co obchoduješ
  const r=await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=1h&limit=250`);
  const d=await r.json(); if(!Array.isArray(d))throw new Error('data');
  return {c:d.map(x=>+x[4]),h:d.map(x=>+x[2]),l:d.map(x=>+x[3]),v:d.map(x=>+x[5])};
}
async function funding(sym){
  try{ const r=await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`);
    const d=await r.json(); return +d.lastFundingRate||0; }catch(e){ return 0; }
}
async function tg(text){
  const r=await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`,{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:CHAT,text})});
  if(!r.ok)console.error('Telegram HTTP',r.status,await r.text());
}

(async()=>{
  if(!TOKEN||!CHAT){console.error('Chybí TELEGRAM_TOKEN nebo TELEGRAM_CHAT (GitHub Secrets).');process.exit(1);}
  let state={}; try{state=JSON.parse(fs.readFileSync(STATE_FILE,'utf8'))}catch(e){}
  const now=Date.now(); let sent=0; const analyzed=[];
  for(const sym of COINS){
    try{
      const K=await klines(sym);
      if(K.c.length<60){console.error(sym,'málo dat');continue;}
      const fr=await funding(sym);
      let nudge=0; if(fr>0.0006)nudge=-0.8; else if(fr<-0.0006)nudge=0.8; // extrémní funding = contrarian
      const a=analyze(K,nudge); const tick=sym.replace('USDT','');
      analyzed.push({sym,tick,a});
      if(a.winPct<MIN_WIN)continue;
      const aligned=(a.dir==='LONG'&&a.htf>0)||(a.dir==='SHORT'&&a.htf<0); // jen info, ne filtr
      const prev=state[sym], changed=!prev||prev.dir!==a.dir, cooled=!prev||(now-prev.ts)>COOLDOWN_MS;
      if(changed||cooled){
        state[sym]={dir:a.dir,ts:now};
        const ar=a.dir==='LONG'?'▲':'▼';
        const frTxt=Math.abs(fr)>0.0006?` · funding ${(fr*100).toFixed(3)}%${fr>0?' (moc longů)':' (moc shortů)'}`:'';
        await tg(`${tick}: dej na ${a.dir} ${ar} na ~${fmtTime(a.hours)}\nŠance ${a.winPct}%${aligned?' (v trendu)':''} · cena $${fmt(a.price)} · 🛑 stop $${fmt(a.stop)}${frTxt}`);
        sent++;
      }
    }catch(e){console.error(sym,e.message)}
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  console.log('Hotovo. Odesláno signálů:', sent);
})();
