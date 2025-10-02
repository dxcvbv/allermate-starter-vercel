// api/places.js
export default async function handler(req, res) {
  try {
    const { lat, lng, q = 'restaurant', limit = 30, bbox } = req.query || {};
    const token = process.env.MAPBOX_TOKEN;
    if (!token) return res.status(500).json({ error: 'Missing MAPBOX_TOKEN' });
    if (!lat || !lng) return res.status(400).json({ error: 'lat/lng required' });

    // --- 1) Mapbox POIs ---
    const base = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`;
    const params = new URLSearchParams({
      access_token: token,
      types: 'poi',
      proximity: `${lng},${lat}`,
      limit: String(limit),
      autocomplete: 'true',
      language: 'ar,en', // Arabic + English
      country: 'AE'      // bias to UAE
    });
    if (bbox) params.set('bbox', bbox); // minLon,minLat,maxLon,maxLat from client

    const r = await fetch(`${base}?${params}`);
    const data = r.ok ? await r.json() : { features: [] };
    let features = (data.features || []).map(f => ({
      id: f.id,
      text: f.text,
      place_name: f.place_name,
      center: f.center,
      properties: f.properties || {}
    }));

    // --- 2) Fallback: OpenStreetMap (Overpass) ---
    if (features.length === 0) {
      const radiusKm = bbox ? approxRadiusKmFromBbox(bbox) : 3;
      const radius = Math.max(1500, Math.min(radiusKm * 1000, 8000)); // 1.5–8km
      const filters = buildOSMFilters(q);

      const query = `
        [out:json][timeout:25];
        (
          node(around:${radius},${lat},${lng})${filters};
          way (around:${radius},${lat},${lng})${filters};
        );
        out center ${limit};
      `;
      const or = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query })
      });

      if (or.ok) {
        const od = await or.json();
        features = (od.elements || []).map(el => {
          const latlon = el.type === 'node'
            ? [el.lon, el.lat]
            : [el.center?.lon, el.center?.lat];
          return {
            id: `${el.type}/${el.id}`,
            text: el.tags?.name || el.tags?.brand || 'Place',
            place_name: buildOSMName(el),
            center: latlon,
            properties: { source: 'osm', amenity: el.tags?.amenity || '', cuisine: el.tags?.cuisine || '' }
          };
        }).filter(f => f.center && f.center[0] != null && f.center[1] != null);
      }
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ places: features });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Unknown error' });
  }
}

// ---------- helpers ----------
function escapeRegex(s=''){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function buildOSMFilters(q){
  const s = (q||'').trim().toLowerCase();
  const base = '["amenity"~"restaurant|cafe|fast_food|ice_cream|food_court"]';

  if (!s || s === 'restaurant') return base;

  const cuisines = {
    burger: 'burger|american',
    pizza: 'pizza|italian',
    cafe: 'cafe|coffee_shop|tea',
    coffee: 'cafe|coffee_shop',
    shawarma: 'shawarma|middle_eastern|arabic',
    sushi: 'sushi|japanese',
    indian: 'indian',
    chinese: 'chinese',
    thai: 'thai',
    lebanese: 'lebanese',
    bakery: 'bakery|cake|pastry|dessert',
    vegan: 'vegan|vegetarian'
  };

  if (cuisines[s]) return `${base}["cuisine"~"${cuisines[s]}",i]`;

  const esc = escapeRegex(q);
  return `${base}[~"^(name|brand|operator)$"~"${esc}",i]`;
}

function buildOSMName(el){
  const t = el.tags || {};
  return [t.name, t.brand, t['addr:street'], t['addr:city']].filter(Boolean).join(', ');
}

function approxRadiusKmFromBbox(bbox){
  try {
    const [w,s,e,n] = bbox.split(',').map(parseFloat);
    const dx = (e - w) * 111, dy = (n - s) * 111;
    const diag = Math.sqrt(dx*dx + dy*dy);
    return Math.max(1.5, Math.min(diag/2, 8));
  } catch { return 3; }
}
