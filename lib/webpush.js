/* Prepara notificaciones Web Push (VAPID + cifrado aes128gcm, RFC 8291/8292) en el navegador.
   El envío lo hace un proceso de GitHub que solo reenvía las solicitudes ya firmadas y cifradas. */
(function (global) {
  'use strict';
  var cs = crypto.subtle, te = new TextEncoder();
  function b64u(buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function ub64u(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var s = atob(t), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  function une() { var n = 0, i, o; for (i = 0; i < arguments.length; i++) n += arguments[i].length; o = new Uint8Array(n); n = 0; for (i = 0; i < arguments.length; i++) { o.set(arguments[i], n); n += arguments[i].length; } return o; }
  async function hkdf(salt, ikm, info, bytes) {
    var k = await cs.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await cs.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: info }, k, bytes * 8));
  }
  async function cifrar(sub, texto) {
    var ua = ub64u(sub.keys.p256dh), auth = ub64u(sub.keys.auth);
    var par = await cs.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    var as = new Uint8Array(await cs.exportKey('raw', par.publicKey));
    var uaKey = await cs.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    var comp = new Uint8Array(await cs.deriveBits({ name: 'ECDH', public: uaKey }, par.privateKey, 256));
    var ikm = await hkdf(auth, comp, une(te.encode('WebPush: info\0'), ua, as), 32);
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
    var nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
    var k = await cs.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
    var ct = new Uint8Array(await cs.encrypt({ name: 'AES-GCM', iv: nonce }, k, une(te.encode(texto), new Uint8Array([2]))));
    return une(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([65]), as, ct);
  }
  async function llavePrivada(pub, priv) {
    var p = ub64u(pub);
    return cs.importKey('jwk', { kty: 'EC', crv: 'P-256', d: priv, x: b64u(p.slice(1, 33)), y: b64u(p.slice(33, 65)), ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  }
  async function jwt(llave, aud, correo) {
    var h = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))), c = b64u(te.encode(JSON.stringify({ aud: aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:' + correo })));
    var firma = await cs.sign({ name: 'ECDSA', hash: 'SHA-256' }, llave, te.encode(h + '.' + c));
    return h + '.' + c + '.' + b64u(firma);
  }
  /* subs: [{sub, archivo}]; datos: {titulo, mensaje, url}. Devuelve las solicitudes listas para reenviar. */
  async function preparar(subs, datos, vapid) {
    var llave = await llavePrivada(vapid.publica, vapid.privada), cache = {}, out = [];
    for (var i = 0; i < subs.length; i++) {
      var s = subs[i].sub; if (!s || !s.endpoint || !s.keys) continue;
      var aud = new URL(s.endpoint).origin; if (!cache[aud]) cache[aud] = await jwt(llave, aud, vapid.correo);
      out.push({ endpoint: s.endpoint, archivo: subs[i].archivo, cuerpo: b64u(await cifrar(s, JSON.stringify(datos))),
        cabeceras: { TTL: '86400', Urgency: 'normal', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: 'vapid t=' + cache[aud] + ', k=' + vapid.publica } });
    }
    return out;
  }
  global.WebPush = { preparar: preparar, b64u: b64u, ub64u: ub64u };
})(window);
