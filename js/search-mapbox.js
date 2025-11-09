/* js/search-mapbox.js
   - Shows map on first load
   - Loads /data/restaurants.json
   - Keyword search (burger, pizza, vegan, etc.)
   - Matches known chains (McDonalds, Burger King, etc.)
   - Apply / Clear buttons
*/

const $ = (s) => document.querySelector(s);

const chainsByKeyword = {
  burger: ['mcdonald', 'burger king', 'kfc', 'five guys', 'wendy', 'hardee', 'shake shack', 'in-n-out', 'carls jr', 'jack in the box'],
  pizza: ['domino', 'pizza hut', 'papa john', 'little caesars', 'papa murphy', 'sbarro'],
  sushi: ['sushi', 'wagamama', 'yo! sushi', 'itzu', 'itsu'],
  coffee: ['starbuck', 'costacoffee', 'costa', 'dunkin', 'tim hortons', 'gloria jean'],
  vegan: ['vegan', 'plant'],
  gluten: ['gluten'],
};

function normalizePoint(p) {
  if (!p) return null;
  if (typeof p.lat === 'number' && typeof p.lng === 'number') return [p.lng, p.lat];
  if (p.location && typeof p.location.lat === 'number' && typeof p.location.lng === 'number')
    return [p.location.lng, p.location.lat];
  if (Array.isArray(p) && p.length === 2) return [p[0], p[1]]; // [lng,lat]
  if (typeof p.longitude === 'number' && typeof p.latitude === 'number') return [p.longitude, p.latitude];
  return null;
}

function includesAny(haystack, needles) {
  const s = String(haystack || '').toLowerCase();
  return needles.some(n => s.includes(n));
}

function scoreItem(it, q, diet) {
  // Base text fields
  const name = String(it.name || it.title || '').toLowerCase();
  const cuisine = String(it.cuisine || it.categories || '').toLowerCase();
  const desc = String(it.description || '').toLowerCase();

  // Keyword match
  let score = 0;
  if (q) {
    const kw = q.toLowerCase();
    if (name.includes(kw)) score += 3;
    if (cuisine.includes(kw)) score += 2;
    if (desc.includes(kw)) score += 1;

    // Known chains for that keyword
    const chains = chainsByKeyword[kw] || [];
    if (chains.length && includesAny(name, chains)) score += 4;
  } else {
    // No keyword: slight base score so we still show reasonable ordering
    score += 1;
  }

  // Diet filters if provided (loose match)
  if (diet) {
    const d = diet.toLowerCase();
    if (name.includes(d) || cuisine.includes(d) || desc.includes(d)) {
      score += 2;
    } else {
      // Penalize if diet is requested but not found
      score -= 2;
    }
  }

  return score;
}

function renderList(items) {
  const list = $('#list');
  if (!list) return;
  list.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'No restaurants found.';
    list.appendChild(empty);
    return;
  }
  items.slice(0, 100).forEach(it => {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `
      <div style="font-weight:700">${it.name || it.title || 'Restaurant'}</div>
      <div class="muted" style="font-size:.9rem">${it.address || it.cuisine || ''}</div>
    `;
    list.appendChild(el);
  });
}

function plot(map, items) {
  // Remove old markers
  if (!map._am_markers) map._am_markers = [];
  map._am_markers.forEach(m => m.remove());
  map._am_markers = [];

  const bounds = new mapboxgl.LngLatBounds();
  let hasBounds = false;

  items.forEach(it => {
    const pt = normalizePoint(it.position || it.coords || it.location || it);
    if (!pt) return;
    const [lng, lat] = pt;

    const marker = new mapboxgl.Marker({ color: '#009688' })
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(
        `<strong>${it.name || it.title || 'Restaurant'}</strong><br>${it.address || ''}`
      ))
      .addTo(map);

    map._am_markers.push(marker);
    bounds.extend([lng, lat]);
    hasBounds = true;
  });

  $('#resultCount').textContent = `${items.length} result${items.length === 1 ? '' : 's'}`;

  // Fit bounds if we plotted anything; else keep current view
  if (hasBounds) map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
}

async function loadData() {
  // Ensure file exists at /data/restaurants.json in your repo
  const res = await fetch('/data/restaurants.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load /data/restaurants.json');
  return res.json();
}

function filterAndRank(raw, q, diet) {
  const kw = (q || '').trim().toLowerCase();

  // Keep items that at least have a point and a name
  const candidates = raw.filter(it => normalizePoint(it.position || it.coords || it.location || it) && (it.name || it.title));

  const scored = candidates.map(it => ({
    item: it,
    score: scoreItem(it, kw, diet)
  }));

  // If there is a keyword, drop very poor matches
  const filtered = kw ? scored.filter(x => x.score > 0) : scored;

  // Sort by score desc, then name
  filtered.sort((a,b) => (b.score - a.score) || String(a.item.name || a.item.title).localeCompare(String(b.item.name || b.item.title)));

  return filtered.map(x => x.item);
}

async function init() {
  // Mapbox init
  mapboxgl.accessToken = window.MAPBOX_TOKEN;
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [55.2708, 25.2048], // Dubai default
    zoom: 11
  });
  map.addControl(new mapboxgl.NavigationControl(), 'top-right');
  map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'top-right');

  // Data
  const raw = await loadData();

  // Initial state: show everything
  const initial = filterAndRank(raw, '', '');
  plot(map, initial);
  renderList(initial);

  // Wire controls
  $('#apply')?.addEventListener('click', () => {
    const q = $('#q')?.value || '';
    const diet = $('#diet')?.value || '';
    const res = filterAndRank(raw, q, diet);
    plot(map, res);
    renderList(res);
  });

  $('#clear')?.addEventListener('click', () => {
    if ($('#q')) $('#q').value = '';
    if ($('#diet')) $('#diet').value = '';
    const res = filterAndRank(raw, '', '');
    plot(map, res);
    renderList(res);
  });
}

init().catch(err => console.error('Search page error:', err));
