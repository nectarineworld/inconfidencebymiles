/* MILES · validación del formulario de reserva: bloquea datos erróneos y lleva al cliente al campo exacto. */
(function () {
  var L = (document.documentElement.lang || 'es').slice(0, 2);
  var T = {
    es: { date: 'Elige una fecha en el calendario.', time: 'Elige una hora (o «flexible»).', name: 'Escribe tu nombre y apellidos.',
      telEmpty: 'El teléfono es obligatorio: te contactaremos por WhatsApp.', telBad: 'Este número no parece correcto. Para España: 9 cifras (ej. 612 345 678). Para otro país, añade el prefijo (ej. +33…).',
      emailEmpty: 'El email es obligatorio: te enviaremos ahí la respuesta.', emailBad: 'Este email no es válido. Revísalo (ej. nombre@gmail.com).', emailSug: '¿Querías decir', fix: 'Corregir',
      como: 'Dinos cómo nos conociste (un solo clic).', consent: 'Marca la casilla para aceptar la Política de Privacidad.' },
    en: { date: 'Choose a date in the calendar.', time: 'Choose a time (or “flexible”).', name: 'Please enter your full name.',
      telEmpty: 'Phone number is required: we will contact you on WhatsApp.', telBad: 'This number does not look right. Spain: 9 digits (e.g. 612 345 678). Other countries: add the country code (e.g. +44…).',
      emailEmpty: 'Email is required: we will send our reply there.', emailBad: 'This email is not valid. Please check it (e.g. name@gmail.com).', emailSug: 'Did you mean', fix: 'Fix it',
      como: 'Tell us how you found us (one click).', consent: 'Tick the box to accept the Privacy Policy.' },
    fr: { date: 'Choisissez une date dans le calendrier.', time: 'Choisissez une heure (ou « flexible »).', name: 'Indiquez vos nom et prénom.',
      telEmpty: 'Le téléphone est obligatoire : nous vous contacterons par WhatsApp.', telBad: 'Ce numéro ne semble pas correct. Espagne : 9 chiffres (ex. 612 345 678). Autre pays : ajoutez l’indicatif (ex. +33…).',
      emailEmpty: 'L’email est obligatoire : nous y enverrons notre réponse.', emailBad: 'Cet email n’est pas valide. Vérifiez-le (ex. nom@gmail.com).', emailSug: 'Vouliez-vous dire', fix: 'Corriger',
      como: 'Dites-nous comment vous nous avez connus (un seul clic).', consent: 'Cochez la case pour accepter la Politique de confidentialité.' },
    ca: { date: 'Tria una data al calendari.', time: 'Tria una hora (o «flexible»).', name: 'Escriu el teu nom i cognoms.',
      telEmpty: 'El telèfon és obligatori: et contactarem per WhatsApp.', telBad: 'Aquest número no sembla correcte. Per a Espanya: 9 xifres (ex. 612 345 678). Per a un altre país, afegeix el prefix (ex. +33…).',
      emailEmpty: 'L’email és obligatori: t’hi enviarem la resposta.', emailBad: 'Aquest email no és vàlid. Revisa’l (ex. nom@gmail.com).', emailSug: 'Volies dir', fix: 'Corregir',
      como: 'Digues-nos com ens vas conèixer (un sol clic).', consent: 'Marca la casella per acceptar la Política de Privacitat.' }
  };
  T = T[L] || T.es;

  var css = document.createElement('style');
  css.textContent = '.mv-bad{border-color:#d16370!important;box-shadow:0 0 0 2px rgba(209,99,112,.35)!important}' +
    '.mv-err{margin-top:8px}.mv-err button{margin-left:8px;background:#c4a776;color:#111;border:0;border-radius:6px;padding:4px 10px;font-weight:600;cursor:pointer;font-size:13px}';
  document.head.appendChild(css);

  var DOM_FIX = { gmial: 'gmail', gamil: 'gmail', gmai: 'gmail', gmal: 'gmail', gnail: 'gmail', gmaill: 'gmail', gmali: 'gmail', gmil: 'gmail', gmale: 'gmail', gemail: 'gmail', 'g-mail': 'gmail',
    hotmial: 'hotmail', hotmal: 'hotmail', hotmai: 'hotmail', hotmil: 'hotmail', hotamil: 'hotmail', hotmaill: 'hotmail', homail: 'hotmail', hotnail: 'hotmail',
    outlok: 'outlook', outllok: 'outlook', outloo: 'outlook', outlock: 'outlook', otlook: 'outlook',
    yahooo: 'yahoo', yaho: 'yahoo', yhoo: 'yahoo', yahho: 'yahoo', iclod: 'icloud', icoud: 'icloud', icluod: 'icloud', iclud: 'icloud', icloude: 'icloud' };
  var TLD_FIX = { con: 'com', cm: 'com', om: 'com', comm: 'com', cpm: 'com', vom: 'com', xom: 'com', ocm: 'com', coom: 'com', cim: 'com', clm: 'com', copm: 'com', 'com.': 'com', ess: 'es', ed: 'es' };

  function suggest(email) {
    var m = /^([^@\s]+)@([^@\s]+)$/.exec(email); if (!m) return null;
    var parts = m[2].split('.'); if (parts.length < 2) return null;
    var name = parts[0], tld = parts.slice(1).join('.'), changed = false;
    if (DOM_FIX[name]) { name = DOM_FIX[name]; changed = true; }
    if (TLD_FIX[tld]) { tld = TLD_FIX[tld]; changed = true; }
    if (name === 'gmail' && tld !== 'com') { tld = 'com'; changed = true; }
    return changed ? m[1] + '@' + name + '.' + tld : null;
  }
  function emailOk(e) { return /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(e) && !/\.\./.test(e); }
  function telOk(t) {
    if (/[^\d\s+().\-]/.test(t)) return false;
    var d = t.replace(/\D/g, ''), intl = /^\s*(\+|00)/.test(t);
    if (intl) { if (/^\s*00/.test(t)) d = d.slice(2); if (/^34/.test(d)) return /^34[6789]\d{8}$/.test(d); return d.length >= 8 && d.length <= 15; }
    return /^[6789]\d{8}$/.test(d);
  }

  function box(anchor) {
    var id = 'mv-' + (anchor.id || anchor.name || 'x'), p = document.getElementById(id);
    if (!p) { p = document.createElement('p'); p.id = id; p.className = 'form-alert mv-err'; p.setAttribute('role', 'alert'); anchor.insertAdjacentElement('afterend', p); }
    return p;
  }
  function clear(el, anchor) {
    var p = document.getElementById('mv-' + ((anchor || el).id || (anchor || el).name || 'x'));
    if (p) p.remove(); el.classList.remove('mv-bad'); el.removeAttribute('aria-invalid');
  }
  function fail(el, msg, anchor, fixTo, quiet) {
    anchor = anchor || el;
    var p = box(anchor); p.textContent = msg;
    if (fixTo) { var b = document.createElement('button'); b.type = 'button'; b.textContent = T.fix;
      b.onclick = function () { el.value = fixTo; clear(el); el.focus(); }; p.appendChild(b); }
    el.classList.add('mv-bad'); el.setAttribute('aria-invalid', 'true');
    if (!quiet) { anchor.scrollIntoView({ behavior: 'smooth', block: 'center' }); try { el.focus({ preventScroll: true }); } catch (e) {} }
    return false;
  }

  function $(id) { return document.getElementById(id); }
  function checkEmail(el, q) {
    var v = el.value.trim().toLowerCase().replace(/\s+/g, ''); el.value = v;
    if (!v) return fail(el, T.emailEmpty, null, null, q);
    var s = suggest(v);
    if (s) return fail(el, T.emailSug + ' ' + s + (L === 'fr' ? ' ?' : '?'), null, s, q);
    if (!emailOk(v)) return fail(el, T.emailBad, null, null, q);
    clear(el); return true;
  }
  function checkTel(el, q) {
    var v = el.value.trim();
    if (!v) return fail(el, T.telEmpty, null, null, q);
    if (!telOk(v)) return fail(el, T.telBad, null, null, q);
    clear(el); return true;
  }
  function checkName(el) { var v = el.value.trim(); if (v.replace(/[^\p{L}]/gu, '').length < 2) return fail(el, T.name); clear(el); return true; }

  window.MV = {
    suggest: suggest, emailOk: emailOk, telOk: telOk,
    // Paso 1 (antes de fórmula/asientos/personas): fecha y hora
    top: function (state) {
      var ds = $('date-summary'), tc = $('time-chips');
      if (!state.date) { var p = box(ds); p.textContent = T.date; ds.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
      var pd = $('mv-date-summary'); if (pd) pd.remove();
      if (tc && !state.time) { var q = box(tc); q.textContent = T.time; tc.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
      var pt = $('mv-time-chips'); if (pt) pt.remove();
      return true;
    },
    // Paso 2: datos de contacto y consentimiento
    contact: function () {
      if (!checkName($('nombre'))) return false;
      if (!checkTel($('tel'))) return false;
      if (!checkEmail($('email'))) return false;
      var c = $('como'); if (!c.value) return fail(c, T.como); clear(c);
      var k = document.querySelector('input[name="privacy_consent"]');
      if (!k.checked) { var lab = k.closest('label'); return fail(k, T.consent, lab); }
      clear(k, k.closest('label'));
      return true;
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var e = $('email'), t = $('tel'), n = $('nombre'), c = $('como'), k = document.querySelector('input[name="privacy_consent"]');
    if (e) { e.addEventListener('blur', function () { if (e.value.trim()) checkEmail(e, true); }); e.addEventListener('input', function () { clear(e); }); }
    if (t) { t.addEventListener('blur', function () { if (t.value.trim()) checkTel(t, true); }); t.addEventListener('input', function () { clear(t); }); }
    if (n) n.addEventListener('input', function () { clear(n); });
    if (c) c.addEventListener('change', function () { clear(c); });
    var ds = $('date-summary'); if (ds) new MutationObserver(function () { var d = $('mv-date-summary'); if (d) d.remove(); }).observe(ds, { childList: true, characterData: true, subtree: true });
    if (k) k.addEventListener('change', function () { clear(k, k.closest('label')); });
    document.addEventListener('click', function (ev) {
      if (ev.target.closest && ev.target.closest('#time-chips .chip')) { var p = $('mv-time-chips'); if (p) p.remove(); }
    });
  });
})();
