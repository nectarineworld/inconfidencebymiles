/* miles-factura.js — Facturas en la ficha (back-office).
 * El cliente puede rellenar sus datos; nada se emite sin validación. El número se asigna solo al emitir (sin huecos).
 */
(function () {
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = n => { const v = Math.round((Number(n) || 0) * 100) / 100; const [e, c] = Math.abs(v).toFixed(2).split('.'); return (v < 0 ? '−' : '') + e.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + c + ' €'; };
  const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const num = v => Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')) || 0;
  const dmy = iso => String(iso || '').slice(0, 10).split('-').reverse().join('/');
  const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const ESTADO = { enlace_enviado: 'Enlace enviado · esperando los datos del cliente', solicitada: 'El cliente ha enviado sus datos · revisa y valida', borrador: 'Borrador · sin emitir', emitida: 'Emitida' };
  const TX = {
    es: { ls: 'Datos para tu factura · MILES', lb: (n, f) => `Hola ${n},\n\nPara preparar la factura de tu evento del ${f}, indícanos tus datos fiscales en este enlace:\n{ENLACE}\n\nRevisaremos la factura y te la enviaremos por email.\n\nEl equipo de MILES`,
      fs: 'Factura {NUMERO} · MILES', fb: (n, f, t) => `Hola ${n},\n\nTe enviamos adjunta la factura {NUMERO} de tu evento del ${f}.\n\nImporte total: ${t}\n\nSi necesitas cualquier cosa, escríbenos únicamente por WhatsApp al +34 932 47 26 54.\n\nEl equipo de MILES` },
    en: { ls: 'Your invoice details · MILES', lb: (n, f) => `Hello ${n},\n\nTo prepare the invoice for your event on ${f}, please enter your billing details here:\n{ENLACE}\n\nWe will review the invoice and send it to you by email.\n\nThe MILES team`,
      fs: 'Invoice {NUMERO} · MILES', fb: (n, f, t) => `Hello ${n},\n\nPlease find attached invoice {NUMERO} for your event on ${f}.\n\nTotal amount: ${t}\n\nIf you need anything, contact us on WhatsApp only at +34 932 47 26 54.\n\nThe MILES team` },
    fr: { ls: 'Vos informations de facturation · MILES', lb: (n, f) => `Bonjour ${n},\n\nPour préparer la facture de votre événement du ${f}, indiquez-nous vos informations fiscales via ce lien :\n{ENLACE}\n\nNous vérifierons la facture et vous l’enverrons par email.\n\nL’équipe MILES`,
      fs: 'Facture {NUMERO} · MILES', fb: (n, f, t) => `Bonjour ${n},\n\nVous trouverez ci-joint la facture {NUMERO} de votre événement du ${f}.\n\nMontant total : ${t}\n\nPour toute question, écrivez-nous uniquement sur WhatsApp au +34 932 47 26 54.\n\nL’équipe MILES` },
    ca: { ls: 'Dades per a la teva factura · MILES', lb: (n, f) => `Hola ${n},\n\nPer preparar la factura del teu esdeveniment del ${f}, indica’ns les teves dades fiscals en aquest enllaç:\n{ENLACE}\n\nRevisarem la factura i te l’enviarem per email.\n\nL’equip de MILES`,
      fs: 'Factura {NUMERO} · MILES', fb: (n, f, t) => `Hola ${n},\n\nT’enviem adjunta la factura {NUMERO} del teu esdeveniment del ${f}.\n\nImport total: ${t}\n\nPer a qualsevol cosa, escriu-nos només per WhatsApp al +34 932 47 26 54.\n\nL’equip de MILES` },
  };

  let d, waPhone, S = null, editing = null;
  const $ = id => document.getElementById(id);
  const lang = () => (['es', 'en', 'fr', 'ca'].includes(d.idioma) ? d.idioma : 'es');
  const first = () => (d.nombre || '').split(' ')[0];

  function modals() {
    if ($('fac-modal')) return;
    const w = document.createElement('div');
    w.innerHTML = `
<div id="fac-modal" class="adm-modal"><div class="adm-modal__box dep-box">
  <h3>Factura · revisar y validar</h3>
  <p id="fac-state" style="margin-bottom:6px"></p>
  <div id="fac-com"></div>
  <div class="dep-sec"><h4>Cliente</h4>
    <label>Razón social o nombre *</label><input id="fc-razon_social" maxlength="160">
    <div class="dep-grid"><div><label>CIF / NIF *</label><input id="fc-cif" maxlength="30"></div><div><label>Email de envío</label><input id="fc-email" type="email" maxlength="160"></div></div>
    <label>Dirección fiscal *</label><input id="fc-direccion" maxlength="200">
    <div class="dep-grid"><div><label>Código postal *</label><input id="fc-cp" maxlength="12"></div><div><label>Ciudad *</label><input id="fc-ciudad" maxlength="80"></div></div>
    <div class="dep-grid"><div><label>Provincia</label><input id="fc-provincia" maxlength="80"></div><div><label>País</label><input id="fc-pais" maxlength="60"></div></div>
    <div class="dep-grid"><div><label>Contacto</label><input id="fc-contacto" maxlength="120"></div><div><label>Nº de pedido / ref. del cliente</label><input id="fc-pedido" maxlength="60"></div></div>
  </div>
  <div class="dep-sec"><h4>Conceptos (precios IVA incluido)</h4>
    <div id="fac-lines"></div>
    <button type="button" class="btn btn--ghost" id="fac-add" style="margin-top:6px">+ Añadir línea</button>
    <div class="dep-grid"><div><label>IVA</label><select id="fac-iva"><option value="10">10 % (hostelería)</option><option value="21">21 %</option><option value="4">4 %</option><option value="0">0 %</option></select></div>
    <div><label>Pagos ya recibidos (€)</label><input id="fac-pag" inputmode="decimal" placeholder="0"></div></div>
    <div class="dep-calc" id="fac-calc"></div>
  </div>
  <div class="dep-sec"><h4>Textos</h4>
    <label>Descripción del servicio (opcional)</label><textarea id="fac-desc" style="min-height:60px" maxlength="600"></textarea>
    <label>Condiciones de pago</label><textarea id="fac-cond" style="min-height:60px" maxlength="600"></textarea>
    <label class="inline" style="font-weight:400"><input type="checkbox" id="fac-banco"> Mostrar los datos bancarios en la factura</label>
    <label>Observaciones (opcional)</label><textarea id="fac-obs" style="min-height:50px" maxlength="800"></textarea>
    <label>Fecha de emisión</label><input id="fac-fe" type="date">
  </div>
  <div class="dep-actions">
    <button class="btn btn--ghost" id="fac-save">Guardar borrador</button>
    <button class="btn btn--ghost" id="fac-prev">Ver el PDF (borrador)</button>
    <button class="btn btn--primary" id="fac-emit">Validar y emitir…</button>
    <button class="btn btn--ghost" onclick="closeM('fac-modal')">Cerrar</button>
  </div>
  <p id="fac-st" style="margin-top:10px"></p>
</div></div>

<div id="fac-emit-modal" class="adm-modal"><div class="adm-modal__box dep-box">
  <h3>Emitir la factura</h3>
  <p id="fe-lead"></p>
  <div class="dep-calc" id="fe-num"></div>
  <label class="inline" style="font-weight:400"><input type="checkbox" id="fe-send"> Enviar la factura por email (PDF adjunto)</label>
  <div id="fe-fields"><label>Para</label><input id="fe-to" type="email"><label>Asunto</label><input id="fe-subject" maxlength="200"><label>Mensaje</label><textarea id="fe-body" style="min-height:200px"></textarea></div>
  <div class="adm-modal__row"><button class="btn btn--ghost" onclick="closeM('fac-emit-modal')">Volver</button><button class="btn btn--primary" id="fe-ok">Emitir definitivamente</button></div>
  <p id="fe-st" style="margin-top:10px"></p>
</div></div>

<div id="fac-link-modal" class="adm-modal"><div class="adm-modal__box dep-box">
  <h3>Pedir los datos de facturación al cliente</h3>
  <p>El cliente recibe un enlace seguro, rellena sus datos fiscales y tú recibes un aviso. La factura no se emite hasta que la valides.</p>
  <div class="dep-row"><button class="chip on" data-ch="email" type="button">Por email</button><button class="chip" data-ch="wa" type="button">Por WhatsApp</button></div>
  <div id="fl-subj"><label>Asunto</label><input id="fl-subject" maxlength="200"></div>
  <label>Mensaje</label><textarea id="fl-body" style="min-height:200px"></textarea>
  <p class="small-muted" style="font-size:12.5px">{ENLACE} se sustituye por el enlace personal del cliente.</p>
  <div class="adm-modal__row"><button class="btn btn--ghost" onclick="closeM('fac-link-modal')">Volver</button><button class="btn btn--primary" id="fl-ok">Enviar</button></div>
  <p id="fl-st" style="margin-top:10px"></p>
</div></div>

<div id="fac-send-modal" class="adm-modal"><div class="adm-modal__box dep-box">
  <h3>Reenviar la factura</h3>
  <label>Para</label><input id="fs-to" type="email"><label>Asunto</label><input id="fs-subject" maxlength="200"><label>Mensaje</label><textarea id="fs-body" style="min-height:180px"></textarea>
  <div class="adm-modal__row"><button class="btn btn--ghost" onclick="closeM('fac-send-modal')">Volver</button><button class="btn btn--primary" id="fs-ok">Enviar</button></div>
  <p id="fs-st" style="margin-top:10px"></p>
</div></div>`;
    document.body.appendChild(w);
  }
  const open = id => $(id).classList.add('open');

  async function pdfLink(invoiceId, holder) {
    holder.innerHTML = 'Generando el PDF…';
    const r = await adminCall('invoice_pdf', { invoice_id: invoiceId });
    if (!r || !r.ok) { holder.textContent = 'Error al generar el PDF: ' + ((r && r.error) || ''); return; }
    const bin = atob(r.pdf); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([u8], { type: 'application/pdf' }));
    holder.innerHTML = `<a class="btn btn--primary" style="display:block;text-align:center;margin-top:6px" href="${url}" target="_blank" rel="noopener" download="${esc(r.filename)}">Abrir ${esc(r.filename)}</a>`;
  }

  // ---------- Editor ----------
  function lineRow(l, i) {
    return `<div class="fac-line" data-i="${i}" style="border:1px solid var(--color-border-subtle);border-radius:8px;padding:8px;margin:6px 0">
      <input class="fl-c" placeholder="Concepto (p. ej. Fórmula tapas + bebida)" value="${esc(l.concepto)}" maxlength="200">
      <div style="display:flex;gap:6px;margin-top:6px;align-items:center">
        <input class="fl-q" inputmode="decimal" style="width:30%" value="${esc(String(l.cantidad ?? 1).replace('.', ','))}" aria-label="Cantidad">
        <span>×</span><input class="fl-p" inputmode="decimal" style="width:38%" value="${esc(String(l.precio ?? 0).replace('.', ','))}" aria-label="Precio IVA incluido">
        <span>€</span><button type="button" class="btn btn--ghost fl-x" style="min-height:38px;padding:0 10px;width:auto" aria-label="Quitar línea">✕</button>
      </div></div>`;
  }
  const readLines = () => [...document.querySelectorAll('#fac-lines .fac-line')].map(el => ({ concepto: el.querySelector('.fl-c').value.trim(), cantidad: num(el.querySelector('.fl-q').value), precio: num(el.querySelector('.fl-p').value) }));
  function drawLines(ls) {
    $('fac-lines').innerHTML = ls.map(lineRow).join('');
    document.querySelectorAll('#fac-lines input').forEach(x => x.oninput = calc);
    document.querySelectorAll('#fac-lines .fl-x').forEach(b => b.onclick = () => { const ls2 = readLines(); ls2.splice(Number(b.closest('.fac-line').dataset.i), 1); drawLines(ls2); calc(); });
  }
  function calc() {
    const ls = readLines().filter(l => l.concepto);
    const iva = Number($('fac-iva').value);
    const total = r2(ls.reduce((s, l) => s + r2(l.cantidad * l.precio), 0));
    const base = r2(total / (1 + iva / 100));
    const pag = num($('fac-pag').value);
    $('fac-calc').innerHTML = ls.map(l => `${esc(l.concepto)}: ${String(l.cantidad).replace('.', ',')} × ${eur(l.precio)} = <b>${eur(l.cantidad * l.precio)}</b>`).join('<br>') +
      `<br>Base imponible ${eur(base)} · IVA ${iva} % ${eur(total - base)}<br><b>TOTAL ${eur(total)}</b>` + (pag > 0 ? `<br>Pagos recibidos −${eur(pag)} · <b>Pendiente ${eur(Math.max(0, total - pag))}</b>` : '') +
      (ls.some(l => !(l.precio > 0)) ? '<div class="dep-warn">Hay una línea sin precio.</div>' : '');
  }
  const CF = ['razon_social', 'cif', 'email', 'direccion', 'cp', 'ciudad', 'provincia', 'pais', 'contacto', 'pedido'];
  function fill(inv) {
    editing = inv;
    const c = inv.cliente || {};
    CF.forEach(k => { $('fc-' + k).value = c[k] || ''; $('fc-' + k).classList.remove('bad'); });
    $('fac-com').innerHTML = c.comentario ? `<div class="dep-warn"><b>Comentario del cliente:</b> ${esc(c.comentario)}</div>` : '';
    $('fac-state').textContent = ESTADO[inv.estado] || '';
    drawLines(inv.lineas && inv.lineas.length ? inv.lineas : [{ concepto: '', cantidad: 1, precio: 0 }]);
    $('fac-iva').value = String(Number(inv.iva_pct ?? 10));
    $('fac-pag').value = inv.anticipo_pagado ? String(inv.anticipo_pagado).replace('.', ',') : '';
    $('fac-desc').value = inv.descripcion || ''; $('fac-cond').value = inv.condiciones_pago || ''; $('fac-banco').checked = !!inv.mostrar_banco;
    $('fac-obs').value = inv.observaciones || ''; $('fac-fe').value = inv.fecha_emision || todayISO();
    $('fac-st').textContent = '';
    $('fac-iva').onchange = calc; $('fac-pag').oninput = calc;
    $('fac-add').onclick = () => { const ls = readLines(); ls.push({ concepto: '', cantidad: 1, precio: 0 }); drawLines(ls); calc(); };
    calc();
  }
  const collect = () => ({
    cliente: Object.assign({}, (editing && editing.cliente) || {}, Object.fromEntries(CF.map(k => [k, $('fc-' + k).value.trim()]))),
    lineas: readLines().filter(l => l.concepto), iva_pct: Number($('fac-iva').value), anticipo_pagado: $('fac-pag').value.trim(),
    descripcion: $('fac-desc').value, condiciones_pago: $('fac-cond').value, mostrar_banco: $('fac-banco').checked, observaciones: $('fac-obs').value, fecha_emision: $('fac-fe').value,
  });
  async function save() {
    const r = await adminCall('invoice_save', { id: d.id, inv: collect() });
    if (!r || !r.ok) throw new Error((r && r.error) || 'error');
    if (editing) editing.id = r.invoice_id;
    return r;
  }
  function openEditor(inv) {
    modals(); fill(inv); open('fac-modal');
    $('fac-save').onclick = async () => { $('fac-st').textContent = 'Guardando…'; try { await save(); $('fac-st').textContent = 'Borrador guardado.'; refresh(); } catch (e) { $('fac-st').textContent = 'Error: ' + e.message; } };
    $('fac-prev').onclick = async () => { $('fac-st').textContent = 'Guardando…'; try { const r = await save(); await pdfLink(r.invoice_id, $('fac-st')); refresh(); } catch (e) { $('fac-st').textContent = 'Error: ' + e.message; } };
    $('fac-emit').onclick = async () => {
      const x = collect(); const miss = ['razon_social', 'cif', 'direccion', 'cp', 'ciudad'].filter(k => !x.cliente[k]);
      miss.forEach(k => $('fc-' + k).classList.add('bad'));
      if (miss.length) { $('fac-st').textContent = 'Faltan datos obligatorios del cliente (marcados en rojo).'; $('fc-' + miss[0]).focus(); return; }
      if (!x.lineas.length) { $('fac-st').textContent = 'Añade al menos un concepto.'; return; }
      $('fac-st').textContent = 'Guardando…';
      let r; try { r = await save(); } catch (e) { $('fac-st').textContent = 'Error: ' + e.message; return; }
      if (!(r.total > 0)) { $('fac-st').textContent = 'El total es 0 €.'; return; }
      $('fac-st').textContent = '';
      openEmit(r.invoice_id, r.total, x);
    };
  }
  async function openEmit(invoiceId, total, x) {
    const g = await adminCall('invoice_get', { id: d.id, anio: Number((x.fecha_emision || todayISO()).slice(0, 4)) });
    const T = TX[lang()];
    $('fe-lead').innerHTML = `Vas a emitir la factura de <b>${esc(x.cliente.razon_social)}</b> (${esc(x.cliente.cif)}) por <b>${eur(total)}</b>. Una vez emitida no se puede modificar ni borrar: si hay un error, se hace una factura rectificativa.`;
    const anio = (x.fecha_emision || todayISO()).slice(0, 4);
    const drawNum = n => { $('fe-num').innerHTML = `Número que se asignará: <b>${esc(n)}</b> <button type="button" class="btn btn--ghost" id="fe-cnt" style="min-height:32px;padding:0 10px;width:auto;margin-left:6px">Cambiar numeración</button>`; $('fe-cnt').onclick = setCounter; };
    const setCounter = async () => {
      const v = prompt(`Último número de factura YA emitido en ${anio} (solo la cifra, p. ej. 34 si la última fue FAC-${anio}-034):`);
      if (v === null) return;
      const r = await adminCall('invoice_counter_set', { anio: Number(anio), ultimo: Number(v) });
      if (r && r.ok) drawNum(r.next_numero); else alert(r && r.error === 'inferior_a_emitidas' ? 'Ya hay facturas emitidas con un número superior.' : 'Valor no válido.');
    };
    let nn = g && g.next_numero; if (nn && !nn.includes('-' + anio + '-')) nn = `FAC-${anio}-…`;
    drawNum(nn || '—');
    const to = x.cliente.email || d.email || '';
    $('fe-send').checked = !!to; $('fe-fields').style.display = to ? '' : 'none';
    $('fe-send').onchange = () => { $('fe-fields').style.display = $('fe-send').checked ? '' : 'none'; };
    $('fe-to').value = to; $('fe-subject').value = T.fs; $('fe-body').value = T.fb(x.cliente.contacto ? x.cliente.contacto.split(' ')[0] : first(), dmy(d.date), eur(total));
    $('fe-st').textContent = ''; $('fe-ok').disabled = false;
    open('fac-emit-modal');
    $('fe-ok').onclick = async () => {
      $('fe-ok').disabled = true; $('fe-st').textContent = 'Emitiendo…';
      const r = await adminCall('invoice_emit', { invoice_id: invoiceId, send_email: $('fe-send').checked, to: $('fe-to').value.trim(), subject: $('fe-subject').value, body: $('fe-body').value });
      if (!r || !r.ok) { $('fe-ok').disabled = false; $('fe-st').textContent = 'Error: ' + ((r && (r.error + (r.campos ? ' (' + r.campos.join(', ') + ')' : ''))) || ''); return; }
      $('fe-st').textContent = `Factura ${r.numero} emitida.` + ($('fe-send').checked ? (r.email && r.email.sent ? ' Email enviado.' : ' Email NO enviado (' + ((r.email && r.email.reason) || '') + ').') : '');
      setTimeout(() => location.reload(), 1800);
    };
  }

  // ---------- Enlace al cliente ----------
  function openLink() {
    modals();
    const T = TX[lang()];
    let ch = d.email ? 'email' : 'wa';
    const chips = document.querySelectorAll('#fac-link-modal [data-ch]');
    const setCh = c => { ch = c; chips.forEach(b => b.classList.toggle('on', b.dataset.ch === c)); $('fl-subj').style.display = c === 'email' ? '' : 'none'; $('fl-ok').textContent = c === 'email' ? 'Enviar por email' : 'Preparar el WhatsApp'; };
    chips.forEach(b => { b.disabled = (b.dataset.ch === 'email' && !d.email) || (b.dataset.ch === 'wa' && !waPhone); b.onclick = () => setCh(b.dataset.ch); });
    setCh(ch);
    $('fl-subject').value = T.ls; $('fl-body').value = T.lb(first(), dmy(d.date)); $('fl-st').textContent = ''; $('fl-ok').disabled = false;
    open('fac-link-modal');
    $('fl-ok').onclick = async () => {
      $('fl-ok').disabled = true; $('fl-st').textContent = 'Preparando…';
      const r = await adminCall('invoice_link', { id: d.id, send_email: ch === 'email', subject: $('fl-subject').value, body: $('fl-body').value });
      if (!r || !r.ok) { $('fl-ok').disabled = false; $('fl-st').textContent = 'Error: ' + ((r && r.error) || ''); return; }
      if (ch === 'email') { $('fl-st').textContent = r.email && r.email.sent ? 'Email enviado al cliente.' : 'Email NO enviado (' + ((r.email && r.email.reason) || '') + ').'; setTimeout(() => location.reload(), 1500); return; }
      const msg = $('fl-body').value.replace('{ENLACE}', r.link);
      $('fl-st').innerHTML = `<a class="btn btn--wa" style="display:block;text-align:center" target="_blank" rel="noopener" href="https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}">Enviar el mensaje por WhatsApp</a><button class="btn btn--ghost" style="width:100%;margin-top:8px" onclick="location.reload()">Cerrar</button>`;
    };
  }

  // ---------- Sección en la ficha ----------
  async function refresh() {
    const root = $('factura-root'); if (!root) return;
    const g = await adminCall('invoice_get', { id: d.id });
    if (!g || !g.ok) { root.innerHTML = ''; return; }
    S = g;
    const emitted = g.invoices.filter(x => x.estado === 'emitida');
    const openInv = g.invoices.find(x => x.estado !== 'emitida');
    const em = emitted.map(x => `<div class="kv" style="flex-wrap:wrap"><b>${esc(x.numero)}</b><span>${eur(x.total)} · ${dmy(x.fecha_emision)}${x.sent_at ? ' · enviada a ' + esc(x.sent_to) : ''}${x.pagada ? ' · <b style="color:#2E7D4F">pagada</b>' : ''}</span></div>
      <div class="dep-row"><button class="chip" data-pdf="${x.id}">PDF</button><button class="chip" data-send="${x.id}">Reenviar</button><button class="chip" data-paid="${x.id}" data-v="${x.pagada ? 0 : 1}">${x.pagada ? 'Marcar no pagada' : 'Marcar pagada'}</button></div>`).join('');
    let op = '';
    if (openInv) {
      const hot = openInv.estado === 'solicitada';
      op = `<div class="${hot ? 'dep-warn' : 'dep-calc'}" style="margin-top:8px"><b>${esc(ESTADO[openInv.estado])}</b>${openInv.cliente && openInv.cliente.razon_social ? '<br>' + esc(openInv.cliente.razon_social) + ' · ' + esc(openInv.cliente.cif || '') : ''}<br>Total previsto: ${eur(openInv.total)}</div>
        <div class="dep-actions"><button class="btn btn--primary" id="fac-open">Revisar y validar…</button>
        <button class="btn btn--ghost" id="fac-relink">${openInv.estado === 'enlace_enviado' ? 'Reenviar el enlace al cliente…' : 'Pedir los datos al cliente…'}</button>
        <button class="btn btn--ghost" id="fac-del">Eliminar el borrador</button></div>`;
    } else {
      op = `<div class="dep-actions"><button class="btn btn--primary" id="fac-ask">Pedir los datos al cliente…</button><button class="btn btn--ghost" id="fac-new">Crear la factura yo mismo…</button></div>`;
    }
    root.innerHTML = `<div class="section" style="margin-bottom:16px"><h2>Factura</h2>${em ? '<div class="kv-list">' + em + '</div>' : ''}${op}<div id="fac-out" style="margin-top:6px;font-size:14px"></div></div>`;
    root.querySelectorAll('[data-pdf]').forEach(b => b.onclick = () => pdfLink(b.dataset.pdf, $('fac-out')));
    root.querySelectorAll('[data-paid]').forEach(b => b.onclick = async () => { await adminCall('invoice_paid', { invoice_id: b.dataset.paid, value: b.dataset.v === '1' }); refresh(); });
    root.querySelectorAll('[data-send]').forEach(b => b.onclick = () => {
      modals(); const x = emitted.find(i => i.id === b.dataset.send); const T = TX[lang()];
      $('fs-to').value = (x.cliente && x.cliente.email) || d.email || ''; $('fs-subject').value = T.fs.replace('{NUMERO}', x.numero);
      $('fs-body').value = T.fb((x.cliente && x.cliente.contacto ? x.cliente.contacto.split(' ')[0] : first()), dmy(d.date), eur(x.total)).replace(/\{NUMERO\}/g, x.numero);
      $('fs-st').textContent = ''; $('fs-ok').disabled = false; open('fac-send-modal');
      $('fs-ok').onclick = async () => { $('fs-ok').disabled = true; $('fs-st').textContent = 'Enviando…'; const r = await adminCall('invoice_send', { invoice_id: x.id, to: $('fs-to').value.trim(), subject: $('fs-subject').value, body: $('fs-body').value }); $('fs-st').textContent = r && r.ok && r.email && r.email.sent ? 'Email enviado.' : 'Error: ' + ((r && (r.error || (r.email && r.email.reason))) || ''); if (r && r.ok) setTimeout(() => location.reload(), 1500); else $('fs-ok').disabled = false; };
    });
    const bo = $('fac-open'); if (bo) bo.onclick = () => openEditor(openInv);
    const bl = $('fac-relink'); if (bl) bl.onclick = openLink;
    const ba = $('fac-ask'); if (ba) ba.onclick = openLink;
    const bd = $('fac-del'); if (bd) bd.onclick = async () => { if (!confirm('¿Eliminar este borrador de factura? (No tiene número: no deja hueco en la numeración.)')) return; await adminCall('invoice_delete_draft', { invoice_id: openInv.id }); refresh(); };
    const bn = $('fac-new'); if (bn) bn.onclick = () => openEditor(Object.assign({ estado: 'borrador', cliente: { contacto: d.nombre || '', email: d.email || '' } }, g.defaults || {}));
  }

  window.milesFactura = { init(dd, wa) { d = dd; waPhone = wa || ''; refresh(); } };
})();
