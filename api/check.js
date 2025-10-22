// api/check.js
import { loadDataset, scoreDish } from './_lib';

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error:'POST only' });

  try{
    // Normalize JSON body (Vercel sometimes passes string/buffer)
    let body = req.body;
    if (Buffer.isBuffer(body)) body = body.toString('utf8');
    if (typeof body === 'string') body = JSON.parse(body || '{}');

    const { restaurantId, sku, profile } = body || {};
    if (!restaurantId || !sku) return res.status(400).json({ error:'restaurantId and sku required' });

    const dataset = await loadDataset();
    const rest = dataset.restaurants.find(r => r.id === restaurantId);
    if (!rest) return res.status(404).json({ error:'Restaurant not found' });
    const item = rest.menu.find(m => m.sku === sku);
    if (!item) return res.status(404).json({ error:'Menu item not found' });

    const result = scoreDish(item, profile, dataset);
    res.status(200).json({ restaurant:rest.name, item, result });
  }catch(e){
    res.status(500).json({ error:e.message });
  }
}
