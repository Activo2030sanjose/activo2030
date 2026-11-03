/*
 * Registro de asistencia de una sesión del pleno, membretado con el logo del club.
 * Usa la misma letra (Arimo, con ₡) que el estado de cuenta.
 */
(function (global) {
  'use strict';
  var C = { navy: [0, 32, 96], azul: [0, 20, 137], rojo: [218, 41, 28], amarillo: [254, 221, 0], celeste: [220, 232, 246],
    linea: [170, 170, 170], texto: [30, 30, 30], gris: [100, 100, 100], ok: [13, 122, 60], warn: [176, 112, 0] };
  var ETQ = { A: 'Presente', J: 'Inasistencia justificada', I: 'Inasistencia injustificada' };
  var X0 = 18.3, ANCHO = 173.4;
  function num(n) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  /* r: registro de la sesión ya calculado (ver index.html → datosAsistencia) */
  function generar(r, cfg, logo) {
    var JS = global.jspdf.jsPDF, doc = new JS({ unit: 'mm', format: 'a4' }), F = global.FUENTES_PDF;
    doc.addFileToVFS('Arimo-Regular.ttf', F.regular); doc.addFont('Arimo-Regular.ttf', 'Arimo', 'normal');
    doc.addFileToVFS('Arimo-Bold.ttf', F.bold); doc.addFont('Arimo-Bold.ttf', 'Arimo', 'bold');
    doc.addFont('Arimo-Regular.ttf', 'Arimo', 'italic');
    doc.setProperties({ title: 'Registro de asistencia - Sesión ' + r.n, author: r.macero, creator: cfg.club });

    function membrete() {
      if (logo) doc.addImage(logo, 'PNG', 18, 12, 24, 24);
      doc.setTextColor.apply(doc, C.texto); doc.setFont('Arimo', 'bold'); doc.setFontSize(11.5);
      doc.text(cfg.club.toUpperCase(), 46, 20);
      doc.setFontSize(9.5); doc.text('MACERÍA · REGISTRO DE ASISTENCIA', 46, 25.5);
      doc.setFont('Arimo', 'normal'); doc.setFontSize(9); doc.setTextColor.apply(doc, C.gris);
      doc.text('Periodo ' + cfg.periodo, 46, 30.5);
      // franja del manual de marca: amarillo, rojo, azul
      var y = 38.5, w = ANCHO;
      doc.setFillColor.apply(doc, C.amarillo); doc.rect(X0, y, w * 0.2, 1.6, 'F');
      doc.setFillColor.apply(doc, C.rojo); doc.rect(X0 + w * 0.2, y, w * 0.3, 1.6, 'F');
      doc.setFillColor.apply(doc, C.azul); doc.rect(X0 + w * 0.5, y, w * 0.5, 1.6, 'F');
    }
    function pie(p, total) {
      doc.setFont('Arimo', 'normal'); doc.setFontSize(7); doc.setTextColor.apply(doc, C.gris);
      doc.text('«La juventud para ser servida debe servir»', X0, 287);
      doc.text('Generado el ' + r.generado + ' · Página ' + p + ' de ' + total, X0 + ANCHO, 287, { align: 'right' });
    }

    membrete();
    doc.setFont('Arimo', 'bold'); doc.setFontSize(16); doc.setTextColor.apply(doc, C.navy);
    doc.text('SESIÓN ' + r.n + (r.extraordinaria ? ' · EXTRAORDINARIA' : ' · ORDINARIA'), X0, 50);

    var base = { theme: 'grid', margin: { left: X0, right: 210 - X0 - ANCHO, top: 46, bottom: 18 },
      styles: { font: 'Arimo', fontSize: 8, cellPadding: 1.3, lineColor: C.linea, lineWidth: 0.15, textColor: C.texto, valign: 'middle' },
      headStyles: { fillColor: C.navy, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      didDrawPage: function () { if (doc.internal.getNumberOfPages() > 1 && doc.internal.getCurrentPageInfo().pageNumber > 1) membrete(); } };

    // Datos de la sesión
    doc.autoTable(Object.assign({}, base, {
      startY: 54, theme: 'plain', styles: Object.assign({}, base.styles, { lineWidth: 0, fontSize: 8.4, cellPadding: { top: 1, bottom: 1, left: 0, right: 2 } }),
      columnStyles: { 0: { cellWidth: 34, fontStyle: 'bold', textColor: C.gris }, 1: { cellWidth: 52 }, 2: { cellWidth: 34, fontStyle: 'bold', textColor: C.gris }, 3: { cellWidth: 53.4 } },
      body: [
        ['Fecha', r.fechaLarga, 'Macero en turno', r.macero],
        ['Hora de inicio', r.hora, 'Registrado por', r.registradoPor],
        ['Convocatoria', r.conv, 'Tipo de cambio', r.tc ? '₡' + num(r.tc) + ' por US$' : 'No aplica']
      ]
    }));

    // Resumen
    var t = r.totales;
    doc.autoTable(Object.assign({}, base, {
      startY: doc.lastAutoTable.finalY + 4,
      head: [['Presentes', 'Justificadas', 'Injustificadas', 'SINPE', 'Efectivo', 'Total recaudado', 'Pendiente y cargos']],
      styles: Object.assign({}, base.styles, { halign: 'center', fontSize: 8.4 }),
      headStyles: Object.assign({}, base.headStyles, { fontSize: 7.4, fillColor: C.celeste, textColor: C.texto }),
      body: [[String(t.A), String(t.J), String(t.I), '₡' + num(t.sinpe), '₡' + num(t.efectivo), { content: '₡' + num(t.total), styles: { fontStyle: 'bold' } }, '₡' + num(t.cargos + (t.pendiente || 0))]]
        .concat(t.usd ? [[{ content: 'Incluye pagos en dólares por US$' + num(t.usd) + ', convertidos con el tipo de cambio de la sesión.', colSpan: 7, styles: { fontSize: 7, textColor: C.gris, fontStyle: 'italic' } }]] : [])
    }));

    // Lista
    var head = ['#', 'Compañero', 'Asistencia', 'Medio', 'Pagado', 'Monto en ₡'].concat(r.campos);
    var cs = { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: r.campos.length ? 40 : 64.4 }, 2: { cellWidth: 32 }, 3: { cellWidth: 17, halign: 'center' }, 4: { cellWidth: 27, halign: 'right' }, 5: { cellWidth: 25, halign: 'right' } };
    doc.autoTable(Object.assign({}, base, {
      startY: doc.lastAutoTable.finalY + 5,
      head: [head], columnStyles: cs, headStyles: Object.assign({}, base.headStyles, { fontSize: 7.6 }),
      body: r.filas.map(function (f, i) {
        var color = f.estado === 'A' ? C.ok : f.estado === 'J' ? C.warn : C.rojo;
        return [String(i + 1), f.nombre + (f.agregado ? ' (agregado)' : ''), { content: ETQ[f.estado], styles: { textColor: color, fontStyle: 'bold', fontSize: 7.4 } },
          f.estado === 'A' ? f.medio : (r.extraordinaria ? '-' : 'Pendiente'), f.estado === 'A' ? (f.medio === 'Pendiente' ? { content: 'Pendiente ₡' + num(f.pendiente || f.cargo), styles: { textColor: C.rojo, fontStyle: 'bold' } } : (f.moneda === 'USD' ? 'US$' : '₡') + num(f.monto) + (f.pendiente ? ' · debe ₡' + num(f.pendiente) : '')) : (r.extraordinaria ? 'No se cobra' : { content: 'Pendiente ₡' + num(f.cargo), styles: { textColor: C.rojo, fontStyle: 'bold' } }),
          f.estado === 'A' ? '₡' + num(f.montoCRC) : '-'].concat(r.campos.map(function (c, j) { return f.extras[j] || ''; }));
      }),
      alternateRowStyles: { fillColor: [247, 248, 252] }
    }));

    // Firma del macero
    var y = doc.lastAutoTable.finalY + 26;
    if (y > 262) { doc.addPage(); membrete(); y = 74; }
    doc.setFont('Arimo', 'bold'); doc.setFontSize(9); doc.setTextColor.apply(doc, C.navy); doc.text('FIRMAS', X0, y - 14);
    var ancho = (ANCHO - 12) / 3, firmas = [[r.macero, 'Macero en turno · Sesión ' + r.n], ['', 'Asesor(a) · Nombre y firma'], ['', 'Asesor(a) · Nombre y firma']];
    firmas.forEach(function (f, i) {
      var x = X0 + i * (ancho + 6);
      doc.setDrawColor.apply(doc, C.texto); doc.setLineWidth(0.2); doc.line(x, y, x + ancho, y);
      doc.setFont('Arimo', 'bold'); doc.setFontSize(8.2); doc.setTextColor.apply(doc, C.texto); if (f[0]) doc.text(doc.splitTextToSize(f[0], ancho)[0], x, y + 4.5);
      doc.setFont('Arimo', 'normal'); doc.setFontSize(7.4); doc.setTextColor.apply(doc, C.gris); doc.text(f[1], x, y + (f[0] ? 8.8 : 4.5));
    });
    doc.setFont('Arimo', 'normal'); doc.setFontSize(7); doc.setTextColor.apply(doc, C.gris);
    doc.text('Fecha de revisión: ____ / ____ / ________', X0, y + 18);

    var tot = doc.internal.getNumberOfPages();
    for (var p = 1; p <= tot; p++) { doc.setPage(p); pie(p, tot); }
    return { doc: doc, archivo: 'Asistencia_Sesion_' + r.n + '_' + r.fechaCorta + '.pdf' };
  }
  global.AsistenciaPDF = { generar: generar };
})(typeof window !== 'undefined' ? window : globalThis);
