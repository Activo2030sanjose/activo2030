/*
 * Almacenamiento cifrado en la rama `datos` del repositorio (API de GitHub).
 * - usuarios.json : directorio de acceso. Por usuario: llaves envueltas con su contraseña (PBKDF2-SHA256 600,000 + AES-GCM).
 * - datos.json    : todo el sistema, cifrado con la llave maestra (solo Superadmin y Tesorero).
 * - socios/<id>.json : el estado de cuenta de cada socio, cifrado con la llave propia del socio.
 * Nada se guarda sin cifrar. El token de GitHub va cifrado con la llave maestra.
 */
(function (global) {
  'use strict';
  var REPO = 'Activo2030sanjose/activo2030', RAMA = 'datos', API = 'https://api.github.com/repos/' + REPO;
  var ITER = 600000, te = new TextEncoder(), td = new TextDecoder(), cs = global.crypto.subtle;

  var b64 = function (u8) { var s = ''; u8 = new Uint8Array(u8); for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  var ub64 = function (s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  var azar = function (n) { return global.crypto.getRandomValues(new Uint8Array(n)); };
  async function sha(texto) { return Array.from(new Uint8Array(await cs.digest('SHA-256', te.encode(texto)))).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }

  async function nuevaLlave() { return b64(azar(32)); }
  async function importar(raw) { return cs.importKey('raw', ub64(raw), 'AES-GCM', false, ['encrypt', 'decrypt']); }
  async function derivar(clave, sal) {
    var base = await cs.importKey('raw', te.encode(clave), 'PBKDF2', false, ['deriveKey']);
    return cs.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: ub64(sal), iterations: ITER }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function cifrar(llave, obj) {
    var k = typeof llave === 'string' ? await importar(llave) : llave, iv = azar(12);
    var ct = await cs.encrypt({ name: 'AES-GCM', iv: iv }, k, te.encode(JSON.stringify(obj)));
    return { iv: b64(iv), ct: b64(ct) };
  }
  async function descifrar(llave, paq) {
    var k = typeof llave === 'string' ? await importar(llave) : llave;
    return JSON.parse(td.decode(await cs.decrypt({ name: 'AES-GCM', iv: ub64(paq.iv) }, k, ub64(paq.ct))));
  }

  /* ---------- GitHub ---------- */
  var token = null;
  function cab(conToken) { var h = { Accept: 'application/vnd.github+json' }; if (conToken && token) h.Authorization = 'Bearer ' + token; return h; }
  async function gh(metodo, ruta, cuerpo) {
    var r = await fetch(API + ruta, { method: metodo, headers: Object.assign(cab(true), cuerpo ? { 'Content-Type': 'application/json' } : {}), body: cuerpo ? JSON.stringify(cuerpo) : undefined, cache: 'no-store' });
    if (!r.ok) { var e = new Error('GitHub ' + r.status); e.status = r.status; throw e; }
    return r.status === 204 ? null : r.json();
  }
  async function leer(ruta) {
    var r = await fetch(API + '/contents/' + ruta + '?ref=' + RAMA + '&t=' + Date.now(), { headers: cab(true), cache: 'no-store' });
    if (r.status === 404) return null;
    if (r.status === 403 || r.status === 429) {
      r = await fetch('https://raw.githubusercontent.com/' + REPO + '/' + RAMA + '/' + ruta + '?t=' + Date.now(), { cache: 'no-store' });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('No se pudo leer ' + ruta);
      return r.json();
    }
    if (!r.ok) throw new Error('No se pudo leer ' + ruta);
    var j = await r.json();
    return JSON.parse(td.decode(ub64(j.content.replace(/\n/g, ''))));
  }
  /* Guarda varios archivos en un solo commit. archivos: {ruta: objeto | null(borrar)} */
  async function guardar(archivos, mensaje) {
    for (var intento = 0; intento < 3; intento++) {
      try {
        var ref = await gh('GET', '/git/ref/heads/' + RAMA);
        var base = ref.object.sha, com = await gh('GET', '/git/commits/' + base);
        var arbol = Object.keys(archivos).map(function (p) {
          return archivos[p] === null ? { path: p, mode: '100644', type: 'blob', sha: null } : { path: p, mode: '100644', type: 'blob', content: JSON.stringify(archivos[p]) };
        });
        var t = await gh('POST', '/git/trees', { base_tree: com.tree.sha, tree: arbol });
        var c = await gh('POST', '/git/commits', { message: mensaje, tree: t.sha, parents: [base] });
        await gh('PATCH', '/git/refs/heads/' + RAMA, { sha: c.sha });
        return;
      } catch (e) { if (e.status !== 422 && e.status !== 409 || intento === 2) throw e; }
    }
  }
  async function crearRama() {
    var main = await gh('GET', '/git/ref/heads/main');
    try { await gh('POST', '/git/refs', { ref: 'refs/heads/' + RAMA, sha: main.object.sha }); } catch (e) { if (e.status !== 422) throw e; }
  }
  async function probarToken(t) {
    var r = await fetch(API, { headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + t } });
    if (!r.ok) return false; var j = await r.json(); return !!(j.permissions && j.permissions.push);
  }

  /* ---------- Usuarios ---------- */
  async function claveBusqueda(dir, login) { return sha(dir.sal + '|' + String(login).trim().toLowerCase()); }

  /* Arma la entrada de acceso de un usuario: sus llaves envueltas con su contraseña. */
  async function entrada(u, clave, llaves) {
    var sal = b64(azar(16)), k = await derivar(clave, sal), e = { id: u.id, sal: sal, activo: u.activo !== false };
    e.llaves = await cifrar(k, { rol: u.rol, socioId: u.socioId || null, socio: llaves.socio || null, maestra: llaves.maestra || null, macero: llaves.macero || null });
    return e;
  }
  async function abrir(dir, login, clave) {
    var h = await claveBusqueda(dir, login), e = dir.usuarios[h];
    if (!e) return null;
    var k = await derivar(clave, e.sal);
    try { var l = await descifrar(k, e.llaves); } catch (_) { return null; }
    if (e.activo === false) return { inactivo: true };
    return Object.assign({ id: e.id }, l);
  }

  global.Almacen = {
    REPO: REPO, sha: sha, nuevaLlave: nuevaLlave, cifrar: cifrar, descifrar: descifrar, leer: leer, guardar: guardar, crearRama: crearRama,
    probarToken: probarToken, ponerToken: function (t) { token = t; }, hayToken: function () { return !!token; },
    claveBusqueda: claveBusqueda, entrada: entrada, abrir: abrir, b64: b64, azar: azar
  };
})(window);
