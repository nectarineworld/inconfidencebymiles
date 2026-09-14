/**
 * MILES · Form intercepteur — envoie une copie de chaque réservation dans Supabase
 * en plus de Netlify Forms (fallback garanti).
 *
 * S'accroche aux formulaires:
 * - contact-es, contact-en, contact-fr, contact-ca
 *
 * Ne bloque JAMAIS l'envoi Netlify — le user ne s'aperçoit pas d'un éventuel échec Supabase.
 */
(function(){
  'use strict';

  var SUPABASE_URL = 'https://fmikzxqquazduyhyvxfz.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_xjRTJL038pSL__ZrH70Otg_PXOd_oZS';

  var FORM_NAMES = ['contact-es', 'contact-en', 'contact-fr', 'contact-ca'];

  function getLang(formName) {
    return formName.split('-')[1] || 'es';
  }

  function extractUtm() {
    try {
      var p = new URLSearchParams(window.location.search);
      return {
        utm_source: p.get('utm_source') || null,
        utm_medium: p.get('utm_medium') || null,
        utm_campaign: p.get('utm_campaign') || null
      };
    } catch(e) { return {}; }
  }

  function pushToSupabase(form) {
    var fd = new FormData(form);
    var utm = extractUtm();
    var idioma = getLang(form.getAttribute('name') || 'contact-es');

    // Détection honeypot
    var honeypot = fd.get('bot-field');
    var honeypotTriggered = honeypot && String(honeypot).length > 0;

    var payload = {
      nombre: (fd.get('nombre') || fd.get('name') || '').toString().trim().substring(0, 200),
      email: (fd.get('email') || '').toString().trim().substring(0, 200),
      telefono: (fd.get('telefono') || fd.get('phone') || fd.get('tel') || '').toString().trim().substring(0, 50) || null,
      idioma: idioma,
      tipo: (fd.get('tipo') || fd.get('event-type') || 'mesa').toString().substring(0, 50),
      fecha: fd.get('fecha') || fd.get('date') || null,
      hora: fd.get('hora') || fd.get('time') || null,
      num_personas: parseInt(fd.get('personas') || fd.get('people') || fd.get('num_personas') || '0') || null,
      ocasion: (fd.get('ocasion') || fd.get('occasion') || '').toString().substring(0, 200) || null,
      mensaje: (fd.get('mensaje') || fd.get('message') || fd.get('comentarios') || '').toString().substring(0, 5000) || null,
      privacy_consent: !!fd.get('privacy_consent'),
      marketing_consent: !!fd.get('marketing_consent'),
      status: 'nueva',
      user_agent: navigator.userAgent.substring(0, 500),
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      honeypot_triggered: honeypotTriggered
    };

    // Ne pas envoyer si champs obligatoires vides
    if (!payload.nombre || !payload.email) return Promise.resolve();
    // Ne pas envoyer si RGPD non coché (Supabase le refusera de toute façon via policy)
    if (!payload.privacy_consent) return Promise.resolve();

    return fetch(SUPABASE_URL + '/rest/v1/reservations', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    }).catch(function(err){
      console.debug('[MILES] Supabase push failed (silent):', err.message);
    });
  }

  function attachForm(form) {
    if (form.dataset.milesFormAttached) return;
    form.dataset.milesFormAttached = 'true';

    form.addEventListener('submit', function(e){
      // On n'empêche PAS la soumission Netlify — on envoie juste une copie en parallèle
      // (fire-and-forget)
      pushToSupabase(form);
    }, { capture: true });
  }

  function init() {
    FORM_NAMES.forEach(function(name){
      var form = document.querySelector('form[name="' + name + '"]');
      if (form) attachForm(form);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
