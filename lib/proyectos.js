/* Gestión de proyectos · Club Activo 20-30 San José #532
 * Carteras de proyectos (una por proyecto) con grupos, columnas editables, subtareas, cronograma,
 * comentarios, archivos e historial. Todo cifrado con la llave de proyectos y guardado en la rama `datos`.
 * Permisos por persona (se asignan en Tesorería → Usuarios): admin, editor, lector. */
(function () {
'use strict';
const A = window.Almacen;
const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ini = n => String(n || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const num = v => { const x = parseFloat(String(v == null ? '' : v).replace(/[₡$,\s]/g, '')); return isNaN(x) ? 0 : x; };
const col = n => '₡' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const hoyISO = () => new Date().toISOString().slice(0, 10);
const fCorta = iso => { if (!iso) return ''; const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: '2-digit' }).replace('.', ''); };
const fHora = t => new Date(t).toLocaleString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const addD = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const diffD = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const IC = {
  mas: '<path d="M12 5v14M5 12h14"/>', buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  car: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v16"/>', tabla: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  crono: '<path d="M4 6h9M7 12h11M5 18h7"/>', cand: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  salir: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"/>', bajar: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  subir: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>', atras: '<path d="m15 18-6-6 6-6"/>', inicio: '<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'
};
const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;
const PAL = ['#001489', '#da291c', '#fedd00', '#12804a', '#747576', '#0a24b8', '#c25e00', '#7b3fb8', '#0d8aa8', '#e8618c'];
const TIPOS = { texto: 'Texto', largo: 'Texto largo', numero: 'Número', monto: 'Monto (₡)', estado: 'Estado / etiquetas', persona: 'Personas', fecha: 'Fecha', crono: 'Cronograma (inicio y fin)', avance: 'Avance %', prioridad: 'Prioridad (estrellas)', casilla: 'Casilla', enlace: 'Enlace' };
const ETQ = [{ t: 'Sin iniciar', c: '#747576' }, { t: 'En curso', c: '#0a24b8' }, { t: 'Detenido', c: '#da291c' }, { t: 'Listo', c: '#12804a' }];

/* ---------- Estado ---------- */
let S = null, K = null, IDX = null, C = null, CID = null, VISTA = 'carteras', MODO = 'tabla', ESC = 'sem';
let pend = [], baseRev = 0, guardando = false, tGuardar = null, tReint = null, deshacer = [], rehacer = [];
let filtro = { q: '', estado: '', persona: '', grupoKpi: '' }, abiertos = {}, menuAbierto = null, editando = false;
const SES = 'sesion-proyectos', INACT = 5 * 60000;
const puede = n => S && ({ lector: 1, editor: 2, admin: 3 }[S.proyRol] || 0) >= ({ lector: 1, editor: 2, admin: 3 }[n]);
const ED = () => puede('editor');
let tt; function toast(m, ms) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, ms || 3000); }
const app = () => $('#app');

/* ---------- Acceso ---------- */
async function iniciar() {
  let g = null; try { g = JSON.parse(sessionStorage.getItem(SES) || 'null'); } catch (_) { }
  if (g && g.S && g.K && Date.now() - g.t < INACT) { S = g.S; K = g.K; if (g.tok) A.ponerToken(g.tok); await entrarApp(); return; }
  pintarLogin();
}
function pintarLogin(msg) {
  app().innerHTML = `<div class="login"><section class="brand"><div style="display:flex;align-items:center;gap:12px"><img src="../img/logo-color.png" alt="Activo 20-30 Internacional San José #532"><b style="letter-spacing:.06em">CLUB ACTIVO 20-30<br>SAN JOSÉ #532</b><span style="flex:1"></span><button class="tema-btn" id="tema-btn" type="button"></button></div>
  <div><h1>Gestión de <span>proyectos.</span></h1><p>Carteras de proyectos del Club: tareas, responsables, fechas, avance y montos, en un solo lugar.</p></div><p style="opacity:.85">La juventud para ser servida, <b style="color:var(--amarillo)">debe servir.</b></p></section>
  <form id="f-login" autocomplete="on"><h2>Iniciar sesión</h2><p style="color:var(--muted);margin:0">Entrá con el mismo usuario y contraseña del portal.</p>
  <label for="l-u">Correo o usuario</label><input class="input" id="l-u" autocomplete="username" required>
  <label for="l-p">Contraseña</label><input class="input" id="l-p" type="password" autocomplete="current-password" required>
  <p class="err" id="l-err">${esc(msg || '')}</p><button class="btn b-rj" style="width:100%;justify-content:center;padding:13px" type="submit">Entrar</button>
  <p style="margin-top:16px;font-size:.85rem"><a href="../" style="color:var(--azul);font-weight:800">← Volver al inicio</a></p></form></div>`;
  montarTema();
}
function montarTema() { if (window.__temaMontar) window.__temaMontar(); else { const b = $('#tema-btn'); if (b && !b.innerHTML) b.textContent = '◐'; } }
const BLOQ = 'bloqueo-proyectos';
async function login(f) {
  const u = $('#l-u').value.trim(), p = $('#l-p').value, err = $('#l-err'), btn = f.querySelector('button');
  let b = {}; try { b = JSON.parse(localStorage.getItem(BLOQ) || '{}'); } catch (_) { }
  if (b.hasta && Date.now() < b.hasta) { err.textContent = 'Demasiados intentos. Probá de nuevo en ' + Math.ceil((b.hasta - Date.now()) / 60000) + ' minutos.'; return; }
  btn.disabled = true; err.textContent = 'Verificando…';
  try {
    const DIR = await A.leer('usuarios.json'), r = DIR && await A.abrir(DIR, u, p);
    if (!r) { const n = (b.n || 0) + 1; try { localStorage.setItem(BLOQ, JSON.stringify(n >= 5 ? { n: 0, hasta: Date.now() + 15 * 60000 } : { n })); } catch (_) { } err.textContent = n >= 5 ? 'Demasiados intentos. El acceso queda bloqueado 15 minutos.' : 'Usuario o contraseña incorrectos.'; return; }
    if (r.inactivo) { err.textContent = 'Tu usuario está desactivado.'; return; }
    if (!r.proy || !r.proyRol) { err.textContent = 'No tenés acceso a Gestión de proyectos. Consultá con los administradores del portal.'; return; }
    try { localStorage.removeItem(BLOQ); } catch (_) { }
    S = { id: r.id, nombre: r.nombre || u, proyRol: r.proyRol }; K = r.proy;
    let tok = null, pub = null; if (DIR.proy) { try { const q = await A.descifrar(K, DIR.proy); tok = q.escritura; pub = q.rsaPub; } catch (_) { } }
    if (tok) A.ponerToken(tok);
    if (tok && pub) A.sha('ingreso|' + r.id).then(async h => A.guardar({ ['ingresos/' + h.slice(0, 24) + '.json']: await A.sellar(pub, { uid: r.id, t: Date.now(), sitio: 'proyectos' }) }, 'Ingreso')).catch(() => { });
    guardarSes(tok); await entrarApp();
  } catch (e) { console.error(e); err.textContent = 'No se pudo conectar. Revisá tu internet.'; }
  finally { btn.disabled = false; }
}
function guardarSes(tok) { try { sessionStorage.setItem(SES, JSON.stringify({ S, K, tok: tok !== undefined ? tok : (JSON.parse(sessionStorage.getItem(SES) || '{}').tok || null), t: Date.now() })); } catch (_) { } }
function salir() { try { sessionStorage.removeItem(SES); } catch (_) { } location.reload(); }
let tInact; function vigilar() { const r = () => { clearTimeout(tInact); tInact = setTimeout(bloquear, INACT); guardarSes(); }; ['pointerdown', 'keydown', 'touchstart'].forEach(e => addEventListener(e, r, { passive: true })); r(); }
function bloquear() {
  if ($('#lock')) return; const d = document.createElement('div'); d.id = 'lock';
  const h = () => { const n = new Date(); return n.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }); };
  d.innerHTML = `<div><div class="hr" id="lk-h">${h()}</div><p>${new Date().toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })} · Pantalla bloqueada</p><form id="f-lock"><input class="input" id="lk-p" type="password" placeholder="Tu contraseña" autocomplete="current-password"><button class="btn b-am" type="submit">Desbloquear</button></form><p class="err" id="lk-e" style="color:#ffb3ab"></p><button class="btn b-sf" id="lk-salir" type="button" style="margin-top:8px">Cerrar sesión</button></div>`;
  document.body.appendChild(d); $('#lk-p').focus(); const iv = setInterval(() => { const x = $('#lk-h'); if (!x) return clearInterval(iv); x.textContent = h(); }, 15000);
}
async function desbloquear() {
  const p = $('#lk-p').value; $('#lk-e').textContent = 'Verificando…';
  try { const DIR = await A.leer('usuarios.json'); let ok = false;
    for (const e of Object.values(DIR.usuarios)) if (e.id === S.id && await abrirEntrada(e, p)) { ok = true; break; }
    if (ok) { $('#lock').remove(); vigilar(); } else $('#lk-e').textContent = 'Contraseña incorrecta.';
  } catch (_) { $('#lk-e').textContent = 'No se pudo verificar.'; }
}
async function abrirEntrada(e, clave) { try { const te = new TextEncoder(); const ub = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const base = await crypto.subtle.importKey('raw', te.encode(clave), 'PBKDF2', false, ['deriveKey']);
  const k = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: ub(e.sal), iterations: 600000 }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return await A.descifrar(k, e.llaves); } catch (_) { return null; } }

/* ---------- Datos ---------- */
const RUTA_IDX = 'proyectos/indice.json', rutaC = id => 'proyectos/c-' + id + '.json', rutaF = id => 'proyectos/f-' + id + '.json';
async function leerIdx() { const p = await A.leer(RUTA_IDX); return p ? await A.descifrar(K, p) : { rev: 0, carteras: [] }; }
async function leerC(id) { const p = await A.leer(rutaC(id)); return p ? await A.descifrar(K, p) : null; }
async function entrarApp() {
  try { IDX = await leerIdx(); } catch (e) { console.error(e); S = null; try { sessionStorage.removeItem(SES); } catch (_) { } return pintarLogin('No se pudieron abrir los proyectos. Volvé a iniciar sesión.'); }
  vigilar(); pintarCarteras(); setInterval(sincronizar, 20000);
}
function nuevaCartera(nombre, color) {
  const cols = [
    { id: 'resp', nombre: 'Responsable', tipo: 'persona', ancho: 150 },
    { id: 'est', nombre: 'Estado', tipo: 'estado', ancho: 130, etiquetas: ETQ.map(x => Object.assign({}, x)) },
    { id: 'pri', nombre: 'Prioridad', tipo: 'prioridad', ancho: 110 },
    { id: 'cro', nombre: 'Cronograma', tipo: 'crono', ancho: 170 },
    { id: 'ava', nombre: 'Avance', tipo: 'avance', ancho: 130 },
    { id: 'pre', nombre: 'Presupuesto', tipo: 'monto', ancho: 120 },
    { id: 'rec', nombre: 'Recaudado', tipo: 'monto', ancho: 120, kpi: 'ingreso' },
    { id: 'cos', nombre: 'Costo', tipo: 'monto', ancho: 120, kpi: 'costo' },
    { id: 'com', nombre: 'Comentario', tipo: 'largo', ancho: 200 }
  ];
  return { rev: 0, id: uid(), nombre, color: color || '#001489', meta: { nombre: 'Meta', monto: 0 }, cols,
    grupos: [{ id: uid(), nombre: 'Planificación', color: '#001489' }, { id: uid(), nombre: 'Ejecución', color: '#da291c' }, { id: uid(), nombre: 'Cierre', color: '#12804a' }],
    items: [], coms: {}, archivos: {}, hist: {} };
}
/* Cambios: cada acción es una función que se aplica sobre la cartera; si otro usuario guardó antes, se vuelve a aplicar sobre su versión. */
function hacer(op, render) {
  if (!ED()) return toast('Tu acceso es de solo lectura');
  deshacer.push(JSON.stringify(C)); if (deshacer.length > 100) deshacer.shift(); rehacer = [];
  op(C); pend.push(op); programarGuardado(); if (render !== false) pintarTablero();
}
function programarGuardado() { $('#sync') && ($('#sync').textContent = 'Guardando…'); clearTimeout(tGuardar); tGuardar = setTimeout(guardarC, 700); }
async function guardarC() {
  if (guardando) return programarGuardado(); if (!pend.length || !C) return;
  if (!A.hayToken()) { toast('No hay llave de guardado. Consultá con los administradores del portal.', 6000); return; }
  guardando = true; const ops = pend.slice(), cid = C.id;
  try {
    const rem = await leerC(cid); let base;
    if (rem && (rem.rev || 0) !== baseRev) { base = rem; ops.forEach(o => { try { o(base); } catch (e) { console.warn(e); } }); }
    else base = C;
    base.rev = (rem ? rem.rev || 0 : 0) + 1;
    const arch = {}; arch[rutaC(cid)] = await A.cifrar(K, base);
    const res = resumenC(base); const i = IDX.carteras.find(x => x.id === cid);
    if (i && JSON.stringify(i.res) !== JSON.stringify(res)) { const idx = await leerIdx(); const j = idx.carteras.find(x => x.id === cid); if (j) { j.res = res; j.nombre = base.nombre; j.color = base.color; idx.rev = (idx.rev || 0) + 1; arch[RUTA_IDX] = await A.cifrar(K, idx); IDX = idx; } }
    await A.guardar(arch, 'Proyectos: ' + base.nombre);
    pend = pend.slice(ops.length); baseRev = base.rev;
    if (base !== C) { C = base; if (!editando) pintarTablero(); } else C.rev = base.rev;
    $('#sync') && ($('#sync').textContent = '✓ Guardado');
  } catch (e) { console.error(e); $('#sync') && ($('#sync').textContent = 'Sin conexión · reintentando'); clearTimeout(tReint); tReint = setTimeout(guardarC, 15000); }
  finally { guardando = false; if (pend.length) programarGuardado(); }
}
async function guardarIdx(op, msg) {
  if (!A.hayToken()) return toast('No hay llave de guardado. Consultá con los administradores del portal.', 6000);
  const idx = await leerIdx(); op(idx); idx.rev = (idx.rev || 0) + 1; const arch = { [RUTA_IDX]: await A.cifrar(K, idx) };
  return { idx, arch, fin: async extra => { Object.assign(arch, extra || {}); await A.guardar(arch, msg); IDX = idx; } };
}
async function sincronizar() {
  if (!S || $('#lock') || guardando || pend.length || editando || document.hidden) return;
  try {
    if (VISTA === 'tablero' && C) { const r = await leerC(C.id); if (r && (r.rev || 0) !== baseRev) { C = r; baseRev = r.rev || 0; pintarTablero(); toast('Se cargaron cambios de otro usuario', 2000); } }
    else if (VISTA === 'carteras') { const i = await leerIdx(); if ((i.rev || 0) !== (IDX.rev || 0)) { IDX = i; pintarCarteras(); } }
  } catch (_) { }
}
function resumenC(c) { const k = kpis(c, ''); return { items: c.items.filter(x => !x.pid).length, ingreso: k.ing, costo: k.cos, avance: k.ava, meta: (c.meta || {}).monto || 0 }; }

/* ---------- Cálculos ---------- */
const colsT = (c, t) => c.cols.filter(x => x.tipo === t && !x.oculta);
const hijos = (c, id) => c.items.filter(x => x.pid === id);
function valor(c, it, cl) {
  const hs = hijos(c, it.id);
  if (hs.length && (cl.tipo === 'monto' || cl.tipo === 'numero')) { const vals = hs.map(h => valor(c, h, cl)).filter(v => v !== '' && v != null); if (vals.length) return { sum: vals.reduce((a, b) => a + num(b), 0) }; }
  if (hs.length && cl.tipo === 'avance') { const v = hs.map(h => num(valor(c, h, cl))); return { avg: v.reduce((a, b) => a + b, 0) / v.length }; }
  return (it.v || {})[cl.id];
}
const plano = v => v && typeof v === 'object' && 'sum' in v ? v.sum : v && typeof v === 'object' && 'avg' in v ? v.avg : v;
function kpis(c, gid) {
  const it = c.items.filter(x => !x.pid && (!gid || x.g === gid));
  const sumK = k => { const cs = c.cols.filter(x => x.kpi === k && !x.oculta); return it.reduce((a, x) => a + cs.reduce((b, cl) => b + num(plano(valor(c, x, cl))), 0), 0); };
  const ca = colsT(c, 'avance')[0], ava = ca && it.length ? it.reduce((a, x) => a + num(plano(valor(c, x, ca))), 0) / it.length : 0;
  return { n: it.length, ing: sumK('ingreso'), cos: sumK('costo'), ava };
}
function pasaFiltro(c, it) {
  const q = filtro.q.trim().toLowerCase();
  const txt = x => (x.nombre + ' ' + Object.values(x.v || {}).map(v => Array.isArray(v) ? v.join(' ') : typeof v === 'object' && v ? Object.values(v).join(' ') : v).join(' ')).toLowerCase();
  const ce = colsT(c, 'estado')[0], cp = colsT(c, 'persona')[0];
  const ok = x => (!q || txt(x).includes(q)) && (!filtro.estado || (ce && (x.v || {})[ce.id] === filtro.estado)) && (!filtro.persona || (cp && ((x.v || {})[cp.id] || []).includes(filtro.persona)));
  return ok(it) || hijos(c, it.id).some(ok);
}
function personas(c) { const s = new Set(); colsT(c, 'persona').forEach(cl => c.items.forEach(x => ((x.v || {})[cl.id] || []).forEach(p => s.add(p)))); return [...s].sort(); }
function registrar(c, itId, campo, de, a) { c.hist = c.hist || {}; (c.hist[itId] = c.hist[itId] || []).unshift({ u: S.nombre, f: Date.now(), campo, de: txtV(de), a: txtV(a) }); c.hist[itId] = c.hist[itId].slice(0, 200); }
const txtV = v => v == null ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? [v.i, v.f].filter(Boolean).join(' → ') : String(v);

/* ---------- Pantalla: carteras ---------- */
function marco(cuerpo, titulo) {
  const av = ini(S.nombre);
  return `<header class="top"><div class="in"><a href="../" title="Inicio del portal"><img src="../img/logo-color.png" alt="Activo 20-30 San José #532"></a><div class="tt"><small>Gestión de proyectos</small><b>${esc(titulo)}</b></div>
  <span class="sync" id="sync"></span><span class="rolp">${{ admin: 'Admin', editor: 'Editor', lector: 'Lector' }[S.proyRol]}</span>
  <button class="ib" id="b-lock" title="Bloquear pantalla" aria-label="Bloquear pantalla">${svg('cand')}</button><button class="tema-btn" id="tema-btn" type="button"></button><button class="av" id="b-cuenta" aria-label="Mi cuenta">${esc(av)}</button></div></header>
  <main>${cuerpo}</main>
  <nav class="bnav" aria-label="Menú"><button class="${VISTA === 'carteras' ? 'on' : ''}" data-go="carteras">${svg('car')}<span>Carteras</span></button>${C && CID ? `<button class="${VISTA === 'tablero' && MODO === 'tabla' ? 'on' : ''}" data-modo="tabla">${svg('tabla')}<span>Tabla</span></button><button class="${VISTA === 'tablero' && MODO === 'crono' ? 'on' : ''}" data-modo="crono">${svg('crono')}<span>Cronograma</span></button>` : ''}<button data-act="lock">${svg('cand')}<span>Bloquear</span></button><button data-act="salir">${svg('salir')}<span>Salir</span></button></nav>`;
}
function pintarCarteras() {
  VISTA = 'carteras'; C = null; CID = null;
  const cs = IDX.carteras || [];
  const card = x => { const r = x.res || {}; const bal = (r.ingreso || 0) - (r.costo || 0);
    return `<button class="cart" style="--c:${esc(x.color)}" data-abrir="${x.id}"><small style="color:var(--muted);font-weight:800;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em">Cartera de proyecto</small><h3>${esc(x.nombre)}</h3>${x.desc ? `<p style="margin:0;color:var(--muted);font-size:.86rem">${esc(x.desc)}</p>` : ''}
    <div class="k"><div><small>Elementos</small><b>${r.items || 0}</b></div><div><small>Avance</small><b>${Math.round(r.avance || 0)}%</b></div><div><small>Recaudado</small><b>${col(r.ingreso)}</b></div><div><small>Balance</small><b class="${bal < 0 ? 'neg' : ''}">${col(bal)}</b></div></div>
    <div class="bar"><i style="width:${Math.min(100, Math.round(r.avance || 0))}%"></i></div></button>`; };
  app().innerHTML = marco(`<section class="hero"><div><small>Club Activo 20-30 San José #532</small><h1>Carteras de proyectos</h1><p>Cada proyecto tiene su propia cartera con grupos, tareas, columnas, cronograma e indicadores.</p></div>
    ${ED() ? `<button class="btn b-am" id="b-ncart">${svg('mas')} Nueva cartera</button>` : ''}</section>
    ${cs.length ? `<div class="carts">${cs.map(card).join('')}</div>` : `<div class="vacio"><b style="font-size:1.1rem;color:var(--ink)">Todavía no hay carteras.</b><p>${ED() ? 'Creá la primera con «Nueva cartera».' : 'Cuando se cree una cartera la vas a ver aquí.'}</p></div>`}`, 'Carteras');
  montarTema();
}
function formCartera(x) {
  modal(`<h2>${x ? 'Editar cartera' : 'Nueva cartera de proyecto'}</h2><form id="f-cart" data-id="${x ? x.id : ''}"><div class="fld"><label for="c-n">Nombre del proyecto</label><input class="input" id="c-n" value="${esc(x ? x.nombre : '')}" required maxlength="80"></div>
  <div class="fld"><label for="c-d">Descripción (opcional)</label><input class="input" id="c-d" value="${esc(x ? x.desc || '' : '')}" maxlength="160"></div>
  <div class="fld"><label>Color</label><div style="display:flex;gap:6px;flex-wrap:wrap">${PAL.map((p, i) => `<label style="cursor:pointer"><input type="radio" name="c-c" value="${p}" ${(x ? x.color : PAL[0]) === p || (!x && i === 0) ? 'checked' : ''} style="position:absolute;opacity:0"><i style="display:block;width:30px;height:30px;border-radius:9px;background:${p};outline:3px solid transparent" class="sw"></i></label>`).join('')}</div></div>
  ${!x ? `<div class="fld"><label for="c-base">Copiar columnas de</label><select class="input" id="c-base"><option value="">Columnas predeterminadas</option>${IDX.carteras.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</select></div>` : ''}
  <div class="ft">${x && puede('admin') ? `<button type="button" class="btn b-sf" style="color:var(--rojo);margin-right:auto" data-delcart="${x.id}">Eliminar cartera</button>` : ''}<button type="button" class="btn b-sf" data-cerrar>Cancelar</button><button class="btn b-az" type="submit">${x ? 'Guardar' : 'Crear cartera'}</button></div></form>`);
  pintarSw();
}
function pintarSw() { $$('.modal input[name=c-c]').forEach(r => r.nextElementSibling.style.outlineColor = r.checked ? 'var(--ink)' : 'transparent'); }
async function guardarCartera(f) {
  const id = f.dataset.id, nombre = $('#c-n').value.trim(), desc = $('#c-d').value.trim(), color = (f.querySelector('input[name=c-c]:checked') || {}).value || PAL[0];
  if (!nombre) return; const btn = f.querySelector('[type=submit]'); btn.disabled = true;
  try {
    if (id) {
      const g = await guardarIdx(i => { const c = i.carteras.find(x => x.id === id); if (c) Object.assign(c, { nombre, desc, color }); }, 'Proyectos: editar cartera');
      if (!g) return; const c = await leerC(id); const extra = {}; if (c) { c.nombre = nombre; c.color = color; c.rev = (c.rev || 0) + 1; extra[rutaC(id)] = await A.cifrar(K, c); } await g.fin(extra);
    } else {
      let nc = nuevaCartera(nombre, color); const bid = $('#c-base').value;
      if (bid) { const b = await leerC(bid); if (b) { nc.cols = JSON.parse(JSON.stringify(b.cols)); nc.grupos = b.grupos.map(x => ({ id: uid(), nombre: x.nombre, color: x.color })); } }
      nc.rev = 1; const g = await guardarIdx(i => i.carteras.push({ id: nc.id, nombre, desc, color, creado: Date.now(), por: S.nombre, res: resumenC(nc) }), 'Proyectos: nueva cartera ' + nombre);
      if (!g) return; await g.fin({ [rutaC(nc.id)]: await A.cifrar(K, nc) });
    }
    cerrarModal(); toast(id ? 'Cartera guardada' : 'Cartera creada'); if (VISTA === 'tablero' && C && C.id === id) await abrirCartera(id); else pintarCarteras();
  } catch (e) { console.error(e); toast('No se pudo guardar. Revisá tu conexión.'); } finally { btn.disabled = false; }
}
async function borrarCartera(id) {
  const x = IDX.carteras.find(c => c.id === id); if (!x || !confirmar('¿Eliminar la cartera «' + x.nombre + '» con todo su contenido? No se puede deshacer.')) return;
  try { const c = await leerC(id); const extra = { [rutaC(id)]: null }; if (c) Object.values(c.archivos || {}).flat().forEach(a => extra[rutaF(a.id)] = null);
    const g = await guardarIdx(i => i.carteras = i.carteras.filter(c => c.id !== id), 'Proyectos: eliminar cartera'); if (!g) return; await g.fin(extra); cerrarModal(); toast('Cartera eliminada'); pintarCarteras(); }
  catch (e) { console.error(e); toast('No se pudo eliminar.'); }
}
async function abrirCartera(id) {
  app().innerHTML = marco('<div class="vacio">Abriendo la cartera…</div>', 'Cargando'); montarTema();
  try { const c = await leerC(id); if (!c) { toast('La cartera no existe'); return pintarCarteras(); } C = c; CID = id; baseRev = c.rev || 0; pend = []; deshacer = []; rehacer = []; filtro = { q: '', estado: '', persona: '', grupoKpi: '' }; VISTA = 'tablero'; pintarTablero(); }
  catch (e) { console.error(e); toast('No se pudo abrir la cartera'); pintarCarteras(); }
}

/* ---------- Pantalla: tablero ---------- */
function pintarTablero() {
  if (!C) return; const sx = (document.scrollingElement || {}).scrollTop || 0; const tws = $$('.tw').map(x => x.scrollLeft);
  const k = kpis(C, filtro.grupoKpi), bal = k.ing - k.cos, meta = num((C.meta || {}).monto), falta = Math.max(0, meta - k.ing);
  const ce = colsT(C, 'estado')[0], ps = personas(C);
  const cab = `<div class="bh"><button class="ib" data-go="carteras" aria-label="Volver a carteras">${svg('atras')}</button><h1 style="--c:${esc(C.color)}"><i></i>${esc(C.nombre)}</h1>${ED() ? `<button class="btn b-sf b-sm" data-editcart>✎ Editar</button>` : ''}<span style="flex:1"></span>
   <div class="seg"><button class="${MODO === 'tabla' ? 'on' : ''}" data-modo="tabla">Tabla</button><button class="${MODO === 'crono' ? 'on' : ''}" data-modo="crono">Cronograma</button></div></div>
   <div class="tabs-g"><button class="${!filtro.grupoKpi ? 'on' : ''}" data-gkpi="">Todos los grupos</button>${C.grupos.map(g => `<button class="${filtro.grupoKpi === g.id ? 'on' : ''}" data-gkpi="${g.id}">${esc(g.nombre)}</button>`).join('')}</div>
   <div class="kpis"><div class="kpi"><small>Recaudado total</small><b>${col(k.ing)}</b><span>${k.n} elemento${k.n === 1 ? '' : 's'}</span></div><div class="kpi"><small>Costo total</small><b>${col(k.cos)}</b></div>
   <div class="kpi"><small>Balance neto</small><b class="${bal < 0 ? 'neg' : ''}">${col(bal)}</b></div><div class="kpi"><small>Avance promedio</small><b>${Math.round(k.ava)}%</b><div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, k.ava)}%"></i></div></div>
   <div class="kpi meta" data-meta title="${ED() ? 'Clic para editar la meta' : ''}"><small>${esc((C.meta || {}).nombre || 'Meta')}${ED() ? ' ✎' : ''}</small><b>${col(meta)}</b><span>Falta ${col(falta)} · ${meta ? Math.round(k.ing / meta * 100) : 0}% alcanzado</span></div></div>
   <div class="tools"><input class="input q" id="q" placeholder="Buscar en la cartera…" value="${esc(filtro.q)}">
   ${ce ? `<select class="input" id="f-est"><option value="">Estado: todos</option>${(ce.etiquetas || []).map(e => `<option ${filtro.estado === e.t ? 'selected' : ''}>${esc(e.t)}</option>`).join('')}</select>` : ''}
   ${ps.length ? `<select class="input" id="f-per"><option value="">Persona: todas</option>${ps.map(p => `<option ${filtro.persona === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>` : ''}
   <button class="btn b-sf b-sm" data-limpiar>Limpiar</button><button class="btn b-sf b-sm" data-fs="-1" title="Letra más pequeña">A−</button><button class="btn b-sf b-sm" data-fs="1" title="Letra más grande">A+</button>
   ${ED() ? `<button class="btn b-az b-sm" data-nitem>${svg('mas')} Nuevo elemento</button><button class="btn b-sf b-sm" data-ngrupo>${svg('mas')} Grupo</button><button class="btn b-sf b-sm" data-importar>${svg('subir')} Importar</button>` : ''}
   <button class="btn b-sf b-sm" data-exportar>${svg('bajar')} Exportar</button></div>`;
  const cuerpo = MODO === 'crono' ? gantt() : C.grupos.map(tablaGrupo).join('') + (C.grupos.length ? '' : '<div class="vacio">No hay grupos. Creá uno con «Grupo».</div>');
  app().innerHTML = marco(cab + cuerpo, C.nombre); montarTema();
  $('#sync').textContent = pend.length ? 'Guardando…' : '✓ Al día';
  document.scrollingElement.scrollTop = sx; $$('.tw').forEach((x, i) => x.scrollLeft = tws[i] || 0);
  if (MODO === 'crono') centrarHoy(false);
}
function tablaGrupo(g) {
  const cols = C.cols.filter(x => !x.oculta), it = C.items.filter(x => x.g === g.id && !x.pid).sort((a, b) => (a.o || 0) - (b.o || 0)).filter(x => pasaFiltro(C, x));
  const tot = C.items.filter(x => x.g === g.id && !x.pid); const kg = kpis(C, g.id);
  const th = cols.map(cl => `<th style="width:${cl.ancho || 140}px;min-width:${cl.ancho || 140}px" data-col="${cl.id}" ${ED() ? 'draggable="true"' : ''}><div class="thi"><span title="${esc(cl.nombre)}">${esc(cl.nombre)}</span>${ED() ? `<button class="cm" data-colmenu="${cl.id}" aria-label="Opciones de ${esc(cl.nombre)}">⋯</button><i class="rz" data-rz="${cl.id}"></i>` : ''}</div></th>`).join('');
  const filas = it.map(x => fila(x, cols, false) + (abiertos[x.id] ? hijos(C, x.id).sort((a, b) => (a.o || 0) - (b.o || 0)).map(h => fila(h, cols, true)).join('') + (ED() ? `<tr class="add sub"><td class="nm" colspan="1"><input data-addsub="${x.id}" placeholder="+ Agregar subtarea"></td>${cols.map(() => '<td></td>').join('')}</tr>` : '') : '')).join('');
  const totales = cols.map(cl => { if (cl.tipo === 'monto' || cl.tipo === 'numero') { const s = tot.reduce((a, x) => a + num(plano(valor(C, x, cl))), 0); return `<td class="c">${cl.tipo === 'monto' ? col(s) : s.toLocaleString('en-US')}</td>`; } if (cl.tipo === 'avance') return `<td class="c">${Math.round(tot.length ? tot.reduce((a, x) => a + num(plano(valor(C, x, cl))), 0) / tot.length : 0)}%</td>`; if (cl.tipo === 'estado') { const n = tot.length || 1; return `<td class="c"><div style="display:flex;height:10px;border-radius:5px;overflow:hidden">${(cl.etiquetas || []).map(e => { const k = tot.filter(x => (x.v || {})[cl.id] === e.t).length; return k ? `<i title="${esc(e.t)}: ${k}" style="width:${k / n * 100}%;background:${e.c}"></i>` : ''; }).join('')}</div></td>`; } return '<td></td>'; }).join('');
  return `<section class="grp" style="--gc:${esc(g.color)}" data-grupo="${g.id}"><div class="gh">${ED() ? `<button class="hd" data-gmenu="${g.id}" aria-label="Opciones del grupo">⋯</button>` : ''}<button class="tg" data-gtoggle="${g.id}" aria-label="Contraer o expandir">${g.cerrado ? '▸' : '▾'}</button><button class="gn" ${ED() ? `data-gren="${g.id}"` : ''}>${esc(g.nombre)}</button><span class="gt">${tot.length} elemento${tot.length === 1 ? '' : 's'} · Recaudado ${col(kg.ing)} · Costo ${col(kg.cos)} · Balance <b class="${kg.ing - kg.cos < 0 ? 'neg' : ''}">${col(kg.ing - kg.cos)}</b></span></div>
  ${g.cerrado ? '' : `<div class="tw"><table class="t"><thead><tr><th class="nm" style="min-width:260px;position:sticky;left:0;z-index:2"><div class="thi" style="cursor:default"><span>Elemento</span></div></th>${th}${ED() ? `<th style="width:44px"><div class="thi" style="cursor:default"><button class="cm" data-ncol title="Nueva columna" aria-label="Nueva columna" style="font-size:1.1rem;color:var(--azul)">＋</button></div></th>` : ''}</tr></thead>
  <tbody data-gbody="${g.id}">${filas}${ED() ? `<tr class="add"><td class="nm"><input data-additem="${g.id}" placeholder="+ Agregar elemento (Enter)"></td>${cols.map(() => '<td></td>').join('')}<td></td></tr>` : ''}
  <tr class="tot"><td class="nm" style="padding:8px">Totales</td>${totales}${ED() ? '<td></td>' : ''}</tr></tbody></table></div>`}</section>`;
}
function fila(x, cols, sub) {
  const nh = hijos(C, x.id).length, nc = ((C.coms || {})[x.id] || []).length, na = ((C.archivos || {})[x.id] || []).length;
  return `<tr class="${sub ? 'sub' : ''}" data-item="${x.id}"><td class="nm"><div class="nmw">${ED() ? `<button class="hd" data-arrastre="${x.id}" aria-label="Arrastrar">⠿</button>` : ''}${!sub ? `<button class="ic ar" data-abrirsub="${x.id}" aria-label="Subtareas">${abiertos[x.id] ? '▾' : '▸'}</button>` : ''}<button class="dot" style="background:${esc(x.color || 'var(--line)')}" ${ED() ? `data-color="${x.id}"` : ''} aria-label="Color"></button>
  <span class="tx" ${ED() ? `data-nombre="${x.id}" tabindex="0"` : ''} title="${esc(x.nombre)}">${esc(x.nombre)}</span>${!sub && nh ? `<span class="ic" data-abrirsub="${x.id}">${nh} sub</span>` : ''}<button class="ic" data-det="${x.id}" data-tab="coms" title="Comentarios">💬${nc || ''}</button><button class="ic" data-det="${x.id}" data-tab="arch" title="Archivos">📎${na || ''}</button><button class="ic" data-imenu="${x.id}" aria-label="Opciones">⋯</button></div></td>
  ${cols.map(cl => celda(x, cl)).join('')}${ED() ? '<td></td>' : ''}</tr>`;
}
function celda(x, cl) {
  const v = valor(C, x, cl), raw = plano(v), ed = ED() ? `tabindex="0" data-cel="${x.id}|${cl.id}"` : `data-ver="${x.id}"`;
  let h = '';
  switch (cl.tipo) {
    case 'monto': h = raw === '' || raw == null ? '' : `<span class="nw">${v && v.sum != null ? 'Σ ' : ''}${col(raw)}</span>`; break;
    case 'numero': h = raw === '' || raw == null ? '' : `${v && v.sum != null ? 'Σ ' : ''}${num(raw).toLocaleString('en-US')}`; break;
    case 'estado': { const e = (cl.etiquetas || []).find(z => z.t === raw); h = raw ? `<span class="pl" style="background:${e ? e.c : '#747576'}">${esc(raw)}</span>` : ''; break; }
    case 'persona': h = `<span class="per">${(raw || []).map(p => `<span>${esc(p)}</span>`).join('')}</span>`; break;
    case 'fecha': h = raw ? `<span class="nw ${raw < hoyISO() ? 'neg' : ''}">${fCorta(raw)}</span>` : ''; break;
    case 'crono': h = raw && raw.i ? `<span class="nw">${fCorta(raw.i)} → ${fCorta(raw.f || raw.i)}</span>` : ''; break;
    case 'avance': { const p = Math.round(num(raw)); h = `<div class="prog"><div class="bar"><i style="width:${Math.min(100, p)}%"></i></div><b style="font-size:.78rem">${p}%</b></div>`; break; }
    case 'prioridad': { const n = num(raw); h = `<span class="stars">${[1, 2, 3, 4, 5].map(i => ED() ? `<button style="border:0;background:none;padding:0 1px;color:${i <= n ? '#c9a400' : 'var(--line)'}" data-estrella="${x.id}|${cl.id}|${i}">★</button>` : `<span style="color:${i <= n ? '#c9a400' : 'var(--line)'}">★</span>`).join('')}</span>`; return `<td class="c">${h}</td>`; }
    case 'casilla': return `<td class="c" style="text-align:center"><input type="checkbox" class="cbx" ${raw ? 'checked' : ''} ${ED() ? `data-casilla="${x.id}|${cl.id}"` : 'disabled'}></td>`;
    case 'enlace': h = raw ? `<a href="${esc(/^https?:\/\//.test(raw) ? raw : 'https://' + raw)}" target="_blank" rel="noopener noreferrer" style="color:var(--azul)">${esc(raw)}</a>` : ''; break;
    default: h = esc(raw || '');
  }
  return `<td class="c" ${ed} title="${esc(txtV(raw))}">${h}</td>`;
}

/* ---------- Edición de celdas ---------- */
function setV(itId, colId, val, render) {
  hacer(c => { const it = c.items.find(x => x.id === itId); if (!it) return; it.v = it.v || {}; const cl = c.cols.find(x => x.id === colId); const de = it.v[colId]; if (JSON.stringify(de) === JSON.stringify(val)) return; if (val === '' || val == null || (Array.isArray(val) && !val.length)) delete it.v[colId]; else it.v[colId] = val; registrar(c, itId, cl ? cl.nombre : colId, de, val); }, render);
}
function editarCelda(td) {
  const [itId, colId] = td.dataset.cel.split('|'), cl = C.cols.find(x => x.id === colId), it = C.items.find(x => x.id === itId); if (!cl || !it) return;
  if (hijos(C, itId).length && ['monto', 'numero', 'avance'].includes(cl.tipo)) return toast('Este valor se calcula con las subtareas');
  const v = (it.v || {})[colId];
  if (cl.tipo === 'estado') return menuEstado(td, it, cl);
  if (cl.tipo === 'persona') return menuPersona(td, it, cl);
  if (cl.tipo === 'largo') return modalTexto(it, cl);
  if (cl.tipo === 'crono') return modalCrono(it, cl);
  const tipo = cl.tipo === 'fecha' ? 'date' : ['monto', 'numero', 'avance'].includes(cl.tipo) ? 'number' : 'text';
  editando = true; td.innerHTML = `<input class="input" style="padding:6px 8px;border-radius:8px;min-width:100%" type="${tipo}" ${tipo === 'number' ? 'step="any"' : ''} ${cl.tipo === 'avance' ? 'min="0" max="100"' : ''} value="${esc(v == null ? '' : v)}">`;
  const inp = td.firstChild; inp.focus(); if (inp.select && tipo !== 'date') inp.select();
  let hecho = false; const fin = ok => { if (hecho) return; hecho = true; editando = false; if (ok) { let nv = inp.value.trim(); if (tipo === 'number' && nv !== '') nv = cl.tipo === 'avance' ? Math.max(0, Math.min(100, num(nv))) : num(nv); setV(itId, colId, nv === '' ? null : nv); } else pintarTablero(); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fin(true); } if (e.key === 'Escape') { e.preventDefault(); fin(false); } });
  inp.addEventListener('blur', () => fin(true));
}
function editarNombre(el) {
  const id = el.dataset.nombre, it = C.items.find(x => x.id === id); editando = true;
  el.outerHTML = `<input class="input" id="en-${id}" style="padding:5px 8px;flex:1;min-width:120px" value="${esc(it.nombre)}">`;
  const inp = $('#en-' + id); inp.focus(); inp.select(); let hecho = false;
  const fin = ok => { if (hecho) return; hecho = true; editando = false; const n = inp.value.trim(); if (ok && n && n !== it.nombre) hacer(c => { const x = c.items.find(z => z.id === id); if (x) { registrar(c, id, 'Nombre', x.nombre, n); x.nombre = n; } }); else pintarTablero(); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); }); inp.addEventListener('blur', () => fin(true));
}
function menu(anchor, html) {
  cerrarMenu(); const m = document.createElement('div'); m.className = 'menu'; m.innerHTML = html; document.body.appendChild(m);
  const r = anchor.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px'; m.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4) + 'px';
  menuAbierto = m; return m;
}
function cerrarMenu() { if (menuAbierto) { menuAbierto.remove(); menuAbierto = null; } }
function menuEstado(td, it, cl) {
  const m = menu(td, (cl.etiquetas || []).map(e => `<button class="opt" data-pick="${esc(e.t)}"><i style="background:${e.c}"></i>${esc(e.t)}</button>`).join('') + `<hr><button data-pick="">Vaciar</button><button data-editetq="${cl.id}">✎ Editar etiquetas</button>`);
  m.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.editetq) { cerrarMenu(); return modalEtiquetas(cl.id); } cerrarMenu(); setV(it.id, cl.id, b.dataset.pick || null); });
}
function menuPersona(td, it, cl) {
  const act = ((it.v || {})[cl.id] || []).slice(), todas = [...new Set(personas(C).concat(act))];
  const pinta = () => `<div style="padding:6px"><input class="input" id="np" placeholder="Escribí un nombre y Enter" style="padding:8px"></div>${todas.map(p => `<label><input type="checkbox" class="cbx" value="${esc(p)}" ${act.includes(p) ? 'checked' : ''}> ${esc(p)}</label>`).join('')}<hr><button data-ok>Listo</button>`;
  const m = menu(td, pinta()); $('#np', m).focus();
  const listo = () => { const sel = $$('input[type=checkbox]', m).filter(x => x.checked).map(x => x.value); cerrarMenu(); setV(it.id, cl.id, sel); };
  m.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'np') { e.preventDefault(); const n = e.target.value.trim(); if (n && !todas.includes(n)) { todas.push(n); act.length = 0; $$('input[type=checkbox]', m).forEach(x => x.checked && act.push(x.value)); act.push(n); m.innerHTML = pinta(); $('#np', m).focus(); } } });
  m.addEventListener('click', e => { if (e.target.closest('[data-ok]')) listo(); });
}
function modal(html) { cerrarModal(); const s = document.createElement('div'); s.className = 'scrim'; s.id = 'scrim'; const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal'; m.setAttribute('role', 'dialog'); m.innerHTML = html; document.body.append(s, m); const f = m.querySelector('input,textarea,select'); f && f.focus(); editando = true; return m; }
function cerrarModal() { ['#modal', '#scrim'].forEach(s => { const x = $(s); x && x.remove(); }); editando = !!$('.panel'); }
function modalTexto(it, cl) {
  modal(`<h2>${esc(cl.nombre)}</h2><p style="margin:-6px 0 10px;color:var(--muted)">${esc(it.nombre)}</p><textarea class="input" id="mt" rows="8">${esc((it.v || {})[cl.id] || '')}</textarea><div class="ft"><button class="btn b-sf" data-cerrar>Cancelar</button><button class="btn b-az" id="mt-ok">Guardar</button></div>`);
  $('#mt-ok').onclick = () => { const v = $('#mt').value.trim(); cerrarModal(); setV(it.id, cl.id, v || null); };
}
function modalCrono(it, cl) {
  const v = (it.v || {})[cl.id] || {};
  modal(`<h2>${esc(cl.nombre)}</h2><p style="margin:-6px 0 10px;color:var(--muted)">${esc(it.nombre)}</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="fld"><label>Inicio</label><input class="input" type="date" id="cr-i" value="${esc(v.i || '')}"></div><div class="fld"><label>Fin</label><input class="input" type="date" id="cr-f" value="${esc(v.f || '')}"></div></div>
  <div class="ft"><button class="btn b-sf" id="cr-x" style="margin-right:auto">Vaciar</button><button class="btn b-sf" data-cerrar>Cancelar</button><button class="btn b-az" id="cr-ok">Guardar</button></div>`);
  $('#cr-ok').onclick = () => { let i = $('#cr-i').value, f = $('#cr-f').value || i; if (i && f < i) [i, f] = [f, i]; cerrarModal(); setV(it.id, cl.id, i ? { i, f } : null); };
  $('#cr-x').onclick = () => { cerrarModal(); setV(it.id, cl.id, null); };
}
function modalEtiquetas(colId) {
  const cl = C.cols.find(x => x.id === colId); const et = JSON.parse(JSON.stringify(cl.etiquetas || []));
  const pinta = () => et.map((e, i) => `<div class="lbl-row"><input type="color" value="${e.c}" data-ec="${i}"><input class="input" value="${esc(e.t)}" data-et="${i}" style="flex:1"><button class="btn b-sf b-sm" data-eb="${i}" aria-label="Quitar">✕</button></div>`).join('');
  const m = modal(`<h2>Etiquetas de «${esc(cl.nombre)}»</h2><div id="etq">${pinta()}</div><button class="btn b-sf b-sm" id="e-add">+ Etiqueta</button><div class="ft"><button class="btn b-sf" data-cerrar>Cancelar</button><button class="btn b-az" id="e-ok">Guardar</button></div>`);
  const leer = () => $$('[data-et]', m).forEach(x => et[+x.dataset.et].t = x.value.trim()) || $$('[data-ec]', m).forEach(x => et[+x.dataset.ec].c = x.value);
  m.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.id === 'e-add') { leer(); et.push({ t: 'Nueva', c: PAL[et.length % PAL.length] }); $('#etq').innerHTML = pinta(); } if (b.dataset.eb) { leer(); et.splice(+b.dataset.eb, 1); $('#etq').innerHTML = pinta(); } if (b.id === 'e-ok') { leer(); const lista = et.filter(x => x.t); const viejo = (cl.etiquetas || []).map(x => x.t);
    cerrarModal(); hacer(c => { const k = c.cols.find(x => x.id === colId); const ren = {}; viejo.forEach((t, i) => { if (et[i] && et[i].t && et[i].t !== t) ren[t] = et[i].t; }); k.etiquetas = lista; c.items.forEach(it => { const v = (it.v || {})[colId]; if (v && ren[v]) it.v[colId] = ren[v]; }); }); } });
}

/* ---------- Elementos, grupos y columnas ---------- */
const sigOrden = (gid, pid) => C.items.filter(x => x.g === gid && (x.pid || null) === (pid || null)).reduce((a, x) => Math.max(a, x.o || 0), 0) + 1;
function crearItem(gid, nombre, pid) { if (!nombre) return; const id = uid(), o = sigOrden(gid, pid); if (pid) abiertos[pid] = true; hacer(c => { c.items.push({ id, g: gid, pid: pid || null, nombre, o, v: {}, creado: Date.now(), por: S.nombre }); registrar(c, id, 'Creado', '', nombre); }); return id; }
function menuItem(btn, id) {
  const it = C.items.find(x => x.id === id); const ed = ED();
  const m = menu(btn, `<button data-a="det">Ver detalles</button><button data-a="coms">Comentarios</button><button data-a="arch">Archivos</button><button data-a="hist">Historial</button>${ed ? `<hr>${!it.pid ? '<button data-a="sub">Agregar subtarea</button>' : ''}<button data-a="dup">Duplicar</button><button data-a="color">Color de fila</button>${!it.pid ? `<button data-a="mover">Mover a grupo…</button>` : ''}<button data-a="crono">Ver en cronograma</button><hr><button class="dl" data-a="del">Eliminar</button>` : ''}`);
  m.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a; cerrarMenu();
    if (['det', 'coms', 'arch', 'hist'].includes(a)) return panel(id, a);
    if (a === 'sub') { abiertos[id] = true; pintarTablero(); const i = $(`[data-addsub="${id}"]`); i && i.focus(); }
    if (a === 'dup') { const nid = uid(); hacer(c => { const x = c.items.find(z => z.id === id); const cp = Object.assign(JSON.parse(JSON.stringify(x)), { id: nid, nombre: x.nombre + ' (copia)', o: (x.o || 0) + .5 }); c.items.push(cp); hijos(c, id).forEach(h => c.items.push(Object.assign(JSON.parse(JSON.stringify(h)), { id: uid(), pid: nid }))); registrar(c, nid, 'Duplicado', '', x.nombre); }); }
    if (a === 'color') menuColor(btn, id);
    if (a === 'mover') { const m2 = menu(btn, C.grupos.filter(g => g.id !== it.g).map(g => `<button class="opt" data-g="${g.id}"><i style="background:${g.color}"></i>${esc(g.nombre)}</button>`).join('') || '<button disabled>No hay otros grupos</button>'); m2.addEventListener('click', ev => { const g = ev.target.closest('[data-g]'); if (!g) return; cerrarMenu(); moverItem(id, g.dataset.g, null); }); }
    if (a === 'crono') { MODO = 'crono'; pintarTablero(); }
    if (a === 'del' && confirmar('¿Eliminar «' + it.nombre + '» con sus subtareas, comentarios y archivos?')) { const ids = [id].concat(hijos(C, id).map(h => h.id)); const fs = ids.flatMap(i => (C.archivos || {})[i] || []).map(f => f.id); hacer(c => { c.items = c.items.filter(x => !ids.includes(x.id)); ids.forEach(i => { delete (c.coms || {})[i]; delete (c.archivos || {})[i]; delete (c.hist || {})[i]; }); }); borrarArchivosRemotos(fs); toast('Eliminado'); }
  });
}
function menuColor(btn, id) { const m = menu(btn, `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:6px">${PAL.map(p => `<button data-c="${p}" style="height:30px;border-radius:8px;background:${p};padding:0"></button>`).join('')}</div><button data-c="">Sin color</button>`); m.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; cerrarMenu(); hacer(c => { const x = c.items.find(z => z.id === id); if (x) x.color = b.dataset.c || null; }); }); }
function moverItem(id, gid, antesDe) {
  hacer(c => { const x = c.items.find(z => z.id === id); if (!x) return; const deG = x.g; x.g = gid; hijos(c, id).forEach(h => h.g = gid); const her = c.items.filter(z => z.g === gid && (z.pid || null) === (x.pid || null) && z.id !== id).sort((a, b) => (a.o || 0) - (b.o || 0)); const i = antesDe ? her.findIndex(z => z.id === antesDe) : -1; her.splice(i < 0 ? her.length : i, 0, x); her.forEach((z, k) => z.o = k + 1); if (deG !== gid) registrar(c, id, 'Grupo', (c.grupos.find(g => g.id === deG) || {}).nombre, (c.grupos.find(g => g.id === gid) || {}).nombre); });
}
function menuGrupo(btn, gid) {
  const g = C.grupos.find(x => x.id === gid), i = C.grupos.indexOf(g);
  const m = menu(btn, `<button data-a="add">Agregar elemento</button><button data-a="ren">Renombrar</button><button data-a="col">Cambiar color</button>${i > 0 ? '<button data-a="up">Subir grupo</button>' : ''}${i < C.grupos.length - 1 ? '<button data-a="down">Bajar grupo</button>' : ''}<hr><button class="dl" data-a="del">Eliminar grupo</button>`);
  m.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a; cerrarMenu();
    if (a === 'add') { const n = prompt('Nombre del elemento'); if (n && n.trim()) crearItem(gid, n.trim()); }
    if (a === 'ren') renGrupo(gid);
    if (a === 'col') { const m2 = menu(btn, `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:6px">${PAL.map(p => `<button data-c="${p}" style="height:30px;border-radius:8px;background:${p};padding:0"></button>`).join('')}</div>`); m2.addEventListener('click', ev => { const c2 = ev.target.closest('[data-c]'); if (!c2) return; cerrarMenu(); hacer(c => { const x = c.grupos.find(z => z.id === gid); if (x) x.color = c2.dataset.c; }); }); }
    if (a === 'up' || a === 'down') hacer(c => { const k = c.grupos.findIndex(z => z.id === gid), j = k + (a === 'up' ? -1 : 1); if (j < 0 || j >= c.grupos.length) return; [c.grupos[k], c.grupos[j]] = [c.grupos[j], c.grupos[k]]; });
    if (a === 'del' && confirmar('¿Eliminar el grupo «' + g.nombre + '» y todos sus elementos?')) { const ids = C.items.filter(x => x.g === gid).map(x => x.id); const fs = ids.flatMap(i2 => (C.archivos || {})[i2] || []).map(f => f.id); hacer(c => { c.grupos = c.grupos.filter(z => z.id !== gid); c.items = c.items.filter(x => x.g !== gid); ids.forEach(i2 => { delete (c.coms || {})[i2]; delete (c.archivos || {})[i2]; delete (c.hist || {})[i2]; }); }); borrarArchivosRemotos(fs); }
  });
}
function renGrupo(gid) { const g = C.grupos.find(x => x.id === gid); const n = prompt('Nombre del grupo', g.nombre); if (n && n.trim() && n.trim() !== g.nombre) hacer(c => { const x = c.grupos.find(z => z.id === gid); if (x) x.nombre = n.trim(); }); }
function nuevaColumna(btn) {
  const m = menu(btn, Object.entries(TIPOS).map(([k, l]) => `<button data-t="${k}">${l}</button>`).join(''));
  m.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; cerrarMenu(); const t = b.dataset.t; const n = prompt('Nombre de la columna', TIPOS[t].replace(/ \(.*\)| \/.*/, '')); if (!n || !n.trim()) return;
    const id = uid(); hacer(c => c.cols.push(Object.assign({ id, nombre: n.trim(), tipo: t, ancho: t === 'largo' ? 200 : t === 'crono' ? 170 : 140 }, t === 'estado' ? { etiquetas: ETQ.map(x => Object.assign({}, x)) } : {}))); });
}
function menuColumna(btn, colId) {
  const cl = C.cols.find(x => x.id === colId), vis = C.cols.filter(x => !x.oculta), i = vis.indexOf(cl);
  const m = menu(btn, `<button data-a="ren">Renombrar</button><button data-a="ancho">Ancho…</button>${cl.tipo === 'estado' ? '<button data-a="etq">Editar etiquetas</button>' : ''}${cl.tipo === 'monto' || cl.tipo === 'numero' ? `<hr><button data-a="k-ingreso">${cl.kpi === 'ingreso' ? '✓ ' : ''}Sumar como ingreso en indicadores</button><button data-a="k-costo">${cl.kpi === 'costo' ? '✓ ' : ''}Sumar como costo en indicadores</button><button data-a="k-no">${!cl.kpi ? '✓ ' : ''}No usar en indicadores</button>` : ''}<hr>${i > 0 ? '<button data-a="izq">Mover a la izquierda</button>' : ''}${i < vis.length - 1 ? '<button data-a="der">Mover a la derecha</button>' : ''}<hr><button class="dl" data-a="del">Eliminar columna</button>`);
  m.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a; cerrarMenu();
    if (a === 'ren') { const n = prompt('Nombre de la columna', cl.nombre); if (n && n.trim()) hacer(c => { c.cols.find(x => x.id === colId).nombre = n.trim(); }); }
    if (a === 'ancho') { const n = num(prompt('Ancho en píxeles (60–600)', cl.ancho || 140)); if (n) hacer(c => { c.cols.find(x => x.id === colId).ancho = Math.max(60, Math.min(600, n)); }); }
    if (a === 'etq') modalEtiquetas(colId);
    if (a.startsWith('k-')) hacer(c => { const k = a.slice(2); c.cols.find(x => x.id === colId).kpi = k === 'no' ? null : k; });
    if (a === 'izq' || a === 'der') moverColumna(colId, vis[i + (a === 'izq' ? -1 : 2)] ? vis[i + (a === 'izq' ? -1 : 2)].id : null);
    if (a === 'del' && confirmar('¿Eliminar la columna «' + cl.nombre + '»? Sus valores dejan de verse.')) hacer(c => { c.cols.find(x => x.id === colId).oculta = true; });
  });
}
function moverColumna(colId, antesDe) { hacer(c => { const k = c.cols.findIndex(x => x.id === colId); const [x] = c.cols.splice(k, 1); const j = antesDe ? c.cols.findIndex(z => z.id === antesDe) : -1; c.cols.splice(j < 0 ? c.cols.length : j, 0, x); }); }
const confirmar = m => window.confirm(m);

/* ---------- Panel de detalle ---------- */
let PNL = null;
function panel(id, tab) {
  cerrarPanel(); PNL = { id, tab: tab || 'det' }; const s = document.createElement('div'); s.className = 'scrim'; s.id = 'pscrim'; const p = document.createElement('aside'); p.className = 'panel'; p.id = 'panel'; document.body.append(s, p); editando = true; pintarPanel();
}
function cerrarPanel() { ['#panel', '#pscrim'].forEach(x => { const e = $(x); e && e.remove(); }); PNL = null; editando = !!$('#modal'); }
function pintarPanel() {
  const p = $('#panel'); if (!p || !PNL) return; const it = C.items.find(x => x.id === PNL.id); if (!it) return cerrarPanel();
  const t = PNL.tab, ed = ED(); let b = '';
  if (t === 'det') b = `<div class="fld"><label>Nombre</label><input class="input" id="d-nom" value="${esc(it.nombre)}" ${ed ? '' : 'disabled'}></div>` + C.cols.filter(x => !x.oculta).map(cl => { const v = (it.v || {})[cl.id];
      const dis = ed ? '' : 'disabled', calc = hijos(C, it.id).length && ['monto', 'numero', 'avance'].includes(cl.tipo);
      let f = '';
      if (calc) f = `<div class="input" style="opacity:.8">${cl.tipo === 'monto' ? col(plano(valor(C, it, cl))) : Math.round(plano(valor(C, it, cl)) * 100) / 100} <small>(calculado con subtareas)</small></div>`;
      else if (cl.tipo === 'estado') f = `<select class="input" data-df="${cl.id}" ${dis}><option value="">—</option>${(cl.etiquetas || []).map(e => `<option ${v === e.t ? 'selected' : ''}>${esc(e.t)}</option>`).join('')}</select>`;
      else if (cl.tipo === 'persona') f = `<input class="input" data-df="${cl.id}" data-tipo="persona" value="${esc((v || []).join(', '))}" placeholder="Nombres separados por coma" ${dis}>`;
      else if (cl.tipo === 'largo') f = `<textarea class="input" rows="4" data-df="${cl.id}" ${dis}>${esc(v || '')}</textarea>`;
      else if (cl.tipo === 'crono') f = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><input class="input" type="date" data-df="${cl.id}" data-p="i" value="${esc((v || {}).i || '')}" ${dis}><input class="input" type="date" data-df="${cl.id}" data-p="f" value="${esc((v || {}).f || '')}" ${dis}></div>`;
      else if (cl.tipo === 'casilla') f = `<input type="checkbox" class="cbx" data-df="${cl.id}" ${v ? 'checked' : ''} ${dis}>`;
      else if (cl.tipo === 'prioridad') f = `<select class="input" data-df="${cl.id}" ${dis}>${[0, 1, 2, 3, 4, 5].map(n => `<option value="${n}" ${num(v) === n ? 'selected' : ''}>${n ? '★'.repeat(n) : 'Sin prioridad'}</option>`).join('')}</select>`;
      else f = `<input class="input" data-df="${cl.id}" type="${cl.tipo === 'fecha' ? 'date' : ['monto', 'numero', 'avance'].includes(cl.tipo) ? 'number' : 'text'}" step="any" value="${esc(v == null ? '' : v)}" ${dis}>`;
      return `<div class="fld"><label>${esc(cl.nombre)}</label>${f}</div>`; }).join('') + (ed ? `<div class="fld"><label>Color de la línea</label><div style="display:flex;gap:6px;flex-wrap:wrap">${PAL.map(c => `<button data-dcol="${c}" style="width:28px;height:28px;border-radius:8px;border:2px solid ${it.color === c ? 'var(--ink)' : 'transparent'};background:${c}" aria-label="Color"></button>`).join('')}</div></div><div class="ft"><button class="btn b-az" id="d-ok">Guardar cambios</button></div>` : '');
  if (t === 'coms') { const cs = (C.coms || {})[it.id] || []; b = (ed ? `<textarea class="input" id="c-txt" rows="3" placeholder="Escribí una actualización…"></textarea><div class="ft" style="margin:8px 0 16px"><button class="btn b-az" id="c-pub">Publicar</button></div>` : '') + (cs.length ? cs.map(c => `<div class="com"><div class="mh"><b>${esc(c.u)}</b><span>${fHora(c.f)}</span><span style="flex:1"></span>${ed && (c.u === S.nombre || puede('admin')) ? `<button class="ic" style="border:0;background:none;color:var(--rojo)" data-delcom="${c.id}">Eliminar</button>` : ''}</div><p>${esc(c.t)}</p></div>`).join('') : '<p style="color:var(--muted)">Todavía no hay comentarios.</p>'); }
  if (t === 'arch') { const as = (C.archivos || {})[it.id] || []; b = (ed ? `<label class="drop" id="drop">Arrastrá archivos aquí o tocá para elegir (máx. 10 MB)<input type="file" id="f-up" multiple hidden></label>` : '') + (as.length ? as.map(a => `<div class="file"><span title="${esc(a.n)}">📄 ${esc(a.n)} <small style="color:var(--muted)">· ${(a.tam / 1024 / 1024).toFixed(2)} MB · ${esc(a.u)}</small></span><button class="btn b-sf b-sm" data-verf="${a.id}">Ver</button><button class="btn b-sf b-sm" data-bajf="${a.id}">Descargar</button>${ed ? `<button class="btn b-sf b-sm" style="color:var(--rojo)" data-delf="${a.id}">✕</button>` : ''}</div>`).join('') : '<p style="color:var(--muted)">No hay archivos.</p>'); }
  if (t === 'hist') { const hs = (C.hist || {})[it.id] || []; b = hs.length ? hs.map(h => `<div class="hist"><b>${esc(h.u)}</b> · <small>${fHora(h.f)}</small><br>${esc(h.campo)}: ${h.de ? `<s style="color:var(--muted)">${esc(h.de)}</s> → ` : ''}${esc(h.a)}</div>`).join('') : '<p style="color:var(--muted)">Sin cambios registrados.</p>'; }
  const nc = ((C.coms || {})[it.id] || []).length, na = ((C.archivos || {})[it.id] || []).length;
  p.innerHTML = `<div class="ph"><div style="flex:1;min-width:0"><small style="color:var(--muted);font-weight:800">${esc((C.grupos.find(g => g.id === it.g) || {}).nombre || '')}${it.pid ? ' · Subtarea de ' + esc((C.items.find(x => x.id === it.pid) || {}).nombre || '') : ''}</small><h2>${esc(it.nombre)}</h2></div><button class="ib" id="p-x" aria-label="Cerrar">✕</button></div>
  <div class="pt">${[['det', 'Detalles'], ['coms', 'Comentarios' + (nc ? ' (' + nc + ')' : '')], ['arch', 'Archivos' + (na ? ' (' + na + ')' : '')], ['hist', 'Historial']].map(([k, l]) => `<button class="${t === k ? 'on' : ''}" data-ptab="${k}">${l}</button>`).join('')}</div><div class="pb">${b}</div>`;
}
function guardarDetalle() {
  const it = C.items.find(x => x.id === PNL.id), nom = $('#d-nom').value.trim(), vals = {};
  $$('[data-df]', $('#panel')).forEach(el => { const cid = el.dataset.df, cl = C.cols.find(x => x.id === cid); let v;
    if (el.type === 'checkbox') v = el.checked || null; else if (el.dataset.p) { vals[cid] = vals[cid] || {}; vals[cid][el.dataset.p] = el.value; return; } else if (el.dataset.tipo === 'persona') v = el.value.split(',').map(s => s.trim()).filter(Boolean); else if (['monto', 'numero', 'avance', 'prioridad'].includes(cl.tipo)) v = el.value === '' ? null : (cl.tipo === 'avance' ? Math.max(0, Math.min(100, num(el.value))) : num(el.value)); else v = el.value.trim() || null;
    vals[cid] = v; });
  Object.keys(vals).forEach(k => { const v = vals[k]; if (v && typeof v === 'object' && !Array.isArray(v)) vals[k] = v.i ? { i: v.i, f: v.f && v.f >= v.i ? v.f : v.i } : null; if (vals[k] === 0 && C.cols.find(x => x.id === k).tipo === 'prioridad') vals[k] = null; });
  hacer(c => { const x = c.items.find(z => z.id === it.id); if (!x) return; if (nom && nom !== x.nombre) { registrar(c, x.id, 'Nombre', x.nombre, nom); x.nombre = nom; } x.v = x.v || {};
    Object.entries(vals).forEach(([k, v]) => { const de = x.v[k]; if (JSON.stringify(de == null ? null : de) === JSON.stringify(v == null || (Array.isArray(v) && !v.length) ? null : v)) return; if (v == null || (Array.isArray(v) && !v.length)) delete x.v[k]; else x.v[k] = v; registrar(c, x.id, (c.cols.find(z => z.id === k) || {}).nombre || k, de, v); }); });
  toast('Cambios guardados'); pintarPanel();
}
async function subirArchivos(files) {
  for (const f of files) {
    if (f.size > 10 * 1024 * 1024) { toast('«' + f.name + '» pesa más de 10 MB'); continue; }
    toast('Subiendo ' + f.name + '…', 60000);
    try { const data = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ko; r.readAsDataURL(f); });
      const fid = uid(); await A.guardar({ [rutaF(fid)]: await A.cifrar(K, { n: f.name, tipo: f.type, data }) }, 'Proyectos: archivo');
      const itId = PNL.id; hacer(c => { c.archivos = c.archivos || {}; (c.archivos[itId] = c.archivos[itId] || []).push({ id: fid, n: f.name, tipo: f.type, tam: f.size, u: S.nombre, f: Date.now() }); registrar(c, itId, 'Archivo', '', f.name); });
      toast('Archivo subido'); pintarPanel();
    } catch (e) { console.error(e); toast('No se pudo subir ' + f.name); }
  }
}
async function abrirArchivo(fid, bajar) {
  toast('Abriendo…', 30000);
  try { const p = await A.leer(rutaF(fid)); if (!p) return toast('El archivo ya no existe'); const a = await A.descifrar(K, p);
    const bin = Uint8Array.from(atob(a.data), c => c.charCodeAt(0)), blob = new Blob([bin], { type: a.tipo || 'application/octet-stream' }), url = URL.createObjectURL(blob);
    if (bajar || !/^(image\/|application\/pdf|text\/)/.test(a.tipo || '')) { const l = document.createElement('a'); l.href = url; l.download = a.n; l.click(); }
    else window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000); $('#toast').hidden = true;
  } catch (e) { console.error(e); toast('No se pudo abrir el archivo'); }
}
function borrarArchivosRemotos(ids) { if (!ids.length) return; const arch = {}; ids.forEach(i => arch[rutaF(i)] = null); A.guardar(arch, 'Proyectos: borrar archivos').catch(e => console.warn(e)); }

/* ---------- Cronograma ---------- */
const ESCALAS = { dia: 34, sem: 14, mes: 4 };
function gantt() {
  const cc = colsT(C, 'crono')[0];
  if (!cc) return `<div class="vacio">Esta cartera no tiene una columna de tipo «Cronograma». ${ED() ? 'Agregala con el ＋ de la tabla.' : ''}</div>`;
  const pxd = ESCALAS[ESC], filas = [];
  C.grupos.forEach(g => { filas.push({ g }); C.items.filter(x => x.g === g.id && !x.pid && pasaFiltro(C, x)).sort((a, b) => (a.o || 0) - (b.o || 0)).forEach(x => { filas.push({ x, g }); hijos(C, x.id).forEach(h => filas.push({ x: h, g, sub: true })); }); });
  const fechas = C.items.map(x => (x.v || {})[cc.id]).filter(v => v && v.i).flatMap(v => [v.i, v.f || v.i]).concat([hoyISO()]).sort();
  let d0 = addD(fechas[0], -14), d1 = addD(fechas[fechas.length - 1], 45); if (ESC === 'mes') { d0 = d0.slice(0, 8) + '01'; }
  const dias = diffD(d0, d1), W = dias * pxd, ca = colsT(C, 'avance')[0];
  let hdr = '';
  if (ESC === 'dia') for (let i = 0; i < dias; i++) { const f = addD(d0, i), d = new Date(f + 'T12:00:00'); hdr += `<span style="width:${pxd}px;${d.getDay() === 0 || d.getDay() === 6 ? 'background:rgba(0,0,0,.04)' : ''}">${d.getDate()}<br>${'DLKMJVS'[d.getDay()]}</span>`; }
  else if (ESC === 'sem') { for (let i = 0; i < dias; i += 7) hdr += `<span style="width:${pxd * 7}px">${fCorta(addD(d0, i))}</span>`; }
  else { let f = d0; while (f < d1) { const d = new Date(f + 'T12:00:00'), n = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10), w = Math.min(diffD(f, n), diffD(f, d1)); hdr += `<span style="width:${w * pxd}px">${d.toLocaleDateString('es-CR', { month: 'short', year: '2-digit' })}</span>`; f = n; } }
  const izq = filas.map(r => r.x ? `<div class="it ${r.sub ? 'sb' : ''}" data-det="${r.x.id}" data-tab="det" title="${esc(r.x.nombre)}">${esc(r.x.nombre)}</div>` : `<div class="gx" style="--gc:${esc(r.g.color)}">${esc(r.g.nombre)}</div>`).join('');
  const der = filas.map(r => { if (!r.x) return '<div class="rw" style="background:var(--card2)"></div>'; const v = (r.x.v || {})[cc.id];
    if (!v || !v.i) return `<div class="rw">${ED() ? `<button class="btn b-sf b-sm" style="margin-left:8px;padding:3px 8px" data-programar="${r.x.id}">+ Programar</button>` : ''}</div>`;
    const l = diffD(d0, v.i) * pxd, w = Math.max(pxd, (diffD(v.i, v.f || v.i) + 1) * pxd), pg = ca ? Math.min(100, num(plano(valor(C, r.x, ca)))) : 0;
    return `<div class="rw"><div class="gb" style="left:${l}px;width:${w}px;--gc:${esc(r.x.color || r.g.color)}" ${ED() ? `data-gbar="${r.x.id}"` : `data-det="${r.x.id}" data-tab="det"`} title="${esc(r.x.nombre)}: ${fCorta(v.i)} → ${fCorta(v.f || v.i)}"><i class="pg" style="width:${pg}%"></i><span style="position:relative">${esc(r.x.nombre)}</span>${ED() ? '<i class="rs" data-rs="1"></i>' : ''}</div></div>`; }).join('');
  return `<div class="tools"><div class="seg">${[['dia', 'Días'], ['sem', 'Semanas'], ['mes', 'Meses']].map(([k, l]) => `<button class="${ESC === k ? 'on' : ''}" data-esc="${k}">${l}</button>`).join('')}</div><button class="btn b-sf b-sm" data-hoy>Ir a hoy</button><span class="gprog">${ED() ? 'Arrastrá una barra para mover las fechas o su borde derecho para cambiar la duración.' : ''}</span></div>
  <div class="gantt" id="gantt" data-d0="${d0}" data-pxd="${pxd}"><div class="gg"><div class="gl"><div class="hdr">Elemento</div>${izq}</div><div class="gr" style="width:${W}px"><div class="hdr">${hdr}</div>${der}<i class="today" style="left:${diffD(d0, hoyISO()) * pxd + pxd / 2}px"></i></div></div></div>`;
}
function centrarHoy(suave) { const g = $('#gantt'); if (!g) return; const x = diffD(g.dataset.d0, hoyISO()) * +g.dataset.pxd; g.scrollTo({ left: Math.max(0, x - g.clientWidth / 2 + 220), behavior: suave ? 'smooth' : 'auto' }); }

/* ---------- Excel ---------- */
async function exportar() {
  if (!window.ExcelJS) return toast('No se pudo cargar el generador de Excel');
  const wb = new ExcelJS.Workbook(), cols = C.cols.filter(x => !x.oculta);
  const val = (x, cl) => { const v = plano(valor(C, x, cl)); if (v == null) return ''; if (cl.tipo === 'crono') return v.i ? v.i + ' → ' + (v.f || v.i) : ''; if (Array.isArray(v)) return v.join(', '); if (cl.tipo === 'casilla') return v ? 'Sí' : ''; return v; };
  C.grupos.forEach(g => { const ws = wb.addWorksheet(g.nombre.slice(0, 31).replace(/[\\/?*[\]:]/g, ' ') || 'Grupo'); ws.addRow(['ID', 'Elemento', 'Tipo', 'Pertenece a'].concat(cols.map(c => c.nombre))); ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF001489' } };
    C.items.filter(x => x.g === g.id && !x.pid).sort((a, b) => (a.o || 0) - (b.o || 0)).forEach(x => { ws.addRow([x.id, x.nombre, 'Elemento', ''].concat(cols.map(cl => val(x, cl)))); hijos(C, x.id).forEach(h => ws.addRow([h.id, h.nombre, 'Subtarea', x.nombre].concat(cols.map(cl => val(h, cl))))); });
    ws.columns.forEach((c, i) => c.width = i === 1 ? 36 : 18); });
  const wc = wb.addWorksheet('Comentarios'); wc.addRow(['Elemento', 'Autor', 'Fecha', 'Comentario']); Object.entries(C.coms || {}).forEach(([id, cs]) => { const it = C.items.find(x => x.id === id); cs.forEach(c => wc.addRow([it ? it.nombre : id, c.u, new Date(c.f).toLocaleString('es-CR'), c.t])); });
  const wr = wb.addWorksheet('Resumen'); const k = kpis(C, ''); [['Cartera', C.nombre], ['Elementos', k.n], ['Recaudado', k.ing], ['Costo', k.cos], ['Balance', k.ing - k.cos], ['Avance promedio %', Math.round(k.ava)], [(C.meta || {}).nombre || 'Meta', num((C.meta || {}).monto)], ['Exportado', new Date().toLocaleString('es-CR') + ' por ' + S.nombre]].forEach(r => wr.addRow(r));
  const buf = await wb.xlsx.writeBuffer(), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = C.nombre.replace(/[^\w\- áéíóúñÁÉÍÓÚÑ]/g, '') + '.xlsx'; a.click();
}
async function importar(file) {
  if (!window.ExcelJS) return; try {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer()); let n = 0;
    hacer(c => { wb.worksheets.forEach(ws => { if (['Comentarios', 'Resumen'].includes(ws.name)) return; const enc = ws.getRow(1).values.slice(1).map(v => String(v == null ? '' : (v.text || v)).trim()); const iN = enc.findIndex(h => /^(elemento|nombre|proyecto|tarea)$/i.test(h)); if (iN < 0) return;
      let g = c.grupos.find(x => x.nombre.toLowerCase() === ws.name.toLowerCase()); if (!g) { g = { id: uid(), nombre: ws.name, color: PAL[c.grupos.length % PAL.length] }; c.grupos.push(g); }
      const mapa = enc.map((h, i) => { if (i === iN || /^(id|tipo|pertenece a)$/i.test(h) || !h) return null; let cl = c.cols.find(x => !x.oculta && x.nombre.toLowerCase() === h.toLowerCase()); if (!cl) { cl = { id: uid(), nombre: h, tipo: 'texto', ancho: 140 }; c.cols.push(cl); } return cl; });
      const iId = enc.findIndex(h => /^id$/i.test(h)), iT = enc.findIndex(h => /^tipo$/i.test(h)), iP = enc.findIndex(h => /^pertenece a$/i.test(h)); let ultimo = null;
      ws.eachRow((row, rn) => { if (rn === 1) return; const vs = row.values.slice(1).map(v => v == null ? '' : v.text || v.result || v); const nom = String(vs[iN] || '').trim(); if (!nom) return;
        const esSub = iT >= 0 && /sub/i.test(String(vs[iT])); const padre = esSub ? (iP >= 0 && vs[iP] ? c.items.find(x => x.g === g.id && !x.pid && x.nombre === String(vs[iP]).trim()) : ultimo) : null;
        let it = (iId >= 0 && vs[iId] && c.items.find(x => x.id === String(vs[iId]))) || c.items.find(x => x.g === g.id && x.nombre === nom && (x.pid || null) === (padre ? padre.id : null));
        if (!it) { it = { id: uid(), g: g.id, pid: padre ? padre.id : null, nombre: nom, o: c.items.length + 1, v: {}, creado: Date.now(), por: S.nombre }; c.items.push(it); }
        mapa.forEach((cl, i) => { if (!cl) return; let v = vs[i]; if (v === '' || v == null) return; if (v instanceof Date) v = v.toISOString().slice(0, 10);
          if (cl.tipo === 'monto' || cl.tipo === 'numero' || cl.tipo === 'avance' || cl.tipo === 'prioridad') v = num(v); else if (cl.tipo === 'persona') v = String(v).split(',').map(s => s.trim()).filter(Boolean); else if (cl.tipo === 'crono') { const m = String(v).match(/(\d{4}-\d{2}-\d{2}).*?(\d{4}-\d{2}-\d{2})?$/); v = m ? { i: m[1], f: m[2] || m[1] } : null; } else if (cl.tipo === 'casilla') v = /^(s[ií]|x|true|1)$/i.test(String(v)); else v = String(v);
          if (v != null) it.v[cl.id] = v; });
        if (!esSub) ultimo = it; n++; }); }); });
    toast(n + ' fila' + (n === 1 ? '' : 's') + ' importada' + (n === 1 ? '' : 's'));
  } catch (e) { console.error(e); toast('No se pudo leer el Excel'); }
}

/* ---------- Eventos ---------- */
document.addEventListener('submit', e => { e.preventDefault(); const f = e.target;
  if (f.id === 'f-login') login(f); if (f.id === 'f-lock') desbloquear(); if (f.id === 'f-cart') guardarCartera(f); });
document.addEventListener('change', e => { const t = e.target;
  if (t.name === 'c-c') pintarSw();
  if (t.id === 'f-est') { filtro.estado = t.value; pintarTablero(); } if (t.id === 'f-per') { filtro.persona = t.value; pintarTablero(); }
  if (t.dataset.casilla) { const [i, c] = t.dataset.casilla.split('|'); setV(i, c, t.checked || null); }
  if (t.id === 'f-up') subirArchivos([...t.files]);
  if (t.id === 'f-imp' && t.files[0]) importar(t.files[0]);
});
let tq; document.addEventListener('input', e => { if (e.target.id === 'q') { clearTimeout(tq); tq = setTimeout(() => { filtro.q = e.target.value; const pos = e.target.selectionStart; pintarTablero(); const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos); }, 250); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (menuAbierto) return cerrarMenu(); if ($('#modal')) return cerrarModal(); if ($('#panel')) return cerrarPanel(); }
  const t = e.target;
  if (e.key === 'Enter' && t.dataset && t.dataset.additem !== undefined && t.value.trim()) { const g = t.dataset.additem; crearItem(g, t.value.trim()); const x = $(`[data-additem="${g}"]`); x && x.focus(); }
  if (e.key === 'Enter' && t.dataset && t.dataset.addsub && t.value.trim()) { const p = C.items.find(x => x.id === t.dataset.addsub); crearItem(p.g, t.value.trim(), p.id); const x = $(`[data-addsub="${p.id}"]`); x && x.focus(); }
  if ((e.key === 'Enter' || e.key === 'F2') && t.dataset && t.dataset.cel && !editando) { e.preventDefault(); editarCelda(t); }
  if ((e.key === 'Enter' || e.key === 'F2') && t.dataset && t.dataset.nombre) { e.preventDefault(); editarNombre(t); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && t.dataset && t.dataset.cel && !editando) { const [i, c] = t.dataset.cel.split('|'); const cl = C.cols.find(x => x.id === c); if (!hijos(C, i).length || !['monto', 'numero', 'avance'].includes(cl.tipo)) setV(i, c, null); }
  if (t.dataset && t.dataset.cel && ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.key) && !editando) { const td = t, tr = td.parentElement, i = [...tr.children].indexOf(td); let dest = null;
    if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) dest = td.nextElementSibling; else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) dest = td.previousElementSibling; else { const r = e.key === 'ArrowUp' ? tr.previousElementSibling : tr.nextElementSibling; dest = r && r.children[i]; }
    if (dest && dest.dataset.cel) { e.preventDefault(); dest.focus(); } }
  if ((e.ctrlKey || e.metaKey) && !editando && VISTA === 'tablero' && ED() && !/INPUT|TEXTAREA|SELECT/.test(t.tagName)) {
    if (e.key.toLowerCase() === 'z' && !e.shiftKey && deshacer.length) { e.preventDefault(); rehacer.push(JSON.stringify(C)); const s = JSON.parse(deshacer.pop()); restaurar(s, 'Deshecho'); }
    else if ((e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) && rehacer.length) { e.preventDefault(); deshacer.push(JSON.stringify(C)); const s = JSON.parse(rehacer.pop()); restaurar(s, 'Rehecho'); }
    else if (e.key.toLowerCase() === 'c' && t.dataset.cel) { const [i, c] = t.dataset.cel.split('|'); const it = C.items.find(x => x.id === i); navigator.clipboard && navigator.clipboard.writeText(txtV(plano(valor(C, it, C.cols.find(x => x.id === c))))); toast('Copiado', 1200); }
    else if (e.key.toLowerCase() === 'v' && t.dataset.cel && navigator.clipboard && navigator.clipboard.readText) { e.preventDefault(); pegar(t); }
  }
});
function restaurar(s, msg) { const snap = JSON.parse(JSON.stringify(s)); const op = c => { Object.keys(c).forEach(k => { if (k !== 'rev') delete c[k]; }); Object.assign(c, JSON.parse(JSON.stringify(snap)), { rev: c.rev }); }; op(C); pend.push(op); programarGuardado(); pintarTablero(); toast(msg, 1200); }
async function pegar(td) {
  let txt = ''; try { txt = await navigator.clipboard.readText(); } catch (_) { return toast('El navegador no permitió pegar'); }
  const filas = txt.replace(/\r/g, '').split('\n').filter((x, i, a) => x !== '' || i < a.length - 1).map(r => r.split('\t')); const [i0, c0] = td.dataset.cel.split('|');
  const it0 = C.items.find(x => x.id === i0), lista = C.items.filter(x => x.g === it0.g && (x.pid || null) === (it0.pid || null)).sort((a, b) => (a.o || 0) - (b.o || 0)), vis = C.cols.filter(x => !x.oculta), ci = vis.findIndex(x => x.id === c0);
  hacer(c => { let k = lista.findIndex(x => x.id === i0); filas.forEach(r => { let it = lista[k] && c.items.find(x => x.id === lista[k].id); if (!it) { it = { id: uid(), g: it0.g, pid: it0.pid || null, nombre: 'Nuevo elemento', o: 999 + k, v: {} }; c.items.push(it); } r.forEach((v, j) => { const cl = vis[ci + j]; if (!cl || v === '') return; let x = v.trim(); if (['monto', 'numero', 'avance', 'prioridad'].includes(cl.tipo)) x = num(x); else if (cl.tipo === 'persona') x = x.split(',').map(s => s.trim()).filter(Boolean); else if (cl.tipo === 'casilla') x = /^(s[ií]|x|true|1)$/i.test(x); else if (cl.tipo === 'crono') x = { i: x, f: x }; it.v = it.v || {}; it.v[cl.id] = x; }); k++; }); });
  toast('Pegado');
}
document.addEventListener('click', async e => {
  if (menuAbierto && !menuAbierto.contains(e.target)) { cerrarMenu(); if (!e.target.closest('[data-colmenu],[data-imenu],[data-gmenu],[data-ncol],[data-color],[data-cel],#b-cuenta')) return; }
  const t = e.target.closest('button,[data-cel],[data-nombre],[data-det],.drop,[data-ver]'); if (!t) { if (e.target.id === 'scrim') cerrarModal(); if (e.target.id === 'pscrim') cerrarPanel(); return; }
  const d = t.dataset;
  if (t.id === 'tema-btn') return;
  if (d.cerrar !== undefined) return cerrarModal();
  if (t.id === 'b-lock' || d.act === 'lock') return bloquear();
  if (d.act === 'salir' || t.id === 'lk-salir') return salir();
  if (t.id === 'b-cuenta') { const m = menu(t, `<div style="padding:8px 10px"><b>${esc(S.nombre)}</b><br><small style="color:var(--muted)">Acceso: ${{ admin: 'Admin', editor: 'Editor', lector: 'Lector' }[S.proyRol]}</small></div><hr><button data-act="lock">🔒 Bloquear pantalla</button><button data-go="portal">↩ Volver al portal</button><button data-act="salir">Cerrar sesión</button>`); void m; return; }
  if (d.go === 'portal') { location.href = '../'; return; }
  if (d.go === 'carteras') { cerrarMenu(); if (pend.length) await guardarC(); return pintarCarteras(); }
  if (t.id === 'b-ncart') return formCartera(null);
  if (d.abrir) return abrirCartera(d.abrir);
  if (d.editcart !== undefined) return formCartera(IDX.carteras.find(x => x.id === C.id) || { id: C.id, nombre: C.nombre, color: C.color });
  if (d.delcart) return borrarCartera(d.delcart);
  if (d.modo) { if (VISTA !== 'tablero') return; MODO = d.modo; return pintarTablero(); }
  if (d.gkpi !== undefined) { filtro.grupoKpi = d.gkpi; return pintarTablero(); }
  if (d.meta !== undefined && ED()) { modal(`<h2>Meta de la cartera</h2><div class="fld"><label>Nombre de la meta</label><input class="input" id="m-n" value="${esc((C.meta || {}).nombre || 'Meta')}"></div><div class="fld"><label>Monto (₡)</label><input class="input" id="m-m" type="number" step="any" value="${esc(num((C.meta || {}).monto))}"></div><div class="ft"><button class="btn b-sf" data-cerrar>Cancelar</button><button class="btn b-az" id="m-ok">Guardar</button></div>`); return; }
  if (t.id === 'm-ok') { const n = $('#m-n').value.trim() || 'Meta', m = num($('#m-m').value); cerrarModal(); return hacer(c => c.meta = { nombre: n, monto: m }); }
  if (d.limpiar !== undefined) { filtro.q = ''; filtro.estado = ''; filtro.persona = ''; return pintarTablero(); }
  if (d.fs) { const v = Math.max(8, Math.min(18, (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--fs')) || 13) + +d.fs)); document.documentElement.style.setProperty('--fs', v + 'px'); try { localStorage.setItem('proy-fs', v); } catch (_) { } return; }
  if (d.nitem !== undefined) { if (!C.grupos.length) return toast('Primero creá un grupo'); const n = prompt('Nombre del elemento'); if (n && n.trim()) crearItem((C.grupos.find(g => !g.cerrado) || C.grupos[0]).id, n.trim()); return; }
  if (d.ngrupo !== undefined) { const n = prompt('Nombre del grupo'); if (n && n.trim()) hacer(c => c.grupos.push({ id: uid(), nombre: n.trim(), color: PAL[c.grupos.length % PAL.length] })); return; }
  if (d.importar !== undefined) { let i = $('#f-imp'); if (!i) { i = document.createElement('input'); i.type = 'file'; i.id = 'f-imp'; i.accept = '.xlsx'; i.hidden = true; document.body.appendChild(i); } i.value = ''; i.click(); return; }
  if (d.exportar !== undefined) return exportar();
  if (d.gtoggle) { const g = C.grupos.find(x => x.id === d.gtoggle); g.cerrado = !g.cerrado; return pintarTablero(); }
  if (d.gren) return renGrupo(d.gren);
  if (d.gmenu) return menuGrupo(t, d.gmenu);
  if (d.abrirsub) { abiertos[d.abrirsub] = !abiertos[d.abrirsub]; return pintarTablero(); }
  if (d.color && ED()) return menuColor(t, d.color);
  if (d.imenu) return menuItem(t, d.imenu);
  if (d.det) return panel(d.det, d.tab || 'det');
  if (d.ver) return panel(d.ver, 'det');
  if (d.nombre && ED()) return editarNombre(t);
  if (d.cel) return editarCelda(t);
  if (d.estrella) { const [i, c, n] = d.estrella.split('|'); const it = C.items.find(x => x.id === i); return setV(i, c, num((it.v || {})[c]) === +n ? null : +n); }
  if (d.ncol !== undefined) return nuevaColumna(t);
  if (d.colmenu) return menuColumna(t, d.colmenu);
  if (t.id === 'p-x') return cerrarPanel();
  if (d.ptab) { PNL.tab = d.ptab; return pintarPanel(); }
  if (t.id === 'd-ok') return guardarDetalle();
  if (d.dcol) { const id = PNL.id; hacer(c => { const x = c.items.find(z => z.id === id); if (x) x.color = d.dcol; }); return pintarPanel(); }
  if (t.id === 'c-pub') { const v = $('#c-txt').value.trim(); if (!v) return; const id = PNL.id; hacer(c => { c.coms = c.coms || {}; (c.coms[id] = c.coms[id] || []).unshift({ id: uid(), u: S.nombre, f: Date.now(), t: v }); }); return pintarPanel(); }
  if (d.delcom && confirmar('¿Eliminar el comentario?')) { const id = PNL.id; hacer(c => { c.coms[id] = (c.coms[id] || []).filter(x => x.id !== d.delcom); }); return pintarPanel(); }
  if (t.classList.contains('drop')) return;
  if (d.verf) return abrirArchivo(d.verf, false);
  if (d.bajf) return abrirArchivo(d.bajf, true);
  if (d.delf && confirmar('¿Eliminar el archivo?')) { const id = PNL.id, fid = d.delf; hacer(c => { c.archivos[id] = (c.archivos[id] || []).filter(x => x.id !== fid); }); borrarArchivosRemotos([fid]); return pintarPanel(); }
  if (d.esc) { ESC = d.esc; return pintarTablero(); }
  if (d.hoy !== undefined) return centrarHoy(true);
  if (d.programar) { const cc = colsT(C, 'crono')[0]; return setV(d.programar, cc.id, { i: hoyISO(), f: addD(hoyISO(), 7) }); }
});
/* Arrastrar archivos al panel */
['dragover', 'dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => { const z = e.target.closest && e.target.closest('#drop'); if (!z) { if (ev !== 'dragleave' && e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); if (ev === 'drop') toast('Soltá los archivos en la pestaña «Archivos» de un elemento'); } return; } e.preventDefault(); z.classList.toggle('on', ev === 'dragover'); if (ev === 'drop') subirArchivos([...e.dataTransfer.files]); }));
/* Arrastrar filas (mouse y táctil), columnas y barras del cronograma */
let drag = null;
document.addEventListener('pointerdown', e => {
  const h = e.target.closest('[data-arrastre]'), rz = e.target.closest('[data-rz]'), gb = e.target.closest('[data-gbar]');
  if (h && ED()) { e.preventDefault(); const tr = h.closest('tr'); tr.classList.add('drag'); drag = { tipo: 'fila', id: h.dataset.arrastre, tr }; }
  else if (rz && ED()) { e.preventDefault(); e.stopPropagation(); const th = rz.closest('th'); drag = { tipo: 'ancho', id: rz.dataset.rz, x: e.clientX, w: th.offsetWidth, th }; }
  else if (gb && ED()) { e.preventDefault(); const g = $('#gantt'); drag = { tipo: 'barra', id: gb.dataset.gbar, rs: !!e.target.dataset.rs, x: e.clientX, el: gb, l: gb.offsetLeft, w: gb.offsetWidth, pxd: +g.dataset.pxd, mov: 0 }; }
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  if (drag.tipo === 'fila') { $$('tr.over').forEach(x => x.classList.remove('over')); const el = document.elementFromPoint(e.clientX, e.clientY), tr = el && el.closest('tr[data-item],tr.add'); if (tr && tr !== drag.tr) tr.classList.add('over'); }
  if (drag.tipo === 'ancho') { const w = Math.max(60, Math.min(600, drag.w + e.clientX - drag.x)); drag.th.style.width = drag.th.style.minWidth = w + 'px'; drag.nw = w; }
  if (drag.tipo === 'barra') { const dx = e.clientX - drag.x; drag.mov = dx; if (drag.rs) drag.el.style.width = Math.max(drag.pxd, drag.w + dx) + 'px'; else drag.el.style.left = drag.l + dx + 'px'; }
});
document.addEventListener('pointerup', e => {
  if (!drag) return; const dd = drag; drag = null;
  if (dd.tipo === 'fila') { dd.tr.classList.remove('drag'); const ov = $('tr.over'); $$('tr.over').forEach(x => x.classList.remove('over')); if (!ov) return; const it = C.items.find(x => x.id === dd.id), gid = ov.closest('[data-gbody]').dataset.gbody;
    const antes = ov.dataset.item; const dest = antes && C.items.find(x => x.id === antes);
    if (it.pid) { if (dest && dest.pid === it.pid) hacer(c => { const her = c.items.filter(z => z.pid === it.pid && z.id !== it.id).sort((a, b) => (a.o || 0) - (b.o || 0)); const x = c.items.find(z => z.id === it.id); her.splice(her.findIndex(z => z.id === antes), 0, x); her.forEach((z, k) => z.o = k + 1); }); return; }
    moverItem(dd.id, gid, dest && !dest.pid ? antes : (dest && dest.pid ? dest.pid : null)); }
  if (dd.tipo === 'ancho' && dd.nw) hacer(c => { c.cols.find(x => x.id === dd.id).ancho = dd.nw; });
  if (dd.tipo === 'barra') { const dias = Math.round(dd.mov / dd.pxd); if (!dias) { if (Math.abs(dd.mov) < 4) panel(dd.id, 'det'); return pintarTablero(); } const cc = colsT(C, 'crono')[0], v = (C.items.find(x => x.id === dd.id).v || {})[cc.id];
    setV(dd.id, cc.id, dd.rs ? { i: v.i, f: addD(v.f || v.i, dias) < v.i ? v.i : addD(v.f || v.i, dias) } : { i: addD(v.i, dias), f: addD(v.f || v.i, dias) }); }
});
/* Columnas: arrastrar encabezado para reordenar (computadora) */
document.addEventListener('dragstart', e => { const th = e.target.closest && e.target.closest('th[data-col]'); if (th) { e.dataTransfer.setData('text/col', th.dataset.col); e.dataTransfer.effectAllowed = 'move'; } });
document.addEventListener('dragover', e => { const th = e.target.closest && e.target.closest('th[data-col]'); if (th && [...e.dataTransfer.types].includes('text/col')) e.preventDefault(); });
document.addEventListener('drop', e => { const th = e.target.closest && e.target.closest('th[data-col]'); const id = e.dataTransfer && e.dataTransfer.getData('text/col'); if (th && id && id !== th.dataset.col) { e.preventDefault(); moverColumna(id, th.dataset.col); } });
addEventListener('beforeunload', e => { if (pend.length) { e.preventDefault(); e.returnValue = ''; } });

try { const f = localStorage.getItem('proy-fs'); if (f) document.documentElement.style.setProperty('--fs', f + 'px'); } catch (_) { }
iniciar();
})();
