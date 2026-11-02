/* Estado de cuenta en Excel: una hoja por socio y, en el general, una hoja «Resumen». Usa ExcelJS. */
(function (global) {
  'use strict';
  var EC = global.EstadoCuenta;
  var NAVY = 'FF002060', CEL = 'FFDCE8F6', AMA = 'FFFFC000', VER = 'FF92D050', ROJO = 'FFE60000';
  var MON = '"₡"#,##0.00;-"₡"#,##0.00;"₡ -"';
  var borde = { style: 'thin', color: { argb: 'FF969696' } };
  var B = { top: borde, left: borde, bottom: borde, right: borde };

  function nombreHoja(n, usados) {
    var b = n.replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 28), x = b, i = 2;
    while (usados[x]) x = b.slice(0, 25) + ' ' + i++;
    usados[x] = 1; return x;
  }
  function titulo(ws, fila, texto) {
    ws.mergeCells(fila, 1, fila, 7);
    var c = ws.getCell(fila, 1); c.value = texto;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }; c.alignment = { horizontal: 'center' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  }
  function encabezado(ws, fila, cols) {
    cols.forEach(function (t, i) {
      var c = ws.getCell(fila, i + 1); c.value = t; c.font = { bold: true }; c.border = B;
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CEL } };
    });
  }
  function filaDatos(ws, fila, vals, monedas, relleno, color) {
    vals.forEach(function (v, i) {
      var c = ws.getCell(fila, i + 1); c.value = v; c.border = B;
      if (monedas.indexOf(i) >= 0 && typeof v === 'number') c.numFmt = MON;
      if (relleno) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: relleno } };
      if (color) c.font = { bold: true, color: { argb: color } };
    });
  }

  function hojaSocio(wb, socio, cfg, corte, logoId, usados) {
    var e = EC.calcular(socio, cfg, corte);
    var ws = wb.addWorksheet(nombreHoja(socio.nombre, usados), { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.columns = [{ width: 14 }, { width: 14 }, { width: 14 }, { width: 15 }, { width: 15 }, { width: 13 }, { width: 46 }];
    if (logoId != null) ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 92, height: 92 } });
    [[cfg.club.toUpperCase(), true, 13], [cfg.tesoreria.toUpperCase(), true, 12], ['PERIODO ' + cfg.periodo, false, 11], ['Emitido por: ' + cfg.emitidoPor, true, 8]]
      .forEach(function (x, i) { var c = ws.getCell(i + 1, 3); c.value = x[0]; c.font = { bold: x[1], size: x[2] }; });
    ws.mergeCells(6, 1, 6, 7); var t = ws.getCell(6, 1);
    t.value = 'ESTADO DE CUENTA ' + e.mesCorte.toUpperCase(); t.font = { bold: true, size: 15, color: { argb: 'FF0B2A7A' } }; t.alignment = { horizontal: 'center' };

    var f = 8;
    [['Socio:', socio.nombre], ['Fecha de corte:', e.corteLarga], ['Cuenta bancaria (socios):', cfg.cuentaNombre], ['IBAN:', 'IBAN: ' + cfg.iban],
     ['SINPE Móvil:', cfg.sinpe], ['Calificación de asistencia:', Math.round(e.asistencia * 100) + '%'], ['Total por pagar:', e.totalPendiente]].concat(e.usdPendiente ? [['Por pagar en dólares:', 'US$' + e.usdPendiente.toFixed(2)]] : [])
      .forEach(function (x, i) {
        var a = ws.getCell(f + i, 1), b = ws.getCell(f + i, 3); ws.mergeCells(f + i, 1, f + i, 2); ws.mergeCells(f + i, 3, f + i, 4);
        a.value = x[0]; a.font = { bold: true }; b.value = x[1]; a.border = b.border = B;
        if (i >= 6) { a.font = b.font = { bold: true, color: { argb: ROJO }, size: 12 }; if (i === 6) b.numFmt = MON; }
      });
    var mf = f; ws.getCell(mf, 6).value = 'Montos establecidos'; ws.getCell(mf, 6).font = { bold: true };
    EC.montosDe(cfg).forEach(function (m, i) { ws.getCell(mf + 1 + i, 6).value = '• ' + m.concepto; var c = ws.getCell(mf + 1 + i, 7); c.value = +m.monto; c.numFmt = MON; });

    f = Math.max(f + (e.usdPendiente ? 9 : 8), mf + EC.montosDe(cfg).length + 2);
    titulo(ws, f, 'RESUMEN DEL ESTADO DE CUENTA'); encabezado(ws, f + 1, ['Concepto', '', '', 'Total pagado', 'Pendiente']);
    e.resumen.forEach(function (r, i) { filaDatos(ws, f + 2 + i, [r.concepto, '', '', r.pagado, r.pendiente], [3, 4]); });
    filaDatos(ws, f + 5, ['TOTAL', '', '', e.totalPagado, e.totalPendiente], [3, 4], AMA);

    f += 8; titulo(ws, f, 'CUOTAS DE MEMBRESÍA'); encabezado(ws, f + 1, ['Mes', 'Medio', 'Fecha de pago', 'Pago', 'Pendiente', '', 'Observación']);
    e.cuotas.forEach(function (c, i) { filaDatos(ws, f + 2 + i, [c.mes, c.medio, c.fecha, c.usado ? c.pago : '', c.usado ? c.pendiente : '', '', c.obs], [3, 4]); });
    f += 2 + e.cuotas.length; filaDatos(ws, f, ['TOTAL', '', '', e.resumen[0].pagado, e.resumen[0].pendiente], [3, 4], AMA);

    f += 3; titulo(ws, f, 'CUOTAS DE MACERÍAS E INASISTENCIAS');
    encabezado(ws, f + 1, ['N° de sesión', 'Fecha de sesión', 'Fecha de pago', 'Monto pagado', 'Pendiente', 'Medio', 'Concepto | Observación']);
    e.sesiones.forEach(function (s, i) {
      if (s.vacia || s.noAplica || (s.sinRegistro && !s.sinCobro)) return filaDatos(ws, f + 2 + i, [s.n, s.fecha || '', '', '', '', '', s.obs || ''], []);
      if (s.sinCobro) return filaDatos(ws, f + 2 + i, [s.n, s.fecha, 'N/A', '-', '-', '', s.obs], [], VER, 'FFFFFFFF');
      filaDatos(ws, f + 2 + i, [s.n, s.fecha, s.fechaPago, s.monto, s.pendiente, s.medio, s.obs], [3, 4]);
    });
    f += 2 + e.sesiones.length; filaDatos(ws, f, ['TOTAL', '', '', e.resumen[1].pagado, e.resumen[1].pendiente], [3, 4], AMA);

    f += 3; titulo(ws, f, 'PORCENTAJE DE ASISTENCIA');
    ws.getCell(f + 1, 1).value = 'Asistencia: 1 punto | Inasistencia justificada: 0,5 puntos | Inasistencia injustificada: 0 puntos';
    ws.getCell(f + 1, 7).value = 'Porcentaje: ' + Math.round(e.asistencia * 100) + '%'; ws.getCell(f + 1, 7).font = { bold: true, color: { argb: ROJO } };
    encabezado(ws, f + 2, ['Sesión', 'Puntuación', 'Sesión', 'Puntuación', 'Sesión', 'Puntuación']);
    var hs = e.sesiones, filas = Math.ceil(hs.length / 3);
    for (var r = 0; r < filas; r++) {
      var v = [];
      for (var k = 0; k < 3; k++) { var s = hs[k * filas + r]; v.push(s ? s.n : '', s && s.puntos != null ? s.puntos : ''); }
      filaDatos(ws, f + 3 + r, v, []);
    }
    f += 4 + filas; titulo(ws, f, 'OTRAS CUOTAS'); encabezado(ws, f + 1, ['Concepto', '', '', 'Pagado', 'Por pagar', 'Método', 'Fecha de pago']);
    if (!e.otras.length) filaDatos(ws, f + 2, ['Sin transacciones registradas en el periodo', '', '', '', '', '', ''], []);
    e.otras.forEach(function (o, i) { if (o.enDolares) filaDatos(ws, f + 2 + i, [o.concepto, '', '', o.pagadoUSD ? 'US$' + o.pagadoUSD.toFixed(2) : '', o.usd ? 'US$' + o.usd.toFixed(2) : '', o.metodo, o.fecha], []); else filaDatos(ws, f + 2 + i, [o.concepto, '', '', o.pagado, o.porPagar, o.metodo, o.fecha], [3, 4]); });
    f += 3 + Math.max(1, e.otras.length); titulo(ws, f, 'OBSERVACIONES');
    ws.mergeCells(f + 1, 1, f + 4, 7); var ob = ws.getCell(f + 1, 1); ob.value = socio.observaciones || ''; ob.alignment = { vertical: 'top', wrapText: true };
    ob.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CEL } };
    return e;
  }

  /* socios: lista; corte: 'YYYY-MM-DD'; logo: dataURL. Devuelve un Blob .xlsx */
  async function generar(socios, cfg, corte, logo, general) {
    var wb = new global.ExcelJS.Workbook(); wb.creator = cfg.club + ' - ' + cfg.tesoreria;
    var logoId = logo ? wb.addImage({ base64: logo.split(',')[1], extension: 'png' }) : null, usados = {};
    var res = null, filas = [];
    if (general) { res = wb.addWorksheet('Resumen'); usados.Resumen = 1; }
    socios.forEach(function (s) { var e = hojaSocio(wb, s, cfg, corte, logoId, usados); filas.push([s.nombre, s.estado || 'activo', e.resumen[0].pendiente, e.resumen[1].pendiente, e.resumen[2].pendiente, e.totalPendiente, e.asistencia, e.usdPendiente || 0]); });
    if (res) {
      res.columns = [{ width: 34 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 }, { width: 16 }];
      res.mergeCells(1, 1, 1, 7); res.getCell(1, 1).value = 'CONSOLIDADO DE SOCIOS · CORTE ' + EC.larga(corte).toUpperCase(); res.getCell(1, 1).font = { bold: true, size: 13 };
      encabezado(res, 3, ['Socio', 'Estado', 'Membresía pendiente', 'Macerías pendiente', 'Otras pendiente', 'Total por pagar', 'Asistencia', 'Por pagar en dólares']);
      filas.forEach(function (x, i) { filaDatos(res, 4 + i, x, [2, 3, 4, 5]); res.getCell(4 + i, 7).numFmt = '0%'; res.getCell(4 + i, 8).numFmt = '"US$"#,##0.00;-"US$"#,##0.00;"-"'; });
      var t = 4 + filas.length, sum = function (k) { return filas.reduce(function (a, x) { return a + x[k]; }, 0); };
      filaDatos(res, t, ['TOTAL', '', sum(2), sum(3), sum(4), sum(5), '', sum(7)], [2, 3, 4, 5], AMA); res.getCell(t, 8).numFmt = '"US$"#,##0.00';
    }
    var buf = await wb.xlsx.writeBuffer();
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  global.EstadoExcel = { generar: generar };
})(typeof window !== 'undefined' ? window : globalThis);
