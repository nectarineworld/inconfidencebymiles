/* miles-data.js — client admin MILES (via Edge Function admin-api)
 * Utilise le token de session stocke dans sessionStorage.
 * Redirige vers miles-login.html si pas de token ou token invalide.
 */

const ADMIN_API = 'https://fmikzxqquazduyhyvxfz.supabase.co/functions/v1/admin-api';

// Session persistante (60 jours glissants côté serveur) : localStorage, plus sessionStorage
(function migrate(){ try { const o = sessionStorage.getItem('miles_admin_token'); if (o && !localStorage.getItem('miles_admin_token')) localStorage.setItem('miles_admin_token', o); sessionStorage.removeItem('miles_admin_token'); } catch(e){} })();
function getToken() {
  try { return localStorage.getItem('miles_admin_token'); } catch(e) { return null; }
}
function setToken(t) {
  if (t) localStorage.setItem('miles_admin_token', t);
  else localStorage.removeItem('miles_admin_token');
}
function goLogin() {
  try { sessionStorage.setItem('miles_return', location.pathname + location.search); } catch(e){}
  location.replace('miles-login.html');
}

async function adminCall(action, params) {
  const headers = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) headers['X-Admin-Token'] = t;
  const r = await fetch(ADMIN_API, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, params: params ?? {} })
  });
  const data = await r.json().catch(() => ({ ok: false, error: 'bad_response' }));
  if (r.status === 401 && data.error === 'unauthorized') {
    setToken(null);
    goLogin();
    return null;
  }
  return data;
}

// Labels UI
const TYPE_LABELS = {
  'mesa':                 'Reserva · Mesa 1–10',
  'grupo':                'Reserva · Grupo 10–20',
  'privatizacion_ic':     'Privatización · Sala In Confidence',
  'privatizacion_salvaje':'Privatización · Sala Salvaje',
  'privatizacion_total':  'Privatización · Todo MILES',
  'table':                'Mesa',
  'priv-ic':              'Priv. Sala In Confidence',
  'priv-salvaje':         'Priv. Sala Salvaje',
  'priv-total':           'Priv. todo MILES'
};

// Statuts Supabase -> classes prototype
const STATUS_SUPA_TO_PROTO = {
  'nueva':      'new',
  'en_curso':   'discuss',
  'confirmada': 'confirmed',
  'realizada':  'confirmed',
  'cancelada':  'cancelled',
  'no_show':    'refused'
};
const STATUS_PROTO_TO_SUPA = {
  'new':       'nueva',
  'discuss':   'en_curso',
  'confirmed': 'confirmada',
  'refused':   'no_show',
  'cancelled': 'cancelada'
};

const STATUS_LABELS = {
  'new':       'Nueva solicitud',
  'contact':   'A contactar',
  'discuss':   'En conversacion',
  'option':    'Opcion',
  'confirmed': 'Confirmada',
  'refused':   'No se presentó',
  'cancelled': 'Cancelada',
  'closed':    'Sin continuidad'
};

const STATUS_CLASS = {
  'new':       'badge--new',
  'contact':   'badge--contact',
  'discuss':   'badge--discuss',
  'option':    'badge--option',
  'confirmed': 'badge--confirmed',
  'refused':   'badge--refused',
  'cancelled': 'badge--refused',
  'closed':    'badge'
};

const FORMULA_LABELS = {
  'bebidas':'Solo bebidas · desde 20 EUR/pers.',
  'tapas':  'Tapas + bebidas · desde 35 EUR/pers.',
  'consejo':'A determinar (consejo pedido)'
};

const EVENT_LABELS = {
  'cumple':'Cumpleaños','afterwork':'Afterwork','empresa':'Empresa',
  'fiesta':'Fiesta','rodaje':'Rodaje','boda':'Boda','teambuilding':'Team building','otro':'Otro'
};
const TYPE_CATEGORY = { mesa:'reserva', grupo:'reserva', privatizacion_ic:'priv', privatizacion_salvaje:'priv', privatizacion_total:'priv' };
function fmtReceived(ts) {
  if (!ts) return '—';
  const parts = {};
  new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false })
    .formatToParts(new Date(ts)).forEach(x => parts[x.type] = x.value);
  return `${parts.day}/${parts.month}/${parts.year} – ${parts.hour}:${parts.minute}`;
}
function waitingLabel(ts) {
  if (!ts) return '';
  const h = Math.floor((Date.now() - new Date(ts).getTime()) / 3600000);
  if (h < 1) return 'hace menos de 1 h';
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d > 1 ? 's' : ''}`;
}
window.EMAIL_READY = false;

let DEMANDS = [];
let MANUAL_BLOCKS = new Set();

async function loadDemands() {
  const r = await adminCall('list_reservations');
  if (!r || !r.ok) { DEMANDS = []; return; }
  const rows = r.reservations || [];
  window.EMAIL_READY = !!r.email_ready;
  DEMANDS = rows.filter(row => row.fecha).map(row => {
    let time = row.hora || '';
    if (time && time.length > 5) time = time.substring(0, 5);
    // hora vraiment optionnelle : chaîne vide si non renseignée
    return {
      id: row.id,
      date: row.fecha,
      time,
      personas: row.num_personas || 0,
      type: row.tipo,
      formula: row.formula || ((row.admin_notes || '').match(/Fórmula: ([a-z]+)/) || [])[1] || null,
      event: row.ocasion || row.tipo_evento || null,
      status: STATUS_SUPA_TO_PROTO[row.status] || 'new',
      raw_status: row.status,
      nombre: row.nombre || '(sin nombre)',
      tel: row.telefono || '',
      email: row.email || '',
      msg: row.mensaje || '',
      notas: row.notas_internas || '',
      createdAt: fmtReceived(row.created_at),
      createdTs: row.created_at || '',
      cancelledAt: row.cancelled_at ? fmtReceived(row.cancelled_at) : '',
      category: TYPE_CATEGORY[row.tipo] || 'reserva',
      idioma: row.idioma || 'es',
      _raw: row
    };
  });
  DEMANDS.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  window.DEMANDS = DEMANDS;
}

// Blocages : 'todo' = tout MILES ; 'ic' = Sala In Confidence ; 'salvaje' = Sala Salvaje
let ROOM_BLOCKS = new Map(); // iso -> Set('todo'|'ic'|'salvaje')
const BLOCK_LABELS = { todo: 'Todo MILES', ic: 'Sala In Confidence', salvaje: 'Sala Salvaje' };
function rebuildBlockSets() {
  MANUAL_BLOCKS = new Set([...ROOM_BLOCKS].filter(([, s]) => s.has('todo')).map(([d]) => d));
  window.MANUAL_BLOCKS = MANUAL_BLOCKS;
  window.ROOM_BLOCKS = ROOM_BLOCKS;
}
async function loadBlocks() {
  const r = await adminCall('list_blocks');
  ROOM_BLOCKS = new Map();
  if (r && r.ok) (r.blocks || []).forEach(x => {
    const e = x.espacio || 'todo';
    if (!ROOM_BLOCKS.has(x.fecha)) ROOM_BLOCKS.set(x.fecha, new Set());
    ROOM_BLOCKS.get(x.fecha).add(e);
  });
  rebuildBlockSets();
}

async function toggleBlock(iso, espacio = 'todo') {
  const r = await adminCall('toggle_block', { fecha: iso, espacio });
  if (!r || !r.ok) return false;
  if (!ROOM_BLOCKS.has(iso)) ROOM_BLOCKS.set(iso, new Set());
  const set = ROOM_BLOCKS.get(iso);
  if (r.blocked) set.add(espacio); else set.delete(espacio);
  if (!set.size) ROOM_BLOCKS.delete(iso);
  rebuildBlockSets();
  return true;
}
// Sets partiels pour le calendrier : { ic:Set, salvaje:Set }
function roomSets() {
  const ic = new Set(), salvaje = new Set();
  ROOM_BLOCKS.forEach((s, d) => { if (s.has('ic')) ic.add(d); if (s.has('salvaje')) salvaje.add(d); });
  return { ic, salvaje };
}
window.milesRoomSets = roomSets;
window.BLOCK_LABELS = BLOCK_LABELS;

// 3 interrupteurs (Todo MILES / Sala In Confidence / Sala Salvaje) pour un jour
window.milesBlockControls = function (el, iso, onChange) {
  const draw = () => {
    const set = ROOM_BLOCKS.get(iso) || new Set();
    el.innerHTML = `<p class="adm-block__title">Bloquear este día</p>` + ['todo', 'ic', 'salvaje'].map(k => {
      const on = set.has(k);
      return `<button type="button" class="adm-block__btn${on ? ' is-on' : ''}" data-k="${k}" aria-pressed="${on}">
        <span class="adm-block__sw"></span><span class="adm-block__lbl">${BLOCK_LABELS[k]}</span><span class="adm-block__st">${on ? 'Bloqueado' : 'Libre'}</span></button>`;
    }).join('') + `<p class="adm-block__hint">«Todo MILES» cierra el día a todas las solicitudes. Una sala bloqueada solo impide privatizar esa sala (y Todo MILES); los clientes la ven como reservada.</p>`;
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = async () => {
      b.disabled = true; b.querySelector('.adm-block__st').textContent = 'Guardando…';
      const ok = await toggleBlock(iso, b.dataset.k);
      if (!ok) { b.querySelector('.adm-block__st').textContent = 'Error'; b.disabled = false; return; }
      draw(); if (onChange) onChange();
    });
  };
  draw();
};

async function updateStatus(id, newStatusProto) {
  const supaStatus = STATUS_PROTO_TO_SUPA[newStatusProto] || newStatusProto;
  const r = await adminCall('update_status', { id, status: supaStatus });
  return r && r.ok;
}

async function saveNote(id, note) {
  const r = await adminCall('save_note', { id, note });
  return r && r.ok;
}

async function logout() {
  await adminCall('logout');
  setToken(null);
  location.replace('miles-login.html?out=1');
}
async function cancelReservation(id, sendMail, subject, body) {
  return await adminCall('cancel_reservation', { id, send_email: !!sendMail, subject, body });
}
async function reopenReservation(id) { const r = await adminCall('reopen_reservation', { id }); return r && r.ok; }
async function deleteReservation(id) { const r = await adminCall('delete_reservation', { id, confirm: 'ELIMINAR' }); return r && r.ok; }
async function getHistory(id) { const r = await adminCall('get_history', { id }); return (r && r.ok) ? r.history : []; }

function tabbar(active) {
  const t = (k, href, label) => `<a class="adm-nav__tab ${active===k?'adm-nav__tab--active':''}" href="${href}" ${active===k?'aria-current="page"':''}>${label}</a>`;
  return `
  <nav class="adm-nav" aria-label="Administración">
    <div class="adm-nav__in">
      <span class="adm-nav__brand" role="img" aria-label="MILES" style="display:inline-block;width:84px;line-height:0"><svg class='miles-wm' viewBox='126 490 1388 452' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' focusable='false'> <path fill='none' stroke-width='4' stroke-linecap='butt' stroke-linejoin='miter' stroke='currentColor' stroke-miterlimit='10' d='M 0.00153186 -0.000233646 L 1376.560096 -0.000233646 ' transform='matrix(0.99952, 0, 0, -0.99952, 131.951594, 497.616954)'/> <path fill='none' stroke-width='4' stroke-linecap='butt' stroke-linejoin='miter' stroke='currentColor' stroke-miterlimit='10' d='M 0.00153186 0.00114175 L 1376.560096 0.00114175 ' transform='matrix(0.99952, 0, 0, -0.99952, 131.951594, 934.407391)'/> <path fill-rule='nonzero' fill='currentColor' d='M 357.992188 877.851562 L 357.992188 865.851562 L 405.5 865.851562 L 405.5 572.628906 L 307.601562 877.851562 L 291.285156 877.851562 L 194.339844 572.628906 L 194.339844 865.851562 L 241.851562 865.851562 L 241.851562 877.851562 L 131.953125 877.851562 L 131.953125 865.851562 L 179.464844 865.851562 L 179.464844 569.273438 L 131.953125 569.273438 L 131.953125 557.277344 L 255.769531 557.277344 L 322.957031 777.070312 L 392.542969 557.277344 L 513.964844 557.277344 L 513.964844 569.273438 L 466.453125 569.273438 L 466.453125 865.851562 L 513.964844 865.851562 L 513.964844 877.851562 Z M 357.992188 877.851562 '/> <path fill-rule='nonzero' fill='currentColor' d='M 537.957031 877.851562 L 537.957031 865.851562 L 585.464844 865.851562 L 585.464844 569.273438 L 537.957031 569.273438 L 537.957031 557.277344 L 694.410156 557.277344 L 694.410156 569.273438 L 646.898438 569.273438 L 646.898438 865.851562 L 694.410156 865.851562 L 694.410156 877.851562 Z M 537.957031 877.851562 '/> <path fill-rule='nonzero' fill='currentColor' d='M 986.667969 877.851562 L 720.796875 877.851562 L 720.796875 865.851562 L 768.308594 865.851562 L 768.308594 569.273438 L 720.796875 569.273438 L 720.796875 557.277344 L 879.167969 557.277344 L 879.167969 569.273438 L 829.253906 569.273438 L 829.253906 865.851562 L 891.164062 865.851562 C 920.277344 865.851562 941.554688 857.378906 954.996094 840.425781 C 968.75 823.785156 976.109375 800.273438 977.070312 769.871094 L 991.945312 769.871094 Z M 986.667969 877.851562 '/> <path fill-rule='nonzero' fill='currentColor' d='M 1273.660156 877.851562 L 1001.066406 877.851562 L 1001.066406 865.851562 L 1048.582031 865.851562 L 1048.582031 569.273438 L 1001.066406 569.273438 L 1001.066406 557.277344 L 1265.503906 557.277344 L 1268.863281 643.660156 L 1255.421875 643.660156 C 1248.382812 612.945312 1238.144531 592.949219 1224.707031 583.671875 C 1211.273438 574.074219 1191.269531 569.273438 1164.71875 569.273438 L 1109.53125 569.273438 L 1109.53125 707.003906 L 1122.488281 707.003906 C 1146.796875 707.003906 1162.804688 701.25 1170.480469 689.730469 C 1178.476562 677.894531 1182.476562 664.136719 1182.476562 648.457031 L 1195.914062 648.457031 L 1195.914062 782.351562 L 1182.476562 782.351562 C 1182.476562 765.402344 1178.636719 750.675781 1170.957031 738.199219 C 1162.957031 725.40625 1146.796875 719.003906 1122.488281 719.003906 L 1109.53125 719.003906 L 1109.53125 865.851562 L 1173.835938 865.851562 C 1204.871094 865.851562 1226.46875 858.347656 1238.625 843.300781 C 1250.78125 828.265625 1259.265625 805.386719 1264.0625 774.671875 L 1277.980469 774.671875 Z M 1273.660156 877.851562 '/> <path fill-rule='nonzero' fill='currentColor' d='M 1480.019531 855.300781 C 1461.136719 875.144531 1436.988281 885.050781 1407.554688 885.050781 C 1393.472656 885.050781 1381.160156 882.96875 1370.601562 878.816406 C 1358.4375 874.335938 1347.878906 868.253906 1338.929688 860.578125 L 1315.886719 880.734375 L 1307.734375 880.734375 L 1307.734375 785.234375 L 1321.648438 785.234375 C 1326.445312 809.230469 1336.203125 829.859375 1350.925781 847.140625 C 1365.636719 864.421875 1384.996094 873.054688 1408.992188 873.054688 C 1429.464844 873.054688 1446.585938 866.660156 1460.34375 853.855469 C 1474.417969 840.742188 1481.457031 824.90625 1481.457031 806.347656 C 1481.457031 786.191406 1473.617188 771.316406 1457.945312 761.714844 C 1441.304688 751.800781 1420.511719 743.476562 1395.558594 736.761719 C 1365.476562 728.769531 1343.726562 717.082031 1330.285156 701.726562 C 1316.847656 686.054688 1310.132812 665.574219 1310.132812 640.292969 C 1310.132812 614.070312 1318.289062 592.472656 1334.605469 575.507812 C 1351.5625 558.554688 1372.523438 550.078125 1397.472656 550.078125 C 1410.914062 550.078125 1423.390625 551.996094 1434.910156 555.832031 C 1446.425781 559.675781 1457.144531 565.601562 1467.058594 573.589844 L 1485.300781 554.875 L 1494.417969 554.875 L 1494.417969 645.578125 L 1479.058594 645.578125 C 1476.179688 621.90625 1467.378906 601.902344 1452.664062 585.589844 C 1437.949219 569.914062 1419.226562 562.074219 1396.515625 562.074219 C 1380.199219 562.074219 1366.113281 567.515625 1354.28125 578.386719 C 1342.441406 589.265625 1336.527344 602.230469 1336.527344 617.265625 C 1336.527344 635.496094 1342.601562 647.339844 1354.765625 652.777344 C 1367.238281 658.855469 1385.3125 664.9375 1408.992188 671.011719 C 1446.425781 680.609375 1472.179688 693.253906 1486.257812 708.925781 C 1500.65625 725.246094 1507.851562 748.121094 1507.851562 777.554688 C 1507.851562 809.871094 1498.574219 835.785156 1480.019531 855.300781 '/> </svg></span>
      <div class="adm-nav__tabs">
        ${t('plan','miles-planning.html','Planning')}
        ${t('dem','miles-demandes.html','Solicitudes<span class="adm-nav__count" id="adm-new-count"></span>')}
        ${t('block','miles-bloquear.html','Bloqueado')}
        <a class="adm-nav__tab adm-nav__tab--out" href="#" onclick="event.preventDefault(); if(confirm('¿Cerrar sesión en este dispositivo?')) milesLogout();">Salir</a>
      </div>
    </div>
  </nav>`;
}

function niceDate(iso) {
  if (!iso) return '—';
  const [y,m,d] = iso.split('-');
  return new Date(+y,+m-1,+d).toLocaleDateString('es-ES', {
    weekday:'long', day:'numeric', month:'long'
  });
}
function shortDate(iso) {
  if (!iso) return { day: '?', mon: '?' };
  const [y,m,d] = iso.split('-');
  return { day:+d, mon: new Date(+y,+m-1,+d).toLocaleDateString('es-ES',{month:'short'}).toUpperCase().replace('.','') };
}

// Auth gate : redirige immediatement si pas de token
if (!getToken()) {
  goLogin();
}
// Barre de navigation en haut + thème clair
document.documentElement.classList.add('adm');
function mountNav(active) {
  const root = document.getElementById('tabbar-root');
  if (root) { root.innerHTML = tabbar(active); document.body.prepend(root); }
}

// Exposer
window.TYPE_LABELS = TYPE_LABELS;
window.STATUS_LABELS = STATUS_LABELS;
window.STATUS_CLASS = STATUS_CLASS;
window.STATUS_PROTO_TO_SUPA = STATUS_PROTO_TO_SUPA;
window.FORMULA_LABELS = FORMULA_LABELS;
window.EVENT_LABELS = EVENT_LABELS;
window.milesTabbar = tabbar;
window.milesMountNav = mountNav;
window.fmtReceived = fmtReceived;
window.waitingLabel = waitingLabel;
window.milesCancel = cancelReservation;
window.milesReopen = reopenReservation;
window.milesDelete = deleteReservation;
window.milesHistory = getHistory;
window.milesGetToken = getToken;
window.milesStatusEmail = async function (id, status, subject, body) {
  const r = await fetch(ADMIN_API.replace('/admin-api', '/admin-mail'), {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Token': getToken() || '' },
    body: JSON.stringify({ id, status, subject, body })
  });
  return r.json().catch(() => ({ ok: false, error: 'bad_response' }));
};
window.niceDate = niceDate;
window.shortDate = shortDate;
window.milesToggleBlock = toggleBlock;
window.milesUpdateStatus = updateStatus;
window.milesSaveNote = saveNote;
window.milesLogout = logout;
window.milesAdminCall = adminCall;
window.milesReloadData = async function() {
  await Promise.all([loadDemands(), loadBlocks()]);
};

// Ready promise
window.milesDataReady = (async () => {
  await Promise.all([loadDemands(), loadBlocks()]);
  const n = (window.DEMANDS || []).filter(d => d.raw_status === 'nueva').length;
  const c = document.getElementById('adm-new-count'); if (c && n) c.textContent = n;
})();
