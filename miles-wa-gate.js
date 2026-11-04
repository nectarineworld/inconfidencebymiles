/* MILES — rappel avant WhatsApp : les demandes de réservation passent d'abord par le formulaire */
(function(){
  var L=(document.documentElement.lang||'es').slice(0,2); if(!/^(es|en|fr|ca)$/.test(L)) L='es';
  var T={
    es:{t:'¿Es sobre una reserva?',p:'Si tu mensaje es para una solicitud de reserva, envía primero tu solicitud en línea. Después, resolvemos tus dudas por WhatsApp.',a:'Enviar mi solicitud',b:'Otra consulta: abrir WhatsApp',c:'Cerrar'},
    en:{t:'Is it about a booking?',p:'If your message is about a booking request, please send your request online first. Then we’ll answer your questions on WhatsApp.',a:'Send my request',b:'Other question: open WhatsApp',c:'Close'},
    fr:{t:'C’est pour une réservation ?',p:'Si votre message concerne une demande de réservation, envoyez d’abord votre demande en ligne. Ensuite, nous répondrons à vos questions sur WhatsApp.',a:'Envoyer ma demande',b:'Autre question : ouvrir WhatsApp',c:'Fermer'},
    ca:{t:'És sobre una reserva?',p:'Si el teu missatge és per a una sol·licitud de reserva, envia primer la teva sol·licitud en línia. Després, resolem els teus dubtes per WhatsApp.',a:'Enviar la meva sol·licitud',b:'Altra consulta: obrir WhatsApp',c:'Tancar'}
  }[L];
  var DEF={es:'/reservar',en:'/reservar-en',fr:'/reservar-fr',ca:'/reservar-ca'}[L];
  function resLink(){
    var a=document.querySelector('.final-cta a[href^="/reservar"], a.btn--primary[href^="/reservar"]');
    return a ? a.getAttribute('href') : DEF;
  }
  var css='.mwg{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.72)}'+
  '.mwg__box{position:relative;max-width:420px;width:100%;background:#1A1714;border:1px solid rgba(212,168,90,.45);border-radius:10px;padding:28px 22px 22px;color:#E8E0D0;font-family:inherit;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6)}'+
  '.mwg__t{margin:0 0 10px;font-size:20px;line-height:1.3;color:#D4A85A;font-weight:600}'+
  '.mwg__p{margin:0 0 20px;font-size:15px;line-height:1.5;color:#E8E0D0}'+
  '.mwg__a,.mwg__b{display:block;width:100%;box-sizing:border-box;padding:13px 14px;border-radius:4px;font-size:14px;letter-spacing:.04em;text-decoration:none;cursor:pointer;font-family:inherit}'+
  '.mwg__a,.mwg__a:hover,.mwg__a:focus,.mwg__a:visited{background:#D4A85A!important;color:#0C0A08!important;border:1px solid #D4A85A;font-weight:600;margin-bottom:10px}'+
  '.mwg__b{background:transparent;color:#E8E0D0;border:1px solid rgba(232,224,208,.35)}'+
  '.mwg__x{position:absolute;top:6px;right:8px;background:none;border:0;color:#B8B0A0;font-size:24px;line-height:1;cursor:pointer;padding:6px}';
  var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
  var box=null, last=null;
  function close(){ if(box){ box.remove(); box=null; document.removeEventListener('keydown',esc); if(last) try{last.focus()}catch(e){} } }
  function esc(e){ if(e.key==='Escape') close(); }
  function open(href, el){
    last=el; close();
    box=document.createElement('div'); box.className='mwg'; box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-labelledby','mwg-t');
    box.innerHTML='<div class="mwg__box"><button type="button" class="mwg__x" aria-label="'+T.c+'">&times;</button>'+
      '<p class="mwg__t" id="mwg-t">'+T.t+'</p><p class="mwg__p">'+T.p+'</p>'+
      '<a class="mwg__a" href="'+resLink()+'">'+T.a+'</a>'+
      '<button type="button" class="mwg__b">'+T.b+'</button></div>';
    document.body.appendChild(box);
    box.addEventListener('click',function(e){ if(e.target===box) close(); });
    box.querySelector('.mwg__x').onclick=close;
    box.querySelector('.mwg__b').onclick=function(){ close(); var w=window.open(href,'_blank'); if(w){ try{w.opener=null}catch(e){} } else location.href=href; };
    document.addEventListener('keydown',esc);
    box.querySelector('.mwg__a').focus();
  }
  document.addEventListener('click',function(e){
    var a=e.target.closest && e.target.closest('a[href*="wa.me/"],a[href*="api.whatsapp.com"]');
    if(!a || a.closest('.mwg') || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault(); e.stopPropagation(); open(a.href, a);
  }, true);
})();
