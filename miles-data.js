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

async function loadBlocks() {
  const r = await adminCall('list_blocks');
  if (!r || !r.ok) { MANUAL_BLOCKS = new Set(); return; }
  MANUAL_BLOCKS = new Set((r.blocks || []).map(x => x.fecha));
  window.MANUAL_BLOCKS = MANUAL_BLOCKS;
}

async function toggleBlock(iso) {
  const r = await adminCall('toggle_block', { fecha: iso });
  if (!r || !r.ok) return false;
  if (r.blocked) MANUAL_BLOCKS.add(iso);
  else MANUAL_BLOCKS.delete(iso);
  return true;
}

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
      <span class="adm-nav__brand">MILES</span>
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
