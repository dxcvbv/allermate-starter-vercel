// api/dataset.js
import { loadDataset } from './_lib';

export default async function handler(req, res){
  try{
    const data = await loadDataset();
    res.status(200).json({ ok:true, counts:{
      restaurants: data.restaurants.length,
      aliases: data.aliases.length,
      allergens: data.allergens.length
    }});
  }catch(e){
    res.status(500).json({ error:e.message });
  }
}
