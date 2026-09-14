/* MILES · Calendrier mobile — prototype
 * Dates bloquées codées en dur pour la démo. Dans la version finale,
 * elles proviendront de l'espace privé MILES (blocages manuels + confirmations).
 */

const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre'
];
const DIAS_ES = ['L','M','X','J','V','S','D'];

// Dates bloquées de démo (aaaa-mm-jj)
const BLOCKED_DEMO = new Set([
  '2026-09-19','2026-09-20','2026-09-26','2026-09-27',
  '2026-10-03','2026-10-04','2026-10-10','2026-10-11',
  '2026-10-17','2026-10-18','2026-10-24','2026-10-25','2026-10-31',
  '2026-11-01','2026-11-14','2026-11-21','2026-11-28',
  '2026-12-05','2026-12-19','2026-12-24','2026-12-25','2026-12-26',
  '2026-12-31','2027-01-01'
]);

class MilesCalendar {
  constructor(root, { onSelect } = {}) {
    this.root = root;
    this.onSelect = onSelect || (() => {});
    this.today = new Date();
    this.today.setHours(0,0,0,0);
    this.max = new Date(this.today);
    this.max.setMonth(this.max.getMonth() + 12);
    this.view = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
    this.selected = null;
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
      <div class="cal">
        <div class="cal__header">
          <button class="cal__nav" ${this.canPrev()?'':'disabled style="opacity:.3"'} aria-label="Mes anterior" data-nav="prev">‹</button>
          <div class="cal__title">${MESES[m]} ${y}</div>
          <button class="cal__nav" ${this.canNext()?'':'disabled style="opacity:.3"'} aria-label="Mes siguiente" data-nav="next">›</button>
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
      else if (BLOCKED_DEMO.has(iso)) { cls += ' cal__day--blocked'; disabled = true; }
      else { cls += ' cal__day--available'; }
      if (this.fmt(this.today) === iso) cls += ' cal__day--today';
      if (this.selected === iso) cls += ' cal__day--selected';
      html += `<button type="button" class="${cls}" ${disabled?'disabled':''} data-date="${iso}">${d}</button>`;
    }
    html += `</div>
        <div class="cal__legend">
          <span><i style="background:var(--color-surface-3)"></i>Disponible</span>
          <span><i style="background:repeating-linear-gradient(45deg,rgba(209,99,112,.3),rgba(209,99,112,.3) 3px,transparent 3px,transparent 6px)"></i>No disponible</span>
          <span><i style="background:var(--color-gold)"></i>Seleccionado</span>
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
        this.selected = cell.dataset.date;
        this.render();
        this.onSelect(this.selected);
      });
    });
  }
}

window.MilesCalendar = MilesCalendar;
