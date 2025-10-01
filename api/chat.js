export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

    const { messages = [], profile = {} } = req.body || {};
    const sys = `You are “AllerMate Coach,” a cautious, friendly allergy assistant. 
Do NOT diagnose or prescribe. If anaphylaxis is suspected, advise immediate emergency care 
and following their prescribed epinephrine plan. Personalize using this profile: ${JSON.stringify(profile).slice(0,800)}`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',           // You can change to 'gpt-5-mini' later
        temperature: 0.4,
        max_tokens: 300,
        messages: [{ role: 'system', content: sys }, ...messages]
      })
    });

    if (!r.ok) return res.status(502).json({ error: 'OpenAI error', details: await r.text() });
    const data = await r.json();
    res.status(200).json({ answer: data.choices?.[0]?.message?.content || '' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Unknown error' });
  }
}
