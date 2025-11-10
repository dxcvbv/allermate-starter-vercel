/* js/search-mapbox.js */

const $ = (s) => document.querySelector(s);

// ---- Mapbox init ----
mapboxgl.accessToken = window.MAPBOX_TOKEN;
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [55.2708, 25.2048], // Dubai default
  zoom: 11
});
map.addControl(new mapboxgl.NavigationControl(), 'top-right');
map.addControl(new mapboxgl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: true
}), 'top-right');

// ---- State ----
const state = {
  items: [],      // normalized items
  markers: [],
  activeId: null
};

// ---- Known chain dictionary per keyword (expand anytime) ----
const CHAIN_BY_KEYWORD = {
  burger: [
    "mcdonald", "burger king", "five guys", "wendy", "shake shack",
    "carl's jr", "hardee", "whataburger", "fatburger", "jack in the box"
  ],
  pizza: [
    "domino", "pizza hut", "little caesars", "papa john", "sbarro", "papa murphy"
  ],
  "hot dog": [
    "nathan", "wienerschnitzel", "dog haus", "hotdog", "sausage"
  ],
  sushi: ["sushi", "yo sushi", "itsu"],
  vegan: ["vegan", "plant"]
};

// ---- Normalizers ----
function toText(v) {
  if (!v) return '';
  if (Array.isArray(v)) return v.join(' ');
  return String(v);
}

function normalizePoint(obj) {
  // Accept many shapes: {lat,lng}, {latitude,longitude}, {location:{lat,lng}}, [lng,lat]
  if (!obj) return null;
  if (typeof obj.lat === 'number' && typeof obj.lng === 'number') return [obj.lng, obj.lat];
  if (typeof obj.latitude === 'number' && typeof obj.longitude === 'number') return [obj.longitude, obj.latitude];
  if (Array.isArray(obj) && obj.length === 2 && typeof obj[0] === 'number') return [obj[0], obj[1]];
  if (obj.location && typeof obj.location.lat === 'number' && typeof obj.location.lng === 'number')
    return [obj.location.lng, obj.location.lat];
  return null;
}

function normalizeItem(raw, idx) {
  // Try common fields
  const name = raw.name || raw.title || `Place ${idx+1}`;
  const cuisine = raw.cuisine || raw.category || raw.type || '';
  const address = raw.address || raw.formatted_address || '';
  const description = raw.description || '';
  const tags = raw.tags || raw.keywords || raw.allergens || [];
  const pos = normalizePoint(raw.position || raw.coords || raw.location || raw);

  // Try alternative coords if still missing
  let lnglat = pos;
  if (!lnglat && typeof raw.lng === 'number' && typeof raw.lat === 'number') lnglat = [raw.lng, raw.lat];

  return {
    id: `r${idx}`,
    name,
    cuisine,
    address,
    desc: description,
    tags: Array.isArray(tags) ? tags : [String(tags)],
    qtext: toText([name, cuisine, address, description, tags]).toLowerCase(),
    lnglat
  };
}

// ---- Fetch data & boot ----
(async function init() {
  try {
    const res = await fetch('/data/restaurants.json');
    const data = await res.json();

    state.items = (Array.isArray(data) ? data : (data?.features || []).map(f => f.properties || f)).map(normalizeItem);

    // Show everything initially (pins + list)
    render(state.items);
    fitTo(state.items);

    // Wire controls
    $('#apply')?.addEventListener('click', () => applyFilters());
    $('#clear')?.addEventListener('click', () => { $('#q').value=''; $('#diet').value=''; applyFilters(); });

  } catch (err) {
    console.error('Failed to load restaurants.json', err);
  }
})();

// ---- Filtering ----
function expandKeyword(q) {
  // If user typed "burger", include known chains too
  const k = q.trim().toLowerCase();
  const list = CHAIN_BY_KEYWORD[k];
  return list ? [k, ...list] : [k];
}

function matches(item, q, diet) {
  const text = item.qtext;

  // Diet/cuisine filter: simple contains
  if (diet) {
    const d = diet.toLowerCase();
    if (!(text.includes(d))) return false;
  }

  if (!q) return true;

  // Expand single keyword to include chain names
  const expanded = expandKeyword(q);
  return expanded.some(key => text.includes(key));
}

function applyFilters() {
  const q = ($('#q')?.value || '').trim();
  const diet = ($('#diet')?.value || '').trim();

  const filtered = state.items.filter(it => matches(it, q, diet));
  render(filtered);
  fitTo(filtered);
}

// ---- Rendering ----
function clearMarkers() {
  for (const m of state.markers) m.remove();
  state.markers = [];
}

function fitTo(items) {
  const valid = items.filter(it => it.lnglat);
  if (!valid.length) return;
  const bounds = new mapboxgl.LngLatBounds();
  valid.forEach(it => bounds.extend(it.lnglat));
  map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
}

function render(items) {
  // counts
  $('#count').textContent = `${items.length} result${items.length===1?'':'s'}`;
  $('#countTop').textContent = `${items.length} result${items.length===1?'':'s'}`;

  // list
  const listEl = $('#list');
  listEl.innerHTML = '';
  items.forEach(it => {
    const el = document.createElement('div');
    el.className = 'result';
    el.dataset.id = it.id;
    const address = it.address || '—';
    const cuisine = it.cuisine || '';
    el.innerHTML = `
      <h4>${escapeHtml(it.name)}</h4>
      <div class="meta">${escapeHtml(cuisine)} ${cuisine && address ? '— ' : ''}${escapeHtml(address)}</div>
      <div class="row" style="margin-top:6px">
        ${it.cuisine ? `<span class="badge">${escapeHtml(it.cuisine)}</span>` : ''}
      </div>
    `;
    el.addEventListener('click', () => focusOn(it.id));
    listEl.appendChild(el);
  });

  // markers
  clearMarkers();
  items.forEach(it => {
    if (!it.lnglat) return;
    const marker = new mapboxgl.Marker({ color: '#009688' })
      .setLngLat(it.lnglat)
      .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(`
        <strong>${escapeHtml(it.name)}</strong><br>
        ${escapeHtml(it.address || '')}
      `))
      .addTo(map);
    marker.getElement().addEventListener('click', () => highlight(it.id));
    state.markers.push({ id: it.id, marker });
  });
}

function highlight(id) {
  state.activeId = id;
  document.querySelectorAll('.result').forEach(n => {
    n.style.outline = (n.dataset.id === id) ? '2px solid #00BFA5' : 'none';
  });
}

function focusOn(id) {
  const item = state.items.find(x => x.id === id);
  if (!item || !item.lnglat) return;
  map.flyTo({ center: item.lnglat, zoom: Math.max(map.getZoom(), 14), speed: 0.7 });
  const m = state.markers.find(x => x.id === id)?.marker;
  if (m) m.togglePopup();
  highlight(id);
}

// ---- Helpers ----
function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
