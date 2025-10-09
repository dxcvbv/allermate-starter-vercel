// api/chat.js
export default async function handler(req, res) {
  // quick health check in a browser
  if (req.method === 'GET') return res.status(200).json({ status: 'ok' });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

    // Vercel raw body can be Buffer/string. Normalize to object.
    let body = req.body;
    if (Buffer.isBuffer(body)) body = body.toString('utf8');
    if (typeof body === 'string') {
      try { body = JSON.parse(body || '{}'); }
      catch (e) { return res.status(400).json({ error: 'Invalid JSON body' }); }
    }
    body = body || {};
    const { messages = [], profile = {} } = body;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',     // OK to change to 'gpt-5-mini' later
        temperature: 0.4,
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content:
              `You are “AllerMate Coach,” a careful allergy assistant. Do NOT diagnose or prescribe. ` +
              `If anaphylaxis is suspected, advise immediate emergency care and following their prescribed epinephrine plan. ` +
              `Personalize using this profile (may be empty): ${JSON.stringify(profile).slice(0, 800)}`
          },
          ...messages
        ]
      })
    });

    if (!r.ok) {
      const details = await r.text();
      return res.status(502).json({ error: 'OpenAI error', details });
    }

    const data = await r.json();
    const answer = data.choices?.[0]?.message?.content?.trim() || 'No answer.';
    return res.status(200).json({ answer });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Unknown error' });
  }
}
