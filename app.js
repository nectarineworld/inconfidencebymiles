/* Miles Cocktail Lounge — App Logic */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  /* --- Initialize Lucide Icons --- */
  if (window.lucide) {
    lucide.createIcons();
  }

  /* --- Navigation Scroll Effect --- */
  const nav = document.getElementById('nav');
  let lastScroll = 0;
  
  const handleScroll = () => {
    const scrollY = window.scrollY;
    if (scrollY > 60) {
      nav.classList.add('nav--scrolled');
    } else {
      nav.classList.remove('nav--scrolled');
    }
    lastScroll = scrollY;
  };
  
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  /* --- Mobile Navigation --- */
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  function closeMenu() {
    if (navToggle && navLinks) {
      navToggle.setAttribute('aria-expanded', 'false');
      navLinks.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  }

  function openMenu() {
    if (navToggle && navLinks) {
      navToggle.setAttribute('aria-expanded', 'true');
      navLinks.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navLinks.classList.contains('is-open');
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        closeMenu();
      });
    });

    // Close menu on outside click
    document.addEventListener('click', (e) => {
      if (navLinks.classList.contains('is-open') && !navLinks.contains(e.target) && !navToggle.contains(e.target)) {
        closeMenu();
      }
    });

    // Close menu on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('is-open')) {
        closeMenu();
      }
    });
  }

  /* --- Smooth Scroll for Anchor Links --- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* --- Google Maps embed (replaces Leaflet) --- */
  /* Map is now an iframe in the HTML, no JS needed */

  /* --- GSAP Scroll Animations (fallback for browsers without CSS scroll-timeline) --- */
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    /* Only use GSAP if CSS animation-timeline is NOT supported */
    if (!CSS.supports('animation-timeline', 'scroll()')) {
      document.querySelectorAll('.reveal-el').forEach(el => {
        gsap.from(el, {
          opacity: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            once: true,
          }
        });
      });
    }

    /* Hero parallax (always) */
    const heroBgImg = document.querySelector('.hero__bg-img');
    if (heroBgImg) {
      gsap.to(heroBgImg, {
        y: '15%',
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        }
      });
    }
  }

  /* --- Ambiance Strip: duplicate for infinite scroll --- */
  const strip = document.querySelector('.ambiance__strip');
  if (strip) {
    const children = Array.from(strip.children);
    children.forEach(child => {
      const clone = child.cloneNode(true);
      strip.appendChild(clone);
    });
  }

  /* --- Contact Form Handler (Netlify Forms) --- */
  const form = document.getElementById('contactForm');
  const formSuccess = document.getElementById('formSuccess');
  
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      /* Basic validation */
      const nameField = form.querySelector('#name');
      const emailField = form.querySelector('#email');
      let valid = true;

      if (!nameField.value.trim()) {
        nameField.style.borderColor = '#D16370';
        valid = false;
      } else {
        nameField.style.borderColor = '';
      }

      if (!emailField.value.trim() || !emailField.value.includes('@')) {
        emailField.style.borderColor = '#D16370';
        valid = false;
      } else {
        emailField.style.borderColor = '';
      }

      ['#date', '#guests'].forEach(sel => {
        const el = form.querySelector(sel);
        if (el && !el.value) { el.style.borderColor = '#D16370'; valid = false; }
        else if (el) el.style.borderColor = '';
      });

      if (valid) {
        /* Envoi à Supabase (Netlify ne sert plus le site) */
        const lang = (form.getAttribute('name') || 'contact-es').split('-')[1] || 'es';
        const MSG = {
          blocked: { es:'Esta fecha no está disponible. Por favor, elige otra fecha.', en:'This date is not available. Please choose another date.', fr:'Cette date n’est pas disponible. Veuillez choisir une autre date.', ca:'Aquesta data no està disponible. Si us plau, tria’n una altra.' },
          missing: { es:'Rellena nombre, email, teléfono, fecha, personas, cómo nos conociste y acepta la privacidad.', en:'Please fill in name, email, phone, date, guests, how you heard about us and accept the privacy policy.', fr:'Merci de remplir nom, e-mail, téléphone, date, personnes, comment vous nous avez connus et d’accepter la confidentialité.', ca:'Omple nom, email, telèfon, data, persones, com ens vas conèixer i accepta la privacitat.' },
          error: { es:'No hemos podido enviar tu solicitud. Escríbenos únicamente por WhatsApp: 932 47 26 54', en:'We could not send your request. Message us only on WhatsApp: +34 932 47 26 54', fr:'Nous n’avons pas pu envoyer votre demande. Écrivez-nous uniquement sur WhatsApp : +34 932 47 26 54', ca:'No hem pogut enviar la sol·licitud. Escriu-nos únicament per WhatsApp: 932 47 26 54' }
        };
        const btn = form.querySelector('button[type="submit"]');
        if (form.__milesSending) return; form.__milesSending = true;
        const label = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = '…'; }
        const push = window.milesPushContact ? window.milesPushContact(form) : Promise.resolve({ ok: false, error: 'server' });
        push.then(res => {
          if (btn) { btn.disabled = false; btn.textContent = label; }
          if (!(res && res.ok)) form.__milesSending = false;
          if (res && res.ok) {
            [...form.children].forEach(c => { if (c !== formSuccess) c.style.display = 'none'; }); formSuccess.hidden = false;
            try { sessionStorage.setItem('miles_last_req', JSON.stringify(res.resumen || {})); } catch (e) {}
            // Conversión Google Ads: una sola vez, solo tras el registro correcto
            if (!window.__milesConvSent) { window.__milesConvSent = res.ref; window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: 'form_submit', solicitud_ref: res.ref, solicitud_tipo: 'home' }); }
            const WAL = { es:'Continuar por WhatsApp', en:'Continue on WhatsApp', fr:'Continuer sur WhatsApp', ca:'Continuar per WhatsApp' };
            const WAT = { es:'Hola MILES, acabo de enviar una solicitud desde la web.', en:'Hi MILES, I have just sent a request from the website.', fr:'Bonjour MILES, je viens d’envoyer une demande depuis le site.', ca:'Hola MILES, acabo d’enviar una sol·licitud des del web.' };
            const r = res.resumen || {};
            const txt = [WAT[lang] || WAT.es, r.date, r.pers ? r.pers + ' pax' : '', r.nombre, 'Ref: ' + res.ref].filter(Boolean).join('\n');
            if (!formSuccess.querySelector('.form__success-wa')) {
              const a = document.createElement('a'); a.className = 'btn btn--ghost form__success-wa'; a.target = '_blank'; a.rel = 'noopener';
              a.href = 'https://wa.me/34932472654?text=' + encodeURIComponent(txt); a.textContent = WAL[lang] || WAL.es; a.style.marginTop = '14px'; a.style.display = 'inline-flex';
              formSuccess.appendChild(document.createElement('br')); formSuccess.appendChild(a);
            }
            return;
          }
          const k = res && (res.error === 'blocked' || res.error === 'past') ? 'blocked' : (res && res.error === 'missing' ? 'missing' : 'error');
          if (k === 'blocked') { const d = form.querySelector('#date'); if (d) { d.style.borderColor = '#D16370'; d.focus(); } }
          alert(MSG[k][lang] || MSG[k].es);
        });
      }
    });
  }

  /* --- Active Navigation Highlight --- */
  const sections = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav__links a[href^="#"]');
  
  const observerOptions = {
    rootMargin: '-20% 0px -75% 0px',
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navAnchors.forEach(a => {
          a.style.color = '';
          if (a.getAttribute('href') === `#${id}`) {
            a.style.color = '#C9A84C';
          }
        });
      }
    });
  }, observerOptions);

  sections.forEach(section => observer.observe(section));
});

// Disable right-click on images
document.addEventListener('contextmenu', function(e) {
  if (e.target.tagName === 'IMG') e.preventDefault();
});
