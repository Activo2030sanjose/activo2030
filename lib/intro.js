(()=>{const DEMO=false;if(matchMedia("(prefers-reduced-motion: reduce)").matches)return; /* vista previa: se repite hasta tocar «Saltar intro» */const I=document.getElementById("intro"),D=I.querySelector(".drops");let tm=[];
 const clear=()=>{tm.forEach(clearTimeout);tm=[]},end=()=>{clear();I.classList.add("done");document.body.style.overflow=""};
 const play=()=>{clear();I.className="";document.body.style.overflow="hidden";
  const hg=I.querySelector(".hg");hg.replaceWith(hg.cloneNode(true));I.getBoundingClientRect();I.classList.add("ig");
  {const H2=I.querySelector(".hg"),t0=performance.now(),D0=1900,e=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
   const fr=n=>{if(!I.classList.contains("ig")||I.classList.contains("done"))return;const k=Math.min(1,(n-t0)/D0),a=innerWidth/innerHeight;
    // altura visible: de 1100 (reloj pequeño) a 70 (centro del vidrio llena la pantalla)
    const h=Math.exp(Math.log(1100)+(Math.log(70)-Math.log(1100))*e(k)),w=h*a;
    H2.setAttribute("viewBox",(60-w/2).toFixed(2)+" "+(100-h/2).toFixed(2)+" "+w.toFixed(2)+" "+h.toFixed(2));if(k<1)requestAnimationFrame(fr)};
   requestAnimationFrame(fr)}
  D.innerHTML="";for(let k=0;k<9;k++){const z=10+Math.random()*22;D.innerHTML+=`<i style="left:calc(50% + ${(Math.random()*40-20).toFixed(0)}px);width:${z}px;height:${z}px;margin-left:${-z/2}px;animation-delay:${(k*.07).toFixed(2)}s"></i>`}
  tm.push(setTimeout(()=>I.classList.add("s2"),1900),setTimeout(()=>{I.classList.remove("s2");I.classList.add("s3")},2600),setTimeout(DEMO?play:end,DEMO?6400:5600))};
 window.A2030Intro={play};
 let seen=false;try{seen=sessionStorage.getItem("a2030i")==="1";sessionStorage.setItem("a2030i","1")}catch(e){}
 const urls=[...I.querySelectorAll(".ly")].map(e=>getComputedStyle(e).backgroundImage.replace(/^url\(["']?|["']?\)$/g,""));
 Promise.all(urls.map(u=>{const i=new Image();i.src=u;return i.decode?i.decode().catch(()=>{}):0})).then(()=>requestAnimationFrame(()=>requestAnimationFrame(play)));setTimeout(()=>{if(!I.className)play()},1200)})();
