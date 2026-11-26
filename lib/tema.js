/* Versión día / noche compartida por el inicio y los portales */
(function(){var r=document.documentElement,K='a2030tema',t=null;
 try{t=localStorage.getItem(K)}catch(e){}
 if(t==='noche')r.setAttribute('data-theme','dark');else r.setAttribute('data-theme','light');
 var sun='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
     moon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>';
 function pinta(b){var n=r.getAttribute('data-theme')==='dark';b.innerHTML=n?sun:moon;b.setAttribute('aria-label',n?'Versión día':'Versión noche');b.title=n?'Versión día':'Versión noche';
  var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=n?'#070b2a':'#001489'}
 function monta(){var b=document.getElementById('tema-btn');
  if(!b){var h=document.querySelector('.head .wrap');if(!h)return;b=document.createElement('button');b.id='tema-btn';b.type='button';b.className='tema-btn';h.appendChild(b)}
  pinta(b);if(b.dataset.tm)return;b.dataset.tm='1';b.addEventListener('click',function(){var n=r.getAttribute('data-theme')!=='dark';r.setAttribute('data-theme',n?'dark':'light');try{localStorage.setItem(K,n?'noche':'dia')}catch(e){}pinta(b)})}
 window.__temaMontar=monta;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',monta);else monta();
})();
