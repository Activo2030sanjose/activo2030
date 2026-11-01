/* Colaboradores · People Resource Center (PRC)
 * Roles: superadmin y director (aprueban vacaciones), supervisor (carga datos, boletas, horas extra), colaborador (consulta y solicita).
 * rh/datos.json va cifrado con la llave de RH; rh/colab/<id>.json con la llave propia de cada colaborador.
 * Las solicitudes de los colaboradores viajan selladas por el buzón (solo la Dirección las puede abrir). */
(function () {
'use strict';
let X = null, RH = null, MIA = null, mesVista = null, sel = null, arrastre = false, tabRH = 'colaboradores', tabPay = 'boletas', perBol = null;
const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);
const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'], MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const fecha = s => { const p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
const dmy = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
const largo = s => { const d = fecha(s); return DIAS[(d.getDay() + 6) % 7] + ', ' + d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear(); };
const r2 = n => Math.round(n * 100) / 100;
const puedeRH = () => !!(X && X.S.rh), esDirector = () => X && (X.S.rol === 'director' || X.S.rol === 'superadmin'), esSupervisor = () => X && ['supervisor', 'director', 'superadmin'].includes(X.S.rol);
const cfgMia = () => (MIA && MIA.config) || (RH && RH.config) || {};

/* ---------- Números en letras (constancias) ---------- */
function letras(n) {
  const U = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'], C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  const cien = x => x === 100 ? 'cien' : (C[Math.floor(x / 100)] + ' ' + (x % 100 < 30 ? U[x % 100] : D[Math.floor(x % 100 / 10)] + (x % 10 ? ' y ' + U[x % 10] : ''))).trim();
  const mil = x => { const m = Math.floor(x / 1000), r = x % 1000; return ((m ? (m === 1 ? 'mil' : cien(m).replace(/uno$/, 'un') + ' mil') : '') + ' ' + cien(r)).trim(); };
  const e = Math.floor(n), c = Math.round((n - e) * 100), mill = Math.floor(e / 1e6), resto = e % 1e6;
  let t = ((mill ? (mill === 1 ? 'un millón' : mil(mill).replace(/uno$/, 'un') + ' millones') : '') + ' ' + mil(resto)).trim() || 'cero';
  t = t.replace(/uno$/, 'un') + ' colones';
  return c ? t + ' con ' + cien(c).replace(/uno$/, 'un') + ' céntimos' : t;
}

/* ---------- Calendario laboral ---------- */
const feriados = () => (cfgMia().feriados || []);
const esFeriado = s => feriados().find(f => f.fecha === s);
const laborable = d => { const w = d.getDay(); return w !== 0 && w !== 6 && !esFeriado(iso(d)); };
function diasHabiles(a, b) { let n = 0; for (let d = fecha(a); d <= fecha(b); d.setDate(d.getDate() + 1)) if (laborable(d)) n++; return n; }
function reincorporacion(b) { const d = fecha(b); do d.setDate(d.getDate() + 1); while (!laborable(d)); return iso(d); }

/* ---------- Datos ---------- */
async function cargarDatos() {
  const A = X.A;
  if (X.S.rh) { RH = await A.descifrar(X.S.rh, await A.leer('rh/datos.json')); if (RH.config.token) A.ponerToken(RH.config.token); await recibirSolicitudes(); }
  if (X.S.colab && X.S.colabId) { const p = await A.leer('rh/colab/' + X.S.colabId + '.json'); MIA = p ? await A.descifrar(X.S.colab, p) : null; }
}
const colabRH = id => RH.colaboradores[id];
function snapshot(id) {
  const c = RH.config;
  return { colaborador: RH.colaboradores[id], boletas: RH.boletas[id] || [], solicitudes: RH.solicitudes[id] || [],
    config: { empresa: c.empresa, cedulaJuridica: c.cedulaJuridica, ciudad: c.ciudad, firmante: c.firmante, contacto: c.contacto, ccss: c.ccss, feriados: c.feriados, solicitudes: c.solicitudes || null, escritura: c.token || null, rsaPub: RH.rsaPub } };
}
async function guardarRH(c, msg, btn, ok) {
  const A = X.A; if (!A.hayToken()) { X.toast('Falta el token de GitHub de RH. Pedile al administrador que lo configure.', 6000); return false; }
  X.ocupado(btn, true); X.toast('Guardando…', 60000);
  try {
    const rem = await A.leer('rh/datos.json');
    if (rem) { const r = await A.descifrar(X.S.rh, rem); if ((r.rev || 0) !== (RH.rev || 0)) { X.toast('Hubo cambios desde otro lugar. Recargá la página y volvé a hacer el cambio.', 8000); return false; } }
    RH.rev = (RH.rev || 0) + 1;
    const arch = { 'rh/datos.json': await A.cifrar(X.S.rh, RH) };
    const ids = c.colabs === 'todos' ? Object.keys(RH.colaboradores) : (c.colabs || []);
    for (const id of ids) { if (!RH.llaves[id]) RH.llaves[id] = await A.nuevaLlave(); arch['rh/colab/' + id + '.json'] = await A.cifrar(RH.llaves[id], snapshot(id)); }
    if (c.usuarios && c.usuarios.length) {
      const dir = await A.leer('usuarios.json');
      for (const uid of c.usuarios) {
        Object.keys(dir.usuarios).forEach(h => { if (dir.usuarios[h].id === uid) delete dir.usuarios[h]; });
        const u = RH.usuarios[uid]; if (!u) continue;
        if (!RH.llavesUsuario[uid]) RH.llavesUsuario[uid] = await A.nuevaLlave();
        const e = await A.entrada(u, u.clave, { colab: u.colabId ? RH.llaves[u.colabId] : null, rh: ['director', 'supervisor'].includes(u.rol) ? X.S.rh : null, firma: RH.llavesUsuario[uid] });
        for (const l of [u.usuario, u.correo].filter(Boolean)) dir.usuarios[await A.claveBusqueda(dir, l)] = e;
      }
      arch['usuarios.json'] = dir; X.setDir(dir);
    }
    arch['rh/datos.json'] = await A.cifrar(X.S.rh, RH);
    await A.guardar(arch, msg); X.toast(ok || 'Cambios guardados'); return true;
  } catch (e) { console.error(e); RH.rev = (RH.rev || 1) - 1; X.toast('No se pudo guardar. Revisá tu conexión e intentá de nuevo.'); return false; }
  finally { X.ocupado(btn, false); }
}

/* ---------- Solicitudes dentro del mismo repositorio (sección Issues) ----------
 * El token de solicitudes solo tiene permiso de Issues: no puede tocar el sitio ni los datos.
 * Cada solicitud va sellada (solo la Dirección la abre) y con una copia cifrada para el colaborador. */
const ISS = 'https://api.github.com/repos/Activo2030sanjose/activo2030/issues';
async function iss(metodo, ruta, cuerpo, tok) {
  const t = tok || cfgMia().solicitudes; if (!t) return null;
  const r = await fetch(ISS + ruta, { method: metodo, cache: 'no-store', headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  if (!r.ok) throw new Error('Solicitudes ' + r.status); return r.json();
}
/* Las solicitudes se guardan selladas en rh/entrantes/ de la rama de datos del portal. */
const API = 'https://api.github.com/repos/Activo2030sanjose/activo2030/contents/rh/entrantes';
async function ent(metodo, ruta, cuerpo, tok) {
  const t = tok || cfgMia().escritura; if (!t) return null;
  const r = await fetch(API + ruta, { method: metodo, cache: 'no-store', headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  if (r.status === 404) return null; if (!r.ok) throw new Error('Solicitudes ' + r.status); return r.json();
}
const lista = async tok => ((await ent('GET', '?ref=datos&t=' + Date.now(), null, tok)) || []).filter(f => f.name.endsWith('.json'));
const leerEnt = async (f, tok) => { const j = await ent('GET', '/' + f.name + '?ref=datos', null, tok); return JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g, ''))))); };
async function enviarSolicitud(tipo, datos) {
  const c = cfgMia(); if (!c.escritura || !c.rsaPub) { X.toast('Las solicitudes todavía no están habilitadas. Consultá con la Dirección Ejecutiva.', 6000); return false; }
  const sol = Object.assign({ id: Date.now().toString(36) + X.A.b64(X.A.azar(3)).replace(/[^a-z0-9]/gi, ''), tipo, estado: 'pendiente', creado: new Date().toISOString() }, datos);
  const paq = { sello: await X.A.sellar(c.rsaPub, { colabId: X.S.colabId, sol }), mio: await X.A.cifrar(X.S.colab, sol) };
  await ent('PUT', '/' + sol.id + '.json', { message: 'Solicitud PRC', branch: 'datos', content: btoa(JSON.stringify(paq)) });
  return sol;
}
let pendientesMias = [];
async function misPendientes() {
  pendientesMias = []; if (!cfgMia().escritura) return;
  try { for (const f of await lista()) { try { pendientesMias.push(await X.A.descifrar(X.S.colab, (await leerEnt(f)).mio)); } catch (_) { } } } catch (_) { }
}
async function recibirSolicitudes() {
  const t = RH.config.token; if (!t || !esDirector() && !esSupervisor()) return;
  try {
    const l = await lista(t); if (!l.length) return; let n = 0;
    for (const f of l) {
      try { const { colabId, sol } = await X.A.abrirSello(RH.rsaPriv, (await leerEnt(f, t)).sello);
        if (RH.colaboradores[colabId]) { const l2 = RH.solicitudes[colabId] = RH.solicitudes[colabId] || []; if (!l2.some(s => s.id === sol.id)) { l2.push(sol); n++; } }
      } catch (_) { }
      await ent('DELETE', '/' + f.name, { message: 'Solicitud recibida', sha: f.sha, branch: 'datos' }, t);
    }
    if (n) await guardarRH({ colabs: 'todos' }, 'Recibir solicitudes', null, n + ' solicitudes nuevas por revisar');
  } catch (e) { console.error(e); }
}

/* ---------- PDF ---------- */
async function pdfBase() {
  await X.cargar(X.LIB_PDF); const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), F = window.FUENTES_PDF;
  doc.addFileToVFS('A.ttf', F.regular); doc.addFont('A.ttf', 'Arimo', 'normal'); doc.addFileToVFS('B.ttf', F.bold); doc.addFont('B.ttf', 'Arimo', 'bold'); doc.setFont('Arimo', 'normal');
  return doc;
}
const FMT = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
async function pdfBoleta(col, b, cfg) {
  const doc = await pdfBase(), lg = await X.logo(), X0 = 18, W = 174;
  doc.setDrawColor(40); doc.setLineWidth(0.4); doc.rect(X0, 14, W, 46);
  doc.addImage(lg, 'PNG', X0 + W / 2 - 9, 16, 18, 18);
  doc.setFontSize(9); doc.setFont('Arimo', 'bold'); doc.text('Empresa:', X0 + 2, 40); doc.setFont('Arimo', 'normal'); doc.text(cfg.empresa, X0 + 18, 40);
  doc.setFont('Arimo', 'bold'); doc.text('Fecha fin del periodo:', X0 + 112, 40); doc.setFont('Arimo', 'normal'); doc.text(dmy(b.fin), X0 + 150, 40);
  doc.setFont('Arimo', 'bold'); doc.text('Costa Rica', X0 + W / 2, 50, { align: 'center' }); doc.setFont('Arimo', 'normal'); doc.text(b.motivo || '', X0 + W / 2, 56, { align: 'center' });
  doc.autoTable({ startY: 60, margin: { left: X0, right: 210 - X0 - W }, theme: 'grid', styles: { font: 'Arimo', fontSize: 9, lineColor: 40, lineWidth: 0.3, textColor: 20, cellPadding: 1.6 },
    body: [[{ content: 'Código: ' + col.usuario, styles: {} }, 'Departamento: ' + (col.departamento || '')], ['Nombre: ' + col.nombre, 'Posición: ' + (col.puesto || '')], ['Salario mensual: ' + FMT(col.salario), 'Periodo: ' + dmy(b.inicio) + ' al ' + dmy(b.fin)]], columnStyles: { 0: { cellWidth: W / 2 }, 1: { cellWidth: W / 2 } } });
  const ti = b.lineas.reduce((a, l) => a + (+l.i || 0), 0), tx = b.lineas.reduce((a, l) => a + (+l.x || 0), 0);
  doc.autoTable({ startY: doc.lastAutoTable.finalY, margin: { left: X0, right: 210 - X0 - W }, theme: 'grid', styles: { font: 'Arimo', fontSize: 9, lineColor: 40, lineWidth: 0.3, textColor: 20, cellPadding: 1.6 },
    headStyles: { fillColor: [0, 20, 137], textColor: 255, halign: 'center', fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 82 }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 36, halign: 'right' }, 3: { cellWidth: 36, halign: 'right' } },
    head: [['Descripción', 'Cantidad', 'Ingresos', 'Deducciones']],
    body: b.lineas.map(l => [l.d, l.c || '', +l.i ? FMT(l.i) : '', +l.x ? FMT(l.x) : '']).concat([
      [{ content: 'TOTALES:', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: FMT(ti), styles: { fontStyle: 'bold' } }, { content: FMT(tx), styles: { fontStyle: 'bold' } }],
      [{ content: 'NETO:', colSpan: 3, styles: { fontStyle: 'bold' } }, { content: FMT(ti - tx), styles: { fontStyle: 'bold', fillColor: [254, 221, 0] } }],
      [{ content: 'Banco/Cuenta', colSpan: 3 }, { content: 'Pago', styles: { halign: 'center' } }],
      [{ content: (col.banco || '') + '   ' + (col.cuenta || ''), colSpan: 3 }, FMT(ti - tx)]]) });
  doc.setFontSize(7); doc.setTextColor(110); doc.text('Fecha de pago: ' + dmy(b.pago) + ' · Documento generado por el People Resource Center del ' + cfg.empresa, X0, doc.lastAutoTable.finalY + 6);
  return { doc, archivo: 'Boleta_' + col.usuario + '_' + b.periodo + (b.tipo === 'Q1' ? '_quincena' : '_fin_de_mes') + '.pdf' };
}
async function pdfCarta(col, tipo, dirigida, cfg, boletas) {
  const doc = await pdfBase(), lg = await X.logo(), X0 = 22, W = 166, hoy = dmy(X.hoyISO);
  doc.addImage(lg, 'PNG', 210 - X0 - 24, 14, 24, 24);
  doc.setFillColor(254, 221, 0); doc.rect(X0, 42, W * .2, 1.4, 'F'); doc.setFillColor(218, 41, 28); doc.rect(X0 + W * .2, 42, W * .3, 1.4, 'F'); doc.setFillColor(0, 20, 137); doc.rect(X0 + W * .5, 42, W * .5, 1.4, 'F');
  doc.setFontSize(11); doc.setFont('Arimo', 'bold'); doc.text((dirigida || 'A quien interese') + ',', X0, 58); doc.setFont('Arimo', 'normal');
  const ccss = +cfg.ccss || 0, neto = r2(col.salario * (1 - ccss / 100));
  let p;
  if (tipo === 'anual') {
    const desde = new Date(fecha(X.hoyISO)); desde.setFullYear(desde.getFullYear() - 1);
    const tot = (boletas || []).filter(b => fecha(b.fin) > desde).reduce((a, b) => a + b.lineas.reduce((x, l) => x + (+l.i || 0) - (+l.x || 0), 0), 0);
    p = [`La Dirección Ejecutiva de la ${cfg.empresa}${cfg.cedulaJuridica ? ', cédula jurídica ' + cfg.cedulaJuridica + ',' : ''} hace constar que ${col.nombre}${col.cedula ? ', cédula de identidad número ' + col.cedula + ',' : ''} labora para esta organización desde el ${dmy(col.ingreso)}, desempeñando el puesto de ${col.puesto}.`,
      `En los últimos doce meses ha recibido ingresos netos por ₡${FMT(tot)} (${letras(tot)}), según las boletas de pago registradas.`];
  } else {
    p = [`La Dirección Ejecutiva de la ${cfg.empresa}${cfg.cedulaJuridica ? ', cédula jurídica ' + cfg.cedulaJuridica + ',' : ''} hace constar que ${col.nombre}${col.cedula ? ', cédula de identidad número ' + col.cedula + ',' : ''} labora para esta organización desde el ${dmy(col.ingreso)}, desempeñando el puesto de ${col.puesto}, devengando un salario base mensual de ₡${FMT(col.salario)} (${letras(+col.salario)}).`,
      `El salario neto mensual, una vez hechas las deducciones de ley, es de ₡${FMT(neto)} (${letras(neto)}).`];
  }
  p.push(`Se extiende la presente constancia a solicitud del interesado en la ciudad de ${cfg.ciudad || 'San José'}, el día ${hoy}.`);
  let y = 72; doc.setFontSize(10.5);
  p.forEach(t => { const ls = doc.splitTextToSize(t, W); doc.text(ls, X0, y, { lineHeightFactor: 1.5, align: 'justify', maxWidth: W }); y += ls.length * 6.2 + 8; });
  y = Math.max(y + 30, 210); doc.setDrawColor(40); doc.line(105 - 35, y, 105 + 35, y);
  doc.setFont('Arimo', 'bold'); doc.text(cfg.firmante || 'Dirección Ejecutiva', 105, y + 6, { align: 'center' }); doc.setFont('Arimo', 'normal'); doc.text(cfg.empresa, 105, y + 12, { align: 'center' });
  doc.setFontSize(8); doc.setTextColor(110); if (cfg.contacto) doc.text('La verificación de esta constancia se puede realizar en: ' + cfg.contacto, 105, y + 18, { align: 'center' });
  return { doc, archivo: (tipo === 'anual' ? 'Constancia_ingresos_anuales_' : 'Constancia_salarial_') + col.usuario + '.pdf' };
}
function visor(r) {
  const url = URL.createObjectURL(r.doc.output('blob'));
  X.openSheet(`<h2>${X.esc(r.archivo.replace(/_/g, ' ').replace('.pdf', ''))}</h2><p class="sub">Vista previa del documento. Si no se ve en tu celular, usá Descargar.</p>
    <iframe class="visor" src="${url}#view=FitH" title="Vista previa"></iframe>
    <div class="foot"><button type="button" class="btn btn-soft" data-close>Cerrar</button><button type="button" class="btn btn-red" id="rh-bajar">Descargar PDF</button></div>`, true);
  $('#rh-bajar').onclick = () => r.doc.save(r.archivo);
}

/* ---------- Vistas ---------- */
function iniciales(n) { return String(n || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
function renderInicio() {
  const c = MIA && MIA.colaborador, apps = [];
  if (MIA) apps.push({ go: 'prc', t: 'People Resource Center', d: 'Vacaciones, boletas de pago, constancias y horas extra.', ico: 'prc' });
  if (puedeRH()) apps.push({ go: 'rh', t: 'Administración de personal', d: 'Colaboradores, boletas, solicitudes y aprobaciones.', ico: 'adm' });
  $('#col-hola').textContent = c ? 'Hola, ' + c.nombre.split(' ')[0] : 'Colaboradores';
  $('#col-sub').textContent = c ? c.puesto : (X.S.rol === 'superadmin' ? 'Administración general' : '');
  $('#col-apps').innerHTML = apps.map(a => `<button class="app" data-rhgo="${a.go}"><span class="app-ico ${a.ico}">${a.ico === 'prc' ? '<b>PEOPLE</b><small>RESOURCE CENTER</small>' : '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.8"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M15 14.2c3.3-.3 6.5 1.7 6.5 5.3"/></svg>'}</span><span class="app-t">${a.t}</span><span class="app-d">${a.d}</span></button>`).join('') || '<p class="muted">No tenés aplicaciones asignadas.</p>';
  X.show('colab');
}
function renderPRC() {
  const c = MIA.colaborador, pend = (MIA.solicitudes || []).filter(s => s.estado === 'pendiente').length + pendientesMias.length;
  $('#prc-perfil').innerHTML = `<span class="av" style="background:#da291c">${X.esc(iniciales(c.nombre))}</span><div><b>${X.esc(c.nombre)}</b><span>${X.esc(c.puesto)} · ${X.esc(c.usuario)}</span></div>`;
  const tiles = [['timeoff', 'Time Off', 'Solicitá y consultá tus vacaciones', 'cal'], ['payroll:boletas', 'Boletas de pago', 'Quincena y fin de mes', 'doc'], ['payroll:cartas', 'Cartas', 'Constancias salariales', 'mail'], ['payroll:horas', 'Horas extra', 'Solicitud e historial', 'reloj']];
  if (esDirector() || esSupervisor()) tiles.push(['rh', 'Aprobaciones', 'Solicitudes de tu equipo', 'ok']);
  const ic = { cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h2M14 14h2M8 18h2"/>', doc: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>', mail: '<path d="M3 6h18v12H3z"/><path d="m3 7 9 6 9-6"/>', reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', ok: '<path d="M4 12l5 5L20 6"/>' };
  $('#prc-tiles').innerHTML = tiles.map(([g, t, d, i]) => `<button class="tile" data-rhgo="${g}"><span class="tile-top"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">${ic[i]}</svg></span><span class="tile-b"><b>${t}</b><small>${d}</small></span></button>`).join('');
  $('#prc-pend').textContent = pend ? pend + ' solicitudes pendientes de aprobación' : 'Sin solicitudes pendientes';
  X.show('prc');
}
function eventosMios() { return (MIA.solicitudes || []).filter(s => s.tipo === 'vacaciones').concat(pendientesMias.filter(s => s.tipo === 'vacaciones' && !(MIA.solicitudes || []).some(x => x.id === s.id))); }
function estadoDia(s) { for (const e of eventosMios()) if (e.estado !== 'rechazado' && s >= e.inicio && s <= e.fin) return e.estado; return null; }
function renderTimeOff() {
  if (!mesVista) { const h = fecha(X.hoyISO); mesVista = new Date(h.getFullYear(), h.getMonth(), 1); }
  const meses = [0, 1].map(k => new Date(mesVista.getFullYear(), mesVista.getMonth() + k, 1));
  $('#to-cal').innerHTML = meses.map(m => {
    let h = `<div class="mes-cal"><div class="mes-t"><b>${MESES[m.getMonth()]}</b><span>${m.getFullYear()}</span></div><div class="dias">${DIAS.map(d => `<i>${d}</i>`).join('')}`;
    const pad = (m.getDay() + 6) % 7; for (let i = 0; i < pad; i++) h += '<span></span>';
    for (let d = new Date(m); d.getMonth() === m.getMonth(); d.setDate(d.getDate() + 1)) {
      const s = iso(d), fer = esFeriado(s), est = estadoDia(s), enSel = sel && s >= sel.a && s <= (sel.b || sel.a), cls = [!laborable(d) ? 'nl' : '', fer ? 'fer' : '', s === X.hoyISO ? 'hoy' : '', est === 'aprobado' ? 'apr' : est === 'pendiente' ? 'pen' : '', enSel ? 'sel' : '', s < X.hoyISO ? 'pas' : ''].join(' ');
      h += `<span class="d ${cls}" data-dia="${s}" title="${fer ? X.esc(fer.nombre) : ''}">${d.getDate()}</span>`;
    }
    return h + '</div></div>';
  }).join('');
  const c = MIA.colaborador, prox = eventosMios().filter(e => e.fin >= X.hoyISO && e.estado !== 'rechazado').sort((a, b) => a.inicio.localeCompare(b.inicio));
  const fer = feriados().filter(f => f.fecha >= X.hoyISO).slice(0, 3);
  $('#to-side').innerHTML = `<h3>Saldos</h3><div class="saldo-row"><span>Vacaciones</span><b>${c.vacaciones} ${Math.abs(c.vacaciones) === 1 ? 'día' : 'días'}</b></div>
    <h3>Próximo tiempo libre</h3>${prox.length ? prox.map(e => `<div class="prox"><div><b>Vacaciones (${e.dias} ${e.dias === 1 ? 'día' : 'días'})</b><small>${largo(e.inicio)} – ${largo(e.fin)}</small></div><span class="pill ${e.estado === 'aprobado' ? 'ok' : 'warn'}">${e.estado === 'aprobado' ? 'Aprobado' : 'Pendiente'}</span></div>`).join('') : '<p class="muted">No tenés vacaciones programadas.</p>'}
    ${fer.map(f => `<div class="prox"><div><b>${X.esc(f.nombre)} (1 día)</b><small>${largo(f.fecha)}</small></div><span class="pill">Feriado</span></div>`).join('')}`;
  X.show('timeoff');
}
function formAusencia(a, b) {
  const c = MIA.colaborador;
  X.openSheet(`<h2>Crear ausencia</h2><p class="sub">Los fines de semana y feriados no cuentan como días de vacaciones.</p>
  <form id="f-aus"><div class="confirm" id="aus-err" hidden></div>
   <div class="field"><label>Tipo de tiempo</label><input class="input" value="Vacaciones" disabled></div>
   <div class="field"><label>Saldo disponible</label><input class="input" value="${c.vacaciones} días" disabled></div>
   <div class="row2"><div class="field"><label for="aus-i">Fecha de inicio</label><input class="input" type="date" id="aus-i" min="${X.hoyISO}" value="${a || ''}"></div><div class="field"><label for="aus-f">Fecha de finalización</label><input class="input" type="date" id="aus-f" min="${X.hoyISO}" value="${b || ''}"></div></div>
   <div class="row2"><div class="field"><label>Solicitud</label><input class="input" id="aus-n" value="0 días" disabled></div><div class="field"><label>Reincorporación al trabajo</label><input class="input" id="aus-r" disabled></div></div>
   <div class="field"><label for="aus-c">Comentario</label><textarea class="input" id="aus-c" rows="3"></textarea></div>
   <div class="foot"><button type="button" class="btn btn-soft" data-close>Cancelar</button><button class="btn btn-red" type="submit">Enviar</button></div></form>`);
  if (a && b) calcAus();
}
function calcAus() {
  const a = $('#aus-i').value, b = $('#aus-f').value, err = $('#aus-err'); err.hidden = true;
  if (!a || !b) return null; if (b <= a) { err.textContent = b === a ? 'La fecha de finalización no puede ser igual a la de inicio.' : 'La fecha de finalización no puede ser anterior a la de inicio.'; err.hidden = false; return null; }
  if (a < X.hoyISO) { err.textContent = 'La fecha de inicio no puede ser anterior a hoy.'; err.hidden = false; return null; }
  const n = diasHabiles(a, b); $('#aus-n').value = n + (n === 1 ? ' día' : ' días'); $('#aus-r').value = dmy(reincorporacion(b));
  if (!n) { err.textContent = 'Tu tiempo libre debe incluir al menos un día laborable. Cambiá las fechas.'; err.hidden = false; return null; }
  if (n > MIA.colaborador.vacaciones) { err.textContent = 'Solicitás ' + n + ' días y tu saldo es de ' + MIA.colaborador.vacaciones + '.'; err.hidden = false; return null; }
  return { inicio: a, fin: b, dias: n };
}
function renderPayroll() {
  $$('#pay-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.pay === tabPay));
  const c = MIA.colaborador, el = $('#pay-cont');
  if (tabPay === 'boletas') {
    const bs = (MIA.boletas || []).slice().sort((a, b) => b.fin.localeCompare(a.fin) || b.tipo.localeCompare(a.tipo));
    el.innerHTML = `<h2>Recibos</h2><div class="tbl-x"><table class="tabla"><thead><tr><th>Año</th><th>Periodo</th><th>Fecha inicio</th><th>Fecha fin</th><th>Fecha de pago</th><th>Motivo de pago</th><th>Ver</th></tr></thead><tbody>${bs.map(b => `<tr><td>${b.periodo.slice(0, 4)}</td><td>${b.periodo.slice(5)}${b.tipo === 'Q1' ? ' · Q1' : ''}</td><td>${dmy(b.inicio)}</td><td>${dmy(b.fin)}</td><td>${dmy(b.pago)}</td><td>${X.esc(b.motivo)}</td><td><button class="ibtn up" data-verbol="${b.id}" aria-label="Ver boleta">PDF</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Todavía no hay boletas publicadas.</td></tr>'}</tbody></table></div>`;
  } else if (tabPay === 'cartas') {
    el.innerHTML = `<h2>Cartas</h2><div class="field" style="max-width:460px"><label for="ca-t">Seleccioná una carta</label><select class="input" id="ca-t"><option value="salarial">Constancia salarial</option><option value="anual">Constancia de ingresos anuales</option></select></div>
     <div class="field" style="max-width:460px"><label for="ca-d">Dirigida a</label><textarea class="input" id="ca-d" rows="3">A quien interese</textarea></div>
     <div class="foot" style="justify-content:flex-start"><button class="btn btn-red" id="ca-ver">Ver y descargar</button></div>`;
  } else {
    const hs = (MIA.solicitudes || []).filter(s => s.tipo === 'horas').concat(pendientesMias.filter(s => s.tipo === 'horas' && !(MIA.solicitudes || []).some(x => x.id === s.id))).sort((a, b) => b.fecha.localeCompare(a.fecha));
    el.innerHTML = `<h2>Solicitud de horas extra</h2><form id="f-horas" class="fgrid" style="max-width:720px"><div class="field"><label for="hx-f">Fecha</label><input class="input" type="date" id="hx-f" value="${X.hoyISO}"></div><div class="field"><label for="hx-h">Horas</label><input class="input num" id="hx-h" inputmode="decimal" placeholder="Ej. 2.5"></div>
     <div class="field wide"><label for="hx-m">Motivo</label><input class="input" id="hx-m" placeholder="Ej. Apoyo en la Teletón"></div><div class="foot" style="grid-column:1/-1;justify-content:flex-start"><button class="btn btn-red" type="submit">Enviar solicitud</button></div></form>
     <h2 style="margin-top:24px">Historial de horas extra</h2><ul class="regs">${hs.map(h => `<li><div><div class="t">${dmy(h.fecha)} · ${h.horas} h</div><div class="d">${X.esc(h.motivo)}</div></div><span class="pill ${h.estado === 'aprobado' ? 'ok' : h.estado === 'rechazado' ? 'bad' : 'warn'}">${h.estado}</span></li>`).join('') || '<li class="empty">Sin solicitudes registradas.</li>'}</ul>`;
  }
  X.show('payroll');
}

/* ---------- Administración de personal ---------- */
function renderRH() {
  $$('#rh-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.rhtab === tabRH));
  const el = $('#rh-cont'), cols = Object.values(RH.colaboradores).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const pend = cols.reduce((a, c) => a + (RH.solicitudes[c.id] || []).filter(s => s.estado === 'pendiente').length, 0);
  $('#rh-pend').textContent = pend; $('#rh-pend').hidden = !pend;
  if (tabRH === 'colaboradores') {
    el.innerHTML = `<div class="tools"><h2>Colaboradores</h2><button class="btn btn-soft" id="rh-exp" style="padding:.55rem 1rem">Descargar Excel</button><button class="btn btn-soft" id="rh-imp" style="padding:.55rem 1rem">Cargar Excel</button><input type="file" id="rh-file" accept=".xlsx" hidden>${esSupervisor() ? '<button class="btn btn-blue" id="rh-new" style="padding:.55rem 1rem">+ Nuevo colaborador</button>' : ''}</div>
     <div class="tbl-x"><table class="tabla"><thead><tr><th>Colaborador</th><th>Usuario</th><th>Puesto</th><th>Vacaciones</th><th style="text-align:right">Salario</th><th>Rol</th><th></th></tr></thead><tbody>${cols.map(c => { const u = Object.values(RH.usuarios).find(x => x.colabId === c.id) || {};
      return `<tr><td><b>${X.esc(c.nombre)}</b></td><td>${X.esc(c.usuario)}</td><td>${X.esc(c.puesto)}</td><td>${c.vacaciones} días</td><td style="text-align:right">${X.fmt(c.salario)}</td><td>${X.esc({ director: 'Director Ejecutivo', supervisor: 'Supervisor', colaborador: 'Colaborador' }[u.rol] || '—')}</td><td>${esSupervisor() ? `<button class="mini" data-edcol="${c.id}">Editar</button> <button class="mini" data-clvcol="${u.id || ''}">Clave</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">Todavía no hay colaboradores.</td></tr>'}</tbody></table></div>`;
  } else if (tabRH === 'boletas') {
    if (!perBol) perBol = X.hoyISO.slice(0, 7);
    const lista = cols.flatMap(c => (RH.boletas[c.id] || []).filter(b => b.periodo === perBol).map(b => ({ c, b })));
    el.innerHTML = `<div class="tools"><h2>Boletas de pago</h2><input class="input" type="month" id="bol-per" value="${perBol}" style="width:auto"><button class="btn btn-soft" data-genbol="Q1" style="padding:.55rem 1rem">Generar quincena (${RH.config.q1}%)</button><button class="btn btn-blue" data-genbol="Q2" style="padding:.55rem 1rem">Generar fin de mes (${RH.config.q2}%)</button></div>
     <p class="muted pad-x">La quincena es un adelanto del ${RH.config.q1}% del salario. El fin de mes paga el salario completo y rebaja el adelanto y la CCSS (${RH.config.ccss}%). Podés editar cada boleta antes de publicarla.</p>
     <ul class="regs">${lista.map(({ c, b }) => { const n = b.lineas.reduce((a, l) => a + (+l.i || 0) - (+l.x || 0), 0); return `<li><div><div class="t">${X.esc(c.nombre)} · ${b.tipo === 'Q1' ? 'Quincena' : 'Fin de mes'}</div><div class="d">${dmy(b.inicio)} al ${dmy(b.fin)} · neto ${X.fmt(n)}</div></div><div class="acts"><button class="mini" data-verbolrh="${c.id}|${b.id}">Ver</button><button class="mini" data-edbol="${c.id}|${b.id}">Editar</button><button class="mini" data-delbol="${c.id}|${b.id}">Quitar</button></div></li>`; }).join('') || '<li class="empty">No hay boletas para este mes.</li>'}</ul>`;
  } else if (tabRH === 'solicitudes') {
    const items = cols.flatMap(c => (RH.solicitudes[c.id] || []).map(s => ({ c, s }))).sort((a, b) => (a.s.estado === 'pendiente' ? 0 : 1) - (b.s.estado === 'pendiente' ? 0 : 1) || b.s.creado.localeCompare(a.s.creado));
    el.innerHTML = `<div class="tools"><h2>Solicitudes</h2><p class="muted" style="margin:0">La Dirección Ejecutiva aprueba vacaciones. Supervisión o Dirección aprueban horas extra.</p></div>
     <ul class="regs">${items.map(({ c, s }) => { const puede = s.estado === 'pendiente' && (s.tipo === 'vacaciones' ? esDirector() : esSupervisor());
      return `<li><div><div class="t">${X.esc(c.nombre)} · ${s.tipo === 'vacaciones' ? 'Vacaciones' : 'Horas extra'}</div><div class="d">${s.tipo === 'vacaciones' ? largo(s.inicio) + ' – ' + largo(s.fin) + ' · ' + s.dias + ' días hábiles · saldo ' + c.vacaciones : dmy(s.fecha) + ' · ' + s.horas + ' h · ' + X.esc(s.motivo)}${s.comentario ? ' · «' + X.esc(s.comentario) + '»' : ''}</div></div>
      ${puede ? `<div class="acts"><button class="mini" data-res="${c.id}|${s.id}|aprobado">Aprobar</button><button class="mini" data-res="${c.id}|${s.id}|rechazado">Rechazar</button></div>` : `<span class="pill ${s.estado === 'aprobado' ? 'ok' : s.estado === 'rechazado' ? 'bad' : 'warn'}">${s.estado}</span>`}</li>`; }).join('') || '<li class="empty">No hay solicitudes.</li>'}</ul>`;
  } else {
    const c = RH.config;
    el.innerHTML = `<div class="pad-x"><h2>Configuración</h2><div class="fgrid">
     <div class="field wide"><label for="rc-emp">Nombre de la organización</label><input class="input" id="rc-emp" value="${X.esc(c.empresa)}"></div>
     <div class="field"><label for="rc-ced">Cédula jurídica</label><input class="input" id="rc-ced" value="${X.esc(c.cedulaJuridica || '')}"></div>
     <div class="field"><label for="rc-ciu">Ciudad</label><input class="input" id="rc-ciu" value="${X.esc(c.ciudad || '')}"></div>
     <div class="field"><label for="rc-fir">Firma de las constancias</label><input class="input" id="rc-fir" value="${X.esc(c.firmante || '')}"></div>
     <div class="field"><label for="rc-con">Contacto para verificar constancias</label><input class="input" id="rc-con" value="${X.esc(c.contacto || '')}"></div>
     <div class="field"><label for="rc-ccss">CCSS (%)</label><input class="input num" id="rc-ccss" value="${c.ccss}"></div>
     <div class="field"><label for="rc-q1">Pago de quincena (%)</label><input class="input num" id="rc-q1" value="${c.q1}"></div>
     <div class="field wide"><label for="rc-fer">Feriados (uno por línea: AAAA-MM-DD Nombre)</label><textarea class="input" id="rc-fer" rows="8">${(c.feriados || []).map(f => f.fecha + ' ' + f.nombre).join('\n')}</textarea></div></div>
     <div class="foot" style="justify-content:flex-start"><button class="btn btn-red" id="rc-guardar">Guardar configuración</button></div></div>`;
  }
  X.show('rh');
}
function colForm(id) {
  const c = id ? RH.colaboradores[id] : { nombre: '', usuario: '', puesto: '', departamento: '', cedula: '', ingreso: X.hoyISO, salario: 0, vacaciones: 0, banco: '', cuenta: '' };
  const u = id ? (Object.values(RH.usuarios).find(x => x.colabId === id) || {}) : { rol: 'colaborador' };
  const roles = X.S.rol === 'superadmin' || X.S.rol === 'director' ? ['colaborador', 'supervisor', 'director'] : ['colaborador'];
  const f = (k, l, t) => `<div class="field"><label for="cf-${k}">${l}</label><input class="input${t === 'm' ? ' num' : ''}" id="cf-${k}" ${t === 'd' ? 'type="date"' : t === 'm' ? 'inputmode="decimal"' : ''} value="${X.esc(t === 'm' ? X.fmt2(c[k]) : c[k] || '')}"></div>`;
  X.openSheet(`<h2>${id ? 'Editar colaborador' : 'Nuevo colaborador'}</h2><p class="sub">El usuario es la inicial del nombre y el primer apellido.</p><form id="f-col" data-id="${id || ''}">
   ${f('nombre', 'Nombre completo')}<div class="row2">${f('usuario', 'Usuario')}<div class="field"><label for="cf-rol">Rol</label><select class="input" id="cf-rol">${roles.map(r => `<option value="${r}" ${u.rol === r ? 'selected' : ''}>${{ colaborador: 'Colaborador', supervisor: 'Supervisor', director: 'Director Ejecutivo' }[r]}</option>`).join('')}</select></div></div>
   <div class="row2">${f('puesto', 'Puesto')}${f('departamento', 'Departamento')}</div><div class="row2">${f('cedula', 'Cédula')}${f('ingreso', 'Fecha de ingreso', 'd')}</div>
   <div class="row2">${f('salario', 'Salario mensual (₡)', 'm')}${f('vacaciones', 'Días de vacaciones disponibles', 'm')}</div><div class="row2">${f('banco', 'Banco')}${f('cuenta', 'Cuenta')}</div>
   <div class="foot"><button type="button" class="btn btn-soft" data-close>Cancelar</button><button class="btn btn-red" type="submit">Guardar</button></div></form>`);
}
const sugerirUsuario = n => { const w = X.normal(n).split(' ').filter(Boolean); return w.length ? (w[0][0] + (w.length >= 3 ? w[w.length - 2] : w[1] || '')).replace(/[^a-z]/g, '') : ''; };
async function guardarCol(f) {
  const id0 = f.dataset.id, g = k => $('#cf-' + k).value.trim(), nombre = g('nombre'); let usuario = g('usuario').toLowerCase() || sugerirUsuario(nombre);
  if (!nombre || !g('puesto')) return X.toast('Completá el nombre y el puesto');
  const sal = X.numDe(g('salario')), vac = X.numDe(g('vacaciones')); if (!(sal >= 0) || isNaN(vac)) return X.toast('Revisá el salario y los días de vacaciones');
  const choca = Object.values(RH.usuarios).find(u => X.normal(u.usuario) === X.normal(usuario) && u.colabId !== id0); if (choca) return X.toast('Ese usuario ya existe');
  const id = id0 || 'c-' + X.slug(usuario), c = RH.colaboradores[id] = Object.assign(RH.colaboradores[id] || { id }, { nombre, usuario, puesto: g('puesto'), departamento: g('departamento'), cedula: g('cedula'), ingreso: g('ingreso'), salario: sal, vacaciones: vac, banco: g('banco'), cuenta: g('cuenta') });
  let u = Object.values(RH.usuarios).find(x => x.colabId === id), nuevo = !u;
  if (!u) { u = { id: 'r-' + X.slug(usuario), colabId: id, clave: X.genClave(), debeCambiar: true, activo: true }; RH.usuarios[u.id] = u; }
  Object.assign(u, { usuario, nombre, rol: $('#cf-rol').value });
  if (await guardarRH({ colabs: [id], usuarios: [u.id] }, (id0 ? 'Editar' : 'Crear') + ' colaborador', f.querySelector('[type=submit]'), 'Colaborador guardado')) { X.closeSheet(); renderRH(); if (nuevo) verClave(u.id); }
}
function verClave(uid) { const u = RH.usuarios[uid]; if (!u) return; X.openSheet(`<h2>Acceso de ${X.esc(u.nombre)}</h2><p class="sub">Entregale estos datos de forma privada.</p><div class="confirm" style="background:var(--surface-2);color:var(--fg)">Usuario: <b>${X.esc(u.usuario)}</b><br>Contraseña inicial: <b>${X.esc(u.clave)}</b></div><div class="foot"><button type="button" class="btn btn-soft" data-close>Cerrar</button></div>`); }
function nuevaBoleta(c, per, tipo) {
  const [y, m] = per.split('-').map(Number), fin = iso(new Date(y, m, 0)), q1 = r2(c.salario * RH.config.q1 / 100), ccss = r2(c.salario * RH.config.ccss / 100);
  return tipo === 'Q1' ? { id: per + '-Q1', periodo: per, tipo, inicio: per + '-01', fin: per + '-15', pago: per + '-15', motivo: 'Adelanto de quincena', lineas: [{ d: 'Adelanto de Quincena', c: '', i: q1, x: 0 }] }
    : { id: per + '-Q2', periodo: per, tipo, inicio: per + '-01', fin, pago: fin, motivo: 'Pago de fin de mes', lineas: [{ d: 'Salario', c: '', i: +c.salario, x: 0 }, { d: 'Descuento Adelanto de Quincena', c: '', i: 0, x: q1 }, { d: 'CCSS (SEM, IVM y Banco Popular) ' + RH.config.ccss + '%', c: '', i: 0, x: ccss }] };
}
function bolForm(cid, bid) {
  const b = (RH.boletas[cid] || []).find(x => x.id === bid), c = RH.colaboradores[cid];
  const fila = (l, i) => `<div class="otra bl" data-bi="${i}"><input class="input" data-bk="d" value="${X.esc(l.d)}" aria-label="Descripción"><input class="input" data-bk="c" value="${X.esc(l.c || '')}" placeholder="Cant." aria-label="Cantidad"><input class="input num" data-bk="i" value="${+l.i ? X.fmt2(l.i) : ''}" placeholder="Ingreso" aria-label="Ingreso"><input class="input num" data-bk="x" value="${+l.x ? X.fmt2(l.x) : ''}" placeholder="Deducción" aria-label="Deducción"><button type="button" class="x" data-bldel aria-label="Quitar">×</button></div>`;
  X.openSheet(`<h2>Editar boleta</h2><p class="sub">${X.esc(c.nombre)} · ${b.tipo === 'Q1' ? 'Quincena' : 'Fin de mes'} ${b.periodo}</p><form id="f-bol" data-k="${cid}|${bid}">
   <div class="row2"><div class="field"><label for="bo-i">Fecha inicio</label><input class="input" type="date" id="bo-i" value="${b.inicio}"></div><div class="field"><label for="bo-f">Fecha fin</label><input class="input" type="date" id="bo-f" value="${b.fin}"></div></div>
   <div class="row2"><div class="field"><label for="bo-p">Fecha de pago</label><input class="input" type="date" id="bo-p" value="${b.pago}"></div><div class="field"><label for="bo-m">Motivo</label><input class="input" id="bo-m" value="${X.esc(b.motivo)}"></div></div>
   <div id="bo-l">${b.lineas.map(fila).join('')}</div><button type="button" class="btn btn-soft" id="bo-add" style="padding:.5rem 1rem;margin:6px 0 14px">+ Agregar línea</button>
   <div class="foot"><button type="button" class="btn btn-soft" data-close>Cancelar</button><button class="btn btn-red" type="submit">Guardar</button></div></form>`, true);
  $('#bo-add').onclick = () => $('#bo-l').insertAdjacentHTML('beforeend', fila({ d: '', i: 0, x: 0 }, Date.now()));
}

/* ---------- Excel ---------- */
const COLS = [['nombre', 'Nombre'], ['usuario', 'Usuario'], ['puesto', 'Puesto'], ['departamento', 'Departamento'], ['cedula', 'Cédula'], ['ingreso', 'Fecha de ingreso'], ['salario', 'Salario mensual'], ['vacaciones', 'Días de vacaciones'], ['banco', 'Banco'], ['cuenta', 'Cuenta']];
async function exportar(btn) {
  X.ocupado(btn, true);
  try { await X.cargar(['../lib/exceljs.min.js']); const wb = new window.ExcelJS.Workbook(), ws = wb.addWorksheet('Colaboradores');
    ws.columns = COLS.map(([k, t]) => ({ header: t, key: k, width: k === 'nombre' ? 32 : 18 })); ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF001489' } };
    Object.values(RH.colaboradores).sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(c => ws.addRow(c)); ws.getColumn('salario').numFmt = '"₡"#,##0.00';
    X.bajar(new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Colaboradores.xlsx'); X.toast('Listo: Colaboradores.xlsx');
  } catch (e) { console.error(e); X.toast('No se pudo generar el Excel.'); } finally { X.ocupado(btn, false); }
}
async function importar(file) {
  try { await X.cargar(['../lib/exceljs.min.js']); const wb = new window.ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer()); const ws = wb.worksheets[0];
    const head = {}; ws.getRow(1).eachCell((c, i) => { const t = X.normal(String(c.value || '')); const k = COLS.find(([, n]) => X.normal(n) === t); if (k) head[i] = k[0]; });
    const ids = [], uids = [], nuevos = [];
    ws.eachRow((row, r) => { if (r === 1) return; const o = {}; row.eachCell((c, i) => { if (head[i]) { let v = c.value; if (v instanceof Date) v = iso(new Date(v.getTime() + v.getTimezoneOffset() * 60000)); else if (v && typeof v === 'object' && 'result' in v) v = v.result; o[head[i]] = v; } });
      if (!o.nombre) return; o.usuario = String(o.usuario || sugerirUsuario(o.nombre)).toLowerCase(); o.salario = X.numDe(o.salario) || 0; o.vacaciones = X.numDe(o.vacaciones) || 0;
      let c = Object.values(RH.colaboradores).find(x => X.normal(x.usuario) === X.normal(o.usuario)); const id = c ? c.id : 'c-' + X.slug(o.usuario);
      RH.colaboradores[id] = Object.assign(c || { id }, o, { id }); ids.push(id);
      let u = Object.values(RH.usuarios).find(x => x.colabId === id); if (!u) { u = { id: 'r-' + X.slug(o.usuario), colabId: id, usuario: o.usuario, nombre: o.nombre, rol: 'colaborador', clave: X.genClave(), debeCambiar: true, activo: true }; RH.usuarios[u.id] = u; uids.push(u.id); nuevos.push(u); } });
    if (!ids.length) return X.toast('El archivo no trae colaboradores. Usá el formato de «Descargar Excel».');
    if (await guardarRH({ colabs: ids, usuarios: uids }, 'Cargar colaboradores desde Excel', null, ids.length + ' colaboradores actualizados')) { renderRH(); if (nuevos.length) X.openSheet(`<h2>Usuarios nuevos</h2><p class="sub">Entregá estos accesos de forma privada.</p><ul class="regs">${nuevos.map(u => `<li><span>${X.esc(u.nombre)}</span><b>${X.esc(u.usuario)} · ${X.esc(u.clave)}</b></li>`).join('')}</ul><div class="foot"><button type="button" class="btn btn-soft" data-close>Cerrar</button></div>`); }
  } catch (e) { console.error(e); X.toast('No se pudo leer el Excel.'); }
}

/* ---------- Selección de fechas en el calendario ---------- */
const diaDe = e => { const t = document.elementFromPoint(e.clientX, e.clientY); return t && t.closest && t.closest('#to-cal [data-dia]'); };
function pintarSel() { $$('#to-cal [data-dia]').forEach(x => { const s = x.dataset.dia; x.classList.toggle('sel', !!sel && s >= sel.a && s <= (sel.b || sel.a)); }); }
document.addEventListener('pointerdown', e => { const d = e.target.closest && e.target.closest('#to-cal [data-dia]'); if (!d || !X || d.dataset.dia < X.hoyISO) return;
  e.preventDefault(); arrastre = true; const a0 = d.dataset.dia; sel = { a: a0, b: null, ini0: () => a0 }; pintarSel(); });
document.addEventListener('pointermove', e => { if (!arrastre) return; const d = diaDe(e); if (!d) return; const s = d.dataset.dia;
  sel.b = s >= sel.ini0() ? s : null; if (s < sel.ini0()) { sel.a = s; sel.b = sel.ini0(); } pintarSel(); });
document.addEventListener('pointerup', () => { if (!arrastre) return; arrastre = false;
  if (!sel.b || sel.b === sel.a) { pintarSel(); X.toast('Arrastrá hasta la fecha final, o tocá la fecha final.'); sel.esperando = true; return; }
  formAusencia(sel.a, sel.b); });
document.addEventListener('click', e => { const d = e.target.closest && e.target.closest('#to-cal [data-dia]'); if (!d || !sel || !sel.esperando || arrastre) return;
  const s = d.dataset.dia; if (s === sel.a) return X.toast('La fecha de finalización no puede ser igual a la de inicio.'); const a = s < sel.a ? s : sel.a, b = s < sel.a ? sel.a : s; sel = { a, b }; pintarSel(); formAusencia(a, b); });

/* ---------- Eventos ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t || !X) return; const d = t.dataset;
  if (d.rhgo) { const [v, sub] = d.rhgo.split(':'); if (v === 'prc') { await misPendientes(); renderPRC(); } if (v === 'timeoff') { await misPendientes(); renderTimeOff(); } if (v === 'payroll') { tabPay = sub || 'boletas'; await misPendientes(); renderPayroll(); } if (v === 'rh') { tabRH = sub || (d.rhgo === 'rh' && MIA && !e.target.closest('#col-apps') ? 'solicitudes' : 'colaboradores'); renderRH(); } }
  if (d.pay) { tabPay = d.pay; renderPayroll(); }
  if (d.rhtab) { tabRH = d.rhtab; renderRH(); }
  if (t.id === 'to-prev') { mesVista.setMonth(mesVista.getMonth() - 1); renderTimeOff(); }
  if (t.id === 'to-next') { mesVista.setMonth(mesVista.getMonth() + 1); renderTimeOff(); }
  if (t.id === 'to-crear') formAusencia();
  if (d.verbol) { const b = MIA.boletas.find(x => x.id === d.verbol); X.toast('Generando…', 60000); visor(await pdfBoleta(MIA.colaborador, b, MIA.config)); }
  if (t.id === 'ca-ver') { X.ocupado(t, true); try { visor(await pdfCarta(MIA.colaborador, $('#ca-t').value, $('#ca-d').value.trim(), MIA.config, MIA.boletas)); } finally { X.ocupado(t, false); } }
  if (t.id === 'rh-new') colForm(null);
  if (d.edcol) colForm(d.edcol);
  if (d.clvcol) verClave(d.clvcol);
  if (t.id === 'rh-exp') exportar(t);
  if (t.id === 'rh-imp') $('#rh-file').click();
  if (d.genbol) { const per = $('#bol-per').value; if (!per) return X.toast('Elegí el mes'); let n = 0;
    Object.values(RH.colaboradores).forEach(c => { const l = RH.boletas[c.id] = RH.boletas[c.id] || []; if (!l.some(b => b.id === per + '-' + d.genbol)) { l.push(nuevaBoleta(c, per, d.genbol)); n++; } });
    if (!n) return X.toast('Ya existen esas boletas para el mes. Editalas desde la lista.');
    if (await guardarRH({ colabs: 'todos' }, 'Generar boletas ' + per, t, n + ' boletas publicadas')) renderRH(); }
  if (d.verbolrh) { const [cid, bid] = d.verbolrh.split('|'); visor(await pdfBoleta(RH.colaboradores[cid], RH.boletas[cid].find(b => b.id === bid), RH.config)); }
  if (d.edbol) { const [cid, bid] = d.edbol.split('|'); bolForm(cid, bid); }
  if (d.delbol) { const [cid, bid] = d.delbol.split('|'); RH.boletas[cid] = RH.boletas[cid].filter(b => b.id !== bid); if (await guardarRH({ colabs: [cid] }, 'Quitar boleta', t, 'Boleta quitada')) renderRH(); }
  if (d.bldel !== undefined) t.closest('.bl').remove();
  if (d.res) { const [cid, sid, est] = d.res.split('|'), s = RH.solicitudes[cid].find(x => x.id === sid), c = RH.colaboradores[cid];
    if (est === 'aprobado' && s.tipo === 'vacaciones') { if (s.dias > c.vacaciones) return X.toast('No le alcanza el saldo de vacaciones'); c.vacaciones = r2(c.vacaciones - s.dias); }
    Object.assign(s, { estado: est, resuelto: new Date().toISOString(), resolvio: X.S.uid || X.S.id });
    if (await guardarRH({ colabs: [cid] }, 'Resolver solicitud', t, est === 'aprobado' ? 'Solicitud aprobada' : 'Solicitud rechazada')) renderRH(); }
  if (t.id === 'rc-guardar') { const c = RH.config; c.empresa = $('#rc-emp').value.trim(); c.cedulaJuridica = $('#rc-ced').value.trim(); c.ciudad = $('#rc-ciu').value.trim(); c.firmante = $('#rc-fir').value.trim(); c.contacto = $('#rc-con').value.trim();
    c.ccss = X.numDe($('#rc-ccss').value) || 0; c.q1 = X.numDe($('#rc-q1').value) || 0; c.q2 = r2(100 - c.q1);
    c.feriados = $('#rc-fer').value.split('\n').map(l => l.trim()).filter(l => /^\d{4}-\d{2}-\d{2}\s+\S/.test(l)).map(l => ({ fecha: l.slice(0, 10), nombre: l.slice(10).trim() })).sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (await guardarRH({ colabs: 'todos' }, 'Configuración de RH', t, 'Configuración guardada')) renderRH(); }
});
document.addEventListener('change', e => { if (!X) return; const t = e.target;
  if (t.id === 'aus-i' || t.id === 'aus-f') { if (t.id === 'aus-i' && !$('#aus-f').value) $('#aus-f').value = t.value; calcAus(); }
  if (t.id === 'bol-per') { perBol = t.value; renderRH(); }
  if (t.id === 'rh-file' && t.files[0]) { importar(t.files[0]); t.value = ''; }
  if (t.id === 'cf-nombre' && !$('#cf-usuario').value) $('#cf-usuario').value = sugerirUsuario(t.value);
});
document.addEventListener('submit', async e => { if (!X) return; const f = e.target;
  if (f.id === 'f-aus') { e.preventDefault(); const a = calcAus(); if (!a) return; const btn = f.querySelector('[type=submit]'); X.ocupado(btn, true);
    try { const s = await enviarSolicitud('vacaciones', Object.assign(a, { comentario: $('#aus-c').value.trim() })); if (s) { pendientesMias.push(s); X.closeSheet(); X.toast('Solicitud enviada a la Dirección Ejecutiva'); renderTimeOff(); } } catch (er) { console.error(er); X.toast('No se pudo enviar la solicitud.'); } finally { X.ocupado(btn, false); } }
  if (f.id === 'f-horas') { e.preventDefault(); const h = X.numDe($('#hx-h').value), m = $('#hx-m').value.trim(), fe = $('#hx-f').value; if (!(h > 0) || !m || !fe) return X.toast('Completá la fecha, las horas y el motivo');
    try { const s = await enviarSolicitud('horas', { fecha: fe, horas: h, motivo: m }); if (s) { pendientesMias.push(s); X.toast('Solicitud de horas extra enviada'); renderPayroll(); } } catch (er) { console.error(er); X.toast('No se pudo enviar la solicitud.'); } }
  if (f.id === 'f-col') { e.preventDefault(); guardarCol(f); }
  if (f.id === 'f-bol') { e.preventDefault(); const [cid, bid] = f.dataset.k.split('|'), b = RH.boletas[cid].find(x => x.id === bid);
    Object.assign(b, { inicio: $('#bo-i').value, fin: $('#bo-f').value, pago: $('#bo-p').value, motivo: $('#bo-m').value.trim() });
    b.lineas = [...$$('#bo-l .bl')].map(r => { const g = k => r.querySelector(`[data-bk="${k}"]`).value; return { d: g('d').trim(), c: g('c').trim(), i: X.numDe(g('i')) || 0, x: X.numDe(g('x')) || 0 }; }).filter(l => l.d);
    if (await guardarRH({ colabs: [cid] }, 'Editar boleta', f.querySelector('[type=submit]'), 'Boleta guardada')) { X.closeSheet(); renderRH(); } }
}, true);

window.RH = { async iniciar(ctx) { X = ctx; try { await cargarDatos(); } catch (e) { console.error(e); ctx.toast('No se pudieron cargar los datos de colaboradores.'); } renderInicio(); }, letras, _pdf: { pdfBoleta, pdfCarta } };
})();
