/* Operaciones compartidas entre el portal y el proceso automático del buzón. */
(function (global) {
  'use strict';
  var numDe = function (v) { var x = parseFloat(String(v == null ? '' : v).replace(/[₡$,\s]/g, '')); return isNaN(x) ? NaN : x; };
  /* Aplica un registro de Soy Macero a la sesión y al estado de cuenta de cada socio. */
  function aplicarSesion(D, p) {
    var prev = D.sesiones[p.n] || {};
    D.sesiones[p.n] = Object.assign(prev, { fecha: p.fecha, hora: p.hora, conv: p.conv, extraordinaria: p.extraordinaria, cobra: p.cobra, tc: p.tc, campos: p.campos, macero: p.macero, registradoPor: p.registradoPor, registrado: p.registrado, filas: p.filas });
    p.filas.forEach(function (f) {
      if (!f.socioId) { (D.revisar = D.revisar || []).push({ texto: 'Sesión ' + p.n + ': «' + f.nombre + '» se agregó a mano. Vinculalo a un socio desde su estado de cuenta si corresponde.' }); return; }
      var s = D.socios[f.socioId]; if (!s) return; s.sesiones = s.sesiones || {};
      var pagoOrig = f.estado === 'A' && p.cobra ? numDe(f.pagado) || 0 : 0, crc = f.moneda === 'USD' ? Math.round(pagoOrig * p.tc * 100) / 100 : pagoOrig;
      var extras = (p.campos || []).map(function (c, j) { return f.extras && f.extras[j] ? c + ': ' + f.extras[j] : ''; }).filter(Boolean).join(' | ');
      s.sesiones[p.n] = { asistencia: f.estado, cargo: f.estado === 'A' ? (p.cobra ? numDe(f.cargo) || 0 : 0) : null, monto: crc, moneda: pagoOrig ? f.moneda : '', montoUSD: f.moneda === 'USD' ? pagoOrig : 0, tc: f.moneda === 'USD' ? p.tc : 0,
        medio: crc ? f.medio : '', fechaPago: crc ? p.fecha : '', obs: extras };
    });
  }
  /* Texto de la notificación automática con los datos de cada socio. */
  function plantilla(txt, datos) { return String(txt || '').replace(/\{(\w+)\}/g, function (m, k) { return datos[k] != null ? datos[k] : m; }); }
  global.Operaciones = { aplicarSesion: aplicarSesion, plantilla: plantilla, numDe: numDe };
})(typeof window !== 'undefined' ? window : globalThis);
