/* Reenvía las notificaciones que el portal ya firmó y cifró. No necesita secretos. */
const fs = require('fs'), path = require('path'), dir = 'notif/salida';
(async () => {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.json'))) {
    let ok = 0, malas = 0;
    for (const s of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      try {
        const r = await fetch(s.endpoint, { method: 'POST', headers: s.cabeceras, body: Buffer.from(s.cuerpo, 'base64url') });
        if (r.ok) ok++; else { malas++; console.log('Respuesta', r.status, new URL(s.endpoint).host); if ((r.status === 404 || r.status === 410) && s.archivo && fs.existsSync(s.archivo)) fs.rmSync(s.archivo); }
      } catch (e) { malas++; console.log('Error', e.message); }
    }
    console.log(f, 'enviadas', ok, 'fallidas', malas);
    fs.rmSync(path.join(dir, f));
  }
})();
