const { chromium } = require("@playwright/test");
const pages=["/en","/en/cars","/en/cars/honda-civic","/en/about","/en/contact","/en/login","/en/register","/en/privacy","/ar","/de/cars"];
(async()=>{
 const b=await chromium.launch();
 for(const [name,vp] of [["desktop",{width:1280,height:800}],["mobile",{width:390,height:844}]]){
  for(const path of pages){
   const ctx=await b.newContext({viewport:vp,hasTouch:name==="mobile"});const p=await ctx.newPage();
   const errs=[];p.on("console",m=>{if(m.type()==="error")errs.push(m.text().slice(0,140));});p.on("pageerror",e=>errs.push("pageerror "+e.message.slice(0,140)));
   const bad=[];p.on("response",r=>{if(r.status()>=400)bad.push(r.status()+" "+r.url().slice(-60));});
   await p.goto("http://localhost:3100"+path,{waitUntil:"networkidle"}).catch(()=>{});
   const r=await p.evaluate(()=>{
     const vw=innerWidth;const over=document.documentElement.scrollWidth-vw;
     const small=[...document.querySelectorAll("a,button,[role=button],input,select,[role=radio],[role=tab]")].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.height<36||r.width<36)&&getComputedStyle(e).visibility!=="hidden"}).map(e=>(e.getAttribute("aria-label")||e.textContent||e.tagName).trim().slice(0,25)+" "+Math.round(e.getBoundingClientRect().width)+"x"+Math.round(e.getBoundingClientRect().height));
     const noalt=[...document.querySelectorAll("img")].filter(i=>!i.hasAttribute("alt")).length;
     const wide=[...document.querySelectorAll("body *")].filter(e=>{const r=e.getBoundingClientRect();return r.right>vw+1&&r.width>0}).slice(0,3).map(e=>e.tagName+"."+String(e.className).slice(0,50));
     return {over,small:small.slice(0,6),smallCount:small.length,noalt,wide,h1:document.querySelectorAll("h1").length,title:document.title.slice(0,40)};
   });
   console.log(name,path,JSON.stringify({...r,errs:[...new Set(errs)].slice(0,3),bad:[...new Set(bad)].slice(0,3)}));
   await ctx.close();
  }
 }
 await b.close();})();
