// api/menu.js
import { loadDataset } from './_lib';

export default async function handler(req, res){
  try{
    const { id } = req.query;
    const { restaurants } = await loadDataset();
    const r = restaurants.find(x => x.id === id);
    if (!r) return res.status(404).json({ error:'Restaurant not found' });
    res.status(200).json({ id:r.id, name:r.name, city:r.city, menu:r.menu });
  }catch(e){
    res.status(500).json({ error:e.message });
  }
}
