/* miles-anticipo.js — Módulo de anticipo en la ficha (back-office).
 * Regla de oro: la automatización calcula, avisa y recuerda. Ninguna decisión importante es automática.
 */
(function () {
  const PRICES = { bebidas: 20, tapas: 35 };
  const FORMULA_ADM = { bebidas: 'Bebidas · 20 €/pers.', tapas: 'Tapas + bebida · 35 €/pers.', personalizada: 'Personalizada' };
  const METODO_ADM = { transferencia: 'Transferencia bancaria', efectivo: 'Efectivo en el local', a_elegir: 'A elegir por el cliente' };
  const ESTADO_ADM = { borrador: 'Pre-validado · sin enviar', pendiente: 'Pago pendiente', declarado: 'Cliente indica haber pagado · verificación requerida', verificado: 'Pago recibido y verificado' };
  const RULES = {
    bebidas_7: { l: 'Grupo bebidas estándar · 7 días', d: 7 },
    tapas_10: { l: 'Grupo tapas + bebida estándar · 10 días', d: 10 },
    priv_15: { l: 'Privatización estándar · 15 días', d: 15 },
    priv_alta_30: { l: 'Privatización fecha de alta demanda · 30 días', d: 30 },
    personalizada: { l: 'Condiciones particulares · días a medida', d: null }
  };
  const LIQ = { a_definir: 'A definir', nota: 'Nota abierta', tickets: 'Tickets · saldo antes de la entrega de los tickets', tickets_cumulados: 'Tickets acumulados · pago final agrupado', individual: 'Consumiciones individuales / pago en el momento' };
  const PLAZO_ADM = { horas: 'Plazo en horas', fecha: 'Fecha y hora exactas', antes_llegada: 'Antes de la llegada al local', en_local: 'En el local', libre: 'Mensaje libre' };

  // ---- Textos cliente (4 idiomas) ----
  const T = {
    es: { loc: 'es-ES', f: { bebidas: 'Fórmula bebidas', tapas: 'Fórmula tapas + bebida', personalizada: 'Fórmula personalizada' },
      m: { transferencia: 'Transferencia bancaria', efectivo: 'Efectivo en el local', a_elegir: 'Transferencia bancaria o efectivo en el local (a tu elección)' },
      until: x => `hasta el ${x}`, before: 'antes de tu llegada al local', enLocal: 'En el local, antes de la entrega de los tickets.',
      saldo: 'El saldo restante se abona por transferencia como máximo 48 horas antes del evento, o en efectivo en el local antes de la entrega de los tickets.',
      sign: 'El equipo de MILES · Gastro Cocktail Lounge' },
    en: { loc: 'en-GB', f: { bebidas: 'Drinks package', tapas: 'Tapas + drinks package', personalizada: 'Custom package' },
      m: { transferencia: 'Bank transfer', efectivo: 'Cash at the venue', a_elegir: 'Bank transfer or cash at the venue (your choice)' },
      until: x => `by ${x}`, before: 'before your arrival at the venue', enLocal: 'At the venue, before the tickets are handed over.',
      saldo: 'The remaining balance is paid by bank transfer no later than 48 hours before the event, or in cash at the venue before the tickets are handed over.',
      sign: 'The MILES team · Gastro Cocktail Lounge' },
    fr: { loc: 'fr-FR', f: { bebidas: 'Formule boissons', tapas: 'Formule tapas + boisson', personalizada: 'Formule personnalisée' },
      m: { transferencia: 'Virement bancaire', efectivo: 'Espèces sur place', a_elegir: 'Virement bancaire ou espèces sur place (au choix)' },
      until: x => `avant le ${x}`, before: 'avant votre arrivée chez MILES', enLocal: 'Sur place, avant la remise des tickets.',
      saldo: 'Le solde restant est réglé par virement au plus tard 48 heures avant l\u2019événement, ou en espèces sur place avant la remise des tickets.',
      sign: 'L\u2019équipe MILES · Gastro Cocktail Lounge' },
    ca: { loc: 'ca-ES', f: { bebidas: 'Fórmula begudes', tapas: 'Fórmula tapes + beguda', personalizada: 'Fórmula personalitzada' },
      m: { transferencia: 'Transferència bancària', efectivo: 'Efectiu al local', a_elegir: 'Transferència bancària o efectiu al local (a la teva elecció)' },
      until: x => `fins al ${x}`, before: 'abans de la teva arribada al local', enLocal: 'Al local, abans del lliurament dels tiquets.',
      saldo: 'El saldo restant es paga per transferència com a màxim 48 hores abans de l\u2019esdeveniment, o en efectiu al local abans del lliurament dels tiquets.',
      sign: 'L\u2019equip de MILES · Gastro Cocktail Lounge' }
  };

  const eur = n => (Math.round(Number(n) * 100) / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const r2 = n => Math.round(Number(n) * 100) / 100;
  const pad = n => String(n).padStart(2, '0');
  const toLocalInput = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  const fmtDT = (iso, loc = 'es-ES') => new Date(iso).toLocaleString(loc, { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const fmtD = (ymd, loc = 'es-ES') => ymd ? new Date(ymd + 'T12:00:00').toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const minusDays = (ymd, n) => { const t = new Date(ymd + 'T12:00:00'); t.setDate(t.getDate() - n); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
  const isPriv = d => (d.type || '').startsWith('privatizacion');
  const todayISO = () => window.milesTodayISO();

  function plazoClient(v, lang) {
    const t = T[lang] || T.es;
    if (v.plazo_tipo === 'horas' || v.plazo_tipo === 'fecha') return v.plazo_at ? t.until(fmtDT(v.plazo_at, t.loc)) : '';
    if (v.plazo_tipo === 'antes_llegada') return t.before;
    return v.plazo_texto || '';
  }

  function mailTpl(lang, v, d) {
    const t = T[lang] || T.es, first = (d.nombre || '').split(' ')[0];
    const dl = new Date(d.date + 'T12:00:00').toLocaleDateString(t.loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const [y, m, dd] = d.date.split('-'); const dmy = `${dd}/${m}/${y}`;
    const cash = v.metodo === 'efectivo';
    const lines = {
      es: [`Personas garantizadas: ${v.personas}`, `${t.f[v.formula]}${v.precio_persona ? ` (${eur(v.precio_persona)}/pers.)` : ''}`, `Importe total: ${eur(v.total)}`, `Anticipo: ${eur(v.importe)} (${r2(v.pct)} %)`, `Saldo restante: ${eur(v.saldo)}`, `Forma de pago: ${t.m[v.metodo]}`, `Plazo: ${plazoClient(v, lang)}`],
      en: [`Guaranteed guests: ${v.personas}`, `${t.f[v.formula]}${v.precio_persona ? ` (${eur(v.precio_persona)}/person)` : ''}`, `Total amount: ${eur(v.total)}`, `Deposit: ${eur(v.importe)} (${r2(v.pct)} %)`, `Remaining balance: ${eur(v.saldo)}`, `Payment method: ${t.m[v.metodo]}`, `Deadline: ${plazoClient(v, lang)}`],
      fr: [`Nombre de participants garanti : ${v.personas}`, `${t.f[v.formula]}${v.precio_persona ? ` (${eur(v.precio_persona)}/pers.)` : ''}`, `Montant total : ${eur(v.total)}`, `Acompte : ${eur(v.importe)} (${r2(v.pct)} %)`, `Solde restant : ${eur(v.saldo)}`, `Moyen de règlement : ${t.m[v.metodo]}`, `Échéance : ${plazoClient(v, lang)}`],
      ca: [`Persones garantides: ${v.personas}`, `${t.f[v.formula]}${v.precio_persona ? ` (${eur(v.precio_persona)}/pers.)` : ''}`, `Import total: ${eur(v.total)}`, `Bestreta: ${eur(v.importe)} (${r2(v.pct)} %)`, `Saldo restant: ${eur(v.saldo)}`, `Forma de pagament: ${t.m[v.metodo]}`, `Termini: ${plazoClient(v, lang)}`]
    }[lang].join('\n');
    const B = {
      es: { s: `Anticipo para tu reserva · MILES · ${dmy}`, b: `Hola ${first},\n\nGracias por elegir MILES. Para reservar tu evento del ${dl}, te pedimos un anticipo:\n\n${lines}\n\n${cash ? 'En tu página de pago encontrarás el detalle y las condiciones de reserva:' : 'En tu página de pago encontrarás los datos bancarios, la referencia obligatoria de la transferencia y las condiciones de reserva:'}\n{ENLACE}\n\n${cash ? 'Tu reserva queda confirmada únicamente tras el cobro efectivo en el local y la validación del pago por la empresa.' : 'Tu reserva queda confirmada únicamente tras la recepción efectiva y la verificación del pago por la empresa. La declaración de pago no constituye, por sí sola, una confirmación definitiva.'}\n\nPor seguridad: nunca te pediremos cambiar de cuenta bancaria por email ni por mensaje. Para cualquier duda, escríbenos únicamente por WhatsApp al +34 932 47 26 54.\n\n${t.sign}` },
      en: { s: `Deposit for your booking · MILES · ${dmy}`, b: `Hello ${first},\n\nThank you for choosing MILES. To secure your event on ${dl}, we kindly ask for a deposit:\n\n${lines}\n\n${cash ? 'Your payment page contains the details and the booking conditions:' : 'Your payment page contains the bank details, the mandatory transfer reference and the booking conditions:'}\n{ENLACE}\n\n${cash ? 'Your booking is confirmed only after the cash payment has actually been received at the venue and validated by the company.' : 'Your booking is confirmed only after the payment has actually been received and verified by the company. A payment declaration alone does not constitute a final confirmation.'}\n\nFor your security: we will never ask you to change bank account by email or message. For any question, contact us on WhatsApp only at +34 932 47 26 54.\n\n${t.sign}` },
      fr: { s: `Acompte pour votre réservation · MILES · ${dmy}`, b: `Bonjour ${first},\n\nMerci d\u2019avoir choisi MILES. Pour réserver votre événement du ${dl}, nous vous demandons un acompte :\n\n${lines}\n\n${cash ? 'Votre page de paiement contient le détail et les conditions de réservation :' : 'Votre page de paiement contient les coordonnées bancaires, la référence obligatoire du virement et les conditions de réservation :'}\n{ENLACE}\n\n${cash ? 'Votre réservation est confirmée uniquement après encaissement effectif sur place et validation du règlement par l\u2019entreprise.' : 'Votre réservation est confirmée uniquement après réception effective et vérification du paiement par l\u2019entreprise. La déclaration de paiement ne constitue pas, à elle seule, une confirmation définitive.'}\n\nPar sécurité : nous ne vous demanderons jamais de changer de compte bancaire par email ou par message. Pour toute question, écrivez-nous uniquement sur WhatsApp au +34 932 47 26 54.\n\n${t.sign}` },
      ca: { s: `Bestreta per a la teva reserva · MILES · ${dmy}`, b: `Hola ${first},\n\nGràcies per triar MILES. Per reservar el teu esdeveniment del ${dl}, et demanem una bestreta:\n\n${lines}\n\n${cash ? 'A la teva pàgina de pagament trobaràs el detall i les condicions de reserva:' : 'A la teva pàgina de pagament trobaràs les dades bancàries, la referència obligatòria de la transferència i les condicions de reserva:'}\n{ENLACE}\n\n${cash ? 'La teva reserva queda confirmada únicament després del cobrament efectiu al local i la validació del pagament per part de l\u2019empresa.' : 'La teva reserva queda confirmada únicament després de la recepció efectiva i la verificació del pagament per part de l\u2019empresa. La declaració de pagament no constitueix, per si sola, una confirmació definitiva.'}\n\nPer seguretat: mai no et demanarem canviar de compte bancari per email ni per missatge. Per a qualsevol dubte, escriu-nos només per WhatsApp al +34 932 47 26 54.\n\n${t.sign}` }
    };
    return B[lang] || B.es;
  }

  function waTpl(lang, v, d, link) {
    const first = (d.nombre || '').split(' ')[0]; const [y, m, dd] = d.date.split('-'); const dmy = `${dd}/${m}/${y}`; const pl = plazoClient(v, lang);
    return {
      es: `Hola ${first}, te enviamos la solicitud de anticipo para tu evento del ${dmy} en MILES: anticipo ${eur(v.importe)} (total ${eur(v.total)}), plazo: ${pl}. Toda la información y los datos de pago: ${link}\nTu reserva queda confirmada únicamente tras la verificación del pago.`,
      en: `Hello ${first}, here is the deposit request for your event on ${dmy} at MILES: deposit ${eur(v.importe)} (total ${eur(v.total)}), deadline: ${pl}. All the details and payment information: ${link}\nYour booking is confirmed only once the payment has been verified.`,
      fr: `Bonjour ${first}, voici la demande d\u2019acompte pour votre événement du ${dmy} chez MILES : acompte ${eur(v.importe)} (total ${eur(v.total)}), échéance : ${pl}. Toutes les informations et le paiement : ${link}\nVotre réservation est confirmée uniquement après vérification du paiement.`,
      ca: `Hola ${first}, t\u2019enviem la sol·licitud de bestreta per al teu esdeveniment del ${dmy} a MILES: bestreta ${eur(v.importe)} (total ${eur(v.total)}), termini: ${pl}. Tota la informació i les dades de pagament: ${link}\nLa teva reserva queda confirmada únicament després de verificar el pagament.`
    }[lang] || '';
  }

  // ---------- Modal ----------
  function ensureModal() {
    if (document.getElementById('dep-modal')) return;
    const m = document.createElement('div');
    m.innerHTML = `
<div id="dep-modal" class="adm-modal"><div class="adm-modal__box dep-box">
  <h3 id="dep-title">Validar y pedir anticipo</h3>
  <p>La reserva pasa a «Pendiente de pago». Nunca se confirma sola: la confirmas tú tras verificar el pago.</p>
  <div id="dep-form"></div>
  <div id="dep-result"></div>
</div></div>
<div id="bank-modal" class="adm-modal"><div class="adm-modal__box">
  <h3>Datos bancarios de la empresa</h3>
  <p>Se muestran al cliente en su página de pago. Para cambiarlos se pide la contraseña admin, y recibirás un email de alerta.</p>
  <div class="dep-box" style="max-width:none">
    <label for="bk-tit">Titular</label><input id="bk-tit">
    <label for="bk-cif">CIF</label><input id="bk-cif">
    <label for="bk-iban">IBAN</label><input id="bk-iban" autocomplete="off">
    <label for="bk-banco">Banco</label><input id="bk-banco">
    <label for="bk-bic">BIC</label><input id="bk-bic">
    <label for="bk-pw">Contraseña admin (obligatoria)</label><input id="bk-pw" type="password" autocomplete="current-password">
  </div>
  <div id="bk-status" class="dep-err"></div>
  <div class="adm-modal__row"><button class="btn btn--ghost" onclick="closeM('bank-modal')">Volver</button><button class="btn btn--primary" id="bk-save">Guardar</button></div>
</div></div>
<div id="verify-modal" class="adm-modal"><div class="adm-modal__box">
  <h3>Pago recibido y verificado</h3>
  <p>Marca solo si has comprobado el pago: transferencia visible en la cuenta de la empresa, o efectivo cobrado en caja.</p>
  <div class="dep-actions">
    <button class="btn btn--primary" data-vm="transferencia">Transferencia recibida en la cuenta</button>
    <button class="btn btn--primary" data-vm="efectivo">Efectivo cobrado en el local</button>
    <button class="btn btn--ghost" onclick="closeM('verify-modal')">Volver</button>
  </div>
</div></div>`;
    document.body.appendChild(m);
  }

  function defaults(d, dep) {
    if (dep) return { ...dep, plazo_at: dep.plazo_at, control_at: dep.control_at };
    const formula = d.formula === 'tapas' ? 'tapas' : d.formula === 'bebidas' ? 'bebidas' : 'bebidas';
    const regla = isPriv(d) ? 'priv_15' : formula === 'tapas' ? 'tapas_10' : 'bebidas_7';
    const lang = d.idioma || 'es';
    return {
      formula, precio_persona: PRICES[formula], personas: d.personas || 1, total: (d.personas || 1) * PRICES[formula], total_manual: false,
      modo: 'pct', pct: 50, importe: null, metodo: 'transferencia', plazo_tipo: 'horas', plazo_horas: 48,
      plazo_at: null, control_at: null, plazo_texto: '', regla_cancel: regla, cancel_dias: RULES[regla].d,
      reduccion_dias: null, saldo_texto: formula === 'tapas' ? (T[lang] || T.es).saldo : '',
      liquidacion: formula === 'tapas' ? 'tickets' : 'a_definir', liquidacion_nota: '', max_pagadores: 2
    };
  }

  function openForm(ctx, mode) {
    ensureModal();
    const { d, dep } = ctx; const lang = d.idioma || 'es';
    const v = defaults(d, dep);
    const priv = isPriv(d);
    const eventDT = new Date(d.date + 'T' + (d.time || '20:00') + ':00');
    let bodyDirty = false;
    document.getElementById('dep-title').textContent = dep ? 'Modificar / reenviar anticipo' : 'Validar y pedir anticipo';
    document.getElementById('dep-result').innerHTML = '';
    const ctrlDefault = toLocalInput(new Date(eventDT.getTime() - 24 * 3600e3));
    const f = document.getElementById('dep-form');
    f.innerHTML = `
      <div class="dep-sec"><h4>Reserva</h4>
        <div class="dep-calc">${milesEsc(d.nombre)} · ${milesEsc(d.email || 'sin email')} · ${milesEsc(d.tel || 'sin teléfono')}<br>${niceDate(d.date)}${d.time ? ' · ' + d.time : ''} · ${milesEsc(TYPE_LABELS[d.type] || d.type)}${d.event ? ' · ' + milesEsc(EVENT_LABELS[d.event] || d.event) : ''}</div>
        <label for="dp-pers">Personas garantizadas (mínimo facturado)</label><input id="dp-pers" type="number" min="1" step="1" inputmode="numeric" value="${v.personas}">
        <div id="dp-pers-warn"></div>
        <label>Fórmula</label>
        <div class="dep-row" id="dp-formula">${Object.entries(FORMULA_ADM).map(([k, l]) => `<button type="button" class="chip ${v.formula === k ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
        <div class="dep-grid">
          <div><label for="dp-precio">Precio por persona (€)</label><input id="dp-precio" type="number" min="0" step="0.5" inputmode="decimal" value="${v.precio_persona ?? ''}"></div>
          <div><label for="dp-total">Importe total (€)</label><input id="dp-total" type="number" min="0" step="0.01" inputmode="decimal" value="${v.total}"></div>
        </div>
        <label class="inline"><input type="checkbox" id="dp-tman" ${v.total_manual ? 'checked' : ''}> Total personalizado (no recalcular)</label>
      </div>
      <div class="dep-sec"><h4>Anticipo</h4>
        <div class="dep-row" id="dp-modo"><button type="button" class="chip ${v.modo === 'pct' ? 'on' : ''}" data-k="pct">En porcentaje</button><button type="button" class="chip ${v.modo === 'fijo' ? 'on' : ''}" data-k="fijo">Importe fijo</button></div>
        <div id="dp-pct-box"><div class="dep-row" id="dp-pcts">${[25, 50, 75, 100].map(p => `<button type="button" class="chip" data-p="${p}">${p} %</button>`).join('')}</div>
          <label for="dp-pct">Porcentaje (%)</label><input id="dp-pct" type="number" min="0" max="100" step="1" inputmode="decimal" value="${v.pct ?? 50}"></div>
        <div id="dp-fijo-box"><label for="dp-imp">Importe del anticipo (€)</label><input id="dp-imp" type="number" min="0" step="0.01" inputmode="decimal" value="${v.modo === 'fijo' ? v.importe : ''}"></div>
        <div class="dep-calc" id="dp-calc"></div><div id="dp-err" class="dep-err"></div>
      </div>
      <div class="dep-sec"><h4>Forma de pago del anticipo</h4>
        <select id="dp-metodo">${Object.entries(METODO_ADM).map(([k, l]) => `<option value="${k}" ${v.metodo === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <div id="dp-bank" class="dep-calc" style="margin-top:8px"></div>
      </div>
      <div class="dep-sec"><h4>Plazo de pago</h4>
        <select id="dp-ptipo">${Object.entries(PLAZO_ADM).map(([k, l]) => `<option value="${k}" ${v.plazo_tipo === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <div id="dp-horas-box"><div class="dep-row" id="dp-hs">${[2, 6, 12, 24, 48].map(h => `<button type="button" class="chip" data-h="${h}">${h} h</button>`).join('')}</div>
          <label for="dp-horas">Horas desde ahora</label><input id="dp-horas" type="number" min="1" step="1" inputmode="numeric" value="${v.plazo_horas || 48}"></div>
        <div id="dp-fecha-box"><label for="dp-fecha">Fecha y hora límite</label><input id="dp-fecha" type="datetime-local" value="${v.plazo_at ? toLocalInput(new Date(v.plazo_at)) : ''}"></div>
        <div id="dp-texto-box"><label for="dp-texto">Texto que verá el cliente</label><input id="dp-texto" maxlength="300" value="${milesEsc(v.plazo_texto || '')}"></div>
        <div id="dp-ctrl-box"><label for="dp-ctrl">Control interno (fecha y hora del aviso para el equipo)</label><input id="dp-ctrl" type="datetime-local" value="${v.control_at ? toLocalInput(new Date(v.control_at)) : ctrlDefault}"></div>
        <div class="dep-calc" id="dp-plazo-calc"></div>
      </div>
      <div class="dep-sec"><h4>Cancelación por el cliente</h4>
        <select id="dp-regla">${Object.entries(RULES).map(([k, r]) => `<option value="${k}" ${v.regla_cancel === k ? 'selected' : ''}>${r.l}</option>`).join('')}</select>
        <div id="dp-cdias-box"><label for="dp-cdias">Días mínimos antes del evento</label><input id="dp-cdias" type="number" min="0" step="1" inputmode="numeric" value="${v.cancel_dias ?? ''}"></div>
        <div class="dep-calc" id="dp-cancel-calc"></div>
      </div>
      <div class="dep-sec"><h4>Saldo y liquidación final</h4>
        <label for="dp-saldo">Condiciones del saldo (visible para el cliente)</label><textarea id="dp-saldo" maxlength="400" style="min-height:70px">${milesEsc(v.saldo_texto || '')}</textarea>
        <label for="dp-liq">Liquidación final (interno)</label><select id="dp-liq">${Object.entries(LIQ).map(([k, l]) => `<option value="${k}" ${v.liquidacion === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <label for="dp-liqn">Nota interna</label><input id="dp-liqn" maxlength="400" value="${milesEsc(v.liquidacion_nota || '')}">
        <label for="dp-maxp">Máximo de personas para el pago final</label><input id="dp-maxp" type="number" min="1" max="10" step="1" value="${v.max_pagadores || 2}">
      </div>
      ${priv ? `<div class="dep-sec"><h4>Disponibilidad en la web</h4><label class="inline"><input type="checkbox" id="dp-block" ${d.bloqueaSala === false ? '' : 'checked'}> Bloquear la sala en la web mientras el pago está pendiente</label></div>` : ''}
      <div class="dep-sec"><h4>Mensaje al cliente (${lang.toUpperCase()})</h4>
        <label class="inline"><input type="checkbox" id="dp-send" ${d.email && window.EMAIL_READY ? 'checked' : ''} ${d.email ? '' : 'disabled'}> Enviar por email${d.email ? '' : ' (el cliente no dejó email)'}</label>
        <div id="dp-mail"><label for="dp-subj">Asunto</label><input id="dp-subj" maxlength="200">
        <label for="dp-body">Mensaje <span style="font-weight:400;color:var(--color-text-faint)">({ENLACE} se sustituye por el enlace de pago)</span></label><textarea id="dp-body" style="min-height:280px"></textarea>
        <button type="button" class="btn btn--ghost" id="dp-regen" style="margin-top:6px">Regenerar el texto</button></div>
        ${dep && dep.sent_at ? '<div class="dep-warn">Cada envío crea un enlace nuevo: el enlace anterior deja de funcionar. Si solo modificas y guardas sin enviar, el enlace actual sigue válido y muestra los datos nuevos.</div>' : ''}
      </div>
      <div class="dep-actions">
        <button class="btn btn--primary" id="dp-go-mail">Guardar y enviar por email</button>
        <button class="btn btn--wa" id="dp-go-wa">Guardar y enviar por WhatsApp</button>
        <button class="btn btn--ghost" id="dp-go-save">${dep ? 'Guardar cambios sin enviar' : 'Pre-validar (guardar sin enviar)'}</button>
        <button class="btn btn--ghost" onclick="closeM('dep-modal')">Volver</button>
      </div>`;

    const $ = id => document.getElementById(id);
    let st = { formula: v.formula, modo: v.modo };
    if (!ctx.bank) adminCall('billing_get').then(r => { ctx.bank = r && r.billing; calc(); }); 

    function val() {
      const personas = Math.floor(Number($('dp-pers').value));
      const precio = $('dp-precio').value === '' ? null : Number($('dp-precio').value);
      if (!$('dp-tman').checked && precio !== null && personas > 0) $('dp-total').value = r2(personas * precio);
      const total = r2(Number($('dp-total').value));
      let pct, importe;
      if (st.modo === 'pct') { pct = Number($('dp-pct').value); importe = r2(total * pct / 100); }
      else { importe = r2(Number($('dp-imp').value)); pct = total > 0 ? r2(importe / total * 100) : 0; }
      const pt = $('dp-ptipo').value; let plazo_at = null;
      if (pt === 'horas') { const h = Number($('dp-horas').value); if (h > 0) plazo_at = new Date(Date.now() + h * 3600e3).toISOString(); }
      if (pt === 'fecha' && $('dp-fecha').value) plazo_at = new Date($('dp-fecha').value).toISOString();
      const regla = $('dp-regla').value;
      const cd = regla === 'personalizada' ? ($('dp-cdias').value === '' ? null : Math.floor(Number($('dp-cdias').value))) : RULES[regla].d;
      const rd = st.formula === 'tapas' ? (priv ? 15 : 10) : (priv ? 15 : 7);
      return {
        formula: st.formula, precio_persona: precio, personas, total, total_manual: $('dp-tman').checked, modo: st.modo, pct, importe, saldo: r2(total - importe),
        metodo: $('dp-metodo').value, plazo_tipo: pt, plazo_horas: pt === 'horas' ? Number($('dp-horas').value) : null, plazo_at,
        control_at: ['antes_llegada', 'en_local', 'libre'].includes(pt) && $('dp-ctrl').value ? new Date($('dp-ctrl').value).toISOString() : (plazo_at || null),
        plazo_texto: ['en_local', 'libre'].includes(pt) ? $('dp-texto').value.trim() : null,
        regla_cancel: regla, cancel_dias: cd, cancel_limite: cd !== null ? minusDays(d.date, cd) : null,
        reduccion_dias: rd, reduccion_limite: minusDays(d.date, rd),
        saldo_texto: $('dp-saldo').value.trim(), liquidacion: $('dp-liq').value, liquidacion_nota: $('dp-liqn').value.trim(), max_pagadores: Number($('dp-maxp').value) || 2
      };
    }
    function errors(x) {
      if (!(x.personas > 0)) return 'El número de personas debe ser mayor que 0.';
      if (!(x.total > 0)) return 'El importe total debe ser mayor que 0.';
      if (x.precio_persona !== null && x.precio_persona < 0) return 'El precio por persona no puede ser negativo.';
      if (st.modo === 'pct' && !(x.pct >= 0 && x.pct <= 100)) return 'El porcentaje debe estar entre 0 y 100.';
      if (st.modo === 'fijo' && !(x.importe >= 0)) return 'El importe no puede ser negativo.';
      if (x.importe > x.total) return 'El anticipo no puede superar el importe total.';
      if (!(x.importe > 0)) return 'El anticipo debe ser mayor que 0.';
      if ((x.plazo_tipo === 'horas' || x.plazo_tipo === 'fecha') && !x.plazo_at) return 'Indica el plazo de pago.';
      if (['antes_llegada', 'en_local', 'libre'].includes(x.plazo_tipo) && !x.control_at) return 'Indica la fecha del control interno.';
      if (x.plazo_tipo === 'libre' && !x.plazo_texto) return 'Escribe el mensaje de plazo para el cliente.';
      if (x.regla_cancel === 'personalizada' && (x.cancel_dias === null || x.cancel_dias < 0)) return 'Indica los días de cancelación.';
      return '';
    }
    function calc() {
      const x = val();
      $('dp-pct-box').style.display = st.modo === 'pct' ? '' : 'none';
      $('dp-fijo-box').style.display = st.modo === 'fijo' ? '' : 'none';
      const pt = x.plazo_tipo;
      $('dp-horas-box').style.display = pt === 'horas' ? '' : 'none';
      $('dp-fecha-box').style.display = pt === 'fecha' ? '' : 'none';
      $('dp-texto-box').style.display = ['en_local', 'libre'].includes(pt) ? '' : 'none';
      $('dp-ctrl-box').style.display = ['antes_llegada', 'en_local', 'libre'].includes(pt) ? '' : 'none';
      $('dp-cdias-box').style.display = x.regla_cancel === 'personalizada' ? '' : 'none';
      $('dp-total').readOnly = !$('dp-tman').checked;
      document.querySelectorAll('#dp-pcts .chip').forEach(b => b.classList.toggle('on', st.modo === 'pct' && Number(b.dataset.p) === x.pct));
      document.querySelectorAll('#dp-hs .chip').forEach(b => b.classList.toggle('on', Number(b.dataset.h) === Number($('dp-horas').value)));
      const e = errors(x); $('dp-err').textContent = e;
      $('dp-calc').innerHTML = e ? '' : `Total <b>${eur(x.total)}</b> · Anticipo <b>${eur(x.importe)}</b> (${r2(x.pct)} %) · Saldo <b>${eur(x.saldo)}</b>`;
      // banco
      const b = ctx.bank;
      $('dp-bank').innerHTML = x.metodo === 'efectivo'
        ? 'Pago en efectivo en el local. La reserva solo se confirma tras el cobro efectivo y tu validación manual.'
        : (b ? `${milesEsc(b.titular)} · ${milesEsc(b.banco || '')}<br><span class="dep-mono">${milesEsc(b.iban)}</span><br>Referencia obligatoria: <span class="dep-mono" id="dp-ref">MILES-${String(d.id).slice(0, 8).toUpperCase()}-…</span><br><button type="button" class="btn btn--ghost" style="margin-top:6px;min-height:36px" id="dp-bank-edit">Modificar datos bancarios</button>` : 'Cargando datos bancarios…');
      const be = $('dp-bank-edit'); if (be) be.onclick = () => openBank(ctx);
      // plazo
      const lim = x.plazo_at || x.control_at; let pc = '';
      if (pt === 'horas' || pt === 'fecha') pc = x.plazo_at ? `El cliente verá: «${plazoClient(x, lang)}»` : '';
      else pc = `El cliente verá: «${plazoClient(x, lang) || '…'}»` + (x.control_at ? `<br>Aviso interno: ${fmtDT(x.control_at)}` : '');
      if (lim && new Date(lim) > eventDT) pc += '<div class="dep-warn">Atención: el plazo termina después del inicio del evento.</div>';
      if (lim && new Date(lim) < new Date()) pc += '<div class="dep-warn">Atención: este plazo ya ha pasado.</div>';
      $('dp-plazo-calc').innerHTML = pc;
      $('dp-cancel-calc').innerHTML = x.cancel_limite ? `Anticipo reembolsable si cancela como muy tarde el <b>${fmtD(x.cancel_limite)}</b>. Después, o si no se presenta, el anticipo se conserva.<br>Reducción del número garantizado posible hasta el <b>${fmtD(x.reduccion_limite)}</b> (${x.reduccion_dias} días antes).` : '';
      // personas fuera de plazo
      let pw = '';
      if (dep && x.personas < dep.personas && dep.reduccion_limite && todayISO() > dep.reduccion_limite) pw = '<div class="dep-warn">Modificación fuera de plazo: se requiere una excepción manual.</div>';
      if (dep && x.personas > dep.personas) pw = '<div class="dep-warn">Aumento sujeto a disponibilidad, capacidad y acuerdo por escrito de la empresa.</div>';
      $('dp-pers-warn').innerHTML = pw;
      if (!bodyDirty) { const t = mailTpl(lang, x, d); $('dp-subj').value = t.s; $('dp-body').value = t.b; }
      $('dp-mail').style.display = $('dp-send').checked ? '' : 'none';
      $('dp-go-mail').style.display = d.email ? '' : 'none';
      $('dp-go-wa').style.display = ctx.waPhone ? '' : 'none';
      return x;
    }
    f.querySelectorAll('input,select,textarea').forEach(el => el.addEventListener('input', calc));
    f.querySelectorAll('select,input[type=checkbox]').forEach(el => el.addEventListener('change', calc));
    $('dp-body').addEventListener('input', () => { bodyDirty = true; });
    $('dp-subj').addEventListener('input', () => { bodyDirty = true; });
    $('dp-regen').onclick = () => { bodyDirty = false; calc(); };
    $('dp-formula').querySelectorAll('.chip').forEach(b => b.onclick = () => {
      st.formula = b.dataset.k; $('dp-formula').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
      if (PRICES[st.formula]) $('dp-precio').value = PRICES[st.formula];
      if (st.formula === 'tapas') { if (!$('dp-saldo').value) $('dp-saldo').value = (T[lang] || T.es).saldo; $('dp-liq').value = 'tickets'; if (!priv && $('dp-regla').value === 'bebidas_7') $('dp-regla').value = 'tapas_10'; }
      if (st.formula === 'bebidas' && !priv && $('dp-regla').value === 'tapas_10') $('dp-regla').value = 'bebidas_7';
      calc();
    });
    $('dp-modo').querySelectorAll('.chip').forEach(b => b.onclick = () => {
      const x = val(); st.modo = b.dataset.k; $('dp-modo').querySelectorAll('.chip').forEach(y => y.classList.toggle('on', y === b));
      if (st.modo === 'fijo' && !$('dp-imp').value) $('dp-imp').value = x.importe || '';
      if (st.modo === 'pct' && x.total > 0 && x.importe) $('dp-pct').value = r2(x.importe / x.total * 100);
      calc();
    });
    $('dp-pcts').querySelectorAll('.chip').forEach(b => b.onclick = () => { $('dp-pct').value = b.dataset.p; calc(); });
    $('dp-hs').querySelectorAll('.chip').forEach(b => b.onclick = () => { $('dp-horas').value = b.dataset.h; calc(); });
    $('dp-ptipo').addEventListener('change', () => { const pt = $('dp-ptipo').value; if (pt === 'en_local' && !$('dp-texto').value) $('dp-texto').value = (T[lang] || T.es).enLocal; if (pt === 'libre' && $('dp-texto').value === (T[lang] || T.es).enLocal) $('dp-texto').value = ''; if (pt === 'en_local') $('dp-ctrl').value = toLocalInput(new Date(eventDT.getTime() - 2 * 3600e3)); calc(); });
    calc();

    async function go(kind) {
      const x = calc(); const e = errors(x);
      if (e) { $('dp-err').textContent = e; $('dp-err').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      const btns = f.querySelectorAll('.dep-actions button'); btns.forEach(b => b.disabled = true);
      const params = { id: d.id, dep: x, send: kind === 'mail', wa_only: kind === 'wa', subject: $('dp-subj').value, body: $('dp-body').value };
      if (kind === 'mail' && !$('dp-body').value.includes('{ENLACE}')) { if (!confirm('El mensaje no contiene {ENLACE}: el cliente no recibirá el enlace de pago. ¿Enviar igualmente?')) { btns.forEach(b => b.disabled = false); return; } }
      const r = await adminCall('deposit_save', params);
      if (!r || !r.ok) { $('dp-err').textContent = 'Error: ' + ((r && r.error) || 'desconocido'); btns.forEach(b => b.disabled = false); return; }
      if (priv && $('dp-block')) await adminCall('set_bloquea_sala', { id: d.id, value: $('dp-block').checked });
      f.innerHTML = '';
      let html = '';
      if (kind === 'mail') html = r.email && r.email.sent ? '<p><b>Guardado. Email enviado al cliente.</b></p>' : `<p class="dep-err">Guardado, pero el email no salió (${milesEsc((r.email && r.email.reason) || 'error')}). Usa WhatsApp o copia el enlace.</p>`;
      else if (kind === 'wa') html = '<p><b>Guardado. Enlace de pago creado.</b></p>';
      else html = `<p><b>Guardado${dep ? '' : ' como pre-validado'}.</b> ${dep && dep.sent_at ? 'El enlace actual sigue válido.' : 'No se ha enviado nada al cliente.'}</p>`;
      if (r.link) {
        const wa = ctx.waPhone ? `https://wa.me/${ctx.waPhone}?text=${encodeURIComponent(waTpl(lang, x, d, r.link))}` : '';
        html += `<div class="dep-calc">Enlace de pago del cliente:<br><span class="dep-mono">${milesEsc(r.link)}</span></div>
          <div class="dep-actions">${wa ? `<a class="btn btn--wa" href="${wa}" target="_blank" rel="noopener" id="dp-wa-open">Abrir WhatsApp del cliente con el mensaje</a>` : ''}
          <button class="btn btn--ghost" id="dp-copy">Copiar enlace</button></div>`;
      }
      html += '<div class="dep-actions"><button class="btn btn--primary" onclick="location.reload()">Cerrar</button></div>';
      document.getElementById('dep-result').innerHTML = html;
      const cp = document.getElementById('dp-copy'); if (cp) cp.onclick = () => navigator.clipboard.writeText(r.link).then(() => cp.textContent = 'Enlace copiado');
      if (kind === 'wa' && ctx.waPhone) { const a = document.getElementById('dp-wa-open'); if (a) window.open(a.href, '_blank'); }
    }
    $('dp-go-mail').onclick = () => go('mail');
    $('dp-go-wa').onclick = () => go('wa');
    $('dp-go-save').onclick = () => go('save');
    document.getElementById('dep-modal').classList.add('open');
    document.querySelector('#dep-modal .adm-modal__box').scrollTop = 0;
  }

  function openBank(ctx) {
    ensureModal();
    const b = ctx.bank || {};
    const $ = id => document.getElementById(id);
    $('bk-tit').value = b.titular || ''; $('bk-cif').value = b.cif || ''; $('bk-iban').value = b.iban || ''; $('bk-banco').value = b.banco || ''; $('bk-bic').value = b.bic || ''; $('bk-pw').value = ''; $('bk-status').textContent = '';
    $('bk-save').onclick = async () => {
      $('bk-save').disabled = true; $('bk-status').textContent = 'Guardando…';
      const r = await adminCall('billing_update', { password: $('bk-pw').value, titular: $('bk-tit').value, cif: $('bk-cif').value, iban: $('bk-iban').value, banco: $('bk-banco').value, bic: $('bk-bic').value });
      $('bk-save').disabled = false;
      if (r && r.ok) { $('bk-status').textContent = ''; location.reload(); return; }
      const E = { invalid_password: 'Contraseña incorrecta.', iban_invalido: 'IBAN no válido (revisa los dígitos).', titular_obligatorio: 'Falta el titular.', too_many_attempts: 'Demasiados intentos. Espera 15 minutos.' };
      $('bk-status').textContent = E[r && r.error] || ('Error: ' + ((r && r.error) || ''));
    };
    document.getElementById('bank-modal').classList.add('open');
  }

  // ---------- Sección en la ficha ----------
  async function render(ctx) {
    const { d } = ctx; const root = document.getElementById('anticipo-root'); if (!root) return;
    const cancelled = isCancelledStatus(d.status);
    const r = await adminCall('deposit_get', { id: d.id });
    const dep = r && r.deposit; ctx.dep = dep; ctx.bank = r && r.billing;
    if (!dep) {
      root.innerHTML = cancelled || d.status === 'confirmed' ? '' : `<div class="section" style="margin-bottom:16px"><h2>Anticipo</h2><p style="font-size:14px;color:var(--color-text-muted)">Sin anticipo. Puedes validar la reserva pidiendo un anticipo.</p><button class="btn btn--primary" id="dep-new">Validar y pedir anticipo</button></div>`;
      const b = document.getElementById('dep-new'); if (b) b.onclick = () => openForm(ctx);
      return;
    }
    const al = milesDepAlert({ ...d, dep });
    const plazoAdm = (dep.plazo_tipo === 'horas' || dep.plazo_tipo === 'fecha') ? (dep.plazo_at ? fmtDT(dep.plazo_at) : '—') : (dep.plazo_tipo === 'antes_llegada' ? 'Antes de la llegada al local' : (dep.plazo_texto || '—'));
    const kv = (k, v) => `<div class="kv"><b>${k}</b><span>${v}</span></div>`;
    const rows = [
      kv('Estado del pago', `<b>${ESTADO_ADM[dep.estado_pago]}</b>`),
      kv('Personas garantizadas', dep.personas),
      kv('Fórmula', FORMULA_ADM[dep.formula] + (dep.precio_persona && dep.formula === 'personalizada' ? ` · ${eur(dep.precio_persona)}/pers.` : '')),
      kv('Importe total', eur(dep.total) + (dep.total_manual ? ' (personalizado)' : '')),
      kv('Anticipo', `${eur(dep.importe)} (${r2(dep.pct)} %)`),
      kv('Saldo', `${eur(dep.saldo)}${Number(dep.saldo) > 0 ? (dep.saldo_estado === 'recibido' ? ' · recibido' : ' · pendiente') : ''}`),
      kv('Forma de pago', METODO_ADM[dep.metodo]),
      kv('Plazo (cliente)', milesEsc(plazoAdm)),
      dep.control_at && !['horas', 'fecha'].includes(dep.plazo_tipo) ? kv('Control interno', fmtDT(dep.control_at)) : '',
      dep.metodo !== 'efectivo' ? kv('Referencia transferencia', `<span class="dep-mono">${milesEsc(dep.referencia)}</span> <button class="btn btn--ghost" style="min-height:30px;padding:0 10px;margin-left:6px" id="dep-copy-ref">Copiar</button>`) : '',
      kv('Cancelación', dep.cancel_limite ? `Reembolsable hasta el ${fmtD(dep.cancel_limite)} (${dep.cancel_dias} días · ${milesEsc((RULES[dep.regla_cancel] || {}).l || '')})` : '—'),
      kv('Reducción nº garantizado', dep.reduccion_limite ? `hasta el ${fmtD(dep.reduccion_limite)}${todayISO() > dep.reduccion_limite ? ' · <b>plazo pasado</b>' : ''}` : '—'),
      kv('Liquidación final', milesEsc(LIQ[dep.liquidacion] || '—') + (dep.liquidacion_nota ? ' · ' + milesEsc(dep.liquidacion_nota) : '') + ` · máx. ${dep.max_pagadores} pers.`),
      dep.sent_at ? kv('Enviado', fmtReceived(dep.sent_at)) : '',
      dep.declared_at ? kv('Declaración de pago', `${fmtReceived(dep.declared_at)} · ${dep.declared_by === 'cliente' ? 'por el cliente' : 'marcado por el equipo'}${dep.declared_metodo ? ' · ' + METODO_ADM[dep.declared_metodo] : ''}`) : '',
      dep.accepted_at ? kv('Condiciones aceptadas', `${fmtReceived(dep.accepted_at)} · ${milesEsc(dep.cgv_version || '')} · ${(dep.accepted_lang || '').toUpperCase()}`) : '',
      dep.verified_at ? kv('Pago verificado', `${fmtReceived(dep.verified_at)} · ${METODO_ADM[dep.verified_metodo] || ''}`) : ''
    ].join('');
    const priv = isPriv(d);
    const btn = (id, label, cls = 'btn--ghost') => `<button class="btn ${cls}" id="${id}">${label}</button>`;
    let acts = '';
    if (!cancelled) {
      if (dep.estado_pago === 'pendiente' || dep.estado_pago === 'declarado') acts += btn('dep-verify', 'Pago recibido y verificado…', 'btn--primary');
      if (dep.estado_pago === 'pendiente') acts += btn('dep-declared', 'Marcar «el cliente dice haber pagado»');
      if (dep.estado_pago === 'verificado' && d.status !== 'confirmed') acts += btn('dep-confirm', 'Confirmar la reserva', 'btn--primary');
      if (dep.estado_pago === 'verificado' && Number(dep.saldo) > 0 && dep.saldo_estado === 'pendiente') acts += btn('dep-saldo', 'Saldo recibido');
      if (dep.saldo_estado === 'recibido') acts += btn('dep-saldo-undo', 'Saldo: volver a pendiente');
      if (dep.estado_pago === 'borrador') acts += btn('dep-send', 'Enviar la solicitud de anticipo', 'btn--primary');
      acts += btn('dep-edit', dep.estado_pago === 'borrador' ? 'Modificar' : 'Modificar / prolongar plazo / relanzar');
      if (dep.estado_pago === 'verificado' || dep.estado_pago === 'declarado') acts += btn('dep-undo', 'Volver a «pago pendiente»');
    }
    root.innerHTML = `<div class="section" style="margin-bottom:16px">
      <h2>Anticipo</h2>
      ${al ? `<div class="${al.late ? 'na-late' : 'small-muted'}" style="margin:0 0 8px">${milesEsc(al.label)}</div>` : ''}
      <div class="kv-list">${rows}</div>
      ${priv && d.status === 'deposit' ? `<label class="inline" style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:14px"><input type="checkbox" id="dep-block" style="width:20px;height:20px" ${d.bloqueaSala ? 'checked' : ''}> Bloquear la sala en la web mientras el pago está pendiente</label><div id="dep-block-st" class="small-muted"></div>` : ''}
      <div class="dep-actions">${acts}</div>
      ${dep.metodo !== 'efectivo' && ctx.bank ? `<p class="small-muted" style="margin-top:10px">Cuenta mostrada al cliente: ${milesEsc(ctx.bank.titular)} · <span class="dep-mono">${milesEsc(ctx.bank.iban)}</span> · <a href="#" id="dep-bank">modificar</a></p>` : ''}
    </div>`;
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    const mark = async (what, metodo) => { const x = await adminCall('deposit_mark', { id: d.id, what, metodo }); if (x && x.ok) location.reload(); else alert('Error: ' + ((x && x.error) || '')); };
    on('dep-copy-ref', () => navigator.clipboard.writeText(dep.referencia));
    on('dep-edit', () => openForm(ctx));
    on('dep-send', () => openForm(ctx));
    on('dep-bank', e => { e.preventDefault(); openBank(ctx); });
    on('dep-declared', () => { if (confirm('¿El cliente te ha dicho que ya ha pagado? Esto NO confirma nada: queda pendiente de verificación.')) mark('declarado'); });
    on('dep-verify', () => { ensureModal(); document.querySelectorAll('#verify-modal [data-vm]').forEach(b => b.onclick = () => mark('verificado', b.dataset.vm)); document.getElementById('verify-modal').classList.add('open'); });
    on('dep-saldo', () => { if (confirm(`¿Confirmas que has recibido el saldo de ${eur(dep.saldo)}?`)) mark('saldo_recibido'); });
    on('dep-saldo-undo', () => mark('saldo_pendiente'));
    on('dep-undo', () => { if (confirm('¿Volver a «pago pendiente»?')) mark('pendiente'); });
    on('dep-confirm', () => { if (typeof window.milesOpenNotify === 'function') window.milesOpenNotify('confirmed'); });
    const cb = document.getElementById('dep-block');
    if (cb) cb.onchange = async () => { const x = await adminCall('set_bloquea_sala', { id: d.id, value: cb.checked }); document.getElementById('dep-block-st').textContent = x && x.ok ? (cb.checked ? 'Sala bloqueada en la web.' : 'Sala disponible en la web.') : 'Error'; };
  }

  window.milesAnticipo = {
    init(d, waPhone) { const ctx = { d, waPhone }; window.milesOpenAnticipo = () => openForm(ctx); render(ctx); }
  };
})();
