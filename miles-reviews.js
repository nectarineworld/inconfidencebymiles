/**
 * MILES · Système d'avis vérifiés
 * - Charge les nouveaux avis depuis Supabase
 * - Les injecte en tête de section "reviews" (avant les 81 historiques Privateaser)
 * - Met à jour le compteur affiché : 81 → 81+N
 * - Mise à jour Schema.org AggregateRating
 *
 * Public API key (safe to expose): sb_publishable_...
 * RLS activé côté Supabase.
 */
(function(){
  'use strict';

  var SUPABASE_URL = 'https://fmikzxqquazduyhyvxfz.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_xjRTJL038pSL__ZrH70Otg_PXOd_oZS';
  var BASELINE_COUNT = 81;
  var BASELINE_AVG = 4.9;

  // Ne s'exécute que sur la page /resenas
  if (!document.getElementById('reviews')) return;

  function fetchApprovedReviews(){
    return fetch(SUPABASE_URL + '/rest/v1/public_reviews?select=*&order=created_at.desc', {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Accept': 'application/json'
      }
    }).then(function(r){
      if (!r.ok) throw new Error('Supabase fetch failed: ' + r.status);
      return r.json();
    });
  }

  function starString(rating){
    var s = '';
    for (var i = 0; i < 5; i++) s += (i < rating) ? '★' : '☆';
    return s;
  }

  function formatMonth(iso){
    var d = new Date(iso);
    var m = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return m[d.getMonth()] + ' ' + d.getFullYear();
  }

  function reviewToArticle(r){
    var art = document.createElement('article');
    art.className = 'rc';
    art.setAttribute('data-cat', r.evento_tipo || 'Cliente');
    art.setAttribute('data-lang', r.idioma || 'es');
    art.setAttribute('data-verified', 'nueva');

    var chipLabel = '';
    if (r.evento_tipo === 'mesa') chipLabel = 'Mesa · Reserva confirmada';
    else if (r.evento_tipo === 'grupo') chipLabel = 'Grupo · Reserva confirmada';
    else if (r.evento_tipo === 'privatizacion_ic') chipLabel = 'Privatización In Confidence · Confirmada';
    else if (r.evento_tipo === 'privatizacion_salvaje') chipLabel = 'Privatización Salvaje · Confirmada';
    else if (r.evento_tipo === 'privatizacion_total') chipLabel = 'Privatización Total · Confirmada';
    else chipLabel = 'Reserva confirmada';

    var htmlParts = [
      '<div class="rc__head">',
        '<div class="rc__stars" aria-label="' + r.rating + ' estrellas sobre 5">' + starString(r.rating) + '</div>',
        '<span class="rc__lang" aria-label="Idioma ' + (r.idioma || 'ES').toUpperCase() + '">' + (r.idioma || 'ES').toUpperCase() + '</span>',
        '<span class="rc__verified" title="Avis vérifié — vient d\'une reserva confirmada" style="margin-left:auto;font-size:11px;color:#4a9d5c;font-weight:600;letter-spacing:.05em;">✓ VERIFICADO</span>',
      '</div>',
      '<div class="rc__meta">',
        '<span class="rc__name">' + escapeHtml(r.nombre_publicado) + '</span>',
        '<span class="rc__sep">·</span>',
        '<span class="rc__date">' + formatMonth(r.created_at) + '</span>',
      '</div>',
      '<div class="rc__chip">' + chipLabel + '</div>',
      r.comentario ? '<p class="rc__text">' + escapeHtml(r.comentario) + '</p>' : '',
      r.photo_url ? '<img src="' + escapeAttr(r.photo_url) + '" alt="Foto compartida por el cliente" style="margin-top:12px;max-width:100%;border-radius:4px;max-height:280px;object-fit:cover;" loading="lazy">' : ''
    ];
    art.innerHTML = htmlParts.join('');
    return art;
  }

  function escapeHtml(s){
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escapeAttr(s){
    return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function updateCounters(newCount, newAvg){
    var total = BASELINE_COUNT + newCount;
    var avg;
    if (newCount === 0) {
      avg = BASELINE_AVG;
    } else {
      // Moyenne pondérée
      avg = ((BASELINE_AVG * BASELINE_COUNT) + (newAvg * newCount)) / total;
    }

    // Mettre à jour tous les compteurs "81" visibles
    var statVals = document.querySelectorAll('.stat__val');
    statVals.forEach(function(el){
      if (el.textContent.trim() === '81') {
        el.textContent = total;
      }
    });

    // Mettre à jour le hero__sub si présent
    var heroSub = document.querySelector('.hero__sub');
    if (heroSub && heroSub.innerHTML.includes('81')) {
      heroSub.innerHTML = heroSub.innerHTML.replace(/81 opiniones verificadas/g, total + ' opiniones verificadas');
    }

    // Mettre à jour Schema.org
    var schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');
    schemaScripts.forEach(function(s){
      try {
        var d = JSON.parse(s.textContent);
        if (d && d.aggregateRating) {
          d.aggregateRating.reviewCount = String(total);
          d.aggregateRating.ratingValue = avg.toFixed(1);
          s.textContent = JSON.stringify(d, null, 2);
        }
      } catch(e){}
    });
  }

  function init(){
    fetchApprovedReviews().then(function(reviews){
      if (!Array.isArray(reviews) || reviews.length === 0) return;

      var section = document.getElementById('reviews');
      if (!section) return;

      // Calculer moyenne des nouveaux avis
      var sumRating = 0;
      reviews.forEach(function(r){ sumRating += r.rating; });
      var avgNew = sumRating / reviews.length;

      // Injecter tous les nouveaux en tête de section
      var frag = document.createDocumentFragment();
      reviews.forEach(function(r){
        frag.appendChild(reviewToArticle(r));
      });
      section.insertBefore(frag, section.firstChild);

      updateCounters(reviews.length, avgNew);

      // Log discret
      console.debug('[MILES] ' + reviews.length + ' nuevas opiniones cargadas desde Supabase.');
    }).catch(function(err){
      // Silencieux — la page reste fonctionnelle avec les 81 avis existants
      console.debug('[MILES] No se pudieron cargar opiniones nuevas:', err.message);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
