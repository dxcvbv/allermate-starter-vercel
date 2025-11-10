// /api/chat.js
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { message, context } = req.body || {};
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }
    if (!message) {
      return res.status(400).json({ error: 'No message provided' });
    }

    const system = [
      'You are AllerMate, an allergy-safety assistant.',
      'Be practical and cautious; suggest questions to ask staff.',
      context?.survey ? `User allergens: ${JSON.stringify(context.survey)}` : ''
    ].filter(Boolean).join('\n');

    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: message }
        ],
        temperature: 0.3
      })
    });

    if (!completion.ok) {
      const errText = await completion.text();
      return res.status(500).json({ error: 'OpenAI error', detail: errText });
    }

    const data = await completion.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || 'Sorry, no response.';
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: String(e) });
  }
}
