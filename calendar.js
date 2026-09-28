/* MILES · Calendrier mobile
 * Les dates bloquées viennent de MANUAL_BLOCKS (Supabase),
 * passées via options.blockedDates dans le constructeur.
 */

const CAL_LANG = (document.documentElement.lang || 'es').slice(0, 2);
const CAL_I18N = {
  es: { m: ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'], d: ['L','M','X','J','V','S','D'], prev: 'Mes anterior', next: 'Mes siguiente', na: 'no disponible', free: 'Disponible', full: 'Completo', ic: 'Sala In Confidence reservada', sv: 'Sala Salvaje reservada', sel: 'Tu fecha' },
  en: { m: ['January','February','March','April','May','June','July','August','September','October','November','December'], d: ['M','T','W','T','F','S','S'], prev: 'Previous month', next: 'Next month', na: 'not available', free: 'Available', full: 'Fully booked', ic: 'Sala In Confidence booked', sv: 'Sala Salvaje booked', sel: 'Your date' },
  fr: { m: ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'], d: ['L','M','M','J','V','S','D'], prev: 'Mois précédent', next: 'Mois suivant', na: 'non disponible', free: 'Disponible', full: 'Complet', ic: 'Sala In Confidence réservée', sv: 'Sala Salvaje réservée', sel: 'Votre date' },
  ca: { m: ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'], d: ['Dl','Dt','Dc','Dj','Dv','Ds','Dg'], prev: 'Mes anterior', next: 'Mes següent', na: 'no disponible', free: 'Disponible', full: 'Complet', ic: 'Sala In Confidence reservada', sv: 'Sala Salvaje reservada', sel: 'La teva data' }
};
const CALT = CAL_I18N[CAL_LANG] || CAL_I18N.es;
const MESES = CALT.m;
const DIAS_ES = CALT.d;

class MilesCalendar {
  constructor(root, { onSelect, blockedDates, allowBlockedSelect, onBlocked, rooms, light } = {}) {
    this.rooms = rooms || { ic: new Set(), salvaje: new Set() };
    this.light = !!light;
    this.allowBlockedSelect = !!allowBlockedSelect;
    this.onBlocked = onBlocked || null;
    this.root = root;
    this.onSelect = onSelect || (() => {});
    this.blockedDates = new Set(blockedDates || []);
    this.today = new Date();
    this.today.setHours(0,0,0,0);
    this.max = new Date(this.today);
    this.max.setMonth(this.max.getMonth() + 12);
    this.view = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
    this.selected = null;
    this.render();
  }

  // API publique pour rafraîchir les blocages sans recréer le calendrier
  setBlockedDates(dates) {
    this.blockedDates = new Set(dates || []);
    if (this.selected && this.blockedDates.has(this.selected) && !this.allowBlockedSelect) this.selected = null;
    this.render();
  }

  // Salles réservées (pastilles) : { ic:Set, salvaje:Set }
  setRooms(rooms) {
    this.rooms = rooms || { ic: new Set(), salvaje: new Set() };
    this.render();
  }
  setAll(blocked, rooms) {
    this.blockedDates = new Set(blocked || []);
    this.rooms = rooms || this.rooms;
    if (this.selected && this.blockedDates.has(this.selected) && !this.allowBlockedSelect) this.selected = null;
    this.render();
  }

  fmt(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  canPrev() {
    const y = this.view.getFullYear(), m = this.view.getMonth();
    const t = this.today;
    return !(y === t.getFullYear() && m === t.getMonth());
  }
  canNext() {
    const y = this.view.getFullYear(), m = this.view.getMonth();
    const mx = this.max;
    return !(y === mx.getFullYear() && m === mx.getMonth());
  }

  render() {
    const y = this.view.getFullYear();
    const m = this.view.getMonth();
    const first = new Date(y, m, 1);
    const startWeekday = (first.getDay() + 6) % 7; // ES: lun=0
    const daysInMonth = new Date(y, m+1, 0).getDate();

    let html = `
      <div class="cal${this.light ? ' cal--light' : ''}">
        <div class="cal__header">
          <button class="cal__nav" ${this.canPrev()?'':'disabled style="opacity:.3"'} aria-label="${CALT.prev}" data-nav="prev">‹</button>
          <div class="cal__title">${MESES[m]} ${y}</div>
          <button class="cal__nav" ${this.canNext()?'':'disabled style="opacity:.3"'} aria-label="${CALT.next}" data-nav="next">›</button>
        </div>
        <div class="cal__weekdays">
          ${DIAS_ES.map(d => `<span>${d}</span>`).join('')}
        </div>
        <div class="cal__grid">
    `;

    for (let i = 0; i < startWeekday; i++) {
      html += `<div class="cal__day cal__day--empty"></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      const iso = this.fmt(date);
      let cls = 'cal__day';
      let disabled = false;
      if (date < this.today) { cls += ' cal__day--past'; disabled = true; }
      else if (date > this.max) { cls += ' cal__day--empty'; disabled = true; }
      else if (this.blockedDates.has(iso)) { cls += ' cal__day--blocked'; }
      else { cls += ' cal__day--available'; }
      if (this.fmt(this.today) === iso) cls += ' cal__day--today';
      if (this.selected === iso) cls += ' cal__day--selected';
      let pips = '';
      if (!disabled && !this.blockedDates.has(iso)) {
        if (this.rooms.ic && this.rooms.ic.has(iso)) pips += '<i class="cal__pip cal__pip--ic"></i>';
        if (this.rooms.salvaje && this.rooms.salvaje.has(iso)) pips += '<i class="cal__pip cal__pip--sv"></i>';
      }
      const aria = this.blockedDates.has(iso) ? ' aria-label="' + d + ': ' + CALT.na + '"' : '';
      html += `<button type="button" class="${cls}" ${disabled?'disabled':''} data-date="${iso}"${aria}><span class="cal__num">${d}</span>${pips ? '<span class="cal__pips">' + pips + '</span>' : ''}</button>`;
    }
    html += `</div>
        <div class="cal__legend">
          <span><i class="cal__lg cal__lg--free"></i>${CALT.free}</span>
          <span><i class="cal__lg cal__lg--full"></i>${CALT.full}</span>
          <span><i class="cal__lg cal__lg--ic"></i>${CALT.ic}</span>
          <span><i class="cal__lg cal__lg--sv"></i>${CALT.sv}</span>
          <span><i class="cal__lg cal__lg--sel"></i>${CALT.sel}</span>
        </div>
      </div>
    `;
    this.root.innerHTML = html;
    this.bind();
  }

  bind() {
    this.root.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.nav === 'next' ? 1 : -1;
        this.view.setMonth(this.view.getMonth() + dir);
        this.render();
      });
    });
    this.root.querySelectorAll('[data-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        const iso = cell.dataset.date;
        if (this.blockedDates.has(iso) && !this.allowBlockedSelect) {
          if (this.onBlocked) this.onBlocked(iso);
          return;
        }
        this.selected = iso;
        this.render();
        this.onSelect(this.selected);
      });
    });
  }
}

window.MilesCalendar = MilesCalendar;
