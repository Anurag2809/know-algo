import { getStore } from '@netlify/blobs';

const SYSTEM_PROMPT = `You are a senior system design architect. Given a system to design, generate a COMPLETE guided design session with ALL 7 decision steps in a SINGLE response.

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

DECISION FLOW — adapt questions and tech choices to the specific system:
Step 1 — Scale & constraints: DAU, req/s, data volume, latency SLA, deployment model
Step 2 — Entry point: CDN, load balancer, API gateway, edge, service mesh
Step 3 — Core storage: primary data store for the main entity
Step 4 — Read path: fast reads via caching, search index, or read replicas
Step 5 — Write path & async: high-write handling, queuing, consistency, background jobs
Step 6 — Reliability: failure modes, circuit breaking, SLOs, multi-region failover
Step 7 — Observability: metrics, distributed tracing, alerting, SRE practice

ARCHITECTURE GRAPH — for each step generate an "archGraph" field:
Tiers: 0=Client 1=Gateway 2=Service 3=Data 4=Observability
Types: client gateway service cache database queue ml monitoring unknown
- Step 1: client node + 1 unknown node ("??? Scale Decision ???")
- Step N: all prior decided nodes + 1 unknown node for current decision
- Step 7: all nodes named, no unknown
- Add 1-3 new named nodes per step as architecture grows
- Use MULTIPLE service nodes at tier 2 for microservice systems; add service→service edges
- Max 15 nodes total; 4–9 edges per step
- Node labels: ≤4 words, NO newlines
- Edge labels: REST, gRPC, events, reads, writes, HTTPS, async

JSON format for archGraph:
{"nodes":[{"id":"unique-id","label":"Short Name","tier":0,"type":"client"}],"edges":[{"from":"id","to":"id","label":"optional"}]}

For finalGraph: same format, all nodes named (no unknown), complete data flow.

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
        {"id":"A","label":"<2-4 words>","description":"<1-2 sentences>","tradeoff":"<1 sentence>","patternId":"01","patternName":"<name>"},
        {"id":"B","label":"...","description":"...","tradeoff":"...","patternId":"...","patternName":"..."},
        {"id":"C","label":"...","description":"...","tradeoff":"...","patternId":"...","patternName":"..."},
        {"id":"D","label":"...","description":"...","tradeoff":"...","patternId":"...","patternName":"..."}
      ],
      "recommendedOption": "A",
      "archGraph": {"nodes":[...],"edges":[...]},
      "roleInsights": [
        {"role":"sre","insight":"<1 sentence>"},
        {"role":"backend","insight":"<1 sentence>"},
        {"role":"architect","insight":"<1 sentence>"}
      ]
    }
  ],
  "finalGraph": {"nodes":[...],"edges":[...]},
  "summary": "<3 sentences: what was built, scale, trade-off>",
  "keyInsights": ["<insight 1>","<insight 2>","<insight 3>"]
}`;

function parseJSON(content) {
  try { return JSON.parse(content); } catch {}
  const m = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) try { return JSON.parse(m[1]); } catch {}
  return null;
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
  const userPrompt = `Design this system: ${systemDescription.slice(0, 500)}`;
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey   = process.env.GROQ_API_KEY;

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
            max_tokens: 6000,
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
      await store.setJSON(jobId, { status: 'done', data: parsed }, { ttl: 3600 });
    }
  } catch (err) {
    await store.setJSON(jobId, { status: 'error', error: err.message }, { ttl: 3600 });
  }

  return new Response(null, { status: 200, headers: CORS });
};
