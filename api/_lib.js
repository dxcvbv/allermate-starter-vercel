// api/_lib.js
export async function readText(path) {
  const fs = await import('node:fs/promises');
  return fs.readFile(process.cwd() + path, 'utf8');
}

export async function loadDataset() {
  const restaurants = JSON.parse(await readText('/data/restaurants.json'));
  const rules = JSON.parse(await readText('/data/rules.json'));
  const aliasesCsv = await readText('/data/ingredient_aliases.csv');
  const allergensCsv = await readText('/data/allergens.csv');

  const parseCsv = (csv) => {
    const [head, ...rows] = csv.trim().split(/\r?\n/).map(l => l.split(','));
    return rows.map(r => Object.fromEntries(r.map((v,i)=>[head[i], v])));
  };

  const aliases = parseCsv(aliasesCsv).map(r => ({keyword:r.keyword.toLowerCase(), maps_to:r.maps_to}));
  const allergens = parseCsv(allergensCsv);

  return { restaurants, rules, aliases, allergens };
}

// score a dish against a profile
export function scoreDish({ingredients=[], tags=[]}, profile, dataset){
  const wanted = getAllergySet(profile); // normalized ids (e.g., 'sesame')
  const reasons = [];
  let color = 'green';

  // alias map for simple keyword matching
  const aliasMap = new Map(dataset.aliases.map(a => [a.keyword, a.maps_to]));

  const text = [...ingredients, ...(tags||[])].join(' ').toLowerCase();
  for (const [k,v] of aliasMap.entries()){
    if (text.includes(k) && wanted.has(v)) {
      reasons.push(`Contains or may contain **${v}** (matched: ${k}).`);
    }
  }

  // tag-based checks
  const tagText = (tags||[]).map(t=>t.toLowerCase());
  if (tagText.some(t => /sesame/.test(t)) && wanted.has('sesame')) reasons.push('Tag indicates sesame.');
  for (const t of tagText){
    if (dataset.rules.shared_risk_tags[t]) reasons.push(`Shared-risk: ${t}`);
  }

  // vegan overrides
  if ((profile?.diet||'').toLowerCase()==='vegan'){
    for (const v of dataset.rules.vegan_overrides){
      if (text.includes('paneer') || text.includes('cheese')) reasons.push('Dairy present (vegan override).');
      // general: ingredients may include dairy/egg/fish/shellfish, we mark as yellow if not explicit
    }
  }

  // final color
  if (reasons.some(r => /Contains or may contain/.test(r))) color = 'red';
  else if (reasons.length) color = 'yellow';

  return { color, reasons };
}

function getAllergySet(profile={}){
  // extract ids/words from survey string fields
  const s = profile.survey || {};
  const parts = [s.allergies, s.intolerances, s.avoid, s.notes]
    .filter(Boolean).join(',').toLowerCase();
  const words = parts.split(/[,;/]| and /).map(x=>x.trim()).filter(Boolean);
  return new Set(words.map(w => normalizeAllergen(w)));
}

function normalizeAllergen(w){
  // small normalizer; align with our ids
  if (w.includes('peanut')) return 'peanut';
  if (w.includes('sesame')) return 'sesame';
  if (w.includes('almond')||w.includes('pistachio')||w.includes('walnut')||w.includes('tree nut')) return 'tree_nut';
  if (w.includes('gluten')||w.includes('wheat')||w.includes('barley')||w.includes('rye')) return 'gluten';
  if (w.includes('lactose')) return 'lactose';
  if (w.includes('milk')||w.includes('cheese')||w.includes('casein')) return 'milk_protein';
  if (w.includes('egg')) return 'egg';
  if (w.includes('soy')) return 'soy';
  if (w.includes('fish')) return 'fish';
  if (w.includes('shrimp')||w.includes('prawn')||w.includes('crab')||w.includes('shellfish')) return 'shellfish';
  return w;
}
