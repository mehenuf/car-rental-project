const { chromium } = require("@playwright/test");
const url = "/" + (process.argv[2] || "en");
(async()=>{
 const b=await chromium.launch({args:["--enable-gpu-rasterization","--ignore-gpu-blocklist"]});
 const c=await b.newContext({viewport:{width:1280,height:800}});
 await c.addCookies([{name:"bc_consent",value:encodeURIComponent(JSON.stringify({v:"2026-09",analytics:false})),url:"http://localhost:3100"}]);
 const p=await c.newPage();
 await p.goto("http://localhost:3100"+url);await p.waitForLoadState("networkidle");await p.waitForTimeout(2500);
 await p.evaluate(()=>{window.__f=[];let last=performance.now();const loop=t=>{window.__f.push(t-last);last=t;requestAnimationFrame(loop)};requestAnimationFrame(loop);
   window.__long=[];new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__long.push(Math.round(e.duration)))).observe({type:"longtask",buffered:true});});
 await p.mouse.move(640,400);
 for(let i=0;i<30;i++){await p.mouse.wheel(0,120);await p.mouse.move(400+i*20,300+(i%5)*30);await p.waitForTimeout(90);}
 await p.waitForTimeout(600);
 const r=await p.evaluate(()=>{const f=window.__f.slice(5).sort((a,b)=>a-b);const n=f.length;const avg=f.reduce((a,b)=>a+b,0)/n;
  return {frames:n,avgMs:+avg.toFixed(1),p50:+f[Math.floor(n*.5)].toFixed(1),p95:+f[Math.floor(n*.95)].toFixed(1),max:+f[n-1].toFixed(1),over33:f.filter(x=>x>33).length,longTasks:window.__long.length,longMs:window.__long.reduce((a,b)=>a+b,0)};});
 console.log(url,JSON.stringify(r));
 await b.close();})();
