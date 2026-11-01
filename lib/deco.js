/* Decoración flotante (aros, esferas y destellos) con los colores del manual de marca Activo 20-30. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var sprite = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<linearGradient id="gAroA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff27a"/><stop offset=".45" stop-color="#fedd00"/><stop offset="1" stop-color="#f0a800"/></linearGradient>' +
    '<linearGradient id="gAroR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a7a"/><stop offset=".5" stop-color="#da291c"/><stop offset="1" stop-color="#8f1209"/></linearGradient>' +
    '<linearGradient id="gAroZ" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fb2ff"/><stop offset=".5" stop-color="#3d5bff"/><stop offset="1" stop-color="#001489"/></linearGradient>' +
    '<symbol id="sAroA" viewBox="0 0 200 160"><ellipse cx="100" cy="80" rx="76" ry="56" fill="none" stroke="url(#gAroA)" stroke-width="34"/><ellipse cx="94" cy="70" rx="70" ry="48" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="5" stroke-dasharray="120 400" stroke-linecap="round"/></symbol>' +
    '<symbol id="sAroR" viewBox="0 0 200 160"><ellipse cx="100" cy="80" rx="76" ry="56" fill="none" stroke="url(#gAroR)" stroke-width="34"/><ellipse cx="94" cy="70" rx="70" ry="48" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="5" stroke-dasharray="120 400" stroke-linecap="round"/></symbol>' +
    '<symbol id="sAroZ" viewBox="0 0 200 160"><ellipse cx="100" cy="80" rx="76" ry="56" fill="none" stroke="url(#gAroZ)" stroke-width="34"/><ellipse cx="94" cy="70" rx="70" ry="48" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="5" stroke-dasharray="120 400" stroke-linecap="round"/></symbol>' +
    '<symbol id="sChispa" viewBox="0 0 100 100"><path d="M50 0C53 34 66 47 100 50 66 53 53 66 50 100 47 66 34 53 0 50 34 47 47 34 50 0Z"/></symbol>' +
    '</defs></svg>';
  // [tipo, izquierda %, arriba %, ancho px, giro, solo computadora]
  var GRANDE = [['aro:A', 4, 78, 150, -14], ['esf:r', 34, 8, 50, 0, 1], ['chispa', 52, 16, 54, 0], ['esf:a', 60, 86, 46, 0, 1], ['aro:R', 96, 60, 170, 18], ['chispa:a', 84, 18, 40, 0, 1], ['esf:z', 90, 92, 70, 0, 1], ['aro:Z', 40, 104, 120, 8, 1]];
  var CHICA = [['aro:A', 93, 30, 120, 16], ['esf:r', 80, 85, 44, 0, 1], ['chispa', 70, 22, 40, 0, 1], ['esf:a', 3, 90, 40, 0, 1]];
  function pieza(p, i) {
    var t = p[0].split(':'), cls = 'd' + (p[5] ? ' solo-pc' : ''), est = 'left:' + p[1] + '%;top:' + p[2] + '%;--w:' + p[3] + 'px;--r:' + p[4] + 'deg;animation-delay:-' + (i * 0.9) + 's';
    if (t[0] === 'esf') return '<span class="' + cls + ' d-esf esf-' + t[1] + '" style="' + est + '"></span>';
    var id = t[0] === 'aro' ? 'sAro' + t[1] : 'sChispa';
    return '<svg class="' + cls + ' d-' + t[0] + (t[1] ? ' ' + t[0] + '-' + t[1].toLowerCase() : '') + '" style="' + est + '"><use href="#' + id + '"/></svg>';
  }
  function poner() {
    if (!document.getElementById('gAroA')) document.body.insertAdjacentHTML('afterbegin', sprite);
    var zonas = document.querySelectorAll('[data-deco], .band');
    for (var i = 0; i < zonas.length; i++) {
      var z = zonas[i]; if (z.querySelector(':scope > .deco')) continue;
      var lista = z.hasAttribute('data-deco') && z.getAttribute('data-deco') === 'grande' ? GRANDE : CHICA;
      var d = document.createElement('div'); d.className = 'deco'; d.setAttribute('aria-hidden', 'true');
      d.innerHTML = lista.map(pieza).join('');
      z.insertBefore(d, z.firstChild);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poner); else poner();
  void NS;
})();
