/* Portal de socios · Club Activo 20-30 San José #532
 * Roles: superadmin, tesorero, asociado, colaborador. Datos reales cifrados (ver almacen.js). */
(function () {
'use strict';
const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s), root = document.documentElement;
const A = window.Almacen, EC = window.EstadoCuenta;
const fmt = n => '₡' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt2 = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bigAmount = n => { const [i, d] = fmt2(n).split('.'); return `<span class="sym">₡</span>${i}<span class="dec">.${d}</span>`; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const numDe = v => { const x = parseFloat(String(v == null ? '' : v).replace(/[₡$,\s]/g, '')); return isNaN(x) ? NaN : x; };
const still = () => root.classList.contains('still') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const hoy = new Date(), hoyISO = EC.iso(hoy);
const ROL = { superadmin: 'Superadmin', tesorero: 'Tesorero', asociado: 'Asociado', colaborador: 'Colaborador' };
const ESTADOS = { activo: 'Activo', porConfirmar: 'Por confirmar', juvenil: 'Socio juvenil', incobrable: 'Incobrable', inactivo: 'Inactivo' };
const avColors = ['#001489', '#da291c', '#0a1fa8', '#b3241a', '#747576'];
const ini = n => String(n || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const slug = n => String(n).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const estadoPill = t => t === 0 ? ['ok', 'Al día'] : t >= 30000 ? ['bad', 'Moroso'] : ['warn', 'Pendiente'];

/* ---------- Estado de la sesión ---------- */
let DIR = null;          // usuarios.json
let S = null;            // sesión: {id, rol, socioId, socio(Ks), maestra, macero}
let D = null;            // datos completos (solo superadmin / tesorero)
let MAC = null;          // paquete de macero {directorio, cfg, envios}
let MIO = null;          // {socio, cfg} del socio que inició sesión
const esAdmin = () => S && (S.rol === 'superadmin' || S.rol === 'tesorero');
const esSuper = () => S && S.rol === 'superadmin';
const cfgCompleta = () => Object.assign({}, D.config, { sesiones: D.sesiones });

let tt; function toast(m, ms) { const t = $('#toast'); t.textContent = m; t.hidden = false; t.style.animation = 'none'; t.offsetHeight; t.style.animation = ''; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, ms || 3200); }
function ocupado(btn, si) { if (btn) si ? btn.setAttribute('aria-busy', 'true') : btn.removeAttribute('aria-busy'); }

/* ---------- Vistas ---------- */
function show(v) {
  ['setup', 'login', 'socio', 'admin', 'macero', 'colab'].forEach(k => { const el = $('#v-' + k); if (el) el.hidden = k !== v; });
  $('#h-title').textContent = { admin: 'Tesorería', macero: 'Soy Macero', colab: 'Colaboradores', setup: 'Configuración inicial' }[v] || 'Estados de cuenta';
  let nav = '';
  if (S) {
    if (esAdmin()) nav += `<button class="chip" data-go="admin"><span class="lbl">Tesorería</span></button>`;
    if (S.socioId) nav += `<button class="chip" data-go="socio"><span class="lbl">Mi estado</span></button>`;
    if (puedeMacero()) nav += `<button class="chip" data-go="macero"><span class="lbl">Soy Macero</span></button>`;
    nav += `<button class="chip" id="salir"><span class="avatar">${esc(ini(nombreUsuario()))}</span><span class="lbl">Cerrar sesión</span></button>`;
  }
  $('#h-user').innerHTML = nav;
  closeSheet(); scrollTo(0, 0);
  $$('.rv').forEach(el => { el.style.animation = 'none'; el.offsetHeight; el.style.animation = ''; });
  requestAnimationFrame(sizeDots);
}
function nombreUsuario() { if (D && D.usuarios[S.id]) return D.usuarios[S.id].nombre; if (MIO) return MIO.socio.nombre; return S.nombre || ''; }
function puedeMacero() { return esAdmin() || (S && S.rol === 'asociado' && MAC && MAC.envios && MAC.envios.token); }

/* ---------- Inicio ---------- */
async function iniciar() {
  try { DIR = await A.leer('usuarios.json'); }
  catch (e) { $('#login-err').textContent = 'No se pudo conectar. Revisá tu internet y recargá la página.'; show('login'); return; }
  if (!DIR) $('#login-err').textContent = 'El portal se está actualizando. Probá de nuevo en unos minutos.';
  show('login');
}

/* Configuración inicial: solo si todavía no existe ningún usuario. Requiere el token del repositorio. */
async function configurar(f) {
  const tok = $('#st-token').value.trim(), usu = $('#st-usuario').value.trim(), nom = $('#st-nombre').value.trim(), cor = $('#st-correo').value.trim().toLowerCase();
  const c1 = $('#st-clave').value, c2 = $('#st-clave2').value, btn = f.querySelector('button[type=submit]');
  if (!tok || !usu || !nom || !cor) return toast('Completá todos los campos');
  if (c1.length < 10) return toast('La contraseña debe tener al menos 10 caracteres');
  if (c1 !== c2) return toast('Las contraseñas no coinciden');
  ocupado(btn, true); toast('Verificando el token…', 60000);
  try {
    if (!(await A.probarToken(tok))) { toast('El token no tiene permiso de escritura sobre ' + A.REPO); return; }
    A.ponerToken(tok);
    await A.crearRama();
    if (await A.leer('usuarios.json')) { toast('El sistema ya está configurado. Iniciá sesión.'); location.reload(); return; }
    let ini0 = null; const file = $('#st-datos').files[0];
    if (file) ini0 = JSON.parse(await new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = ko; fr.readAsText(file); }));
    D = nuevoD(ini0);
    const maestra = await A.nuevaLlave(), macero = await A.nuevaLlave();
    D.macero = macero; D.maestra = maestra;
    for (const id of Object.keys(D.socios)) D.llaves[id] = await A.nuevaLlave();
    const socioId = Object.keys(D.socios).find(id => normal(D.socios[id].nombre) === normal(nom)) || null;
    const id = 'u-' + slug(usu);
    D.usuarios[id] = { id, usuario: usu, nombre: nom, correo: cor, rol: 'superadmin', socioId, activo: true, clave: c1 };
    if (socioId && !D.socios[socioId].correo) D.socios[socioId].correo = cor;
    D.config.token = tok;
    if (ini0 && ini0.usuarios) importarUsuarios(ini0.usuarios);
    DIR = { v: 1, sal: A.b64(A.azar(16)), usuarios: {} };
    toast('Creando el acceso cifrado…', 60000);
    await persistir({ datos: true, socios: 'todos', usuarios: 'todos' }, 'Configuración inicial');
    toast('Listo. Ya podés iniciar sesión.'); setTimeout(() => location.reload(), 1500);
  } catch (e) { console.error(e); toast('No se pudo completar la configuración: ' + e.message); }
  finally { ocupado(btn, false); }
}
const normal = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
function nuevoD(x) {
  const base = {
    config: {
      club: 'Club Activo 20-30 de San José', tesoreria: 'Tesorería', periodo: '2026-2027', emitidoPor: 'David Solís Miranda -Tesorero 2026-2027',
      cuentaNombre: 'ASOCIACIÓN CLUB ACTIVO VEINTE TREINTA INTERNACIONAL SAN JOSÉ', iban: '', sinpe: '8401-2030',
      inicioPeriodo: '2026-07-01', mesesPorPeriodo: 13, sesionInicial: 2355, sesionFinal: 2384,
      cuotaMensual: 6000, maceriaMinima: 1000, inasistenciaJustificada: 1000, inasistenciaInjustificada: 5000,
      etiquetaJustificada: 'Inasistencia justificada a sesión (Aprobado en sesion 2357):',
      otrosMontos: [{ concepto: 'Chaleco nuevo socio:', monto: 21000 }, { concepto: 'Cuota de ingreso socios:', monto: 35000 }],
      envios: null, token: null
    },
    sesiones: {}, socios: {}, usuarios: {}, llaves: {}, revisar: [], macero: null, maestra: null
  };
  if (x) { Object.assign(base.config, x.config || {}); base.sesiones = x.sesiones || {}; base.socios = x.socios || {}; base.revisar = x.revisar || []; }
  return base;
}

/* ---------- Acceso ---------- */
const BLOQ = 'bloqueo-acceso';
function bloqueo() { try { return JSON.parse(localStorage.getItem(BLOQ) || '{}'); } catch (_) { return {}; } }
async function entrar(f) {
  const login = $('#l-mail').value.trim(), clave = $('#l-pass').value, err = $('#login-err'), btn = f.querySelector('button[type=submit]');
  err.textContent = '';
  const b = bloqueo();
  if (b.hasta && Date.now() < b.hasta) { err.textContent = 'Acceso bloqueado por intentos fallidos. Probá de nuevo en ' + Math.ceil((b.hasta - Date.now()) / 60000) + ' minutos.'; return; }
  if (!login || !clave) { err.textContent = 'Escribí tu correo o usuario y tu contraseña.'; return; }
  ocupado(btn, true); err.textContent = 'Verificando…';
  try {
    DIR = await A.leer('usuarios.json');
    const r = DIR && await A.abrir(DIR, login, clave);
    if (!r) {
      const n = (b.n || 0) + 1, nb = n >= 5 ? { n: 0, hasta: Date.now() + 15 * 60000 } : { n };
      try { localStorage.setItem(BLOQ, JSON.stringify(nb)); } catch (_) { }
      err.textContent = n >= 5 ? 'Demasiados intentos. El acceso queda bloqueado 15 minutos.' : 'Correo, usuario o contraseña incorrectos. Te quedan ' + (5 - n) + ' intentos.';
      return;
    }
    if (r.inactivo) { err.textContent = 'Tu usuario está desactivado. Consultá con la Tesorería del club.'; return; }
    try { localStorage.removeItem(BLOQ); } catch (_) { }
    S = r; err.textContent = '';
    if (S.macero && DIR.macero) { try { MAC = await A.descifrar(S.macero, DIR.macero); } catch (_) { MAC = null; } }
    if (esAdmin()) {
      D = await A.descifrar(S.maestra, await A.leer('datos.json'));
      if (D.config.token) A.ponerToken(D.config.token);
      await procesarEnvios();
      if (!D.config.token && esSuper()) tab = 'config';
      renderAdmin(); show('admin');
    } else if (S.rol === 'colaborador') { show('colab'); }
    else {
      const paq = await A.leer('socios/' + S.socioId + '.json');
      if (!paq) { err.textContent = 'Tu estado de cuenta todavía no está publicado. Consultá con la Tesorería.'; S = null; return; }
      MIO = await A.descifrar(S.socio, paq);
      renderSocio(); show('socio');
    }
    vigilarInactividad();
  } catch (e) { console.error(e); err.textContent = 'No se pudo iniciar sesión. Revisá tu conexión e intentá de nuevo.'; }
  finally { ocupado(btn, false); $('#l-pass').value = ''; }
}
function salir() { location.reload(); }
let inact; function vigilarInactividad() {
  const lim = esAdmin() ? 30 : 15, reset = () => { clearTimeout(inact); inact = setTimeout(salir, lim * 60000); };
  ['pointerdown', 'keydown', 'scroll'].forEach(ev => addEventListener(ev, reset, { passive: true })); reset();
}

/* ---------- Guardado ---------- */
async function snapshotSocio(id) { return A.cifrar(D.llaves[id], { socio: D.socios[id], cfg: cfgCompleta() }); }
async function paqueteMacero() {
  const directorio = Object.keys(D.socios).filter(id => D.socios[id].estado !== 'inactivo' && D.socios[id].estado !== 'incobrable').map(id => ({ id, nombre: D.socios[id].nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  return A.cifrar(D.macero, { directorio, cfg: Object.assign({}, cfgCompleta(), { token: null, envios: null }), envios: D.config.envios });
}
/* cambios: {datos, socios:[ids]|'todos', usuarios:[ids]|'todos', borrarSocios:[ids], borrarUsuarios:[ids]} */
async function persistir(c, msg) {
  const arch = {};
  if (c.datos !== false) arch['datos.json'] = await A.cifrar(D.maestra, D);
  const ids = c.socios === 'todos' ? Object.keys(D.socios) : (c.socios || []);
  for (const id of ids) { if (!D.llaves[id]) D.llaves[id] = await A.nuevaLlave(); arch['socios/' + id + '.json'] = await snapshotSocio(id); }
  (c.borrarSocios || []).forEach(id => arch['socios/' + id + '.json'] = null);
  const uids = c.usuarios === 'todos' ? Object.keys(D.usuarios) : (c.usuarios || []);
  for (const uid of uids) await escribirAcceso(uid);
  (c.borrarUsuarios || []).forEach(uid => quitarAcceso(uid));
  DIR.macero = await paqueteMacero();
  arch['usuarios.json'] = DIR;
  await A.guardar(arch, msg || 'Actualizar datos');
}
function quitarAcceso(uid) { Object.keys(DIR.usuarios).forEach(h => { if (DIR.usuarios[h].id === uid) delete DIR.usuarios[h]; }); }
async function escribirAcceso(uid) {
  const u = D.usuarios[uid]; quitarAcceso(uid); if (!u) return;
  const admin = u.rol === 'superadmin' || u.rol === 'tesorero';
  const e = await A.entrada(u, u.clave, { socio: u.socioId ? D.llaves[u.socioId] : null, maestra: admin ? D.maestra : null, macero: u.rol !== 'colaborador' ? D.macero : null });
  for (const login of [u.usuario, u.correo].concat(u.alias || []).filter(Boolean)) DIR.usuarios[await A.claveBusqueda(DIR, login)] = e;
}
async function guardarCon(btn, c, msg, ok) {
  if (!A.hayToken()) { toast('Primero guardá el token de GitHub en Tesorería → Configuración', 6000); if (esSuper()) { tab = 'config'; renderAdmin(); } return false; }
  ocupado(btn, true); toast('Guardando…', 60000);
  try { await persistir(c, msg); toast(ok || 'Cambios guardados'); return true; }
  catch (e) { console.error(e); toast('No se pudo guardar. Revisá tu conexión e intentá de nuevo.'); return false; }
  finally { ocupado(btn, false); }
}

/* ---------- Vista del socio ---------- */
function datosSocio() { return esAdmin() ? { socio: D.socios[S.socioId], cfg: cfgCompleta() } : MIO; }
function mesesDisponibles(cfg) {
  return EC.mesesPeriodo(cfg).filter(m => m <= hoy).map(m => ({ clave: m.getFullYear() + '-' + m.getMonth(), corte: EC.corteMes(m.getFullYear(), m.getMonth(), hoy), m })).reverse();
}
function renderSocio() {
  const ds = datosSocio(); if (!ds || !ds.socio) return;
  const { socio, cfg } = ds, e = EC.calcular(socio, cfg, hoyISO);
  $('#s-nombre').textContent = socio.nombre;
  $('#s-sub').textContent = 'Estado de cuenta de ' + e.mesCorte + ' · corte al ' + e.corteLarga;
  $('#s-label').textContent = 'Total por pagar al ' + e.corteLarga;
  $('#s-amount').innerHTML = bigAmount(e.totalPendiente);
  const [c, t] = estadoPill(e.totalPendiente); $('#s-pill').className = 'pill ' + c; $('#s-pill').textContent = t;
  $('#m-amt').textContent = fmt(e.totalPendiente);
  const max = Math.max(1, e.totalPendiente), col = ['var(--azul)', 'var(--amarillo)', 'var(--rojo)'];
  $('#s-break').innerHTML = (e.totalPendiente ? `<div class="bar">${e.resumen.map((r, i) => `<i style="width:${r.pendiente / max * 100}%;background:${col[i]}"></i>`).join('')}</div>` : '') +
    e.resumen.map((r, i) => `<div class="row"><span><i class="dot" style="background:${col[i]}"></i>${r.concepto}</span><b>${fmt(r.pendiente)}</b></div>`).join('') +
    `<div class="row tot"><span>Pagado en el periodo</span><b>${fmt(e.totalPagado)}</b></div>`;
  $('#s-periodo').textContent = 'Periodo ' + cfg.periodo;
  $('#s-meses').innerHTML = e.cuotas.map(q => { const k = q.pago >= cfg.cuotaMensual ? 'p' : q.pendiente ? 'd' : 'f'; return `<div class="mes ${k}">${q.mes}<small>${k === 'p' ? 'Pagada' : k === 'd' ? fmt(q.pendiente) : '—'}</small></div>`; }).join('');
  const pct = Math.round(e.asistencia * 100); $('#s-ring').style.setProperty('--v', pct); $('#s-ring-v').textContent = pct + '%';
  $('#s-asis').innerHTML = `<b>Calificación de asistencia</b><br>${e.sesionesRealizadas} sesiones registradas en el periodo.`;
  const box = $('#count');
  box.innerHTML = e.totalPendiente ? `<p class="txt" style="max-width:none">Podés pagar por SINPE Móvil al ${esc(cfg.sinpe)} o por transferencia a la cuenta del club.</p>` : '<p class="txt" style="max-width:none">Estás al día con el club. ¡Gracias por tu compromiso!</p>';
  $('#s-hist').innerHTML = mesesDisponibles(cfg).map((x, i) => {
    const h = EC.calcular(socio, cfg, x.corte), mes = EC.MES_LARGO[x.m.getMonth()];
    return `<li><div class="doc">PDF</div><div><div class="t">${mes.replace(/^./, c => c.toUpperCase())} ${x.m.getFullYear()}${i === 0 ? ' · en curso' : ''}</div><div class="d num">Por pagar ${fmt(h.totalPendiente)} · corte ${EC.corta(x.corte)}</div></div><button class="dl" data-pdfmes="${x.corte}" aria-label="Descargar estado de cuenta de ${mes}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 21h16"/></svg></button></li>`;
  }).join('');
  $('#s-macero').hidden = !puedeMacero();
}

/* ---------- Librerías bajo demanda ---------- */
const cargadas = {};
function cargar(srcs) {
  return srcs.reduce((p, src) => p.then(() => cargadas[src] || (cargadas[src] = new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete cargadas[src]; ko(new Error(src)); }; document.head.appendChild(s); }))), Promise.resolve());
}
const LIB_PDF = ['../lib/jspdf.umd.min.js', '../lib/jspdf.plugin.autotable.min.js', '../lib/fuentes-pdf.js'];
let logoData = null;
async function logo() {
  if (logoData) return logoData;
  const b = await (await fetch('../img/logo-color.png')).blob();
  return logoData = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
}
function bajar(blob, nombre) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
async function pdfSocios(lista, cfg, corte, btn, nombre) {
  ocupado(btn, true); toast('Generando el PDF…', 60000);
  try {
    await cargar(LIB_PDF); const lg = await logo(); let doc = null, archivo = nombre;
    lista.forEach(s => { const r = EC.generar(s, cfg, corte, lg, doc); doc = r.doc; archivo = archivo || r.archivo; });
    doc.save(archivo); toast('Listo: ' + archivo);
  } catch (e) { console.error(e); toast('No se pudo generar el PDF. Intentá de nuevo.'); } finally { ocupado(btn, false); }
}
async function excelSocios(lista, cfg, corte, btn, nombre, general) {
  ocupado(btn, true); toast('Generando el Excel…', 60000);
  try { await cargar(['../lib/exceljs.min.js', '../lib/estado-excel.js']); bajar(await EstadoExcel.generar(lista, cfg, corte, await logo(), general), nombre); toast('Listo: ' + nombre); }
  catch (e) { console.error(e); toast('No se pudo generar el Excel. Intentá de nuevo.'); } finally { ocupado(btn, false); }
}
const mesArchivo = corte => { const d = EC.corta(corte).split('-'); return d[1].replace(/^./, c => c.toUpperCase()) + '_' + d[2]; };

/* ---------- Tesorería ---------- */
let tab = 'socios', filtroSocios = 'activos';
function renderAdmin() {
  $$('#a-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  $$('.a-panel').forEach(p => p.hidden = p.id !== 'p-' + tab);
  $('#tab-usuarios').hidden = !esAdmin(); $('#tab-config').hidden = !esSuper();
  const ids = Object.keys(D.socios), act = ids.filter(id => (D.socios[id].estado || 'activo') === 'activo');
  const tot = id => EC.calcular(D.socios[id], cfgCompleta(), hoyISO).totalPendiente;
  const ok = act.filter(id => tot(id) === 0).length;
  $('#a-n').textContent = act.length; $('#a-tot').textContent = fmt(ids.reduce((a, id) => a + tot(id), 0));
  $('#a-ok').textContent = ok + ' de ' + act.length; $('#a-meter').style.width = (act.length ? ok / act.length * 100 : 0) + '%';
  const rev = revisiones(); $('#rev-n').textContent = rev.length; $('#rev-n').hidden = !rev.length;
  ({ socios: renderSocios, sesiones: renderSesiones, revision: renderRevision, descargas: renderDescargas, montos: renderMontos, usuarios: renderUsuarios, config: renderConfig })[tab]();
}
function renderSocios() {
  const q = normal($('#a-q').value), cfg = cfgCompleta();
  const lista = Object.keys(D.socios).map(id => ({ id, s: D.socios[id] })).filter(x => {
    const e = x.s.estado || 'activo';
    return (filtroSocios === 'todos' || (filtroSocios === 'activos' ? (e === 'activo' || e === 'porConfirmar') : e === filtroSocios)) && normal(x.s.nombre + ' ' + (x.s.correo || '')).includes(q);
  }).sort((a, b) => a.s.nombre.localeCompare(b.s.nombre));
  $('#a-rows').innerHTML = `<li class="hd"><span>Socio</span><span>Ingreso</span><span>Estado</span><span style="text-align:right">Por pagar</span><span style="text-align:right">Acciones</span></li>` +
    (lista.map(({ id, s }, i) => {
      const t = EC.calcular(s, cfg, hoyISO).totalPendiente, [c, tx] = estadoPill(t), est = s.estado || 'activo';
      return `<li><div class="who"><span class="av" style="background:${avColors[i % 5]}">${esc(ini(s.nombre))}</span><div style="min-width:0"><b>${esc(s.nombre)}</b><span>${esc(s.correo || 'Sin correo')}</span></div></div>
      <div class="pass">${s.ingreso ? EC.corta(s.ingreso) : '—'}</div>
      <div class="stt">${est === 'activo' ? `<span class="pill ${c}">${tx}</span>` : `<span class="pill ${est === 'incobrable' ? 'bad' : 'warn'}">${ESTADOS[est]}</span>`}</div>
      <div class="money num">${est === 'juvenil' ? 'Sin estado de cuenta' : fmt(t)}<small>${est === 'juvenil' ? 'Ver reporte de aportes' : 'Corte ' + EC.corta(hoyISO)}</small></div>
      <div class="acts">${est === 'juvenil' ? '' : `<button class="ibtn up" data-pdfsocio="${id}" title="Estado de cuenta en PDF" aria-label="PDF de ${esc(s.nombre)}">PDF</button><button class="ibtn" data-xlsocio="${id}" title="Estado de cuenta en Excel" aria-label="Excel de ${esc(s.nombre)}">XLS</button>`}<button class="ibtn" data-edsocio="${id}" title="Editar" aria-label="Editar a ${esc(s.nombre)}">✎</button></div></li>`;
    }).join('') || `<li class="empty">No hay socios en esta lista.</li>`);
}
function sesionesLista() { const c = D.config, o = []; for (let n = +c.sesionInicial; n <= +c.sesionFinal; n++) o.push(n); return o; }
function renderSesiones() {
  $('#ses-rows').innerHTML = sesionesLista().map(n => {
    const m = D.sesiones[n] || {}, reg = !!m.registrado, p = reg ? Object.values(D.socios).filter(s => s.sesiones && s.sesiones[n] && s.sesiones[n].asistencia === 'A').length : 0;
    const pasada = m.fecha && m.fecha <= hoyISO;
    return `<li class="ses-row"><b class="num">${n}</b>
      <input class="input" type="date" data-sfecha="${n}" value="${esc(m.fecha || '')}" aria-label="Fecha de la sesión ${n}">
      <input class="input" type="time" data-shora="${n}" value="${esc(m.hora || '19:00')}" aria-label="Hora de la sesión ${n}">
      <label class="chk"><input type="checkbox" data-sextra="${n}" ${m.extraordinaria ? 'checked' : ''}> Extraordinaria</label>
      <label class="chk"><input type="checkbox" data-scobra="${n}" ${m.cobra === false ? 'checked' : ''}> Sin cobro</label>
      <span class="pill ${reg ? 'ok' : pasada ? 'bad' : 'warn'}">${reg ? p + ' presentes' : pasada ? 'Sin registrar' : 'Programada'}</span>
      <div class="acts"><button class="mini" data-sguardar="${n}">Guardar</button><button class="mini" data-sasis="${n}">${reg ? 'Editar asistencia' : 'Pasar lista'}</button>${reg && m.filas ? `<button class="mini" data-pdfses="${n}">PDF</button>` : ''}</div></li>`;
  }).join('');
}
function revisiones() {
  const out = [], cfg = cfgCompleta();
  sesionesLista().forEach(n => {
    const m = D.sesiones[n] || {};
    if (m.fecha && m.fecha <= hoyISO && !m.registrado) out.push({ t: `Sesión ${n} (${EC.corta(m.fecha)}) sin asistencia registrada.`, go: 'ses' + n });
    if (!m.fecha && n <= Math.max(0, ...Object.keys(D.sesiones).filter(k => D.sesiones[k].fecha).map(Number))) out.push({ t: `Sesión ${n} sin fecha.`, go: 'ses' + n });
    if (m.registrado && m.cobra !== false) Object.keys(D.socios).forEach(id => {
      const s = D.socios[id], e = s.estado || 'activo';
      if ((e === 'activo' || e === 'porConfirmar') && (!s.ingreso || s.ingreso <= m.fecha) && !(s.sesiones && s.sesiones[n])) out.push({ t: `${s.nombre} no tiene registro en la sesión ${n}.`, go: 'soc' + id });
    });
  });
  Object.keys(D.socios).forEach(id => { const s = D.socios[id];
    if (s.estado === 'porConfirmar') out.push({ t: `${s.nombre}: confirmar si es socio y su fecha de ingreso.`, go: 'soc' + id });
    if ((s.estado || 'activo') === 'activo' && !Object.values(D.usuarios).some(u => u.socioId === id)) out.push({ t: `${s.nombre} todavía no tiene usuario para entrar.`, go: 'usu' });
  });
  if (!D.config.token) out.unshift({ t: 'Falta el token de GitHub: sin él no se pueden guardar cambios. Agregalo en Configuración.', go: 'cfg' });
  if (!cfg.iban) out.push({ t: 'Falta el IBAN de la cuenta del club en Montos y datos.', go: 'mon' });
  (D.revisar || []).forEach((r, i) => out.push({ t: r.texto, nota: i }));
  return out;
}
function renderRevision() {
  const r = revisiones();
  $('#rev-rows').innerHTML = r.length ? r.map(x => `<li><span>${esc(x.t)}</span>${x.nota != null ? `<button class="mini" data-resuelto="${x.nota}">Marcar resuelto</button>` : x.go ? `<button class="mini" data-ir="${esc(x.go)}">Revisar</button>` : ''}</li>`).join('') : '<li class="empty">No hay detalles pendientes.</li>';
}
function renderDescargas() {
  const meses = mesesDisponibles(cfgCompleta());
  $('#dl-mes').innerHTML = meses.map((x, i) => `<option value="${x.corte}">${EC.MES_LARGO[x.m.getMonth()].replace(/^./, c => c.toUpperCase())} ${x.m.getFullYear()}${i === 0 ? ' (en curso)' : ''} · corte ${EC.corta(x.corte)}</option>`).join('');
  $('#dl-socio').innerHTML = `<option value="">Todos los socios (consolidado)</option>` + Object.keys(D.socios).filter(id => D.socios[id].estado !== 'juvenil').sort((a, b) => D.socios[a].nombre.localeCompare(D.socios[b].nombre)).map(id => `<option value="${id}">${esc(D.socios[id].nombre)}${D.socios[id].estado === 'incobrable' ? ' · incobrable' : ''}</option>`).join('');
}
function descargaElegida(tipo, btn) {
  const corte = $('#dl-mes').value, id = $('#dl-socio').value, cfg = cfgCompleta(), inc = $('#dl-inc').checked;
  const lista = id ? [D.socios[id]] : Object.keys(D.socios).map(k => D.socios[k]).filter(s => s.estado !== 'inactivo' && s.estado !== 'juvenil' && (inc || s.estado !== 'incobrable')).sort((a, b) => a.nombre.localeCompare(b.nombre));
  if (!lista.length) return toast('No hay socios para descargar');
  const base = id ? EC.nombreArchivo(lista[0], corte).replace('.pdf', '') : 'Estados_de_cuenta_' + mesArchivo(corte);
  tipo === 'pdf' ? pdfSocios(lista, cfg, corte, btn, base + '.pdf') : excelSocios(lista, cfg, corte, btn, base + '.xlsx', !id);
}
async function reporteJuveniles(btn) {
  const js = Object.values(D.socios).filter(s => s.estado === 'juvenil').sort((a, b) => a.nombre.localeCompare(b.nombre));
  if (!js.length) return toast('No hay socios juveniles registrados');
  const filas = [];
  js.forEach(s => {
    Object.keys(s.cuotas || {}).forEach(k => { const c = s.cuotas[k]; if (+c.pago) filas.push([s.nombre, c.fecha ? EC.corta(c.fecha) : '', 'Membresía ' + k, c.medio || '', +c.pago, c.obs || '']); });
    Object.keys(s.sesiones || {}).forEach(n => { const r = s.sesiones[n]; if (+r.monto) filas.push([s.nombre, EC.corta(r.fechaPago || (D.sesiones[n] || {}).fecha || ''), 'Macería sesión ' + n, r.medio || '', +r.monto, r.obs || '']); });
    (s.otras || []).forEach(o => { if (+o.pagado) filas.push([s.nombre, o.fecha ? EC.corta(o.fecha) : '', o.concepto, o.metodo || '', +o.pagado, '']); });
  });
  ocupado(btn, true);
  try {
    await cargar(LIB_PDF); const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' }), F = window.FUENTES_PDF;
    doc.addFileToVFS('A.ttf', F.regular); doc.addFont('A.ttf', 'Arimo', 'normal'); doc.addFileToVFS('B.ttf', F.bold); doc.addFont('B.ttf', 'Arimo', 'bold');
    doc.addImage(await logo(), 'PNG', 18, 12, 22, 22); doc.setFont('Arimo', 'bold'); doc.setFontSize(12); doc.text(D.config.club.toUpperCase(), 44, 20);
    doc.setFontSize(10); doc.text('REPORTE DE APORTES · SOCIOS JUVENILES', 44, 26); doc.setFont('Arimo', 'normal'); doc.setFontSize(9); doc.text('Periodo ' + D.config.periodo + ' · generado el ' + EC.larga(hoyISO), 44, 31);
    const tot = filas.reduce((a, f) => a + f[4], 0);
    doc.autoTable({ startY: 40, theme: 'grid', styles: { font: 'Arimo', fontSize: 8 }, headStyles: { fillColor: [0, 32, 96], fontStyle: 'bold' },
      head: [['Socio', 'Fecha', 'Concepto', 'Medio', 'Monto', 'Comprobante']], columnStyles: { 4: { halign: 'right' } },
      body: (filas.length ? filas : [['Sin aportes registrados', '', '', '', 0, '']]).map(f => f.slice(0, 4).concat(fmt(f[4]), f[5])).concat([[{ content: 'TOTAL', colSpan: 4, styles: { fontStyle: 'bold', fillColor: [255, 192, 0] } }, { content: fmt(tot), styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 192, 0] } }, { content: '', styles: { fillColor: [255, 192, 0] } }]]) });
    doc.save('Aportes_socios_juveniles_' + mesArchivo(hoyISO) + '.pdf'); toast('Reporte listo');
  } catch (e) { console.error(e); toast('No se pudo generar el reporte.'); } finally { ocupado(btn, false); }
}
function renderMontos() {
  const c = D.config, campo = (k, l, tipo) => `<div class="field"><label for="cf-${k}">${l}</label><input class="input${tipo === 'm' ? ' num' : ''}" id="cf-${k}" data-cf="${k}" ${tipo === 'm' ? 'inputmode="decimal"' : tipo === 'n' ? 'type="number"' : tipo === 'd' ? 'type="date"' : ''} value="${esc(tipo === 'm' ? fmt2(c[k]) : c[k] || '')}"></div>`;
  $('#mon-form').innerHTML = `<h3 class="sub-h">Montos establecidos</h3><div class="fgrid">
    ${campo('cuotaMensual', 'Cuota de membresía mensual (₡)', 'm')}${campo('maceriaMinima', 'Mínimo macería por sesión (₡)', 'm')}
    ${campo('inasistenciaJustificada', 'Inasistencia justificada (₡)', 'm')}${campo('inasistenciaInjustificada', 'Inasistencia injustificada (₡)', 'm')}
    <div class="field wide"><label for="cf-etiquetaJustificada">Texto de la inasistencia justificada en el PDF</label><input class="input" id="cf-etiquetaJustificada" data-cf="etiquetaJustificada" value="${esc(c.etiquetaJustificada || '')}"></div></div>
    <h3 class="sub-h">Otros montos</h3><div id="otros">${(c.otrosMontos || []).map((m, i) => `<div class="row2 otro"><input class="input" data-oc="${i}" value="${esc(m.concepto)}" aria-label="Concepto"><div class="mt"><input class="input num" data-om="${i}" value="${fmt2(m.monto)}" inputmode="decimal" aria-label="Monto"><button type="button" class="x" data-odel="${i}" aria-label="Quitar">×</button></div></div>`).join('')}</div>
    <button type="button" class="btn btn-soft" id="otro-add" style="padding:.5rem 1rem;margin-top:8px">+ Agregar monto</button>
    <h3 class="sub-h">Datos del estado de cuenta</h3><div class="fgrid">
    ${campo('club', 'Nombre del club')}${campo('tesoreria', 'Área')}${campo('periodo', 'Periodo')}${campo('emitidoPor', 'Emitido por')}
    <div class="field wide"><label for="cf-cuentaNombre">Cuenta bancaria (titular)</label><input class="input" id="cf-cuentaNombre" data-cf="cuentaNombre" value="${esc(c.cuentaNombre)}"></div>
    ${campo('iban', 'IBAN')}${campo('sinpe', 'SINPE Móvil')}${campo('inicioPeriodo', 'Inicio del periodo', 'd')}${campo('mesesPorPeriodo', 'Meses del periodo', 'n')}
    ${campo('sesionInicial', 'Primera sesión del periodo', 'n')}${campo('sesionFinal', 'Última sesión del periodo', 'n')}</div>
    <div class="foot" style="margin-top:16px"><button type="button" class="btn btn-red" id="mon-guardar">Guardar montos y datos</button></div>`;
}
function renderUsuarios() {
  const lista = Object.values(D.usuarios).sort((a, b) => a.nombre.localeCompare(b.nombre));
  $('#usu-rows').innerHTML = lista.map((u, i) => `<li><div class="who"><span class="av" style="background:${avColors[i % 5]}">${esc(ini(u.nombre))}</span><div style="min-width:0"><b>${esc(u.nombre)}</b><span>${esc(u.usuario)}${u.alias && u.alias.length ? ' · también ' + esc(u.alias.join(', ')) : ''}${u.correo ? ' · ' + esc(u.correo) : ''}</span></div></div>
    <div class="stt"><span class="pill ${u.activo === false ? 'bad' : 'ok'}">${ROL[u.rol]}${u.activo === false ? ' · inactivo' : ''}</span></div>
    <div class="pass">${esSuper() ? `<code data-clv="${u.id}">••••••••</code><button class="mini" data-verclave="${u.id}">Ver</button>` : ''}</div>
    <div class="acts">${puedeEditarUsuario(u) ? `<button class="ibtn" data-edusu="${u.id}" aria-label="Editar a ${esc(u.nombre)}">✎</button>` : ''}${esSuper() && u.id !== S.id ? `<button class="ibtn del" data-delusu="${u.id}" aria-label="Eliminar a ${esc(u.nombre)}">🗑</button>` : ''}</div></li>`).join('');
}
const puedeEditarUsuario = u => esSuper() || (S.rol === 'tesorero' && u.rol !== 'superadmin');
function renderConfig() {
  const e = D.config.envios || {};
  $('#cfg-form').innerHTML = `<h3 class="sub-h">Token del repositorio principal</h3><p class="muted">Se guarda cifrado. Cambialo antes de que venza.</p>
    <div class="field"><label for="cfg-token">Token nuevo (opcional)</label><input class="input" id="cfg-token" type="password" autocomplete="off" placeholder="github_pat_…"></div>
    <h3 class="sub-h">Soy Macero para socios</h3><p class="muted">Para que los socios pasen lista, creá un repositorio aparte (por ejemplo «activo2030-envios») y un token fine-grained solo para ese repositorio con «Contents: Read and write». Los registros llegan cifrados y se aplican cuando la Tesorería entra.</p>
    <div class="fgrid"><div class="field"><label for="cfg-erepo">Repositorio de envíos</label><input class="input" id="cfg-erepo" placeholder="Activo2030sanjose/activo2030-envios" value="${esc(e.repo || '')}"></div>
    <div class="field"><label for="cfg-etoken">Token de envíos ${e.token ? '(ya configurado)' : ''}</label><input class="input" id="cfg-etoken" type="password" autocomplete="off" placeholder="github_pat_…"></div></div>
    <div class="foot" style="margin-top:16px"><button type="button" class="btn btn-red" id="cfg-guardar">Guardar configuración</button></div>`;
}

/* ---------- Edición de socio ---------- */
function socioForm(id) {
  const s = id ? D.socios[id] : { nombre: '', correo: '', ingreso: D.config.inicioPeriodo, estado: 'activo', cuotas: {}, sesiones: {}, otras: [], observaciones: '' };
  const cfg = cfgCompleta(), meses = EC.mesesPeriodo(cfg);
  const medios = (v) => ['', 'SINPE', 'Efectivo', 'Transferencia'].map(m => `<option value="${m}" ${v === m ? 'selected' : ''}>${m || '—'}</option>`).join('');
  const filasMes = meses.map(m => { const k = EC.claveMes(m), p = (s.cuotas || {})[k] || {};
    return `<tr><th>${k}</th><td><input class="input num" data-cp="${k}" value="${p.pago ? fmt2(p.pago) : ''}" inputmode="decimal" placeholder="₡0.00" aria-label="Pago ${k}"></td><td><input class="input" type="date" data-cf2="${k}" value="${esc(p.fecha || '')}" aria-label="Fecha ${k}"></td><td><select class="input" data-cm="${k}" aria-label="Medio ${k}">${medios(p.medio)}</select></td><td><input class="input" data-co="${k}" value="${esc(p.obs || '')}" aria-label="Observación ${k}"></td></tr>`; }).join('');
  const filasSes = sesionesLista().filter(n => (D.sesiones[n] || {}).fecha).map(n => { const r = (s.sesiones || {})[n] || {}, m = D.sesiones[n];
    return `<tr><th>${n}<small>${EC.corta(m.fecha)}${m.extraordinaria ? ' · extraordinaria' : ''}${m.cobra === false ? ' · sin cobro' : ''}</small></th>
      <td><select class="input" data-sa="${n}" aria-label="Asistencia ${n}"><option value="">—</option>${[['A', 'Presente'], ['J', 'Justificada'], ['I', 'Injustificada']].map(([v, l]) => `<option value="${v}" ${r.asistencia === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
      <td><input class="input num" data-sc="${n}" value="${r.cargo != null && r.cargo !== '' ? fmt2(r.cargo) : ''}" inputmode="decimal" placeholder="Según montos" aria-label="Cargo ${n}"></td>
      <td><input class="input num" data-sp="${n}" value="${r.monto ? fmt2(r.monto) : ''}" inputmode="decimal" placeholder="₡0.00" aria-label="Pagado ${n}"></td>
      <td><input class="input" type="date" data-sf="${n}" value="${esc(r.fechaPago || '')}" aria-label="Fecha de pago ${n}"></td>
      <td><select class="input" data-sm="${n}" aria-label="Medio ${n}">${medios(r.medio)}</select></td>
      <td><input class="input" data-so="${n}" value="${esc(r.obs || '')}" aria-label="Observación ${n}"></td></tr>`; }).join('');
  const otras = (s.otras || []).map((o, i) => filaOtra(o, i)).join('');
  return `<h2>${id ? 'Editar socio' : 'Nuevo socio'}</h2><p class="sub">Los cambios recalculan el estado de cuenta actual y los de meses anteriores.</p>
  <form id="f-socio" data-id="${id || ''}" class="wide-sheet">
   <div class="fgrid">
    <div class="field wide"><label for="es-nombre">Nombre completo</label><input class="input" id="es-nombre" value="${esc(s.nombre)}"></div>
    <div class="field"><label for="es-correo">Correo</label><input class="input" id="es-correo" type="email" value="${esc(s.correo || '')}"></div>
    <div class="field"><label for="es-ingreso">Fecha de ingreso</label><input class="input" id="es-ingreso" type="date" value="${esc(s.ingreso || '')}"></div>
    <div class="field"><label for="es-estado">Estado</label><select class="input" id="es-estado">${Object.keys(ESTADOS).map(k => `<option value="${k}" ${(s.estado || 'activo') === k ? 'selected' : ''}>${ESTADOS[k]}</option>`).join('')}</select></div>
   </div>
   <details class="blk" open><summary>Cuotas de membresía</summary><div class="tbl-x"><table class="ed"><thead><tr><th>Mes</th><th>Pago</th><th>Fecha</th><th>Medio</th><th>Observación</th></tr></thead><tbody>${filasMes}</tbody></table></div></details>
   <details class="blk"><summary>Macerías e inasistencias</summary>${filasSes ? `<div class="tbl-x"><table class="ed"><thead><tr><th>Sesión</th><th>Asistencia</th><th>Cargo</th><th>Pagado</th><th>Fecha pago</th><th>Medio</th><th>Observación</th></tr></thead><tbody>${filasSes}</tbody></table></div>` : '<p class="muted">Todavía no hay sesiones con fecha.</p>'}</details>
   <details class="blk"><summary>Otras cuotas</summary><div id="es-otras">${otras}</div><button type="button" class="btn btn-soft" id="es-otra-add" style="padding:.5rem 1rem">+ Agregar cuota</button></details>
   <div class="field" style="margin-top:12px"><label for="es-obs">Observaciones del estado de cuenta</label><textarea class="input" id="es-obs" rows="3">${esc(s.observaciones || '')}</textarea></div>
   <div class="foot"><button type="button" class="btn btn-soft" data-close>Cancelar</button><button class="btn btn-red" type="submit">Guardar</button></div>
  </form>`;
}
function filaOtra(o, i) {
  return `<div class="otra" data-oi="${i}"><input class="input" data-ok="concepto" value="${esc(o.concepto || '')}" placeholder="Concepto" aria-label="Concepto"><input class="input num" data-ok="monto" value="${o.monto ? fmt2(o.monto) : ''}" placeholder="Monto ₡" inputmode="decimal" aria-label="Monto">
   <input class="input num" data-ok="pagado" value="${o.pagado ? fmt2(o.pagado) : ''}" placeholder="Pagado ₡" inputmode="decimal" aria-label="Pagado"><input class="input" type="date" data-ok="fecha" value="${esc(o.fecha || o.vence || '')}" aria-label="Fecha"><input class="input" data-ok="metodo" value="${esc(o.metodo || '')}" placeholder="Método" aria-label="Método"><button type="button" class="x" data-otradel aria-label="Quitar">×</button></div>`;
}
async function guardarSocio(f) {
  const id0 = f.dataset.id, nombre = $('#es-nombre').value.trim(); if (!nombre) return toast('Escribí el nombre del socio');
  let id = id0 || slug(nombre); if (!id0) { let k = id, i = 2; while (D.socios[k]) k = id + '-' + i++; id = k; }
  const s = id0 ? D.socios[id0] : { cuotas: {}, sesiones: {}, otras: [] };
  s.nombre = nombre; s.correo = $('#es-correo').value.trim().toLowerCase(); s.ingreso = $('#es-ingreso').value; s.estado = $('#es-estado').value; s.observaciones = $('#es-obs').value;
  s.cuotas = {}; $$('[data-cp]').forEach(i => { const k = i.dataset.cp, v = numDe(i.value), fch = $(`[data-cf2="${k}"]`).value, m = $(`[data-cm="${k}"]`).value, o = $(`[data-co="${k}"]`).value.trim();
    if (v > 0 || o) s.cuotas[k] = { pago: v > 0 ? v : 0, fecha: fch || (v > 0 ? hoyISO : ''), medio: m, obs: o }; });
  const ses = {}; $$('[data-sa]').forEach(sel => { const n = sel.dataset.sa, prev = (s.sesiones || {})[n] || {}, a = sel.value, c = numDe($(`[data-sc="${n}"]`).value), p = numDe($(`[data-sp="${n}"]`).value);
    if (!a) return; ses[n] = Object.assign({}, prev, { asistencia: a, cargo: isNaN(c) ? null : c, monto: p > 0 ? p : 0, fechaPago: $(`[data-sf="${n}"]`).value || (p > 0 ? D.sesiones[n].fecha : ''), medio: $(`[data-sm="${n}"]`).value, obs: $(`[data-so="${n}"]`).value.trim() });
    if (!(p > 0)) { delete ses[n].moneda; delete ses[n].montoUSD; delete ses[n].tc; } });
  Object.keys(s.sesiones || {}).forEach(n => { if (!$(`[data-sa="${n}"]`)) ses[n] = s.sesiones[n]; });
  s.sesiones = ses;
  s.otras = [...$$('#es-otras .otra')].map(r => { const g = k => r.querySelector(`[data-ok="${k}"]`).value; return { concepto: g('concepto').trim(), monto: numDe(g('monto')) || 0, pagado: numDe(g('pagado')) || 0, fecha: g('fecha'), metodo: g('metodo').trim() }; }).filter(o => o.concepto && (o.monto || o.pagado));
  D.socios[id] = s;
  if (await guardarCon(f.querySelector('[type=submit]'), { socios: [id] }, (id0 ? 'Editar' : 'Crear') + ' socio', 'Socio guardado')) { closeSheet(); renderAdmin(); }
}

/* ---------- Usuarios ---------- */
function usuarioForm(uid) {
  const u = uid ? D.usuarios[uid] : { usuario: '', nombre: '', correo: '', rol: 'asociado', socioId: '', activo: true, clave: genClave() };
  const roles = esSuper() ? ['asociado', 'colaborador', 'tesorero', 'superadmin'] : ['asociado', 'colaborador'];
  const socios = Object.keys(D.socios).sort((a, b) => D.socios[a].nombre.localeCompare(D.socios[b].nombre));
  return `<h2>${uid ? 'Editar usuario' : 'Nuevo usuario'}</h2><p class="sub">Entra con su usuario o su correo y la contraseña.</p>
  <form id="f-usu" data-id="${uid || ''}">
   <div class="field"><label for="u-vinc">Socio vinculado</label><select class="input" id="u-vinc"><option value="">Sin socio (colaborador o solo administración)</option>${socios.map(id => `<option value="${id}" ${u.socioId === id ? 'selected' : ''}>${esc(D.socios[id].nombre)}</option>`).join('')}</select></div>
   <div class="field"><label for="u-n">Nombre completo</label><input class="input" id="u-n" value="${esc(u.nombre)}"></div>
   <div class="row2"><div class="field"><label for="u-u">Usuario</label><input class="input" id="u-u" value="${esc(u.usuario)}" autocomplete="off"></div>
   <div class="field"><label for="u-m">Correo</label><input class="input" id="u-m" type="email" value="${esc(u.correo)}"></div></div>
   <div class="row2"><div class="field"><label for="u-rol">Rol</label><select class="input" id="u-rol" ${uid === S.id || (!esSuper() && uid) ? 'disabled' : ''}>${roles.map(r => `<option value="${r}" ${u.rol === r ? 'selected' : ''}>${ROL[r]}</option>`).join('')}</select></div>
   <div class="field"><label for="u-act">Acceso</label><select class="input" id="u-act" ${!esSuper() || uid === S.id ? 'disabled' : ''}><option value="1" ${u.activo !== false ? 'selected' : ''}>Activo</option><option value="0" ${u.activo === false ? 'selected' : ''}>Desactivado</option></select></div></div>
   <div class="field"><label for="u-p">Contraseña ${uid ? '(dejala igual o escribí una nueva)' : ''}</label><div class="pw"><input class="input" id="u-p" type="text" value="${uid ? '' : esc(u.clave)}" placeholder="${uid ? 'Sin cambios' : ''}" autocomplete="off"><button type="button" id="u-gen">Generar</button></div></div>
   <div class="foot"><button type="button" class="btn btn-soft" data-close>Cancelar</button><button class="btn btn-blue" type="submit">Guardar</button></div></form>`;
}
function genClave() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789#$%*'; let p = ''; crypto.getRandomValues(new Uint32Array(12)).forEach(x => p += c[x % c.length]); return p; }
async function guardarUsuario(f) {
  const uid0 = f.dataset.id, nombre = $('#u-n').value.trim(), usuario = $('#u-u').value.trim(), correo = $('#u-m').value.trim().toLowerCase(), clave = $('#u-p').value;
  if (!nombre || !usuario) return toast('Completá el nombre y el usuario');
  if (!uid0 && clave.length < 8) return toast('La contraseña debe tener al menos 8 caracteres');
  if (uid0 && clave && clave.length < 8) return toast('La contraseña debe tener al menos 8 caracteres');
  const choca = Object.values(D.usuarios).find(u => u.id !== uid0 && [u.usuario, u.correo].concat(u.alias || []).filter(Boolean).map(normal).some(x => x === normal(usuario) || (correo && x === normal(correo))));
  if (choca) return toast('Ese usuario o correo ya lo usa ' + choca.nombre);
  const uid = uid0 || 'u-' + slug(usuario) + '-' + A.b64(A.azar(3)).replace(/[^a-z0-9]/gi, '').toLowerCase();
  const u = uid0 ? D.usuarios[uid0] : { id: uid };
  if (u.rol === 'superadmin' && !esSuper()) return toast('No tenés permiso para editar a este usuario');
  Object.assign(u, { nombre, usuario, correo, socioId: $('#u-vinc').value || null });
  if (!$('#u-rol').disabled) u.rol = $('#u-rol').value; if (!u.rol) u.rol = 'asociado';
  if (!$('#u-act').disabled) u.activo = $('#u-act').value === '1'; if (u.activo == null) u.activo = true;
  if (clave) u.clave = clave;
  if (u.socioId && correo && !D.socios[u.socioId].correo) D.socios[u.socioId].correo = correo;
  D.usuarios[uid] = u;
  if (await guardarCon(f.querySelector('[type=submit]'), { usuarios: [uid], socios: u.socioId ? [u.socioId] : [] }, (uid0 ? 'Editar' : 'Crear') + ' usuario', 'Usuario guardado')) { closeSheet(); renderAdmin(); }
}

/* Importa usuarios {usuarios:[{usuario, nombre, socioId, clave, rol}]}. Si el socio ya tiene usuario, el nuevo nombre queda como alias. */
function importarUsuarios(lista) {
  const cambiados = [], socios = [];
  (lista || []).forEach(x => {
    if (!x || !x.usuario || !x.clave) return;
    const usado = Object.values(D.usuarios).some(u => [u.usuario, u.correo].concat(u.alias || []).filter(Boolean).map(normal).includes(normal(x.usuario)));
    if (usado) return;
    const dueno = x.socioId && Object.values(D.usuarios).find(u => u.socioId === x.socioId);
    if (dueno) { dueno.alias = (dueno.alias || []).concat(x.usuario); cambiados.push(dueno.id); return; }
    if (x.socioId && !D.socios[x.socioId]) return;
    const id = 'u-' + slug(x.usuario);
    D.usuarios[id] = { id, usuario: x.usuario, nombre: x.nombre || (D.socios[x.socioId] || {}).nombre || x.usuario, correo: (x.correo || '').toLowerCase(), rol: x.rol || 'asociado', socioId: x.socioId || null, activo: true, clave: x.clave };
    cambiados.push(id); if (x.socioId) socios.push(x.socioId);
  });
  return { cambiados, socios };
}

/* ---------- Envíos de maceros (repositorio aparte) ---------- */
async function ghEnvios(env, metodo, ruta, cuerpo) {
  const r = await fetch('https://api.github.com/repos/' + env.repo + ruta, { method: metodo, cache: 'no-store', headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + env.token, 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  if (r.status === 404) return null; if (!r.ok) throw new Error('Envíos ' + r.status); return r.status === 204 ? null : r.json();
}
async function procesarEnvios() {
  const env = D.config.envios; if (!env || !env.repo || !env.token) return;
  try {
    const lista = await ghEnvios(env, 'GET', '/contents/pendientes?t=' + Date.now()); if (!lista || !lista.length) return;
    let n = 0;
    for (const f of lista.filter(x => x.name.endsWith('.json')).sort((a, b) => a.name.localeCompare(b.name))) {
      const j = await ghEnvios(env, 'GET', '/contents/pendientes/' + f.name);
      const p = await A.descifrar(D.macero, JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(j.content.replace(/\n/g, '')), c => c.charCodeAt(0)))));
      aplicarSesion(p); n++;
      await ghEnvios(env, 'DELETE', '/contents/pendientes/' + f.name, { message: 'Aplicado', sha: f.sha });
    }
    if (n) { await persistir({ socios: 'todos' }, 'Aplicar registros de maceros'); toast('Se aplicaron ' + n + ' registros de Soy Macero', 5000); }
  } catch (e) { console.error(e); toast('No se pudieron revisar los registros de maceros: ' + e.message, 6000); }
}

/* ---------- Soy Macero ---------- */
let mc = null, ultimoGuardado = null;
const cfgMac = () => esAdmin() ? cfgCompleta() : MAC.cfg;
const dirMac = () => esAdmin() ? Object.keys(D.socios).filter(id => !['inactivo', 'incobrable'].includes(D.socios[id].estado)).map(id => ({ id, nombre: D.socios[id].nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre)) : MAC.directorio;
function nuevaFila(id, nombre) { return { socioId: id, nombre, estado: null, cargo: fmt2(cfgMac().maceriaMinima), pagado: '', medio: '', moneda: 'CRC', extras: {} }; }
function primeraLibre() { const c = cfgMac(); for (let n = +c.sesionInicial; n <= +c.sesionFinal; n++) if (!(c.sesiones[n] || {}).registrado) return n; return +c.sesionFinal; }
function cargarSesion(n) {
  const c = cfgMac(), m = c.sesiones[n] || {}, previo = esAdmin() && m.filas ? JSON.parse(JSON.stringify(m.filas)) : null;
  mc = { n, macero: S.socioId || '', fecha: m.fecha || hoyISO, hora: m.hora || '19:00', conv: m.conv || '1', extra: !!m.extraordinaria, cobra: m.cobra !== false, tc: m.tc ? fmt2(m.tc) : '', campos: (m.campos || []).slice(), filas: [] };
  if (m.macero) mc.macero = m.macero;
  dirMac().forEach(x => { const p = previo && previo.find(f => f.socioId === x.id); mc.filas.push(p || nuevaFila(x.id, x.nombre)); });
  if (previo) previo.filter(f => !f.socioId).forEach(f => mc.filas.push(f));
  renderMacero();
}
function renderMacero() {
  const c = cfgMac(), dir = dirMac();
  $('#mc-macero').innerHTML = `<option value="">Elegí el macero</option>` + dir.map(x => `<option value="${x.id}" ${mc.macero === x.id ? 'selected' : ''}>${esc(x.nombre)}${x.id === S.socioId ? ' (vos)' : ''}</option>`).join('');
  let ops = ''; for (let n = +c.sesionInicial; n <= +c.sesionFinal; n++) { const m = c.sesiones[n] || {}; ops += `<option value="${n}" ${n === mc.n ? 'selected' : ''}>${n}${m.fecha ? ' · ' + EC.corta(m.fecha) : ''}${m.registrado ? ' · registrada' : ''}</option>`; }
  $('#mc-sesion').innerHTML = ops; $('#mc-fecha').value = mc.fecha; $('#mc-hora').value = mc.hora;
  $$('#mc-conv button').forEach(b => b.setAttribute('aria-pressed', b.dataset.conv === mc.conv));
  $$('#mc-tipo button').forEach(b => b.setAttribute('aria-pressed', (b.dataset.tipo === '1') === mc.extra));
  $('#mc-cobra').checked = !mc.cobra; $('#mc-tc').value = mc.tc;
  $('#mc-manual').hidden = !esAdmin(); $('#mc-ok').hidden = ultimoGuardado !== mc.n;
  const reg = (c.sesiones[mc.n] || {}).registrado; $('#mc-estado').className = 'pill ' + (reg ? 'ok' : 'warn'); $('#mc-estado').textContent = reg ? 'Registrada · podés editarla' : 'Nueva';
  $('#mc-guardar').textContent = esAdmin() ? 'Guardar y aplicar' : 'Enviar registro';
  $('#mc-campos').innerHTML = mc.campos.length ? '<span>Campos adicionales:</span>' + mc.campos.map((k, i) => `<span class="campo-tag"><input value="${esc(k)}" data-campo="${i}" aria-label="Nombre del campo ${i + 1}"><button type="button" data-delcampo="${i}" aria-label="Quitar campo">×</button></span>`).join('') : '<span>Sin campos adicionales.</span>';
  renderFilas(); resumenMacero();
}
const cargoDe = f => !mc.cobra ? 0 : f.estado === 'J' ? +cfgMac().inasistenciaJustificada : f.estado === 'I' ? +cfgMac().inasistenciaInjustificada : 0;
function renderFilas() {
  const q = normal($('#mc-q').value);
  $('#mc-filas').innerHTML = mc.filas.map((f, k) => {
    if (q && !normal(f.nombre).includes(q)) return '';
    const st = ['A', 'J', 'I'].map(v => `<button type="button" data-st="${k}" data-v="${v}" aria-pressed="${f.estado === v}">${v === 'A' ? 'Presente · 1' : v === 'J' ? 'Justificada · 0,5' : 'Injustificada · 0'}</button>`).join('');
    let monto = '';
    if (f.estado === 'A' && mc.cobra) monto = `<div class="mt">
      <label class="mini-l">Macería ₡<input class="input num" data-cargo="${k}" inputmode="decimal" value="${esc(f.cargo)}"></label>
      <label class="mini-l">Pagó<input class="input num" data-pagado="${k}" inputmode="decimal" value="${esc(f.pagado)}" placeholder="0.00"></label>
      <select class="input" data-mon="${k}" aria-label="Moneda"><option value="CRC" ${f.moneda === 'CRC' ? 'selected' : ''}>₡</option><option value="USD" ${f.moneda === 'USD' ? 'selected' : ''}>US$</option></select>
      <select class="input medio${f.falta ? ' falta' : ''}" data-medio="${k}" aria-label="Medio de pago"><option value="" ${!f.medio ? 'selected' : ''}>Medio…</option><option value="SINPE" ${f.medio === 'SINPE' ? 'selected' : ''}>SINPE</option><option value="Efectivo" ${f.medio === 'Efectivo' ? 'selected' : ''}>Efectivo</option></select></div>`;
    else if (f.estado === 'A') monto = '<div class="cargo"><small>Sesión sin cobro de macería</small></div>';
    else if (f.estado) monto = `<div class="cargo num">${mc.cobra ? 'Cargo ' + fmt(cargoDe(f)) : 'No se cobra'}<small>${f.estado === 'J' ? 'Inasistencia justificada' : 'Inasistencia injustificada'}</small></div>`;
    else monto = '<div class="cargo"><small>Marcá la asistencia</small></div>';
    const nm = f.socioId ? `<span class="av" style="display:grid;width:34px;height:34px;border-radius:50%;place-items:center;color:#fff;font-weight:900;font-size:.75rem;background:${avColors[k % 5]};flex:none">${esc(ini(f.nombre))}</span><b>${esc(f.nombre)}</b>`
      : `<input class="input" data-nombre="${k}" value="${esc(f.nombre)}" placeholder="Nombre" aria-label="Nombre de la persona agregada"><span class="tag-inv">Agregado</span>`;
    const ex = mc.campos.length ? `<div class="ar-extra">${mc.campos.map((cp, j) => `<label>${esc(cp || 'Campo ' + (j + 1))}<input class="input" data-extra="${k}" data-j="${j}" value="${esc(f.extras[j] || '')}"></label>`).join('')}</div>` : '';
    return `<div class="ar ${f.estado ? '' : 'sin'}"><div class="nm">${nm}</div><div class="st" role="group" aria-label="Asistencia">${st}</div>${monto}${f.socioId ? '<span></span>' : `<button type="button" class="x" data-delfila="${k}" aria-label="Quitar fila">×</button>`}${ex}</div>`;
  }).join('') || '<p class="empty">No hay compañeros que coincidan.</p>';
}
function resumenMacero() {
  const c = { A: 0, J: 0, I: 0, N: 0 }; let crc = 0, usd = 0, sin = 0, efe = 0, cargos = 0;
  mc.filas.forEach(f => { c[f.estado || 'N']++; if (f.estado === 'A' && mc.cobra) { const v = numDe(f.pagado) || 0; if (f.moneda === 'USD') usd += v; else { crc += v; if (f.medio === 'SINPE') sin += v; if (f.medio === 'Efectivo') efe += v; } } else if (f.estado) cargos += cargoDe(f); });
  $('#mc-tc-box').hidden = !mc.filas.some(f => f.estado === 'A' && f.moneda === 'USD' && numDe(f.pagado) > 0);
  $('#mc-cts').innerHTML = `<span><i class="dot" style="background:var(--ok)"></i><b>${c.A}</b> presentes</span><span><i class="dot" style="background:#c98a00"></i><b>${c.J}</b> justificadas</span><span><i class="dot" style="background:var(--rojo)"></i><b>${c.I}</b> injustificadas</span>${c.N ? `<span><i class="dot" style="background:var(--line)"></i><b>${c.N}</b> sin marcar</span>` : ''}<span class="tot">Recaudado ${fmt(crc)}${usd ? ' + US$' + fmt2(usd) : ''} (SINPE ${fmt(sin)} · Efectivo ${fmt(efe)}) · Cargos ${fmt(cargos)}</span>`;
}
function validarMacero() {
  if (!mc.macero) return 'Elegí quién es el macero en turno';
  if (!mc.fecha) return 'Elegí la fecha de la sesión'; if (!mc.hora) return 'Indicá la hora de inicio';
  if (mc.filas.some(f => !f.socioId && !f.nombre.trim())) return 'Escribí el nombre de la persona agregada o quitá la fila';
  const sin = mc.filas.filter(f => !f.estado); if (sin.length) return 'Faltan ' + sin.length + ' compañeros por marcar';
  for (const f of mc.filas) { if (f.estado !== 'A' || !mc.cobra) continue;
    const c = numDe(f.cargo), p = numDe(f.pagado || 0);
    if (isNaN(c) || c < 0) return 'Revisá el monto de macería de ' + f.nombre; if (isNaN(p) || p < 0) return 'Revisá lo que pagó ' + f.nombre;
    f.falta = p > 0 && !f.medio; if (f.falta) { renderFilas(); return 'Elegí SINPE o Efectivo para ' + f.nombre; } }
  if (!$('#mc-tc-box').hidden && !(numDe(mc.tc) > 0)) return 'Indicá el tipo de cambio (colones por cada dólar)';
  return null;
}
function payloadMacero() {
  return { n: mc.n, fecha: mc.fecha, hora: mc.hora, conv: mc.conv, extraordinaria: mc.extra, cobra: mc.cobra, tc: numDe(mc.tc) || 0, campos: mc.campos.slice(), macero: mc.macero,
    registradoPor: S.id, rolRegistro: S.rol, registrado: new Date().toISOString(), filas: JSON.parse(JSON.stringify(mc.filas.map(f => Object.assign({}, f, { falta: undefined })))) };
}
function aplicarSesion(p) {
  const prev = D.sesiones[p.n] || {};
  D.sesiones[p.n] = Object.assign(prev, { fecha: p.fecha, hora: p.hora, conv: p.conv, extraordinaria: p.extraordinaria, cobra: p.cobra, tc: p.tc, campos: p.campos, macero: p.macero, registradoPor: p.registradoPor, registrado: p.registrado, filas: p.filas });
  p.filas.forEach(f => {
    if (!f.socioId) { (D.revisar = D.revisar || []).push({ texto: `Sesión ${p.n}: «${f.nombre}» se agregó a mano. Vinculalo a un socio desde su estado de cuenta si corresponde.` }); return; }
    const s = D.socios[f.socioId]; if (!s) return; s.sesiones = s.sesiones || {};
    const pagoOrig = f.estado === 'A' && p.cobra ? numDe(f.pagado) || 0 : 0, crc = f.moneda === 'USD' ? Math.round(pagoOrig * p.tc * 100) / 100 : pagoOrig;
    const extras = p.campos.map((c, j) => f.extras && f.extras[j] ? `${c}: ${f.extras[j]}` : '').filter(Boolean).join(' | ');
    s.sesiones[p.n] = { asistencia: f.estado, cargo: f.estado === 'A' ? (p.cobra ? numDe(f.cargo) || 0 : 0) : null, monto: crc, moneda: pagoOrig ? f.moneda : '', montoUSD: f.moneda === 'USD' ? pagoOrig : 0, tc: f.moneda === 'USD' ? p.tc : 0,
      medio: crc ? f.medio : '', fechaPago: crc ? p.fecha : '', obs: extras };
  });
}
async function guardarMacero(btn) {
  const err = validarMacero(); if (err) return toast(err);
  const p = payloadMacero();
  if (esAdmin()) { aplicarSesion(p); if (!(await guardarCon(btn, { socios: 'todos' }, 'Registrar sesión ' + p.n, 'Sesión ' + p.n + ' aplicada a los estados de cuenta'))) return; renderAdmin(); }
  else {
    ocupado(btn, true); toast('Enviando…', 60000);
    try { const paq = await A.cifrar(S.macero, p); const nombre = 'pendientes/' + p.n + '-' + Date.now() + '.json';
      await ghEnvios(MAC.envios, 'PUT', '/contents/' + nombre, { message: 'Registro de sesión ' + p.n, content: btoa(JSON.stringify(paq)) });
      MAC.cfg.sesiones[p.n] = Object.assign(MAC.cfg.sesiones[p.n] || {}, { fecha: p.fecha, filas: p.filas, campos: p.campos, conv: p.conv, hora: p.hora, macero: p.macero, extraordinaria: p.extraordinaria, cobra: p.cobra, tc: p.tc, registrado: p.registrado, enviado: true });
      toast('Registro enviado. Tesorería lo aplica a los estados de cuenta.', 5000);
    } catch (e) { console.error(e); toast('No se pudo enviar. Revisá tu conexión e intentá de nuevo.'); return; } finally { ocupado(btn, false); }
  }
  ultimoGuardado = p.n; renderMacero();
  $('#mc-ok-t').textContent = `Sesión ${p.n} ${esAdmin() ? 'registrada' : 'enviada'}`;
  $('#mc-ok-d').textContent = mc.filas.filter(f => f.estado === 'A').length + ' presentes. Descargá o enviá el archivo de asistencia.';
  $('#mc-ok').scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'center' });
}
function datosAsistencia(n) {
  const c = cfgMac(), r = c.sesiones[n], tc = r.tc || 0, t = { A: 0, J: 0, I: 0, sinpe: 0, efectivo: 0, total: 0, cargos: 0, usd: 0 };
  const nombreDe = id => (dirMac().find(x => x.id === id) || {}).nombre || '';
  const filas = r.filas.map(f => { const v = f.estado === 'A' && r.cobra !== false ? numDe(f.pagado) || 0 : 0, crcV = f.moneda === 'USD' ? Math.round(v * tc * 100) / 100 : v;
    const cargo = f.estado === 'A' ? (r.cobra !== false ? numDe(f.cargo) || 0 : 0) : (r.cobra === false ? 0 : f.estado === 'J' ? +c.inasistenciaJustificada : +c.inasistenciaInjustificada);
    t[f.estado]++; if (f.estado === 'A') { t.total += crcV; if (f.medio === 'SINPE') t.sinpe += crcV; else if (crcV) t.efectivo += crcV; if (f.moneda === 'USD') t.usd += v; } else t.cargos += cargo;
    return { nombre: f.nombre, agregado: !f.socioId, estado: f.estado, medio: f.medio, moneda: f.moneda, monto: v, montoCRC: crcV, cargo, extras: f.extras || {} }; });
  const g = new Date(r.registrado || Date.now());
  return { n, fechaLarga: EC.larga(r.fecha), fechaCorta: EC.corta(r.fecha), hora: r.hora, conv: r.conv === '2' ? 'Segunda convocatoria' : 'Primera convocatoria', extraordinaria: !!r.extraordinaria,
    macero: nombreDe(r.macero), registradoPor: esAdmin() && D.usuarios[r.registradoPor] ? D.usuarios[r.registradoPor].nombre + ' (' + ROL[D.usuarios[r.registradoPor].rol] + ')' : nombreDe(r.macero), tc,
    campos: (r.campos || []).map((x, j) => x || 'Campo ' + (j + 1)), filas, totales: t, generado: EC.larga(EC.iso(g)) + ' ' + g.toTimeString().slice(0, 5) };
}
async function descargarAsistencia(n, btn) {
  ocupado(btn, true);
  try { await cargar(LIB_PDF.concat('../lib/asistencia-pdf.js')); const r = AsistenciaPDF.generar(datosAsistencia(n), cfgMac(), await logo()); r.doc.save(r.archivo); toast('Listo: ' + r.archivo); }
  catch (e) { console.error(e); toast('No se pudo generar el PDF.'); } finally { ocupado(btn, false); }
}
function correoForm(n) {
  const r = cfgMac().sesiones[n], para = [esAdmin() && D.socios[r.macero] ? D.socios[r.macero].correo : '', esAdmin() ? D.usuarios[S.id].correo : ''].filter((x, i, a) => x && a.indexOf(x) === i).join(', ');
  return `<h2>Enviar por correo</h2><p class="sub">Archivo de asistencia de la sesión ${n}</p><form id="f-mail" data-n="${n}">
  <div class="field"><label for="ml-para">Para</label><input class="input" id="ml-para" value="${esc(para)}" placeholder="correo@ejemplo.com, otro@ejemplo.com"></div>
  <div class="field"><label for="ml-msg">Mensaje</label><textarea class="input" id="ml-msg" rows="4">Adjunto el registro de asistencia de la sesión ${n} del ${EC.larga(r.fecha)}.</textarea></div>
  <div class="secure" style="margin:0 0 14px"><span>En el celular se abre tu app de correo con el PDF adjunto. En la computadora se descarga el PDF y se abre tu correo para adjuntarlo.</span></div>
  <div class="foot"><button type="button" class="btn btn-soft" data-close>Cancelar</button><button class="btn btn-blue">Enviar</button></div></form>`;
}
async function enviarAsistencia(n, para, msg, btn) {
  ocupado(btn, true);
  try { await cargar(LIB_PDF.concat('../lib/asistencia-pdf.js')); const r = AsistenciaPDF.generar(datosAsistencia(n), cfgMac(), await logo()), asunto = 'Registro de asistencia · Sesión ' + n;
    const file = new File([r.doc.output('blob')], r.archivo, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: asunto, text: msg }); closeSheet(); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    r.doc.save(r.archivo); closeSheet();
    location.href = 'mailto:' + para.split(',').map(x => encodeURIComponent(x.trim())).join(',') + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(msg + '\n\n(Adjuntá el archivo ' + r.archivo + ' que se acaba de descargar.)');
    toast('Se descargó ' + r.archivo + '. Adjuntalo en el correo.');
  } catch (e) { console.error(e); toast('No se pudo preparar el correo.'); } finally { ocupado(btn, false); }
}

/* ---------- Panel lateral ---------- */
const sheet = $('#sheet'), scrim = $('#scrim');
function openSheet(h, ancho) { sheet.innerHTML = '<button class="x" data-close aria-label="Cerrar">×</button>' + h; sheet.classList.toggle('ancho', !!ancho); sheet.hidden = scrim.hidden = false; const f = sheet.querySelector('input:not([type=hidden]),select'); f && f.focus(); }
function closeSheet() { sheet.hidden = scrim.hidden = true; }
scrim.addEventListener('click', closeSheet);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); $('#a11y').hidden = true; } });

/* ---------- Eventos ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
  if (t.id === 'salir') return salir();
  if (d.go === 'admin') { renderAdmin(); show('admin'); }
  if (d.go === 'socio') { renderSocio(); show('socio'); }
  if (d.go === 'macero') { ultimoGuardado = null; cargarSesion(primeraLibre()); show('macero'); }
  if (d.peek) { const i = document.getElementById(d.peek), v = i.type === 'password'; i.type = v ? 'text' : 'password'; t.textContent = v ? 'Ocultar' : 'Mostrar'; }
  if (d.pdfmes) { const ds = datosSocio(); pdfSocios([ds.socio], ds.cfg, d.pdfmes === '__HOY__' ? hoyISO : d.pdfmes, t); }
  if (d.tab) { tab = d.tab; renderAdmin(); }
  if (d.f) { filtroSocios = d.f; $$('#a-filtro button').forEach(b => b.setAttribute('aria-pressed', b === t)); renderSocios(); }
  if (d.pdfsocio) pdfSocios([D.socios[d.pdfsocio]], cfgCompleta(), hoyISO, t);
  if (d.xlsocio) excelSocios([D.socios[d.xlsocio]], cfgCompleta(), hoyISO, t, EC.nombreArchivo(D.socios[d.xlsocio], hoyISO).replace('.pdf', '.xlsx'), false);
  if (d.edsocio) openSheet(socioForm(d.edsocio), true);
  if (t.id === 'a-new') openSheet(socioForm(null), true);
  if (t.id === 'es-otra-add') $('#es-otras').insertAdjacentHTML('beforeend', filaOtra({}, Date.now()));
  if (d.otradel !== undefined) t.closest('.otra').remove();
  if (d.sguardar) { const n = d.sguardar, m = D.sesiones[n] = D.sesiones[n] || {}; m.fecha = $(`[data-sfecha="${n}"]`).value; m.hora = $(`[data-shora="${n}"]`).value; m.extraordinaria = $(`[data-sextra="${n}"]`).checked; m.cobra = !$(`[data-scobra="${n}"]`).checked;
    if (!m.fecha) { delete D.sesiones[n]; } if (await guardarCon(t, { socios: 'todos' }, 'Actualizar sesión ' + n, 'Sesión ' + n + ' actualizada')) renderAdmin(); }
  if (d.sasis) { ultimoGuardado = null; cargarSesion(+d.sasis); show('macero'); }
  if (d.pdfses) descargarAsistencia(+d.pdfses, t);
  if (d.resuelto !== undefined) { D.revisar.splice(+d.resuelto, 1); if (await guardarCon(t, { socios: [] }, 'Revisión resuelta', 'Marcado como resuelto')) renderAdmin(); }
  if (d.ir) { const g = d.ir; if (g.startsWith('soc')) openSheet(socioForm(g.slice(3)), true); else if (g.startsWith('ses')) { tab = 'sesiones'; renderAdmin(); } else if (g === 'usu') { tab = 'usuarios'; renderAdmin(); } else if (g === 'mon') { tab = 'montos'; renderAdmin(); } else if (g === 'cfg') { tab = 'config'; renderAdmin(); } }
  if (t.id === 'dl-pdf') descargaElegida('pdf', t);
  if (t.id === 'dl-xls') descargaElegida('xls', t);
  if (t.id === 'dl-juv') reporteJuveniles(t);
  if (t.id === 'otro-add') { leerMontos(); D.config.otrosMontos.push({ concepto: '', monto: 0 }); renderMontos(); }
  if (d.odel !== undefined) { leerMontos(); D.config.otrosMontos.splice(+d.odel, 1); renderMontos(); }
  if (t.id === 'mon-guardar') { const er = leerMontos(); if (er) return toast(er); if (await guardarCon(t, { socios: 'todos' }, 'Actualizar montos', 'Montos y datos guardados')) renderAdmin(); }
  if (t.id === 'usu-new') openSheet(usuarioForm(null));
  if (t.id === 'usu-imp') $('#usu-file').click();
  if (d.edusu) openSheet(usuarioForm(d.edusu));
  if (t.id === 'u-gen') $('#u-p').value = genClave();
  if (d.verclave) { const c = $(`[data-clv="${d.verclave}"]`), ver = t.textContent === 'Ver'; c.textContent = ver ? D.usuarios[d.verclave].clave : '••••••••'; t.textContent = ver ? 'Ocultar' : 'Ver'; }
  if (d.delusu) openSheet(`<h2>Eliminar usuario</h2><p class="sub">${esc(D.usuarios[d.delusu].nombre)}</p><div class="confirm">Pierde el acceso al portal. Su estado de cuenta como socio se conserva.</div><div class="foot"><button type="button" class="btn btn-soft" data-close>Cancelar</button><button class="btn btn-red" data-delusuok="${d.delusu}">Eliminar</button></div>`);
  if (d.delusuok) { const u = d.delusuok; delete D.usuarios[u]; if (await guardarCon(t, { borrarUsuarios: [u] }, 'Eliminar usuario', 'Usuario eliminado')) { closeSheet(); renderAdmin(); } }
  if (t.id === 'cfg-guardar') guardarConfig(t);
  if (t.hasAttribute('data-close')) closeSheet();
  /* Macero */
  if (d.st !== undefined) { const f = mc.filas[+d.st]; f.estado = f.estado === d.v ? null : d.v; if (f.estado === 'A' && f.pagado === '') f.pagado = f.cargo; renderFilas(); resumenMacero(); }
  if (d.conv) { mc.conv = d.conv; $$('#mc-conv button').forEach(x => x.setAttribute('aria-pressed', x === t)); }
  if (d.tipo) { mc.extra = d.tipo === '1'; if (mc.extra) mc.cobra = false; $$('#mc-tipo button').forEach(x => x.setAttribute('aria-pressed', x === t)); $('#mc-cobra').checked = !mc.cobra; renderFilas(); resumenMacero(); }
  if (t.id === 'mc-todos') { mc.filas.forEach(f => { if (!f.estado) { f.estado = 'A'; if (f.pagado === '') f.pagado = f.cargo; } }); renderFilas(); resumenMacero(); }
  if (t.id === 'mc-addrow') { mc.filas.push(nuevaFila(null, '')); renderFilas(); resumenMacero(); }
  if (t.id === 'mc-addcampo') { mc.campos.push('Campo ' + (mc.campos.length + 1)); renderMacero(); }
  if (d.delcampo !== undefined) { const j = +d.delcampo; mc.campos.splice(j, 1); mc.filas.forEach(f => { const nx = {}; Object.keys(f.extras).forEach(k => { k = +k; if (k < j) nx[k] = f.extras[k]; else if (k > j) nx[k - 1] = f.extras[k]; }); f.extras = nx; }); renderMacero(); }
  if (d.delfila !== undefined) { mc.filas.splice(+d.delfila, 1); renderFilas(); resumenMacero(); }
  if (t.id === 'mc-guardar') guardarMacero(t);
  if (t.id === 'mc-pdf' && ultimoGuardado) descargarAsistencia(ultimoGuardado, t);
  if (t.id === 'mc-mail' && ultimoGuardado) openSheet(correoForm(ultimoGuardado));
  if (t.id === 'notice-ok') { $('#notice').hidden = true; try { localStorage.setItem('aviso-ok', '1'); } catch (_) { } }
});
function leerMontos() {
  const c = D.config; let er = null;
  $$('[data-cf]').forEach(i => { const k = i.dataset.cf; if (['cuotaMensual', 'maceriaMinima', 'inasistenciaJustificada', 'inasistenciaInjustificada'].includes(k)) { const v = numDe(i.value); if (isNaN(v) || v < 0) er = 'Revisá los montos'; else c[k] = v; } else if (['mesesPorPeriodo', 'sesionInicial', 'sesionFinal'].includes(k)) c[k] = parseInt(i.value, 10) || c[k]; else c[k] = i.value.trim(); });
  $$('[data-oc]').forEach(i => { const j = +i.dataset.oc; c.otrosMontos[j] = { concepto: i.value.trim(), monto: numDe($(`[data-om="${j}"]`).value) || 0 }; });
  if (+c.sesionFinal < +c.sesionInicial) er = 'La última sesión no puede ser menor que la primera';
  return er;
}
async function guardarConfig(btn) {
  const tok = $('#cfg-token').value.trim(), repo = $('#cfg-erepo').value.trim(), etok = $('#cfg-etoken').value.trim();
  if (tok) { if (!(await A.probarToken(tok))) return toast('Ese token no tiene permiso de escritura sobre ' + A.REPO); D.config.token = tok; A.ponerToken(tok); }
  if (repo || etok) D.config.envios = { repo: repo || (D.config.envios || {}).repo, token: etok || (D.config.envios || {}).token };
  if (await guardarCon(btn, { socios: [] }, 'Actualizar configuración', 'Configuración guardada')) renderAdmin();
}
document.addEventListener('submit', e => {
  e.preventDefault(); const f = e.target;
  if (f.id === 'f-login') entrar(f);
  if (f.id === 'f-setup') configurar(f);
  if (f.id === 'f-socio') guardarSocio(f);
  if (f.id === 'f-usu') guardarUsuario(f);
  if (f.id === 'f-mail') { const para = $('#ml-para').value.trim(); if (!/^\s*[^\s@,]+@[^\s@,]+\.[^\s@,]+\s*(,\s*[^\s@,]+@[^\s@,]+\.[^\s@,]+\s*)*$/.test(para)) return toast('Revisá los correos: separalos con coma'); enviarAsistencia(+f.dataset.n, para, $('#ml-msg').value, f.querySelector('.btn-blue')); }
});
document.addEventListener('input', e => { const t = e.target, d = t.dataset;
  if (t.id === 'a-q') renderSocios();
  if (!mc || !t.closest('#v-macero')) return;
  if (d.cargo !== undefined) { mc.filas[+d.cargo].cargo = t.value; resumenMacero(); }
  if (d.pagado !== undefined) { mc.filas[+d.pagado].pagado = t.value; resumenMacero(); }
  if (d.nombre !== undefined) mc.filas[+d.nombre].nombre = t.value;
  if (d.extra !== undefined) mc.filas[+d.extra].extras[+d.j] = t.value;
  if (d.campo !== undefined) mc.campos[+d.campo] = t.value;
  if (t.id === 'mc-fecha') mc.fecha = t.value; if (t.id === 'mc-hora') mc.hora = t.value; if (t.id === 'mc-tc') mc.tc = t.value;
  if (t.id === 'mc-q') renderFilas();
});
document.addEventListener('change', async e => { const t = e.target, d = t.dataset;
  if (t.id === 'usu-file' && t.files[0]) {
    try { const j = JSON.parse(await new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = ko; fr.readAsText(t.files[0]); }));
      const r = importarUsuarios(j.usuarios); t.value = '';
      if (!r.cambiados.length) return toast('No había usuarios nuevos para importar');
      if (await guardarCon($('#usu-imp'), { usuarios: r.cambiados, socios: r.socios }, 'Importar usuarios', r.cambiados.length + ' usuarios listos')) renderAdmin();
    } catch (er) { console.error(er); toast('El archivo no es válido'); }
    return;
  }
  if (!mc || !t.closest('#v-macero')) return;
  if (t.id === 'mc-sesion') { ultimoGuardado = null; cargarSesion(+t.value); }
  if (t.id === 'mc-macero') mc.macero = t.value;
  if (t.id === 'mc-cobra') { mc.cobra = !t.checked; renderFilas(); resumenMacero(); }
  if (d.medio !== undefined) { const f = mc.filas[+d.medio]; f.medio = t.value; f.falta = false; t.classList.remove('falta'); resumenMacero(); }
  if (d.mon !== undefined) { mc.filas[+d.mon].moneda = t.value; resumenMacero(); }
});
document.addEventListener('focusout', e => { const t = e.target; if (t.matches && t.matches('input.num')) { const v = numDe(t.value); if (!isNaN(v) && t.value.trim() !== '') { t.value = fmt2(v); t.dispatchEvent(new Event('input', { bubbles: true })); } } });

/* ---------- Semitono animado ---------- */
let canv = [];
function sizeDots() { canv = [...$$('canvas[data-dots]')].filter(c => c.offsetParent !== null).map(c => { const r = c.getBoundingClientRect(), dp = Math.min(devicePixelRatio || 1, 2); c.width = r.width * dp; c.height = r.height * dp; const x = c.getContext('2d'); x.setTransform(dp, 0, 0, dp, 0, 0); return { x, w: r.width, h: r.height }; }); draw(performance.now()); }
function draw(t) { canv.forEach(({ x, w, h }) => { x.clearRect(0, 0, w, h); const g = 20, tt = t / 1000;
  for (let yy = g / 2; yy < h; yy += g) for (let xx = g / 2; xx < w; xx += g) { let s = Math.max(0, 1 - Math.hypot(xx / w - .92, (yy / h + .1) * .9) * 1.25); if (s <= 0) continue;
    s *= .75 + .25 * Math.sin(tt * 1.1 + xx * .035 + yy * .02); const rr = s * 4.2; if (rr < .35) continue; const hs = (Math.sin(xx * 12.9898 + yy * 78.233) * 43758.5453) % 1;
    x.fillStyle = hs > .9 ? 'rgba(254,221,0,.9)' : hs < -.94 ? 'rgba(218,41,28,.85)' : 'rgba(255,255,255,' + (.12 + s * .25) + ')'; x.beginPath(); x.arc(xx, yy, rr, 0, 6.283); x.fill(); } }); }
(function loop(t) { if (!still()) draw(t || 0); requestAnimationFrame(loop); })();
addEventListener('resize', sizeDots);

/* ---------- Accesibilidad ---------- */
const ab = $('#a11y-btn'), ap = $('#a11y');
ab.addEventListener('click', () => { ap.hidden = !ap.hidden; ab.setAttribute('aria-expanded', !ap.hidden); });
const pref = { sz: 1, tg: {} }; try { Object.assign(pref, JSON.parse(localStorage.getItem('a11y') || '{}')); } catch (_) { }
function applyA11y() { root.style.setProperty('--scale', pref.sz);
  $$('.a11y .sz button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.sz === +pref.sz));
  $$('.a11y .tg').forEach(b => { const on = !!pref.tg[b.dataset.tg]; b.setAttribute('aria-pressed', on); if (b.dataset.tg !== 'guide') root.classList.toggle(b.dataset.tg, on); });
  $('#guide').hidden = !pref.tg.guide; try { localStorage.setItem('a11y', JSON.stringify(pref)); } catch (_) { } setTimeout(sizeDots, 50); }
ap.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.sz) pref.sz = +b.dataset.sz; if (b.dataset.tg) pref.tg[b.dataset.tg] = !pref.tg[b.dataset.tg]; if (b.id === 'a11y-reset') { pref.sz = 1; pref.tg = {}; } applyA11y(); });
addEventListener('pointermove', e => { if (pref.tg.guide) $('#guide').style.top = (e.clientY - 22) + 'px'; });
applyA11y();
try { if (localStorage.getItem('aviso-ok')) $('#notice').hidden = true; } catch (_) { }

window.__portal = { datosAsistencia: n => datosAsistencia(n) };
iniciar();
})();
