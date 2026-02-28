# KnowAlgo — Data Structures & Algorithms, Explained Deeply

**Live site:** https://anurag2809.github.io/know-algo/

KnowAlgo is a free, open-source educational website that teaches Data Structures and Algorithms with deep explanations — not just how to code them, but *why* they work. Every guide includes visual ASCII diagrams, Python implementations with inline comments, and full LeetCode solutions with complexity analysis.

---

## What's Inside

| Guide | Topics | LC Problems |
|---|---|---|
| [Arrays & Strings](arrays-strings.html) | Two pointers, sliding window (fixed/variable), prefix sums, binary search (3 templates) | 8 |
| [Backtracking](backtracking.html) | Subsets, permutations, combinations, grid DFS, N-queens, Sudoku, pruning | 8 |
| [Intervals](intervals.html) | Merge, insert, meeting rooms, non-overlapping, sweep line | 7 |
| [Greedy Algorithms](greedy.html) | Jump Game I/II, Gas Station, Task Scheduler, Candy, Partition Labels | 8 |
| [Bit Manipulation](bit-manipulation.html) | XOR tricks, Brian Kernighan, bitmasks, counting bits DP | 8 |
| [Dynamic Programming](dp.html) | 1D/2D DP, knapsack, LCS, LIS O(n log n), space optimization | 8 |
| [Graph: Traversal](graph.html) | BFS, DFS, grid, multi-source BFS, cycle detection | 6 |
| [Graph: Weighted Algorithms](graph-algorithms.html) | Dijkstra, Bellman-Ford, Floyd-Warshall, Topo Sort, Union-Find, MST | 6 |
| [Binary Tree](binary-tree.html) | All 4 traversals, DFS patterns, LCA, serialize/deserialize | 6 |
| [Binary Search Tree](bst.html) | Insert/delete/search, kth smallest, BST iterator | 6 |
| [Heap / Priority Queue](heap.html) | Min/max heap, heapify O(n), Top-K, median from stream | 5 |
| [Stack & Queue](stack-queue.html) | Monotonic stack/deque, next greater element, sliding window max | 6 |
| [Hash Map](hash-map.html) | Collision resolution, load factor, LRU Cache | 6 |
| [Linked List](linked-list.html) | Floyd's cycle, runner technique, reversal, merge | 6 |
| [Trie (Prefix Tree)](trie.html) | Insert/search/startsWith/delete, FrequencyTrie | 6 |
| **[Interview Prep Guide](interview-prep.html)** | **8-week study plan, 90-problem curated list (Blind 75 + NeetCode 150), pattern cheatsheet** | **90+** |

**Total: 15 deep-dive guides · 90+ LeetCode solutions · 100% free**

---

## Interview Prep

The [Interview Prep Guide](interview-prep.html) is the master study guide that ties everything together:

- **8-week structured study plan** — one topic cluster per week, ~2 problems/day
- **90-problem curated list** — tagged with Blind 75 and NeetCode 150 coverage, linked to the relevant deep-dive
- **15-pattern recognition cheatsheet** — trigger phrases to identify patterns quickly
- **Interview strategy** — 45-minute time breakdown, what to do when stuck, complexity rules of thumb

---

## Design & Tech Stack

- Pure static HTML/CSS/JS — no frameworks, no build step
- [Prism.js](https://prismjs.com/) for syntax highlighting (prism-tomorrow theme)
- Google Analytics (`G-2Z1EQCZBXH`)
- JSON-LD structured data on every page (Schema.org TechArticle)
- Reading progress bar, sticky TOC sidebar with IntersectionObserver
- Fully responsive (mobile sidebar hidden, single-column layout)

---

## AI Discoverability

This site is designed to be AI-readable:

- **[`/llms.txt`](llms.txt)** — machine-readable site index following the [llmstxt.org](https://llmstxt.org/) standard
- **[`/sitemap.xml`](sitemap.xml)** — standard XML sitemap for crawlers
- **[`/robots.txt`](robots.txt)** — explicitly welcomes AI crawlers (GPTBot, ClaudeBot, PerplexityBot)
- **JSON-LD** structured data on every page

---

## Local Development

No build step needed. Just open any `.html` file in a browser, or serve locally:

```bash
# Python
python3 -m http.server 8000

# Node (npx)
npx serve .
```

Then open http://localhost:8000

---

## License

Free to use for educational purposes. © 2026 KnowAlgo.
