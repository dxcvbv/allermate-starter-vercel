/* js/search-mapbox.js
   - Loads /data/restaurants.json
   - Filters to restaurants only
   - Keyword matching (e.g., "burger" shows McDonald's, Burger King, Five Guys…)
   - Scores & sorts results
   - Plots Mapbox markers + renders a list
*/

const $ = (s) => document.querySelector(s);

mapboxgl.accessToken = window.MAPBOX_TOKEN;

// ----- Known brand hints by keyword -----
const BRAND_HINTS = {
  burger: [
    'mcdonald', "mc donald", "mcdonald's", 'burger king', 'five guys', 'wendy', 'hardee', 'carls jr', 'shake shack',
    'in-n-out', 'jack in the box', 'whataburger', 'fatburger', 'johnny rockets', 'smashburger'
  ],
  pizza: ['pizza hut', 'domino', "domino's", 'papa john', 'little caesars', 'sbarro'],
  coffee: ['starbucks', 'costa', 'tim hortons', 'dunkin', 'gloria jean', 'arabica', 'caribou coffee'],
  vegan: ['by chloe', 'vegan', 'plant', 'greens'],
  chicken: ['kfc', 'popeyes', 'jollibee', 'wingstop'],
  sushi: ['sushi', 'wagamama', 'itsu'],
  sandwich: ['subway', 'jimmy john', 'firehouse subs', 'potbelly']
};

// Normalize helpers
function normStr(v) { return (v ?? '').toString().toLowerCase(); }
function normArr(a) {
  if (!a) return [];
  if (Array.isArray(a)) return a.map(x => normStr(x));
  return normStr(a).split(/[|,;/]/).map(x => x.trim()).filter(Boolean);
}

function getName(r) { return r.name ?? r.title ?? ''; }
function getAddress(r) { return r.address ?? r.location_text ?? r.desc ?? ''; }
function getTags(r) {
  // collect potential category/cuisine fields
  return [
    ...normArr(r.tags),
    ...normArr(r.categories),
    ...normArr(r.category),
    ...normArr(r.cuisine),
    ...normArr(r.type),
  ];
}
function isRestaurant(r) {
  const tags = getTags(r);
  const t = normStr(r.type);
  const cat = normStr(r.category);
  const any = [t, cat, ...tags].join(' ');
  return any.includes('restaurant') || any.includes('food') || any.includes('diner') || any.includes('eatery');
}

function getLngLat(r) {
  // Accept many shapes
  const p = r.position ?? r.coords ?? r.location ?? null;
  if (p && typeof p.lng === 'number' && typeof p.lat === 'number') return [p.lng, p.lat];
  if (p && Array.isArray(p) && p.length === 2) return [p[0], p[1]];     // [lng, lat]
  if (typeof r.longitude === 'number' && typeof r.latitude === 'number') return [r.longitude, r.latitude];
  // Some datasets store as [lat,lng]
  if (Array.isArray(r) && r.length === 2 && typeof r[0] === 'number' && typeof r[1] === 'number') {
    return [r[1], r[0]];
  }
  return null;
}

// Simple keyword → score function
function scoreRestaurant(r, qWords, cuisine) {
  const name = normStr(getName(r));
  const tags = getTags(r);
  const joined = (name + ' ' + tags.join(' '));
  let score = 0;

  // Base: restaurants only
  if (!isRestaurant(r)) return -1;

  // Cuisine select boosts
  if (cuisine) {
    if (joined.includes(cuisine)) score += 3;
  }

  // Query words
  for (const w of qWords) {
    if (!w) continue;
    if (name.includes(w)) score += 4;          // strong match on name
    if (joined.includes(w)) score += 2;        // weaker match on tags
    // brand hints (e.g., "burger" boosts 'mcdonald', etc.)
    const hints = BRAND_HINTS[w] || [];
    for (const h of hints) {
      if (joined.includes(h)) score += 5;
    }
  }

  // Tiny bias so non-matches aren’t all equal
  if (score === 0 && qWords.length === 0 && !cuisine) score = 1;

  return score;
}

function filterAndSort(data, q, cuisine) {
  const qWords = normStr(q).split(/\s+/).filter(Boolean);
  // If they typed "burgers", treat as "burger" too
  const stem = (s) => s.replace(/s\b/g, '');
  const stems = qWords.map(stem);

  return data
    .map(r => ({ r, s: scoreRestaurant(r, stems, cuisine ? normStr(cuisine) : '') }))
    .filter(x => x.s > 0)
    .sort((a,b) => b.s - a.s)
    .map(x => x.r);
}

// Map & UI state
const state = {
  map: null,
  data: [],
  markers: []
};

function clearMarkers() {
  state.markers.forEach(m => m.remove());
  state.markers = [];
}

function renderList(items) {
  const list = $('#list');
  list.innerHTML = '';
  (items.length ? items : []).slice(0, 60).forEach(it => {
    const el = document.createElement('div');
    el.className = 'item';
    const name = getName(it) || 'Restaurant';
    const addr = getAddress(it);
    const tags = getTags(it).filter(Boolean).slice(0, 4);
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <strong>${name}</strong>
        ${tags.length ? `<span class="muted" style="font-size:.85rem">${tags.join(' • ')}</span>` : ''}
      </div>
      ${addr ? `<div class="muted" style="font-size:.9rem">${addr}</div>` : ''}
    `;
    list.appendChild(el);
  });
  if (!items.length) list.innerHTML = '<div class="item muted">No restaurants found.</div>';
}

function plot(items) {
  clearMarkers();
  const bounds = new mapboxgl.LngLatBounds();

  for (const it of items) {
    const lnglat = getLngLat(it);
    if (!lnglat) continue;

    const marker = new mapboxgl.Marker({ color: '#009688' })
      .setLngLat(lnglat)
      .setPopup(
        new mapboxgl.Popup({ offset: 16 }).setHTML(`
          <strong>${getName(it) || 'Restaurant'}</strong><br/>
          ${getAddress(it) || ''}
        `)
      )
      .addTo(state.map);

    state.markers.push(marker);
    bounds.extend(lnglat);
  }

  $('#resultCount').textContent = `${items.length} result${items.length === 1 ? '' : 's'}`;

  if (!bounds.isEmpty()) {
    state.map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
  }
}

async function loadData() {
  const res = await fetch('/data/restaurants.json');
  const json = await res.json();
  // Keep only items that look like restaurants
  state.data = Array.isArray(json) ? json.filter(isRestaurant) : [];
}

function applyFilters() {
  const q = $('#q')?.value || '';
  const cuisine = $('#cuisine')?.value || '';
  const items = filterAndSort(state.data, q, cuisine);
  renderList(items);
  plot(items);
}

async function init() {
  // Create map
  const start = [55.2708, 25.2048]; // Dubai default
  state.map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: start,
    zoom: 11
  });

  state.map.addControl(new mapboxgl.NavigationControl(), 'top-right');
  state.map.addControl(new mapboxgl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true
  }), 'top-right');

  // Try to center on user if allowed
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        state.map.setCenter([longitude, latitude]);
        state.map.setZoom(13);
      },
      () => {}
    );
  }

  await loadData();
  applyFilters();

  $('#apply')?.addEventListener('click', applyFilters);
  $('#clear')?.addEventListener('click', () => {
    $('#q').value = '';
    $('#cuisine').value = '';
    applyFilters();
  });

  // Enter to apply
  $('#q')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applyFilters(); }
  });
}

init().catch(err => console.error('Map init error:', err));
