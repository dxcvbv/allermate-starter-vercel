/* js/search-mapbox.js */

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const MAPBOX_TOKEN = window.MAPBOX_TOKEN;
mapboxgl.accessToken = MAPBOX_TOKEN;

const state = {
  map: null,
  markers: [],
  data: [],
};

// -------------------------------
// Helpers
// -------------------------------
function normText(x) {
  return (x ?? '').toString().toLowerCase();
}

function joinFields(it) {
  // concatenate common textual fields for search
  const parts = [
    it.name, it.title, it.brand, it.cuisine, it.category, it.categories,
    it.tags, it.description, it.address, it.street
  ];
  return normText(Array.isArray(parts) ? parts.flat().join(' ') : parts.join(' '));
}

function getCoords(obj) {
  // return [lng, lat] or null
  const p = obj?.position || obj?.location || obj?.coords || obj;
  if (!p) return null;
  if (typeof p.lng === 'number' && typeof p.lat === 'number') return [p.lng, p.lat];
  if (typeof p.longitude === 'number' && typeof p.latitude === 'number') return [p.longitude, p.latitude];
  if (Array.isArray(p) && p.length === 2 && p.every(n => typeof n === 'number')) return [p[0], p[1]];
  return null;
}

const CHAIN_KEYWORDS = {
  burger: [
    'mcdonald', 'burger king', 'five guys', 'shake shack', 'wendy', 'hardee', 'carl\'s jr', 'jollibee',
    'fatburger', 'smashburger', 'whopper', 'big mac', 'hamburger', 'burger'
  ],
  pizza: [
    'domino', 'pizza hut', 'little caesars', 'papa john', 'sarpino', 'margherita', 'pepperoni', 'pizza'
  ],
  hotdog: [
    'hot dog', 'hotdog', 'frank', 'sausage', 'wiener', 'corn dog'
  ],
  sushi: ['sushi', 'sashimi', 'maki', 'nigiri'],
  vegan: ['vegan', 'plant-based'],
  gluten: ['gluten free', 'gluten-free']
};

function matchesKeyword(text, keyword) {
  if (!keyword) return true;
  const k = normText(keyword).trim();
  if (!k) return true;

  // map "hot dog" -> hotdog family, etc.
  const family =
    k.includes('burger') ? 'burger' :
    k.includes('pizza')  ? 'pizza'  :
    k.includes('hot') && k.includes('dog') ? 'hotdog' :
    k.includes('sushi')  ? 'sushi'  :
    k.includes('vegan')  ? 'vegan'  :
    k.includes('gluten') ? 'gluten' : null;

  if (family) {
    return CHAIN_KEYWORDS[family].some(w => text.includes(w));
  }

  // fallback: plain substring
  return text.includes(k);
}

function matchesDiet(it, diet) {
  if (!diet) return true;
  const text = joinFields(it);
  if (diet === 'vegan')       return /\bvegan|plant[- ]based\b/.test(text);
  if (diet === 'vegetarian')  return /\bvegetarian\b/.test(text);
  if (diet === 'gluten')      return /\bgluten[- ]?free\b/.test(text);
  return true;
}

function scoreItem(it, keyword) {
  // simple ranking: name hits > cuisine/tags hits > chain hints
  const name = normText(it.name || it.title);
  const text = joinFields(it);

  let s = 0;
  if (!keyword) return 1;

  const k = normText(keyword);
  if (name.includes(k)) s += 5;
  if (text.includes(k)) s += 2;

  // boost known chain keywords for that family
  const fam =
    k.includes('burger') ? 'burger' :
    k.includes('pizza')  ? 'pizza'  :
    (k.includes('hot') && k.includes('dog')) ? 'hotdog' : null;

  if (fam) {
    for (const w of CHAIN_KEYWORDS[fam]) {
      if (text.includes(w)) s += 3;
    }
  }

  return s;
}

// -------------------------------
// Map + UI
// -------------------------------
function clearMarkers() {
  state.markers.forEach(m => m.remove());
  state.markers = [];
}

function plot(items) {
  clearMarkers();
  const bounds = new mapboxgl.LngLatBounds();

  items.forEach(it => {
    const c = getCoords(it);
    if (!c) return;
    const [lng, lat] = c;

    const marker = new mapboxgl.Marker({ color: '#009688' })
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(`
        <strong>${it.name || it.title || 'Restaurant'}</strong><br>
        ${it.address || it.street || ''}`))
      .addTo(state.map);

    state.markers.push(marker);
    bounds.extend([lng, lat]);
  });

  const count = items.length;
  $('#count').textContent = `${count} result${count===1?'':'s'}`;
  if (count > 0 && !bounds.isEmpty()) {
    state.map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
  }
}

function renderList(items) {
  const list = $('#list');
  const empty = $('#empty');
  list.innerHTML = '';

  if (items.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  items.slice(0, 100).forEach(it => {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `
      <div style="font-weight:700">${it.name || it.title || 'Restaurant'}</div>
      <div class="muted" style="font-size:.9rem">${it.address || it.street || ''}</div>
    `;
    list.appendChild(el);
  });
}

function applyFilters() {
  const q = $('#q').value.trim();
  const diet = $('#diet').value;

  const filtered = state.data
    .filter(it => matchesKeyword(joinFields(it), q))
    .filter(it => matchesDiet(it, diet))
    .sort((a, b) => scoreItem(b, q) - scoreItem(a, q));

  renderList(filtered);
  plot(filtered);
}

async function init() {
  // Map shows immediately
  state.map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [55.2708, 25.2048], // Dubai fallback
    zoom: 11
  });
  state.map.addControl(new mapboxgl.NavigationControl(), 'top-right');
  state.map.addControl(new mapboxgl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true
  }), 'top-right');

  // Load data
  const r = await fetch('/data/restaurants.json');
  state.data = await r.json();

  // Show all immediately
  $('#q').value = '';
  $('#diet').value = '';
  applyFilters();

  // Wire buttons
  $('#apply').addEventListener('click', applyFilters);
  $('#clear').addEventListener('click', () => {
    $('#q').value = '';
    $('#diet').value = '';
    applyFilters();
  });

  // Enter to search
  $('#q').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyFilters();
  });
}

init().catch(err => console.error('Search init error:', err));
