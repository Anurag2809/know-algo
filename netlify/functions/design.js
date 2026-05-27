const SYSTEM_PROMPT = `You are a senior system design architect. Generate a complete 7-step guided design session in ONE response. Be CONCISE — every text field must be ≤15 words. Total output must stay under 5000 tokens.

16 patterns (use patternId 01-16):
01 Traffic Shaping  02 Caching  03 Data Storage  04 API & Protocols
05 Async Messaging  06 Reliability  07 Consistency  08 Data Pipelines
09 Security  10 Observability  11 Migration  12 Platform Infra
13 ML/AI Systems  14 Real-Time/Event  15 IoT & Edge  16 Global Distribution

Roles: sre backend security data platform ml frontend mobile architect

Decision steps (adapt to the system):
1 Scale & constraints  2 Entry point  3 Core storage  4 Read path
5 Write/async path    6 Reliability  7 Observability

ARCHITECTURE GRAPH (archGraph per step):
Tiers: 0=Client 1=Gateway 2=Service 3=Data 4=Observability
Types: client gateway service cache database queue ml monitoring unknown
- Step 1: client node + 1 unknown node ("??? Scale ???")
- Step N: all prior decided nodes + 1 unknown node for current decision
- Step 7: all nodes named, no unknown
- Add 1-3 new named nodes per step as the architecture grows
- Use MULTIPLE service nodes at tier 2 for microservice systems; add service→service edges
- Max 12 nodes total; 3-7 edges per step
- Node labels: short name only, ≤4 words, NO newlines

OUTPUT RULES:
- EXACTLY 4 options per step, each from a different patternId
- recommendedOption choices must together form one coherent architecture
- EXACTLY 3 roleInsights per step (most relevant roles)
- VALID JSON only, no markdown

JSON schema:
{
  "systemName": "<3 words>",
  "systemDescription": "<1 sentence>",
  "steps": [
    {
      "step": 1,
      "question": "<≤12 words>",
      "context": "<≤15 words>",
      "options": [
        { "id": "A", "label": "<2-3 words>", "description": "<≤15 words>", "tradeoff": "<≤12 words>", "patternId": "01", "patternName": "<name>" },
        { "id": "B", ... }, { "id": "C", ... }, { "id": "D", ... }
      ],
      "recommendedOption": "A",
      "archGraph": {
        "nodes": [ { "id": "client", "label": "Browser", "tier": 0, "type": "client" } ],
        "edges": [ { "from": "client", "to": "unknown-1" } ]
      },
      "roleInsights": [
        { "role": "sre", "insight": "<≤15 words>" },
        { "role": "backend", "insight": "<≤15 words>" },
        { "role": "architect", "insight": "<≤15 words>" }
      ]
    }
  ],
  "finalGraph": {
    "nodes": [ { "id": "...", "label": "...", "tier": 0, "type": "..." } ],
    "edges": [ { "from": "...", "to": "...", "label": "optional short label" } ]
  },
  "summary": "<2 sentences>",
  "keyInsights": ["<≤15 words>", "<≤15 words>", "<≤15 words>"]
}`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { systemDescription } = body;
  if (!systemDescription || typeof systemDescription !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'systemDescription string required' }) };
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey   = process.env.GROQ_API_KEY;

  if (!geminiKey && !groqKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'No API key configured' }) };
  }

  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  const userPrompt = `Design this system: ${systemDescription.slice(0, 500)}`;

  function parseJSON(content) {
    try { return JSON.parse(content); } catch {}
    const m = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) try { return JSON.parse(m[1]); } catch {}
    return null;
  }

  // ── 1. Gemini 1.5 Flash (primary — 1M TPD free) ──────────────────────────
  if (geminiKey) {
    let res, geminiErr;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.65,
              maxOutputTokens: 8192,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        }
      );
    } catch (err) {
      geminiErr = err.message;
    }

    if (res && res.ok) {
      const data    = await res.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) {
        const parsed = parseJSON(content);
        if (parsed) return { statusCode: 200, headers: CORS, body: JSON.stringify(parsed) };
        return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Gemini returned invalid JSON' }) };
      }
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Empty response from Gemini' }) };
    }

    if (res && !res.ok) {
      const errText = await res.text();
      // Only fall through to Groq on rate limit; surface all other Gemini errors
      if (res.status !== 429) {
        return { statusCode: res.status, headers: CORS, body: JSON.stringify({ error: 'Gemini API error', detail: errText }) };
      }
    }

    if (geminiErr) {
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Could not reach Gemini', detail: geminiErr }) };
    }
    // Rate-limited — fall through to Groq
  }

  // ── 2. Groq fallback (llama-3.3-70b only — 8b model can't fit our prompt) ──
  if (!groqKey) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: 'AI service temporarily unavailable. Please try again shortly.' }) };
  }

  const GROQ_MODELS = [
    { id: 'llama-3.3-70b-versatile', max_tokens: 6000 },
  ];

  let lastErrBody = '';

  for (const model of GROQ_MODELS) {
    let groqRes;
    try {
      groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: model.id,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user',   content: userPrompt },
          ],
          temperature: 0.65,
          max_tokens: model.max_tokens,
          response_format: { type: 'json_object' },
        }),
      });
    } catch (err) {
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Failed to reach AI service', detail: err.message }) };
    }

    if (!groqRes.ok) {
      lastErrBody = await groqRes.text();
      if (groqRes.status === 429) continue; // try next model
      return { statusCode: groqRes.status, headers: CORS, body: JSON.stringify({ error: 'AI service error', detail: lastErrBody }) };
    }

    const data    = await groqRes.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Empty response from model' }) };

    const parsed = parseJSON(content);
    if (!parsed) return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Model returned invalid JSON' }) };

    return { statusCode: 200, headers: CORS, body: JSON.stringify(parsed) };
  }

  // All providers exhausted
  let retryIn = null;
  try {
    const obj = JSON.parse(lastErrBody);
    const m = (obj?.error?.message || '').match(/try again in ([\dhms.]+)/i);
    retryIn = m ? m[1] : null;
  } catch {}

  return {
    statusCode: 429,
    headers: CORS,
    body: JSON.stringify({ error: retryIn ? `Daily limit reached. Try again in ${retryIn}.` : 'Rate limit reached. Please try again later.' }),
  };
};
