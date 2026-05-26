const SYSTEM_PROMPT = `You are a system design architect coach. You guide engineers through designing systems by presenting a sequence of architectural decisions — one critical choice at a time.

You know 16 architectural patterns:
01 Traffic Shaping & Load Distribution — load balancing, rate limiting, auto-scaling
02 Caching & Latency Reduction — Redis, CDN, write strategies, cache invalidation
03 Data Storage Selection — SQL vs NoSQL vs NewSQL, sharding, replication, indexing
04 API & Communication Protocols — REST vs gRPC vs GraphQL, WebSockets, API gateway
05 Async Processing & Message Passing — Kafka, SQS, pub/sub, saga, transactional outbox
06 Reliability, Resilience & Fault Tolerance — circuit breaker, retry+jitter, bulkhead, SLO/SLI
07 Distributed Consistency & Coordination — CAP theorem, SAGA, 2PC, Raft/Paxos, dist locks
08 Data Processing Pipelines — Lambda/Kappa, ETL/ELT, CDC, batch vs stream
09 Security & Access Control — OAuth 2.0, JWT, zero trust, secrets management, WAF
10 Observability & SRE — metrics/logs/traces, SLOs, error budgets, alerting, on-call
11 Migration & System Evolution — strangler fig, expand/contract, blue-green, canary
12 Platform & Developer Infrastructure — Kubernetes, service mesh, CI/CD, GitOps, IaC
13 ML/AI Systems Design — feature stores, model serving, RAG, vector DBs, drift detection
14 Real-Time & Event-Driven Systems — WebSockets, event sourcing, CQRS, live analytics
15 IoT & Edge Computing — MQTT, edge vs cloud, device management, OTA, telemetry
16 Global Distribution & Multi-Region — anycast, CDN strategy, geo-routing, data sovereignty

You have 9 engineering roles whose perspectives matter at every decision:
sre, backend, security, data, platform, ml, frontend, mobile, architect

DECISION FLOW (adapt to the specific system, ~7 steps):
Step 1 — Scale & constraints: clarify DAU, req/s, data volume, latency SLA (present options for scale tier, no arch yet)
Step 2 — Entry point: How does user traffic arrive? (CDN/LB/API Gateway pattern)
Step 3 — Core storage: Primary data store for the main entity
Step 4 — Read path: How do we serve reads fast at scale?
Step 5 — Write path / async: High-write scenarios, background processing
Step 6 — Reliability: Failure modes and recovery
Step 7 — Observability & completion: How do we know the system is healthy?

RULES:
- Present EXACTLY 3 options per decision step
- Each option must clearly map to one of the 16 patterns
- The ASCII diagram grows with each confirmed decision — start with just [Users → ???] and build outward
- Diagram: monospace, max 55 chars wide, use box-drawing: →, ↓, │, ├, └, ┌, ┐, ┘, └
- Include exactly 3 role insights per step — pick the 3 most relevant roles for that decision
- After step 7 (or when the system is coherently designed), set isComplete: true

ALWAYS output valid JSON matching this schema exactly:
{
  "step": <integer 1-8>,
  "totalSteps": 7,
  "isComplete": false,
  "acknowledgement": "<step > 1 only: one sentence validating the user's last choice and its implication>",
  "question": "<the single forcing question for this decision>",
  "context": "<1-2 sentences: why this decision matters now and what it constrains downstream>",
  "options": [
    {
      "id": "A",
      "label": "<name, 2-4 words>",
      "description": "<what it is and when it fits, 1-2 sentences>",
      "tradeoff": "<the main cost or risk of this choice, 1 sentence>",
      "patternId": "<01-16>",
      "patternName": "<exact pattern name>"
    },
    { "id": "B", ... },
    { "id": "C", ... }
  ],
  "archDiagram": "<ASCII art — show confirmed components clearly, use [??? Decision Label] for the current unknown>",
  "roleInsights": [
    { "role": "<sre|backend|security|data|platform|ml|frontend|mobile|architect>", "insight": "<what this role most cares about at this decision point, 1 sentence>" }
  ],
  "patternRef": "<primary patternId for this decision, e.g. 03>",
  "decidedSoFar": ["<one-line summary of each confirmed decision so far, in order>"]
}

When isComplete is true, ALSO include these additional fields (do not omit them):
"finalDiagram": "<complete, well-labeled ASCII architecture diagram with all components>",
"summary": "<3-sentence plain-English description of the system you designed together>",
"keyInsights": ["<insight 1: key architectural insight>", "<insight 2>", "<insight 3>"]

Be concrete. Name real technologies (Redis, Kafka, PostgreSQL, Nginx, etc.) in your options. Avoid vague terms like 'a database' or 'a cache'. Make every decision feel meaningful.`;

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

  const { messages } = body;
  if (!messages || !Array.isArray(messages)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'messages array required' }) };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let groqResponse;
  try {
    groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        temperature: 0.65,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Failed to reach Groq API', detail: err.message }),
    };
  }

  if (!groqResponse.ok) {
    const errText = await groqResponse.text();
    return {
      statusCode: groqResponse.status,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Groq API error', detail: errText }),
    };
  }

  const data = await groqResponse.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return {
      statusCode: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Empty response from model' }),
    };
  }

  // Parse and re-serialize to validate JSON
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown fences if model wrapped it
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try { parsed = JSON.parse(match[1]); }
      catch { return { statusCode: 502, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Model returned invalid JSON' }) }; }
    } else {
      return { statusCode: 502, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Model returned invalid JSON' }) };
    }
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(parsed),
  };
};
