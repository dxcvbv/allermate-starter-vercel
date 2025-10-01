export default async function handler(req, res) {
  try {
    const { lat, lng, q = 'restaurant', limit = 20 } = req.query || {};
    const token = process.env.MAPBOX_TOKEN;
    if (!token) return res.status(500).json({ error: 'Missing MAPBOX_TOKEN' });
    if (!lat || !lng) return res.status(400).json({ error: 'lat/lng required' });
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?proximity=${lng},${lat}&types=poi&limit=${limit}&access_token=${token}`;
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: 'Mapbox error', details: await r.text() });
    const data = await r.json();
    const places = (data.features||[]).map(f=>({ id:f.id, text:f.text, place_name:f.place_name, center:f.center, properties:f.properties||{} }));
    res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ places });
  } catch(e){ res.status(500).json({ error: e.message||'Unknown error' }); }
}