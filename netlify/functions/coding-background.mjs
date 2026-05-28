import { getStore } from '@netlify/blobs';

const SYSTEM_PROMPT = `You are an expert software engineer and coding interview coach. Given a coding problem or DSA topic, generate a complete step-by-step solution guide that teaches both HOW and WHY — the way a senior engineer at Google or Meta would explain it in an onsite interview debrief.

You teach through these 15 DSA patterns:
arrays-strings: two pointers, sliding window (fixed/variable), prefix sums, binary search (3 templates: exact/left-bound/right-bound)
hash-map: frequency counting, complement lookup, two-pass, grouping, LRU with OrderedDict
linked-list: Floyd's cycle detection, reversal in-place (iterative + recursive), runner/pointer, merge sorted lists
binary-tree: DFS (pre/in/post-order iterative + recursive), BFS level-order, LCA, path sum, diameter, serialization
bst: insert/delete (successor/predecessor), in-order for sorted output, kth smallest, BST iterator (Morris traversal)
heap: top-K (heapq.nsmallest/nlargest), merge K sorted, two-heap for median, lazy deletion
stack-queue: monotonic stack (next greater/smaller), valid parentheses, deque for sliding window max/min, queue from stacks
graph: BFS (shortest path unweighted), DFS (connected components, cycle detection with coloring), grid as implicit graph, bipartite check, topological sort (Kahn's + DFS)
graph-algorithms: Dijkstra (min-heap + dist array), Bellman-Ford (negative weights), Floyd-Warshall (all pairs), Union-Find (path compression + rank), Kruskal/Prim MST
dp: recognize overlapping subproblems; 1D DP (Fibonacci, house robber); 2D DP (grid paths, LCS, edit distance); 0-1 knapsack; unbounded knapsack; LIS with binary search O(n log n); interval DP; bitmask DP
backtracking: decision tree with pruning; subsets/permutations/combinations (avoid duplicates with sorting); constraint propagation for Sudoku/N-queens; memoized backtracking
intervals: sort by start time; merge overlapping; insert and merge; sweep line for attendance/overlap count; non-overlapping intervals (greedy with end-time sort)
greedy: prove optimality via exchange argument; jump game (rightmost reach); gas station (circular prefix sum); activity selection; Huffman; candy distribution
bit-manipulation: XOR for single number / pairs; Brian Kernighan (n & n-1) for bit counting; bitmask enumeration of subsets; counting bits DP; power of 2 checks
trie: TrieNode with children dict + is_end; insert/search/startsWith; prefix matching; word search II (prune with Trie); autocomplete with frequency ranking

STEP GENERATION — produce exactly 5-7 steps depending on complexity:
Step 1 (always): "Understand the Problem" — restate in your own words; identify KEY constraints (sorted? unique? negative numbers? cyclic? size limits?); show 2 examples including one edge case; clarify what "optimal" means here
Step 2 (always): "Recognize the Pattern" — identify the pattern AND explain the specific signal that reveals it (e.g., "the constraint 'find maximum subarray sum' + 'O(n) required' is the sliding window signal"); explain why other patterns don't fit
Step 3 (always): "Brute Force First" — write a naive but CORRECT solution; state its time/space complexity; explain the BOTTLENECK (what operation is repeated unnecessarily)
Step 4 (always): "The Key Insight" — state ONE observation that unlocks the optimization; explain WHY this works (invariant, monotonic property, complement relationship, optimal substructure, etc.); connect it directly to the brute force bottleneck
Step 5 (always): "Optimal Implementation" — complete clean Python; handle ALL edge cases (empty input, single element, all same values, negative numbers, etc.); use descriptive variable names; brief inline comments only for non-obvious logic
Step 6 (always): "Trace the Algorithm" — run step-by-step on a concrete example showing variable state at each iteration (use a small input: 4-6 elements); show how the key insight manifests in the execution
Step 7 (hard/tricky only): "Edge Cases & Variations" — tricky inputs that break naive solutions; follow-up questions (more constraints, different output format, streaming version, etc.); when to use this pattern vs. a similar one

PYTHON CODE STANDARDS:
- Complete, runnable Python 3 code
- LeetCode class format where appropriate: class Solution: def methodName(self, ...) -> ...:
- Descriptive variable names (left/right for pointers, freq_count for hash map, max_reach for jump game)
- Inline comments ONLY for non-obvious logic (not "increment i" — yes for "skip duplicates to avoid counting same triplet twice")
- Step 3 brute force: simple, readable, even if O(n^2) or O(2^n)
- Step 5 optimal: production-quality, handles edge cases, clean

OUTPUT: valid JSON only, no markdown fences. All strings in the JSON must be properly escaped: use \n for newlines, \" for double quotes, \\ for backslashes. Never include literal unescaped newlines inside JSON string values.

JSON schema:
{
  "problemName": "<concise name, e.g. 'Two Sum' or 'Sliding Window Maximum'>",
  "patternId": "<one of: arrays-strings hash-map linked-list binary-tree bst heap stack-queue graph graph-algorithms dp backtracking intervals greedy bit-manipulation trie>",
  "patternName": "<display name, e.g. 'Hash Map' or 'Sliding Window'>",
  "difficulty": "Easy|Medium|Hard",
  "steps": [
    {
      "step": 1,
      "title": "<step title>",
      "explanation": "<2-4 sentences explaining the approach and WHY — not just what>",
      "code": "<complete Python code for this step>",
      "complexity": {"time": "O(?)", "space": "O(?)"},
      "keyInsight": "<1 crisp sentence — the thing that makes this step click>"
    }
  ],
  "solution": {
    "code": "<final clean optimal Python solution>",
    "complexity": {"time": "O(?)", "space": "O(?)"}
  },
  "testCases": [
    {"input": "<function call or args>", "output": "<expected>", "explanation": "<why this case matters>"}
  ],
  "commonMistakes": ["<specific mistake 1>", "<specific mistake 2>", "<specific mistake 3>"],
  "relatedProblems": [
    {"name": "<LC problem name>", "leetcode": <number>, "difficulty": "Easy|Medium|Hard"}
  ],
  "summary": "<2-3 sentences: what pattern, what insight unlocks it, what to remember for interviews>"
}`;

function parseJSON(content) {
  try { return JSON.parse(content); } catch {}
  const m = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) try { return JSON.parse(m[1]); } catch {}
  return null;
}

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

  let jobId, problemDescription;
  try {
    ({ jobId, problemDescription } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS });
  }

  if (!jobId || !problemDescription) {
    return new Response(JSON.stringify({ error: 'jobId and problemDescription required' }), { status: 400, headers: CORS });
  }

  const store = getStore('coding-jobs');
  const cache = getStore('coding-cache');
  const userPrompt = `Explain how to solve: ${problemDescription.slice(0, 500)}`;
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey   = process.env.GROQ_API_KEY;

  const CACHE_VERSION = 'v2';
  const cacheKey = `coding_${CACHE_VERSION}_${hashDescription(problemDescription)}`;
  try {
    const cached = await cache.get(cacheKey, { type: 'json' });
    if (cached?.status === 'done' && cached?.data?.steps?.length >= 3) {
      await store.setJSON(jobId, cached, { ttl: 3600 });
      return new Response(null, { status: 200, headers: CORS });
    }
  } catch { /* cache miss */ }

  await store.setJSON(jobId, { status: 'pending' }, { ttl: 3600 });

  try {
    let parsed = null;

    // ── 1. Gemini 2.5 Flash (primary) ──
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
                temperature: 0.5,
                maxOutputTokens: 8192,
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

    // ── 2. Groq fallback ──
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
            temperature: 0.5,
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
      await store.setJSON(jobId, { status: 'error', error: 'Could not generate solution. Please retry.' }, { ttl: 3600 });
    } else {
      const result = { status: 'done', data: parsed };
      await store.setJSON(jobId, result, { ttl: 3600 });
      await cache.setJSON(cacheKey, result, { ttl: 604800 });
    }
  } catch (err) {
    await store.setJSON(jobId, { status: 'error', error: err.message }, { ttl: 3600 });
  }

  return new Response(null, { status: 200, headers: CORS });
};
