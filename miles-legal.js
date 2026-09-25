/**
 * MILES · Legal & RGPD compliance layer
 * - Bandeau cookies discret conforme LSSICE art. 22.2
 * - Google Consent Mode v2 (default denied)
 * - Footer légal minimal auto-injecté
 * - Cross-page state via cookie miles_consent
 *
 * Ne pas modifier sans repasser les 3 vérifications:
 *  1. GA/Ads ne se déclenchent qu'après clic ACEPTAR
 *  2. Bandeau visible sur 1re visite, discret après
 *  3. Lien "Gestionar mis cookies" fonctionne partout
 */
(function(){
  'use strict';

  // ============================================================
  // 1. Google Consent Mode v2 — default DENIED
  // ============================================================
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  var COOKIE_NAME = 'miles_consent';
  var COOKIE_MAXAGE = 60 * 60 * 24 * 365; // 1 an

  function getConsent(){
    var m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]+)'));
    return m ? m[1] : null;
  }
  function setConsent(v){
    document.cookie = COOKIE_NAME + '=' + v + '; path=/; max-age=' + COOKIE_MAXAGE + '; SameSite=Lax';
  }

  // Set default consent state avant tout tag
  gtag('consent', 'default', {
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'analytics_storage': 'denied',
    'functionality_storage': 'granted',
    'security_storage': 'granted',
    'wait_for_update': 500
  });
  gtag('set', 'url_passthrough', true);
  gtag('set', 'ads_data_redaction', true);

  // Si déjà consentement stocké, appliquer immédiatement
  var stored = getConsent();
  if (stored === 'granted') {
    gtag('consent', 'update', {
      'ad_storage': 'granted',
      'ad_user_data': 'granted',
      'ad_personalization': 'granted',
      'analytics_storage': 'granted'
    });
  }

  // ============================================================
  // 2. Bandeau cookies — apparaît uniquement si aucun choix fait
  // ============================================================
  function createBanner(){
    if (getConsent()) return; // choix déjà fait
    if (document.getElementById('miles-cookie-banner')) return;

    var div = document.createElement('div');
    div.id = 'miles-cookie-banner';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-label', 'Aviso de cookies');
    div.innerHTML = [
      '<style>',
      '#miles-cookie-banner{position:fixed;bottom:0;left:0;right:0;z-index:9998;',
      'background:rgba(12,10,8,0.97);border-top:1px solid rgba(196,167,118,0.2);',
      'padding:14px 20px;backdrop-filter:blur(10px);color:#e8dfd0;',
      'font-family:"General Sans","Helvetica Neue",sans-serif;font-size:13px;',
      'line-height:1.5;transition:opacity .3s;}',
      '#miles-cookie-banner .mcb-inner{max-width:1100px;margin:0 auto;display:flex;',
      'align-items:center;gap:16px;flex-wrap:wrap;}',
      '#miles-cookie-banner p{flex:1;min-width:220px;margin:0;color:#c8bda8;}',
      '#miles-cookie-banner a{color:#d4a85a;text-decoration:underline;}',
      '#miles-cookie-banner .mcb-btns{display:flex;gap:8px;}',
      '#miles-cookie-banner button{font-family:inherit;font-size:12px;padding:8px 18px;',
      'border-radius:2px;cursor:pointer;letter-spacing:0.05em;text-transform:uppercase;}',
      '#miles-cookie-banner .mcb-reject{background:transparent;border:1px solid rgba(196,167,118,0.4);color:#b8a88a;}',
      '#miles-cookie-banner .mcb-accept{background:#c4a776;border:none;color:#0C0A08;font-weight:600;}',
      '#miles-cookie-banner .mcb-reject:hover{border-color:#c4a776;color:#c4a776;}',
      '#miles-cookie-banner .mcb-accept:hover{background:#d4a85a;}',
      '@media(max-width:600px){#miles-cookie-banner{padding:12px 14px;font-size:12px;}',
      '#miles-cookie-banner .mcb-inner{gap:12px;}',
      '#miles-cookie-banner button{padding:7px 14px;font-size:11px;}}',
      '</style>',
      '<div class="mcb-inner">',
        '<p>Usamos cookies para medir la audiencia y mejorar la experiencia. ',
        '<a href="/politica-cookies" target="_blank" rel="noopener">Más información</a></p>',
        '<div class="mcb-btns">',
          '<button type="button" class="mcb-reject" aria-label="Rechazar cookies no esenciales">Rechazar</button>',
          '<button type="button" class="mcb-accept" aria-label="Aceptar todas las cookies">Aceptar</button>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(div);

    div.querySelector('.mcb-accept').addEventListener('click', function(){
      setConsent('granted');
      gtag('consent', 'update', {
        'ad_storage': 'granted',
        'ad_user_data': 'granted',
        'ad_personalization': 'granted',
        'analytics_storage': 'granted'
      });
      div.style.opacity = '0';
      setTimeout(function(){ div.remove(); }, 300);
    });

    div.querySelector('.mcb-reject').addEventListener('click', function(){
      setConsent('denied');
      div.style.opacity = '0';
      setTimeout(function(){ div.remove(); }, 300);
    });
  }

  // ============================================================
  // 3. Footer légal discret — auto-injecté
  // ============================================================
  function injectFooter(){
    if (document.getElementById('miles-legal-footer')) return;

    // Si un footer existe déjà, on ajoute la mention légale à l'intérieur
    var existingFooter = document.querySelector('footer.footer .footer__bottom')
                      || document.querySelector('footer.footer');
    var legalText = 
                    '<a href="/aviso-legal">Aviso Legal</a> · ' +
                    '<a href="/politica-privacidad">Privacidad</a> · ' +
                    '<a href="/politica-cookies">Cookies</a> · ' +
                    '<a href="#" id="miles-manage-cookies">Gestionar cookies</a>';

    if (existingFooter) {
      var p = document.createElement('p');
      p.id = 'miles-legal-footer';
      p.style.cssText = 'font-size:10.5px;color:#6a5f4d;margin-top:12px;line-height:1.6;text-align:center;';
      p.innerHTML = legalText;
      existingFooter.appendChild(p);
    } else {
      // Pas de footer existant → on crée un footer minimal en bas de page
      var f = document.createElement('div');
      f.id = 'miles-legal-footer';
      f.style.cssText = 'padding:16px;text-align:center;font-size:10.5px;color:#6a5f4d;background:#0C0A08;line-height:1.6;';
      f.innerHTML = legalText;
      document.body.appendChild(f);
    }

    // Style commun pour les liens
    var s = document.createElement('style');
    s.textContent = '#miles-legal-footer a{color:#7a6f5d;text-decoration:none;} ' +
                    '#miles-legal-footer a:hover{color:#c4a776;text-decoration:underline;}';
    document.head.appendChild(s);

    // Handler "Gestionar cookies" → réafficher le bandeau
    var mgr = document.getElementById('miles-manage-cookies');
    if (mgr) {
      mgr.addEventListener('click', function(e){
        e.preventDefault();
        // Forcer réaffichage
        document.cookie = COOKIE_NAME + '=; path=/; max-age=0';
        var existing = document.getElementById('miles-cookie-banner');
        if (existing) existing.remove();
        createBanner();
      });
    }
  }

  // ============================================================
  // 4. Injection au chargement DOM
  // ============================================================
  function init(){
    // Supprimer l'ancien bandeau non-conforme s'il existe
    var oldBanner = document.getElementById('cookieBanner');
    if (oldBanner) oldBanner.remove();

    // Léger délai pour ne pas gêner LCP
    setTimeout(function(){
      createBanner();
      injectFooter();
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
