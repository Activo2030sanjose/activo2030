/* Avatar 3D personalizable (SVG con luces y sombras). Avatar.svg(cfg) dibuja; Avatar.montar(el, cfg, alGuardar) arma el editor. */
(function (global) {
  'use strict';
  var PIEL = ['#f9dcc4', '#f1c19b', '#d9a066', '#b97a4a', '#8d5432', '#5e3620'];
  var PELO = { negro: '#1e1a1a', castano: '#5a3622', rubio: '#e2b552', pelirrojo: '#b4461f', canoso: '#c9c9cf', azul: '#1f3fd6' };
  var OJOS = { cafe: '#5b3a1f', negro: '#1d1b1b', miel: '#a8741e', verde: '#3d8a4a', azul: '#2f6fd1', gris: '#7d8796' };
  var ROPA = { chaleco: 'Chaleco Activo', camisa: 'Camisa', saco: 'Saco', camiseta: 'Camiseta' };
  var FONDO = ['#2f7bff', '#fedd00', '#da291c', '#001489', '#eef2fb', '#4fbf8a'];
  var DEF = { sexo: 'h', piel: 2, cara: 'ovalada', ojos: 'normal', colorOjos: 'cafe', cejas: 'normal', nariz: 'boton', boca: 'sonrisa', pelo: 'corto', colorPelo: 'negro', barba: 'no', lentes: 'no', ropa: 'chaleco', colorRopa: '#ffffff', fondo: 0 };

  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function tono(h, k) { var c = hex(h).map(function (v) { return Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)); }); return '#' + c.map(function (v) { return ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2); }).join(''); }
  var n = 0;
  function base(sexo) { var c = Object.assign({}, DEF); c.sexo = sexo; if (sexo === 'm') { c.pelo = 'largo'; c.colorPelo = 'castano'; c.ojos = 'grandes'; c.cejas = 'finas'; c.boca = 'sonrisa'; } return c; }
  function limpio(cfg) { return Object.assign({}, DEF, cfg && typeof cfg === 'object' ? cfg : {}); }

  function svg(cfg, opciones) {
    var c = limpio(cfg), id = 'av' + (++n), sk = PIEL[c.piel] || PIEL[2], hp = PELO[c.colorPelo] || PELO.negro, ey = OJOS[c.colorOjos] || OJOS.cafe;
    var m = c.sexo === 'm', o = opciones || {};
    var g = '<defs>' +
      '<radialGradient id="' + id + 'f" cx="35%" cy="25%" r="85%"><stop offset="0" stop-color="' + tono(FONDO[c.fondo] || FONDO[0], .35) + '"/><stop offset="1" stop-color="' + tono(FONDO[c.fondo] || FONDO[0], -.25) + '"/></radialGradient>' +
      '<radialGradient id="' + id + 's" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="' + tono(sk, .28) + '"/><stop offset=".6" stop-color="' + sk + '"/><stop offset="1" stop-color="' + tono(sk, -.28) + '"/></radialGradient>' +
      '<radialGradient id="' + id + 'h" cx="35%" cy="20%" r="85%"><stop offset="0" stop-color="' + tono(hp, .35) + '"/><stop offset=".55" stop-color="' + hp + '"/><stop offset="1" stop-color="' + tono(hp, -.35) + '"/></radialGradient>' +
      '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<clipPath id="' + id + 'c"><circle cx="100" cy="100" r="100"/></clipPath>' +
      '</defs>';
    var s = g + '<g clip-path="url(#' + id + 'c)">';
    if (!o.sinFondo) s += '<circle cx="100" cy="100" r="100" fill="url(#' + id + 'f)"/>';
    // pelo de atrás
    var hb = { largo: 'M52 92C46 140 50 178 62 196H138C150 178 154 140 148 92C140 52 60 52 52 92Z', medio: 'M54 92C50 120 54 134 62 140H138C146 134 150 120 146 92C138 54 62 54 54 92Z', mono: '' }[c.pelo];
    if (hb) s += '<path d="' + hb + '" fill="url(#' + id + 'h)"/>';
    if (c.pelo === 'mono') s += '<circle cx="100" cy="40" r="20" fill="url(#' + id + 'h)"/>';
    // cuello y cuerpo
    s += '<path d="M84 124h32v26c0 8-32 8-32 0z" fill="' + tono(sk, -.18) + '"/>';
    var hom = m ? 'M34 210C34 166 60 148 100 148S166 166 166 210Z' : 'M40 210C40 168 64 150 100 150S160 168 160 210Z';
    s += ropa(c, hom, id);
    // orejas
    s += '<ellipse cx="58" cy="96" rx="8" ry="11" fill="' + tono(sk, -.1) + '"/><ellipse cx="142" cy="96" rx="8" ry="11" fill="' + tono(sk, -.1) + '"/>';
    if (m) s += '<circle cx="58" cy="108" r="2.6" fill="#fedd00"/><circle cx="142" cy="108" r="2.6" fill="#fedd00"/>';
    // cabeza
    var cab = c.cara === 'redonda' ? '<ellipse cx="100" cy="92" rx="43" ry="44"/>' : c.cara === 'cuadrada' ? '<rect x="58" y="48" width="84" height="88" rx="30"/>' : '<ellipse cx="100" cy="92" rx="40" ry="46"/>';
    s += cab.replace('/>', ' fill="url(#' + id + 's)"/>');
    s += '<ellipse cx="78" cy="108" rx="8" ry="5" fill="#ff7a7a" opacity=".25"/><ellipse cx="122" cy="108" rx="8" ry="5" fill="#ff7a7a" opacity=".25"/>';
    // ojos
    s += ojos(c, ey, m);
    // cejas
    var cw = c.cejas === 'gruesas' ? 5 : c.cejas === 'finas' ? 2.2 : 3.4, cc = tono(hp === PELO.canoso ? '#8a8a90' : hp, -.15);
    s += '<path d="M74 77q9-6 18-1M108 76q9-5 18 1" fill="none" stroke="' + cc + '" stroke-width="' + cw + '" stroke-linecap="round"/>';
    // nariz
    s += { boton: '<ellipse cx="100" cy="102" rx="5.5" ry="4.5" fill="' + tono(sk, -.12) + '"/><circle cx="98" cy="100.5" r="1.6" fill="#fff" opacity=".5"/>',
      recta: '<path d="M100 88v14q-4 2-6 1" fill="none" stroke="' + tono(sk, -.3) + '" stroke-width="2.6" stroke-linecap="round"/>',
      ancha: '<path d="M92 104q8 5 16 0" fill="none" stroke="' + tono(sk, -.3) + '" stroke-width="2.8" stroke-linecap="round"/><ellipse cx="100" cy="100" rx="8" ry="5" fill="' + tono(sk, -.1) + '"/>' }[c.nariz] || '';
    // barba
    if (c.barba === 'completa') s += '<path d="M60 96C60 140 80 142 100 142S140 140 140 96C134 118 122 122 100 122S66 118 60 96Z" fill="url(#' + id + 'h)"/>';
    if (c.barba === 'corta') s += '<path d="M62 100C64 134 82 140 100 140S136 134 138 100C130 120 118 126 100 126S70 120 62 100Z" fill="' + hp + '" opacity=".55"/>';
    if (c.barba === 'bigote' || c.barba === 'completa') s += '<path d="M86 113q7-6 14-1q7-5 14 1q-7 3-14 0q-7 3-14 0z" fill="' + tono(hp, -.1) + '"/>';
    // boca
    var lc = m ? '#c9475a' : '#9b3b3b';
    s += { sonrisa: '<path d="M88 117q12 10 24 0" fill="none" stroke="' + lc + '" stroke-width="3.4" stroke-linecap="round"/>',
      amplia: '<path d="M86 114q14 2 28 0q-2 16-14 16t-14-16z" fill="#7a1f2b"/><path d="M89 115q11 2 22 0v3q-11 2-22 0z" fill="#fff"/>',
      abierta: '<ellipse cx="100" cy="119" rx="7" ry="6" fill="#7a1f2b"/><ellipse cx="100" cy="122" rx="4" ry="2.4" fill="#f27a8a"/>',
      seria: '<path d="M90 119h20" stroke="' + lc + '" stroke-width="3.2" stroke-linecap="round"/>' }[c.boca] || '';
    if (m && c.boca !== 'amplia' && c.boca !== 'abierta') s = s.replace(/stroke="#c9475a" stroke-width="3.4"/, 'stroke="#c9475a" stroke-width="4"');
    // pelo de adelante
    s += peloFrente(c, id);
    // lentes
    if (c.lentes === 'redondos') s += '<g fill="#fff" fill-opacity=".18" stroke="#1d1b2e" stroke-width="3"><circle cx="83" cy="91" r="12"/><circle cx="117" cy="91" r="12"/><path d="M95 91h10" fill="none"/></g>';
    if (c.lentes === 'cuadrados') s += '<g fill="#fff" fill-opacity=".18" stroke="#1d1b2e" stroke-width="3"><rect x="69" y="81" width="28" height="20" rx="6"/><rect x="103" y="81" width="28" height="20" rx="6"/><path d="M97 90h6" fill="none"/></g>';
    // brillo general
    s += '<ellipse cx="86" cy="62" rx="22" ry="12" fill="url(#' + id + 'b)" opacity=".6" transform="rotate(-18 86 62)"/>';
    s += '</g>';
    return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Avatar">' + s + '</svg>';
  }
  function ojos(c, ey, m) {
    var r = c.ojos === 'grandes' ? 8 : 6.5, out = '';
    [83, 117].forEach(function (x) {
      if (c.ojos === 'felices') { out += '<path d="M' + (x - 7) + ' 93q7-8 14 0" fill="none" stroke="#2a1d1d" stroke-width="3.2" stroke-linecap="round"/>'; return; }
      var ry = c.ojos === 'almendra' ? r * .72 : r;
      out += '<ellipse cx="' + x + '" cy="91" rx="' + (r + 1.5) + '" ry="' + (ry + 1.5) + '" fill="#fff"/>' +
        '<circle cx="' + x + '" cy="92" r="' + (ry * .78) + '" fill="' + ey + '"/><circle cx="' + x + '" cy="92" r="' + (ry * .4) + '" fill="#0d0b0b"/>' +
        '<circle cx="' + (x - 2.2) + '" cy="89.3" r="' + (ry * .28) + '" fill="#fff"/>';
      if (m) out += '<path d="M' + (x - r - 2) + ' ' + (91 - ry) + 'q' + (r + 2) + ' -5 ' + (2 * r + 4) + ' 0" fill="none" stroke="#1d1515" stroke-width="2.4" stroke-linecap="round"/>';
    });
    return out;
  }
  function ropa(c, hom, id) {
    var s = '';
    if (c.ropa === 'chaleco') {
      s += '<path d="' + hom + '" fill="#ffffff"/>';
      s += '<path d="M40 210C40 170 58 154 84 150L100 196L116 150C142 154 160 170 160 210Z" fill="#f7861a"/>';
      s += '<path d="M84 150L100 196L116 150" fill="none" stroke="#da291c" stroke-width="4"/><path d="M40 210C40 170 58 154 84 150M160 210C160 170 142 154 116 150" fill="none" stroke="#da291c" stroke-width="4"/>';
      s += '<rect x="122" y="164" width="24" height="9" rx="3" fill="#1f3fd6" stroke="#fff" stroke-width="1.2"/>';
      s += '<circle cx="134" cy="186" r="8" fill="#fedd00"/><circle cx="134" cy="186" r="5.5" fill="#da291c"/><circle cx="134" cy="186" r="3" fill="#fff"/><path d="M133 184h2v4h-2z" fill="#1f3fd6"/>';
      s += '<path d="M100 196V160" stroke="#1f3fd6" stroke-width="5" stroke-linecap="round"/>';
    } else if (c.ropa === 'saco') {
      s += '<path d="' + hom + '" fill="#3b3f52"/><path d="M84 150L100 200L116 150Z" fill="#fff"/><path d="M96 158h8l-2 6 3 24-5 6-5-6 3-24z" fill="#da291c"/><path d="M84 150L96 176L86 180L78 154M116 150L104 176L114 180L122 154" fill="#2c2f40"/>';
    } else if (c.ropa === 'camisa') {
      s += '<path d="' + hom + '" fill="' + (c.colorRopa || '#fff') + '"/><path d="M84 150L100 166L116 150L112 172L100 166L88 172Z" fill="' + tono(c.colorRopa || '#ffffff', -.12) + '"/><circle cx="100" cy="180" r="2" fill="#999"/><circle cx="100" cy="194" r="2" fill="#999"/>';
    } else {
      s += '<path d="' + hom + '" fill="' + (c.colorRopa || '#1f3fd6') + '"/><path d="M86 151q14 12 28 0" fill="none" stroke="' + tono(c.colorRopa || '#1f3fd6', -.25) + '" stroke-width="4"/>';
    }
    return s + '<path d="' + hom + '" fill="url(#' + id + 'b)" opacity=".35"/>';
  }
  function peloFrente(c, id) {
    var f = 'url(#' + id + 'h)';
    switch (c.pelo) {
      case 'rapado': return '<path d="M60 84C58 56 76 44 100 44S142 56 140 84C132 66 118 60 100 60S68 66 60 84Z" fill="' + PELO[c.colorPelo] + '" opacity=".45"/>';
      case 'corto': return '<path d="M57 90C52 54 74 38 100 38S150 52 143 90C138 70 124 60 108 62Q100 54 90 62C76 62 64 70 57 90Z" fill="' + f + '"/>';
      case 'medio': return '<path d="M56 100C48 56 72 38 100 38S152 56 144 100C140 76 130 66 116 62C104 70 82 70 70 66C62 74 58 86 56 100Z" fill="' + f + '"/>';
      case 'largo': return '<path d="M55 110C46 58 70 38 100 38S154 58 145 110C142 82 134 68 122 62C110 72 88 72 74 64C64 74 58 90 55 110Z" fill="' + f + '"/>';
      case 'mono': return '<path d="M57 92C52 54 74 42 100 42S148 54 143 92C138 70 122 62 100 62S62 70 57 92Z" fill="' + f + '"/>';
      case 'colochos':
        var s = '', p = [[62, 78, 14], [70, 58, 16], [86, 46, 17], [104, 42, 18], [122, 48, 17], [136, 62, 15], [140, 80, 13], [96, 58, 14], [116, 60, 13], [78, 64, 13]];
        p.forEach(function (q) { s += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + q[2] + '" fill="' + f + '"/>'; });
        return s;
      default: return '';
    }
  }

  /* ---------- Editor ---------- */
  var GRUPOS = [
    ['Básico', [['sexo', 'Sexo', { h: 'Hombre', m: 'Mujer' }], ['piel', 'Color de piel', PIEL.map(function (x, i) { return i; }), 'piel'], ['cara', 'Forma de la cara', { ovalada: 'Ovalada', redonda: 'Redonda', cuadrada: 'Cuadrada' }]]],
    ['Cara', [['ojos', 'Ojos', { normal: 'Normales', grandes: 'Grandes', almendra: 'Almendra', felices: 'Felices' }], ['colorOjos', 'Color de ojos', OJOS, 'color'], ['cejas', 'Cejas', { finas: 'Finas', normal: 'Normales', gruesas: 'Gruesas' }], ['nariz', 'Nariz', { boton: 'Botón', recta: 'Recta', ancha: 'Ancha' }], ['boca', 'Boca', { sonrisa: 'Sonrisa', amplia: 'Sonrisa amplia', abierta: 'Abierta', seria: 'Seria' }]]],
    ['Pelo', [['pelo', 'Largo del pelo', { calvo: 'Sin pelo', rapado: 'Rapado', corto: 'Corto', medio: 'Medio', largo: 'Largo', colochos: 'Colochos', mono: 'Moño' }], ['colorPelo', 'Color del pelo', PELO, 'color'], ['barba', 'Barba', { no: 'Sin barba', bigote: 'Bigote', corta: 'Corta', completa: 'Completa' }]]],
    ['Estilo', [['lentes', 'Anteojos', { no: 'Sin anteojos', redondos: 'Redondos', cuadrados: 'Cuadrados' }], ['ropa', 'Ropa', ROPA], ['colorRopa', 'Color de la ropa', { '#ffffff': '#ffffff', '#1f3fd6': '#1f3fd6', '#da291c': '#da291c', '#fedd00': '#fedd00', '#1d1b2e': '#1d1b2e', '#4fbf8a': '#4fbf8a' }, 'color'], ['fondo', 'Fondo', FONDO.map(function (x, i) { return i; }), 'fondo']]]
  ];
  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function montar(el, cfg, alGuardar) {
    var c = limpio(cfg), tab = 0;
    function opciones(g) {
      return GRUPOS[g][1].map(function (f) {
        var k = f[0], tipo = f[3], ops = f[2], keys = Array.isArray(ops) ? ops : Object.keys(ops);
        if (k === 'colorRopa' && (c.ropa === 'chaleco' || c.ropa === 'saco')) return '';
        return '<fieldset class="av-f"><legend>' + f[1] + '</legend><div class="av-ops">' + keys.map(function (v) {
          var on = String(c[k]) === String(v), sw = tipo === 'piel' ? PIEL[v] : tipo === 'fondo' ? FONDO[v] : tipo === 'color' ? (ops[v].charAt ? ops[v] : v) : null;
          return sw ? '<button type="button" class="av-sw' + (on ? ' on' : '') + '" data-k="' + k + '" data-v="' + v + '" style="--c:' + sw + '" aria-label="' + esc(f[1] + ' ' + v) + '" aria-pressed="' + on + '"></button>'
            : '<button type="button" class="av-op' + (on ? ' on' : '') + '" data-k="' + k + '" data-v="' + v + '" aria-pressed="' + on + '">' + esc(ops[v]) + '</button>';
        }).join('') + '</div></fieldset>';
      }).join('');
    }
    function pintar() {
      el.innerHTML = '<div class="av-ed"><div class="av-prev">' + svg(c) + '<button type="button" class="av-azar" data-azar>Sorprendeme</button></div><div class="av-cfg">' +
        '<div class="av-tabs" role="tablist">' + GRUPOS.map(function (g, i) { return '<button type="button" role="tab" aria-selected="' + (i === tab) + '" data-tab="' + i + '">' + g[0] + '</button>'; }).join('') + '</div>' +
        '<div class="av-panel">' + opciones(tab) + '</div></div></div>' +
        '<div class="foot"><button type="button" class="btn btn-soft" data-close>Cancelar</button><button type="button" class="btn btn-red" data-avguardar>Guardar avatar</button></div>';
    }
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { tab = +b.dataset.tab; pintar(); return; }
      if (b.hasAttribute('data-azar')) { c = aleatorio(c.sexo); pintar(); return; }
      if (b.hasAttribute('data-avguardar')) { alGuardar(c, b); return; }
      if (b.dataset.k) {
        var k = b.dataset.k, v = b.dataset.v;
        if (k === 'sexo') { if (v !== c.sexo) { var nb = base(v); nb.piel = c.piel; nb.colorOjos = c.colorOjos; nb.ropa = c.ropa; nb.fondo = c.fondo; c = nb; } }
        else c[k] = (k === 'piel' || k === 'fondo') ? +v : v;
        pintar();
      }
    };
    pintar();
  }
  function aleatorio(sexo) {
    var r = function (a) { return a[Math.floor(Math.random() * a.length)]; }, c = base(sexo || r(['h', 'm']));
    c.piel = Math.floor(Math.random() * PIEL.length); c.cara = r(['ovalada', 'redonda', 'cuadrada']); c.ojos = r(['normal', 'grandes', 'almendra', 'felices']);
    c.colorOjos = r(Object.keys(OJOS)); c.nariz = r(['boton', 'recta', 'ancha']); c.boca = r(['sonrisa', 'amplia', 'abierta']);
    c.pelo = c.sexo === 'm' ? r(['largo', 'medio', 'colochos', 'mono', 'corto']) : r(['corto', 'rapado', 'medio', 'colochos', 'calvo']);
    c.colorPelo = r(['negro', 'castano', 'rubio', 'pelirrojo', 'negro', 'castano']); c.barba = c.sexo === 'h' ? r(['no', 'no', 'bigote', 'corta', 'completa']) : 'no';
    c.lentes = r(['no', 'no', 'redondos', 'cuadrados']); c.fondo = Math.floor(Math.random() * FONDO.length);
    return c;
  }
  global.Avatar = { svg: svg, montar: montar, base: base, aleatorio: aleatorio };
})(typeof window !== 'undefined' ? window : globalThis);
