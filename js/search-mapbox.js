// js/search-mapbox.js
const token = window.MAPBOX_TOKEN;
mapboxgl.accessToken = token;

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [55.2708, 25.2048], // Dubai default center
  zoom: 11
});

// Optional controls
map.addControl(new mapboxgl.NavigationControl(), 'top-right');
map.addControl(new mapboxgl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: true
}), 'top-right');

// Load your dataset and plot markers
(async () => {
  const r = await fetch('/data/restaurants.json');
  const items = await r.json();
  const bounds = new mapboxgl.LngLatBounds();

  function norm(pt, it){
    // Try several shapes
    const p = pt || it.position || it.location || it.coords || null;
    if (!p) return null;
    if (typeof p.lng === 'number' && typeof p.lat === 'number') return [p.lng, p.lat];
    if (Array.isArray(p) && p.length === 2) return [p[0], p[1]];
    if (typeof it.longitude === 'number' && typeof it.latitude === 'number') return [it.longitude, it.latitude];
    return null;
  }

  // initial plot
  plot(items);

  // filter by name
  document.getElementById('apply')?.addEventListener('click', () => {
    const q = (document.getElementById('q')?.value || '').trim().toLowerCase();
    const filtered = items.filter(it => (it.name || it.title || '').toLowerCase().includes(q));
    plot(filtered);
  });

  function plot(list){
    // clear existing markers by removing map and recreating markers layer
    // (simplest approach for now)
    document.querySelectorAll('.mapboxgl-marker').forEach(n => n.remove());

    const localBounds = new mapboxgl.LngLatBounds();
    list.forEach(it => {
      const pt = norm(null, it);
      if (!pt) return;
      const [lng, lat] = pt;

      new mapboxgl.Marker({ color: '#009688' })
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(
          `<strong>${it.name || it.title || 'Place'}</strong><br>${it.address || ''}`
        ))
        .addTo(map);

      localBounds.extend([lng, lat]);
    });

    document.getElementById('resultCount').textContent =
      `${list.length} result${list.length === 1 ? '' : 's'}`;

    if (!localBounds.isEmpty()) map.fitBounds(localBounds, { padding: 40, maxZoom: 15 });

    // simple side list
    const listEl = document.getElementById('list');
    if (listEl){
      listEl.innerHTML = '';
      list.slice(0, 100).forEach(it => {
        const div = document.createElement('div');
        div.className = 'item';
        div.innerHTML = `
          <div style="font-weight:700">${it.name || it.title || 'Place'}</div>
          <div class="muted" style="font-size:.9rem">${it.address || ''}</div>
        `;
        listEl.appendChild(div);
      });
    }
  }
})();
