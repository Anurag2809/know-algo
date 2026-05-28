import { getStore } from '@netlify/blobs';

const SYSTEM_PROMPT = `You are a senior system design architect. Given a system to design, generate a COMPLETE guided design session in a SINGLE response.

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

9 engineering roles: sre, backend, security, data, platform, ml, frontend, mobile, architect

DECISION FLOW — generate 5 to 12 steps based on the system's actual complexity. Not every system needs all patterns. Choose only patterns that genuinely matter for this system.
- Always start with: Scale & constraints (step 1)
- Always end with: Observability or a system-appropriate wrap-up step
- Simple CRUD app or internal tool: 5-6 steps
- Standard web platform at scale: 7-8 steps
- Complex distributed / real-time / ML / IoT / global system: 9-12 steps
- Each step must address a DIFFERENT patternId (01-16). No two steps share the same patternId.
- Order steps by architectural dependency: decide entry points before storage, storage before read/write optimization, etc.

Examples of when to add extra steps:
- IoT system → add step for IoT & Edge (15) and possibly Data Pipelines (08)
- ML platform → add step for ML/AI Systems (13)
- Global product → add step for Global Distribution (16)
- Payment / health system → add step for Security (09)
- High-write system → add step for Distributed Consistency (07)

ARCHITECTURE GRAPH — for each step generate an "archGraph" field:
Tiers: 0=Client 1=Gateway 2=Service 3=Data 4=Observability
Types: client gateway service cache database queue ml monitoring unknown
- Step 1: client node + 1 unknown node ("??? Scale Decision ???")
- Step N: all prior decided nodes + 1 unknown node for current decision
- Last step: all nodes named, no unknown
- Add 1-2 new named nodes per step as architecture grows
- Use MULTIPLE service nodes at tier 2 for microservice systems
- Max 14 nodes total; 3-5 edges per step (primary data flow only — omit obvious/redundant edges)
- finalGraph: max 7 edges — show the main request path and key async flows only
- Node labels: ≤4 words, NO newlines
- Edge labels: REST, gRPC, events, reads, writes, HTTPS, async (omit label if edge direction is obvious)

JSON format for archGraph:
{"nodes":[{"id":"unique-id","label":"Short Name","tier":0,"type":"client"}],"edges":[{"from":"id","to":"id","label":"optional"}]}

For finalGraph: same format, all nodes named (no unknown), primary data flow only.

SPECIFICITY MANDATE — the most important rule:
Every output must be written FOR THIS SPECIFIC SYSTEM, not for a generic web app.

1. archGraph node labels must name components native to this actual system
   - BAD: "Service", "Database", "Queue"
   - GOOD for Instagram: "Feed Ranking Engine", "Post CDN Edge", "Like Event Bus", "Story Expiry Worker"
   - GOOD for Uber: "Driver Location Service", "Surge Pricing Engine", "Trip State Machine"
2. Option descriptions must address this system's known challenges with real mechanisms and numbers
   - BAD: "Use Kafka for async processing"
   - GOOD: "For Instagram fan-out: pre-compute feeds at write time for accounts <10K followers; pull-on-read + CDN pre-warming for celebrities (>1M followers) when engagement velocity exceeds 500 events/second"
3. roleInsights must name specific failure modes for this system's domain
4. antiPatterns must be real failure modes teams building THIS type of system actually encounter
5. deepDive must reference real companies, real incidents, and specific optimizations not covered in the decision steps

OUTPUT RULES:
- EXACTLY 4 options per step, each from a DIFFERENT patternId (01-16)
- recommendedOption choices must together form one coherent architecture
- EXACTLY 3 roleInsights per step (most relevant roles)
- Name real technologies
- VALID JSON only, no markdown

JSON schema:
{
  "systemName": "<2-4 word name>",
  "systemDescription": "<2 sentences>",
  "steps": [
    {
      "step": 1,
      "question": "<the forcing architectural question>",
      "context": "<1-2 sentences: why this matters>",
      "options": [
        {"id":"A","label":"<2-4 words>","description":"<1-2 sentences, system-specific>","tradeoff":"<1 sentence>","patternId":"01","patternName":"<name>"},
        {"id":"B","label":"...","description":"...","tradeoff":"...","patternId":"...","patternName":"..."},
        {"id":"C","label":"...","description":"...","tradeoff":"...","patternId":"...","patternName":"..."},
        {"id":"D","label":"...","description":"...","tradeoff":"...","patternId":"...","patternName":"..."}
      ],
      "recommendedOption": "A",
      "archGraph": {"nodes":[...],"edges":[...]},
      "roleInsights": [
        {"role":"sre","insight":"<1 sentence, specific to this system>"},
        {"role":"backend","insight":"<1 sentence, specific to this system>"},
        {"role":"architect","insight":"<1 sentence, specific to this system>"}
      ]
    }
  ],
  "finalGraph": {"nodes":[...],"edges":[...]},
  "summary": "<3 sentences: what was built, scale, trade-off>",
  "keyInsights": ["<deep insight 1 specific to this system>","<insight 2>","<insight 3>"],
  "antiPatterns": [
    {
      "title": "<specific anti-pattern name for this system>",
      "description": "<why this is bad specifically for THIS system — concrete impact>",
      "remedy": "<specific fix adapted to this system>"
    }
  ],
  "deepDive": "<3-4 paragraphs separated by double newlines. Must include: (1) the 2-3 core engineering challenges unique to this system, (2) how real companies solved similar problems (name them and cite specific techniques), (3) system-specific optimizations not covered in the decision steps, (4) important edge cases or failure modes to plan for. Write at the level of a senior engineer who deeply knows this domain.>"
}`;

function parseJSON(content) {
  try { return JSON.parse(content); } catch {}
  const m = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) try { return JSON.parse(m[1]); } catch {}
  return null;
}

// FNV-1a 32-bit hash — cache key for identical/near-identical descriptions
function hashDescription(s) {
  const norm = s.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 300);
  let h = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS });
  }

  let jobId, systemDescription;
  try {
    ({ jobId, systemDescription } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS });
  }

  if (!jobId || !systemDescription) {
    return new Response(JSON.stringify({ error: 'jobId and systemDescription required' }), { status: 400, headers: CORS });
  }

  const store = getStore('design-jobs');
  const cache = getStore('design-cache');
  const userPrompt = `Design this system: ${systemDescription.slice(0, 500)}`;
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey   = process.env.GROQ_API_KEY;

  // Check cache first — same description returns instant result, saves AI budget
  const cacheKey = `design_${hashDescription(systemDescription)}`;
  try {
    const cached = await cache.get(cacheKey, { type: 'json' });
    if (cached?.status === 'done' && cached?.data?.steps?.length >= 3) {
      await store.setJSON(jobId, cached, { ttl: 3600 });
      return new Response(null, { status: 200, headers: CORS });
    }
  } catch { /* cache miss — proceed to AI */ }

  // Store pending so poll knows the job started
  await store.setJSON(jobId, { status: 'pending' }, { ttl: 3600 });

  try {
    let parsed = null;

    // ── 1. Gemini 2.5 Flash (primary) ──────────────────────────────────────
    if (geminiKey && !parsed) {
      try {
        const res = await fetch(
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
                maxOutputTokens: 16384,
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) parsed = parseJSON(content);
        }
      } catch (_) { /* fall through */ }
    }

    // ── 2. Groq fallback ────────────────────────────────────────────────────
    if (!parsed && groqKey) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user',   content: userPrompt },
            ],
            temperature: 0.65,
            max_tokens: 8000,
            response_format: { type: 'json_object' },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) parsed = parseJSON(content);
        }
      } catch (_) { /* fall through */ }
    }

    if (!parsed || !parsed.steps?.length) {
      await store.setJSON(jobId, { status: 'error', error: 'Could not generate plan. Please retry.' }, { ttl: 3600 });
    } else {
      const result = { status: 'done', data: parsed };
      await store.setJSON(jobId, result, { ttl: 3600 });
      // Cache for 7 days so identical descriptions skip AI entirely
      await cache.setJSON(cacheKey, result, { ttl: 604800 });
    }
  } catch (err) {
    await store.setJSON(jobId, { status: 'error', error: err.message }, { ttl: 3600 });
  }

  return new Response(null, { status: 200, headers: CORS });
};
