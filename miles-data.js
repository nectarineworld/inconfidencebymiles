/* miles-data.js — client admin MILES (via Edge Function admin-api)
 * Utilise le token de session stocke dans sessionStorage.
 * Redirige vers miles-login.html si pas de token ou token invalide.
 */

const ADMIN_API = 'https://fmikzxqquazduyhyvxfz.supabase.co/functions/v1/admin-api';

function getToken() {
  return sessionStorage.getItem('miles_admin_token');
}
function setToken(t) {
  if (t) sessionStorage.setItem('miles_admin_token', t);
  else sessionStorage.removeItem('miles_admin_token');
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
    location.replace('miles-login.html');
    return null;
  }
  return data;
}

// Labels UI
const TYPE_LABELS = {
  'mesa':                 'Mesa',
  'grupo':                'Grupo/evento',
  'privatizacion_ic':     'Priv. Sala In Confidence',
  'privatizacion_salvaje':'Priv. Sala Salvaje',
  'privatizacion_total':  'Priv. todo MILES',
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
  'cumple':'Cumpleanos','afterwork':'Afterwork','empresa':'Empresa',
  'fiesta':'Fiesta','rodaje':'Rodaje','otro':'Otro'
};

let DEMANDS = [];
let MANUAL_BLOCKS = new Set();

async function loadDemands() {
  const r = await adminCall('list_reservations');
  if (!r || !r.ok) { DEMANDS = []; return; }
  const rows = r.reservations || [];
  DEMANDS = rows.filter(row => row.fecha).map(row => {
    let time = row.hora || '';
    if (time && time.length > 5) time = time.substring(0, 5);
    if (!time) time = '—';
    return {
      id: row.id,
      date: row.fecha,
      time,
      personas: row.num_personas || 0,
      type: row.tipo,
      formula: row.formula || null,
      event: row.tipo_evento || null,
      status: STATUS_SUPA_TO_PROTO[row.status] || 'new',
      raw_status: row.status,
      nombre: row.nombre || '(sin nombre)',
      tel: row.telefono || '',
      email: row.email || '',
      msg: row.mensaje || '',
      notas: row.notas_internas || '',
      createdAt: row.created_at ? new Date(row.created_at).toLocaleString('es-ES') : '',
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
  location.replace('miles-login.html');
}

function tabbar(active) {
  return `
  <nav class="priv-tabbar">
    <a class="priv-tab ${active==='plan'?'priv-tab--active':''}" href="miles-planning.html">
      <span class="priv-tab__icon">📅</span>Planning
    </a>
    <a class="priv-tab ${active==='dem'?'priv-tab--active':''}" href="miles-demandes.html">
      <span class="priv-tab__icon">📋</span>Solicitudes
    </a>
    <a class="priv-tab ${active==='block'?'priv-tab--active':''}" href="miles-bloquear.html">
      <span class="priv-tab__icon">🔒</span>Bloquear
    </a>
    <a class="priv-tab" href="#" onclick="event.preventDefault(); milesLogout();">
      <span class="priv-tab__icon">⏻</span>Salir
    </a>
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
  location.replace('miles-login.html');
}

// Exposer
window.TYPE_LABELS = TYPE_LABELS;
window.STATUS_LABELS = STATUS_LABELS;
window.STATUS_CLASS = STATUS_CLASS;
window.STATUS_PROTO_TO_SUPA = STATUS_PROTO_TO_SUPA;
window.FORMULA_LABELS = FORMULA_LABELS;
window.EVENT_LABELS = EVENT_LABELS;
window.milesTabbar = tabbar;
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
})();
