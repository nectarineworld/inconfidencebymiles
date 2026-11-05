/* MILES — WhatsApp después de la solicitud: para reservar o privatizar, primero la solicitud en el planning */
(function(){
  var L=(document.documentElement.lang||'es').slice(0,2); if(!/^(es|en|fr|ca)$/.test(L)) L='es';
  var T={
    es:{t:'¿Quieres reservar o privatizar?',p:'Primero, envía tu solicitud: queda registrada en nuestro planning. Después, seguimos contigo por WhatsApp.',a:'Enviar mi solicitud',o:'¿Es otra pregunta, sin reserva?',ol:'Escríbenos por WhatsApp',
        dt:'Tu solicitud ya está enviada',dp:'Continúa por WhatsApp: te enviamos el resumen de tu solicitud para no repetir nada.',da:'Continuar por WhatsApp',hi:'Hola MILES, acabo de enviar una solicitud desde la web.',c:'Cerrar'},
    en:{t:'Want to book or hire a space?',p:'First, send your request: it is recorded in our planning. Then we continue with you on WhatsApp.',a:'Send my request',o:'Another question, not a booking?',ol:'Message us on WhatsApp',
        dt:'Your request has been sent',dp:'Continue on WhatsApp: we include your request summary so you don’t have to repeat anything.',da:'Continue on WhatsApp',hi:'Hi MILES, I have just sent a request from the website.',c:'Close'},
    fr:{t:'Vous souhaitez réserver ou privatiser ?',p:'Envoyez d’abord votre demande : elle est enregistrée dans notre planning. Ensuite, on continue avec vous sur WhatsApp.',a:'Envoyer ma demande',o:'Une autre question, sans réservation ?',ol:'Écrivez-nous sur WhatsApp',
        dt:'Votre demande est envoyée',dp:'Continuez sur WhatsApp : le résumé de votre demande est déjà inclus, rien à répéter.',da:'Continuer sur WhatsApp',hi:'Bonjour MILES, je viens d’envoyer une demande depuis le site.',c:'Fermer'},
    ca:{t:'Vols reservar o privatitzar?',p:'Primer, envia la teva sol·licitud: queda registrada al nostre planning. Després, continuem amb tu per WhatsApp.',a:'Enviar la meva sol·licitud',o:'És una altra pregunta, sense reserva?',ol:'Escriu-nos per WhatsApp',
        dt:'La teva sol·licitud ja s’ha enviat',dp:'Continua per WhatsApp: hi incloem el resum de la teva sol·licitud, no cal repetir res.',da:'Continuar per WhatsApp',hi:'Hola MILES, acabo d’enviar una sol·licitud des del web.',c:'Tancar'}
  }[L];
  var DEF={es:'/reservar',en:'/reservar-en',fr:'/reservar-fr',ca:'/reservar-ca'}[L];
  function resLink(){
    var a=document.querySelector('.final-cta a[href^="/reservar"], a.btn--primary[href^="/reservar"]');
    return a ? a.getAttribute('href') : DEF;
  }
  function lastReq(){ try{ var s=JSON.parse(sessionStorage.getItem('miles_last_req')||'null'); return (s&&s.ref)?s:null; }catch(e){ return null; } }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  var css='.mwg{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.72)}'+
  '.mwg__box{position:relative;max-width:420px;width:100%;background:#1A1714;border:1px solid rgba(212,168,90,.45);border-radius:10px;padding:28px 22px 20px;color:#E8E0D0;font-family:inherit;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6)}'+
  '.mwg__t{margin:0 0 10px;font-size:20px;line-height:1.3;color:#D4A85A;font-weight:600}'+
  '.mwg__p{margin:0 0 20px;font-size:15px;line-height:1.5;color:#E8E0D0}'+
  '.mwg__a,.mwg__a:hover,.mwg__a:focus,.mwg__a:visited{display:block;width:100%;box-sizing:border-box;padding:13px 14px;border-radius:4px;font-size:14px;letter-spacing:.04em;text-decoration:none;cursor:pointer;font-family:inherit;background:#D4A85A!important;color:#0C0A08!important;border:1px solid #D4A85A;font-weight:600}'+
  '.mwg__o{margin:18px 0 0;font-size:13px;line-height:1.5;color:#9E9688}'+
  '.mwg__o button{background:none;border:0;padding:0;font:inherit;color:#B8B0A0;text-decoration:underline;cursor:pointer}'+
  '.mwg__x{position:absolute;top:6px;right:8px;background:none;border:0;color:#B8B0A0;font-size:24px;line-height:1;cursor:pointer;padding:6px}';
  var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
  var box=null, last=null;
  function close(){ if(box){ box.remove(); box=null; document.removeEventListener('keydown',onKey); if(last) try{last.focus()}catch(e){} } }
  function onKey(e){ if(e.key==='Escape') close(); }
  function openWa(href){ close(); var w=window.open(href,'_blank'); if(w){ try{w.opener=null}catch(e){} } else location.href=href; }
  function open(href, el){
    last=el; close();
    var r=lastReq(), inner;
    if(r){
      var txt=[T.hi, r.date, r.time, r.pers ? r.pers+' pax' : '', r.nombre, 'Ref: '+r.ref].filter(Boolean).join('\n');
      var wa='https://wa.me/34932472654?text='+encodeURIComponent(txt);
      inner='<p class="mwg__t" id="mwg-t">'+T.dt+'</p><p class="mwg__p">'+T.dp+'</p>'+
            '<a class="mwg__a" href="'+esc(wa)+'" target="_blank" rel="noopener" data-mwg-wa="1">'+T.da+'</a>';
    } else {
      inner='<p class="mwg__t" id="mwg-t">'+T.t+'</p><p class="mwg__p">'+T.p+'</p>'+
            '<a class="mwg__a" href="'+esc(resLink())+'">'+T.a+'</a>'+
            '<p class="mwg__o">'+T.o+' <button type="button" class="mwg__ol">'+T.ol+'</button></p>';
    }
    box=document.createElement('div'); box.className='mwg'; box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-labelledby','mwg-t');
    box.innerHTML='<div class="mwg__box"><button type="button" class="mwg__x" aria-label="'+T.c+'">&times;</button>'+inner+'</div>';
    document.body.appendChild(box);
    box.addEventListener('click',function(e){ if(e.target===box) close(); });
    box.querySelector('.mwg__x').onclick=close;
    var ol=box.querySelector('.mwg__ol'); if(ol) ol.onclick=function(){ openWa(href); };
    var wa=box.querySelector('[data-mwg-wa]'); if(wa) wa.addEventListener('click',function(){ setTimeout(close,50); });
    document.addEventListener('keydown',onKey);
    box.querySelector('.mwg__a').focus();
  }
  document.addEventListener('click',function(e){
    var a=e.target.closest && e.target.closest('a[href*="wa.me/"],a[href*="api.whatsapp.com"]');
    if(!a || a.closest('.mwg') || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault(); e.stopPropagation(); open(a.href, a);
  }, true);
})();
