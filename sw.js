/* Arşiv — service worker
 * 1) Paylaş menüsünden gelen görselleri yakalar
 * 2) Uygulama kabuğunu önbelleğe alır (açılış hızlı olsun, internetsiz de açılsın)
 */
const SURUM = 'arsiv-kabuk-v1';
const KABUK = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SURUM).then(c => c.addAll(KABUK)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(adlar => Promise.all(
      adlar.filter(a => a.startsWith('arsiv-kabuk-') && a !== SURUM).map(a => caches.delete(a))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // --- Paylaş menüsü ---
  if (e.request.method === 'POST' && url.pathname.endsWith('/paylas')) {
    e.respondWith((async () => {
      try {
        const veri = await e.request.formData();
        const dosyalar = veri.getAll('gorseller').filter(d => d && d.size);
        const c = await caches.open('arsiv-paylasim');
        for (const k of await c.keys()) await c.delete(k);
        for (let i = 0; i < Math.min(dosyalar.length, 3); i++) {
          await c.put('paylasim/dosya-' + i, new Response(dosyalar[i], { headers: { 'Content-Type': dosyalar[i].type } }));
        }
        await c.put('paylasim/meta', new Response(JSON.stringify({
          dosyaSayisi: Math.min(dosyalar.length, 3),
          title: veri.get('title') || '',
          text: veri.get('text') || '',
          url: veri.get('url') || ''
        })));
      } catch (err) { /* uygulama açılır, kullanıcı elle ekleyebilir */ }
      return Response.redirect('./?paylasim=1', 303);
    })());
    return;
  }

  // --- Uygulama kabuğu: önce ağ, olmazsa önbellek ---
  if (e.request.method === 'GET' && url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r.ok) { const kopya = r.clone(); caches.open(SURUM).then(c => c.put(e.request, kopya)); }
        return r;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
    );
  }
});
