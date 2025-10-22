// api/restaurants.js
import { loadDataset } from './_lib';

export default async function handler(req, res){
  try{
    const { restaurants } = await loadDataset();

    const { city, bbox } = req.query;
    let list = restaurants;

    if (city) {
      list = list.filter(r => r.city.toLowerCase() === String(city).toLowerCase());
    }

    if (bbox) {
      // bbox = "west,south,east,north"
      const [w,s,e,n] = bbox.split(',').map(Number);
      list = list.filter(r => {
        const [lat,lng] = r.coords;
        return lng>=w && lng<=e && lat>=s && lat<=n;
      });
    }

    res.status(200).json({ restaurants:list });
  }catch(e){
    res.status(500).json({ error: e.message });
  }
}
