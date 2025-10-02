export default async function handler(req, res) {
  try {
    const { lat, lng, q = 'restaurant', limit = 20, bbox } = req.query || {};
    const token = process.env.MAPBOX_TOKEN;
    if (!token) return res.status(500).json({ error: 'Missing MAPBOX_TOKEN' });
    if (!lat || !lng) return res.status(400).json({ error: 'lat/lng required' });

    // 1) Try Mapbox Geocoding (POIs) — with optional bbox from the current map view
    const base = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`;
    const params = new URLSearchParams({
      access_token: token,
      types: 'poi',
      proximity: `${lng},${lat}`,
      limit: String(limit),
      autocomplete: 'true',
      language: 'en'
    });
    if (bbox) params.set('bbox', bbox); // format: minLon,minLat,maxLon,maxLat
    const r = await fetch(`${base}?${params}`);
    const ok = r.ok;
    const data = ok ? await r.json() : { features: [] };
    let features = (data.features || []).map(f => ({
      id: f.id,
      text: f.text,
      place_name: f.place_name,
      center: f.center,
      properties: f.properties || {}
    }));

    // 2) Fallback to OpenStreetMap Overpass if Mapbox returned nothing
    if (features.length === 0) {
      const radius = 3000; // meters around the center
      // filter by amenity types; if q not 'restaurant', try to match name
      const nameFilter =
        q && q !== 'restaurant'
          ? `[name~"${escapeRegex(q)}",i]`
          : '';
      const query = `
        [out:json][timeout:25];
        (
          node(around:${radius},${lat},${lng})["amenity"~"restaurant|cafe|fast_food|ice_cream|food_court"]${nameFilter};
          way (around:${radius},${lat},${lng})["amenity"~"restaurant|cafe|fast_food|ice_cream|food_court"]${nameFilter};
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
            text: el.tags?.name || (el.tags?.brand ? `${el.tags.brand}` : 'Place'),
            place_name: buildOSMName(el),
            center: latlon,
            properties: { source: 'osm', amenity: el.tags?.amenity || '' }
          };
        }).filter(f => f.center && f.center[0] != null && f.center[1] != null);
      }
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ places: features });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Unknown error' });
  }
}

// helpers
function escapeRegex(s=''){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function buildOSMName(el){
  const t = el.tags || {};
  const parts = [t.name, t.brand, t['addr:street'], t['addr:city']].filter(Boolean);
  return parts.join(', ');
}
