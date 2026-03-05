# YC Coding Session — Marketing Agent Architecture Review

**Date:** 2026-03-05
**Repository:** Marketing- (Next.js 16 + TypeScript + Supabase + Google Vertex AI)

---

## User:

Review the core logic in my marketing agent repository, specifically focusing on the file that handles API requests and state management (e.g., agent.py or main.py). Analyze the current architecture for handling API rate limits and token exhaustion. Identify any potential race conditions if multiple agents execute simultaneously.

---

## Claude:

### Architecture Review: API Request Handling & State Management

#### Overview

This is a **Next.js 16 full-stack application** using TypeScript. There is no `agent.py` or `main.py` — the core logic is entirely in TypeScript services under `lib/services/` with API routes under `app/api/`. The AI backend is Google Cloud Vertex AI (Gemini models), with Supabase for persistence.

---

### 1. API Rate Limit Handling — Critical Gaps

**Current state: No rate limiting exists at any layer.**

| Layer | Status |
|-------|--------|
| API route level | No middleware, no per-user throttling |
| AI service level (`aiService.ts`) | No retry-after handling, no backoff |
| Supabase calls | No connection pooling limits |
| Client-side | No debounce visible in API routes |

**Specific issues in `aiService.ts`:**

- **Lines 91-128** (`generateContent`): The model fallback loop tries 4 models sequentially on failure, but it treats **all** HTTP errors the same — a `429 Too Many Requests` is handled identically to a `404 Not Found`. There's no `Retry-After` header parsing, no exponential backoff, and no distinction between transient vs. permanent failures.

- **Lines 161-217** (`generateImage`): Uses a single model (`imagen-4.0-generate-001`) with zero retry logic. One rate limit hit = immediate failure.

- **API key in URL** (line 98): `?key=${process.env.GOOGLE_API_KEY}` — a single shared API key for all users means one user's burst can exhaust the quota for everyone.

---

### 2. Token Exhaustion Analysis

**No token budget tracking exists anywhere.**

- `maxOutputTokens` is hardcoded per method: `2048` for text (line 107), `1024` for image analysis (line 287), `512` for logo analysis (line 340). These are never adjusted based on prompt size.

- **Prompt inflation in `storyGenerator.ts` lines 106-159**: The `buildContextAwarePrompt` method concatenates RAG chunks + user profile + user preferences + variation instructions with no size cap. With 5 RAG chunks and 10 user memories, the input can easily exceed model context limits.

- **Prompt inflation in `contentCreator.ts` lines 76-209**: `buildPrompt` concatenates up to 36 liked style memories + 36 disliked style memories per platform into the prompt, with no truncation.

- **No input token counting** — the system never measures prompt size before sending to the API.

---

### 3. Race Conditions with Concurrent Agents

**Several concrete race conditions exist:**

#### 3a. Story Cache — Unprotected Shared Mutable State (`storyCache.ts`)

The `StoryCache` is an **in-memory `Map` singleton** (line 76: `export const storyCache = new StoryCache()`). In the stories API route (`app/api/stories/route.ts`):

```typescript
Line 51:  const cached = storyCache.get(cacheKey);  // CHECK
Line 82:  const stories = await storyGenerator...     // GENERATE (async, ~seconds)
Line 110: storyCache.set(cacheKey, cacheData);        // SET
```

This is a classic **check-then-act race**. Two concurrent requests with the same prompt will both miss the cache check, both trigger expensive AI generation, and both write to the cache — wasting API quota and potentially causing inconsistent sub-block updates on lines 112-129.

#### 3b. Memory Cleanup — Non-Atomic Count-Then-Delete (`userMemoryService.ts`)

In `cleanupOldMemories` (lines 253-281):

```typescript
Step 1: SELECT count(*)        // line 257
Step 2: DELETE ... LIMIT N     // line 270
```

Two concurrent `addMemory` calls for the same user+type can both read `count = 36`, both calculate `toDelete = 1`, and both delete 1 row — resulting in only 35 rows instead of 36. Over time, this undercount compounds.

#### 3c. Parallel Story Generation — Shared `stories` Object (`aiService.ts`)

In `generateStories` (lines 139-156):

```typescript
const stories: Record<string, string> = {};
await Promise.all(
  styles.map(async (style) => {
    stories[style] = await this.generateStory(...);  // concurrent writes
  })
);
```

While JavaScript is single-threaded per event loop tick, the `stories[style] = ...` writes happen after separate `await` calls, so they interleave safely in Node.js. **This is actually safe** due to JS concurrency model — but it's a pattern that would break if moved to a worker-thread architecture.

#### 3d. Sub-Block Updates — No Optimistic Locking (`app/api/stories/route.ts`)

Lines 113-129 perform read-then-write on sub-blocks without any version check:

```typescript
const existing = await subBlockStorage.getByUserId(subBlockId, userId);  // READ
await subBlockStorage.update({ ...existing, ... });                       // WRITE
```

Two concurrent story generations for the same sub-block will each read the same version and the last write wins, potentially losing the first update's data.

#### 3e. `AIService` Singleton Reinitialization (`aiService.ts`)

The `reloadApiKey()` method (line 69) calls `this.initialize()` which reassigns `this.vertexAI` and `this.genAI`. If called while a request is in-flight, the client objects could be replaced mid-request.

---

### 4. Additional Architectural Concerns

**No request queuing or concurrency limits**: `Promise.all` in `storyGenerator.ts:64` fires 3 AI requests simultaneously. `contentCreator.ts:59` fires N platform requests simultaneously. A single user action can spawn 3 (stories) + 4 (platforms) = 7 concurrent Gemini API calls. Multiply by concurrent users and quota is exhausted quickly.

**No circuit breaker**: If Gemini API goes down, every request still attempts all model fallbacks sequentially before failing — amplifying latency.

**In-memory cache lost on deploy**: `storyCache` is a process-local `Map`. Any Next.js server restart (deploy, scale event, crash) loses all cached stories, causing cache-dependent flows (like `contentCreator.ts:26` which throws `"Story not found"`) to fail.

---

### Summary of Findings

| Issue | Severity | Location |
|-------|----------|----------|
| No API rate limiting at any layer | **High** | All API routes |
| No retry/backoff for 429 responses | **High** | `aiService.ts:91-128` |
| Single shared API key for all users | **High** | `aiService.ts:98` |
| Cache check-then-act race condition | **Medium** | `stories/route.ts:51-110` |
| Non-atomic memory cleanup | **Medium** | `userMemoryService.ts:253-281` |
| Sub-block update without optimistic locking | **Medium** | `stories/route.ts:113-129` |
| Unbounded prompt size (token exhaustion) | **Medium** | `storyGenerator.ts`, `contentCreator.ts` |
| No input token counting | **Medium** | `aiService.ts` |
| In-memory cache lost on restart | **Low** | `storyCache.ts` |
| Singleton reinitialization during requests | **Low** | `aiService.ts:69` |

---

## User:

That analysis is too basic. Assume a scenario where the system hits a hard 429 Too Many Requests error from a target platform during a mid-generation state. Propose a deterministic fallback architecture—without writing the exact code yet—that caches the agent's current state locally and implements a distributed lock to prevent duplicate posts.

---

## Claude:

### Precise Enumeration of Mid-Generation Failure Points

A 429 from Gemini does not hit one place. It hits at **seven distinct call-sites**, each leaving the system in a different partial state.

A single user action ("generate content for my story across 4 platforms") triggers this **call graph**, where every arrow is a separate Gemini HTTP call that can independently 429:

```
POST /api/stories
 |-- storyGenerator.generateStories()
 |   |-- vectorStore.searchSimilarChunks()
 |   |   \--> [CALL A] embeddingGoogleCloud.generateEmbedding(query)   // Vertex AI embedding
 |   |--> [CALL B] preferenceExtractor.extractPreferences()            // Gemini text gen
 |   \-- Promise.all(3 variations)
 |       |--> [CALL C1] aiService.generateContent(professional)        // Gemini text gen
 |       |--> [CALL C2] aiService.generateContent(viral)               // Gemini text gen
 |       \--> [CALL C3] aiService.generateContent(storyteller)         // Gemini text gen
 |
POST /api/content  (after story selection)
 |-- contentCreator.generateContent()
 |   \-- Promise.all(4 platforms)
 |       |--> [CALL D1] aiService.generateContent(linkedin)            // Gemini text gen
 |       |--> [CALL D2] aiService.generateContent(twitter)             // Gemini text gen
 |       |--> [CALL D3] aiService.generateContent(instagram)           // Gemini text gen
 |       \--> [CALL D4] aiService.generateContent(facebook)            // Gemini text gen
 |
POST /api/images  (after content generation)
 |--> [CALL E] aiService.generateContent(enhancePrompt)                // Gemini text gen
 \--> [CALL F] aiService.generateImage(imagen)                         // Imagen API
```

**Key insight**: A 429 at [CALL C2] means C1 succeeded and C3 may have succeeded. The system currently **discards the successful results** and returns a blanket 500 to the client.

### State Corruption Scenarios

| 429 Location | What Already Succeeded | What's Lost | Corrupt State |
|---|---|---|---|
| CALL A (embedding) | Nothing | Query embedding | None — but RAG context unavailable |
| CALL B (preferences) | RAG chunks retrieved | Preference extraction | None — preferences optional |
| CALL C2 (viral story) | Professional story generated | Viral + maybe storyteller | `storyCache` never written; sub-block never updated |
| CALL D3 (instagram) | LinkedIn + Twitter captions | Instagram + Facebook | Client gets partial `contents` object with missing keys |
| CALL E (prompt enhance) | All captions | Enhanced image prompt | No image generated |
| CALL F (imagen) | Enhanced prompt | Actual image bytes | Prompt saved but no image URL; sub-block inconsistent |

---

### Generation Task State Machine

Every generation request transitions through deterministic phases. The fallback architecture persists state at each phase boundary so recovery never redoes completed work.

```
+-------------+     +--------------+     +----------------+     +---------------+
|  SUBMITTED  |---->|  CONTEXT     |---->|  GENERATING    |---->|  FINALIZING   |
|             |     |  GATHERING   |     |                |     |               |
| request_id  |     | rag_chunks   |     | partial_results|     | cache_written |
| user_id     |     | user_profile |     | per-variation  |     | sub_block_ok  |
| prompt      |     | preferences  |     | per-platform   |     | storage_ok    |
| block_id    |     |              |     |                |     |               |
+-------------+     +--------------+     +----------------+     +---------------+
       |                    |                     |                      |
       v                    v                     v                      v
   +--------+          +--------+           +---------+           +----------+
   | FAILED |          | FAILED |           | PARTIAL |           | COMPLETED|
   | (retry |          | (retry |           | (resume |           |          |
   |  all)  |          |  from  |           |  from   |           |          |
   |        |          |  here) |           | missing |           |          |
   +--------+          +--------+           | items)  |           +----------+
                                            +---------+
```

#### Checkpoint Schema (new Supabase table: `generation_tasks`)

```
generation_tasks
|-- id: uuid (PK)                          -- deterministic: hash(user_id, block_id, prompt, timestamp_bucket)
|-- user_id: uuid (FK)
|-- block_id: uuid (FK)
|-- sub_block_id: uuid (FK, nullable)
|-- task_type: enum('story', 'content', 'image')
|-- phase: enum('submitted', 'context_gathering', 'generating', 'finalizing', 'completed', 'failed')
|-- request_params: jsonb                  -- original request body (immutable)
|-- context_snapshot: jsonb                -- { rag_chunks, user_profile, preferences }
|-- partial_results: jsonb                 -- { "professional": "...", "viral": null, "storyteller": "..." }
|-- error_log: jsonb[]                     -- [{ call_site, status, retry_after, timestamp }]
|-- retry_count: int (default 0)
|-- max_retries: int (default 5)
|-- next_retry_at: timestamptz             -- computed from Retry-After header or exponential backoff
|-- lock_holder: text (nullable)           -- instance_id holding the distributed lock
|-- lock_expires_at: timestamptz           -- TTL for lock auto-release
|-- created_at: timestamptz
|-- updated_at: timestamptz
|-- completed_at: timestamptz (nullable)
```

---

### Deterministic Retry with Surgical Resume

#### The 429 Discriminator

The current `aiService.generateContent` loop (lines 91-128) treats all failures identically. The new architecture classifies every non-2xx response:

```
Response Analysis:
  |-- 429 + Retry-After header present
  |     -> Parse header value (seconds or HTTP-date)
  |     -> Set next_retry_at = now + retry_after + jitter(0-2s)
  |     -> Checkpoint current partial_results
  |     -> Return RETRIABLE_429
  |
  |-- 429 + No Retry-After
  |     -> Use exponential backoff: min(2^retry_count * 1000, 64000) + jitter
  |     -> Checkpoint current partial_results
  |     -> Return RETRIABLE_429
  |
  |-- 429 + "quota exceeded" in body (daily/monthly quota, not rate limit)
  |     -> This is NOT retriable on short timescales
  |     -> Mark task phase = 'failed', error = QUOTA_EXHAUSTED
  |     -> Return partial_results to client with degraded flag
  |     -> Do NOT retry automatically
  |
  |-- 404 (model not found)
  |     -> Skip to next model in fallback list (existing behavior)
  |     -> Do NOT checkpoint -- this is model selection, not state
  |
  \-- 500/503 (server error)
        -> Treat as retriable with shorter backoff ceiling (16s max)
        -> Checkpoint partial_results
```

#### Surgical Resume — Only Regenerate What's Missing

When a story generation 429s at variation 2 of 3:

```json
{
  "professional": "The future of AI in marketing...",
  "viral": null,
  "storyteller": null
}
```

On resume, the system:
1. Reads `generation_tasks` row by deterministic ID
2. Reads `context_snapshot` — does **not** re-query RAG or re-extract preferences
3. Iterates `partial_results`, finds keys with `null` values
4. Generates **only** the missing variations using the **same** `context_snapshot`
5. Merges into `partial_results` and advances phase

This is critical because:
- The RAG chunks may have changed between original request and retry (new files uploaded)
- User preferences may have changed (new like/dislike)
- Using the **snapshot** ensures deterministic output: same context in = comparable output out

#### The Concurrency Problem with Promise.all

Currently `storyGenerator.ts:64` and `contentCreator.ts:59` use bare `Promise.all`. A 429 on one concurrent call doesn't cancel the others — they continue burning quota. The architecture replaces this with:

**Cooperative cancellation via AbortController propagation:**

```
For each generation batch (3 stories or 4 platforms):
  1. Create shared AbortController
  2. Wrap each aiService.generateContent call with the signal
  3. On first 429:
     a. Abort remaining in-flight requests (they haven't consumed quota yet if still connecting)
     b. Collect results from already-completed promises
     c. Write checkpoint with partial_results
     d. Schedule retry for remaining items
```

This prevents the cascade where one 429 means 2 other calls also hit the rate limit and get 429'd, tripling the backoff penalty.

---

### Distributed Lock — Preventing Duplicate Posts

#### Why This Is Necessary

Three scenarios cause duplicate generation without locking:

1. **User double-click**: Two POST /api/stories arrive < 100ms apart with identical params
2. **Retry storm**: Client-side retry + server-side retry both execute; or the browser retry-on-timeout fires while the server is still in backoff
3. **Background resume**: A scheduled retry picks up a checkpointed task while the user manually re-triggers

#### Lock Design Using Supabase Advisory Locks + Row-Level Locking

**Layer 1: Deterministic Task ID (idempotency key)**

```
task_id = SHA-256(user_id + block_id + prompt_normalized + floor(timestamp / 60000))
```

The 60-second time bucket means identical requests within the same minute map to the same task. This is the **idempotency key**.

**Layer 2: Supabase Row Lock via `SELECT ... FOR UPDATE SKIP LOCKED`**

```sql
-- Attempt to acquire lock on a generation task
-- Returns the row if lock acquired, empty if another worker holds it

SELECT * FROM generation_tasks
WHERE id = $task_id
  AND phase NOT IN ('completed', 'failed')
  AND (lock_holder IS NULL OR lock_expires_at < now())
FOR UPDATE SKIP LOCKED;

-- If row returned, update lock:
UPDATE generation_tasks
SET lock_holder = $instance_id,
    lock_expires_at = now() + interval '120 seconds'
WHERE id = $task_id;
```

**Why `SKIP LOCKED` instead of `NOWAIT`**: `NOWAIT` throws an error immediately if locked. `SKIP LOCKED` returns an empty result set, which lets the API route distinguish between "task exists and is being processed" (return 202 + task_id to client) vs "task doesn't exist" (create it).

**Layer 3: Lock TTL and Heartbeat**

- Lock TTL: 120 seconds (maximum expected generation time for 3 stories)
- During generation, the worker extends the lock every 30 seconds by updating `lock_expires_at`
- If a worker crashes mid-generation, the lock expires and another worker (or scheduled retry) picks it up
- The partial_results ensure the new worker doesn't redo completed work

**Layer 4: Instance Identity**

Each Next.js server process generates a unique `instance_id` at startup:

```
instance_id = hostname + pid + random_suffix
```

This goes into `lock_holder` so we can distinguish "I already hold this lock" from "someone else holds it."

#### Request Flow with Locking

```
Client POST /api/stories { prompt, blockId }
  |
  |-- Compute task_id = hash(userId, blockId, normalize(prompt), time_bucket)
  |
  |-- SELECT ... FOR UPDATE SKIP LOCKED where id = task_id
  |     |
  |     |-- Row returned (lock acquired):
  |     |     |-- phase = 'completed' -> Return cached result immediately
  |     |     |-- phase = 'generating', partial_results has data -> Resume from checkpoint
  |     |     \-- No row -> INSERT new task, begin generation
  |     |
  |     \-- No row returned (locked by another worker):
  |           \-- Return HTTP 202 { task_id, status: 'processing', retry_after: 5 }
  |               Client polls GET /api/stories/status/:task_id
  |
  |-- Execute generation with checkpointing
  |     |-- After each successful variation: UPDATE partial_results
  |     |-- On 429: checkpoint, release lock, set next_retry_at
  |     \-- On completion: set phase = 'completed', release lock
  |
  \-- Return result
```

---

### Background Retry Processor

A 429'd task that's been checkpointed needs to be retried. Two mechanisms:

#### Inline Retry (Synchronous — for short Retry-After values)

If `Retry-After` <= 10 seconds:
- Hold the request open
- Sleep for the indicated duration
- Retry the failed call(s) only
- This avoids the complexity of background processing for brief rate limits

#### Deferred Retry (Asynchronous — for longer backoffs)

If `Retry-After` > 10 seconds or retry_count > 2:

**Option A (recommended for this stack): Next.js Cron Route**

A new API route `GET /api/cron/retry-tasks` that:
1. Queries `generation_tasks WHERE phase IN ('generating', 'failed') AND next_retry_at <= now() AND retry_count < max_retries`
2. Acquires locks on returned rows
3. Resumes generation from `partial_results`
4. Triggered by Vercel Cron (if deployed there) or external cron every 30 seconds

**Option B (if Supabase Edge Functions available): Database Trigger**

A Supabase Edge Function triggered by `pg_cron` that processes the retry queue. This keeps retry logic closer to the data and avoids cold-start latency.

#### Client Notification

When a task completes asynchronously, the client needs to know. Two options:
- **Polling**: Client hits `GET /api/stories/status/:task_id` every 5 seconds after receiving a 202
- **Supabase Realtime**: Subscribe to `generation_tasks` changes filtered by `user_id`. When `phase` flips to `completed`, client receives the push and fetches results

---

### Interaction with Existing Components

#### StoryCache (storyCache.ts) — Becomes a Read-Through Layer

Currently the cache is the **only** persistence for generated stories. Under this architecture:
- `generation_tasks.partial_results` is the source of truth during generation
- `storyCache` becomes a **read-through cache** that hydrates from `generation_tasks` on miss
- Cache eviction (24h TTL) no longer causes data loss — the generation task row persists

#### UserMemoryService (userMemoryService.ts) — Cleanup Race Fix

The non-atomic count-then-delete in `cleanupOldMemories` is fixed by replacing the two-step operation with a single SQL statement:

```sql
DELETE FROM user_memories
WHERE id IN (
  SELECT id FROM user_memories
  WHERE user_id = $1 AND memory_type = $2
  ORDER BY created_at ASC
  OFFSET $limit  -- keep the newest $limit rows
)
```

This is atomic at the database level regardless of concurrent callers.

#### AIService Singleton (aiService.ts) — Token Bucket Gating

Before any call enters the Gemini API, it must acquire a token from a **process-local token bucket**:

```
Token Bucket Configuration:
  - Capacity: matches Gemini quota (e.g., 60 requests/minute for gemini-3-pro-preview)
  - Refill rate: 1 token per second
  - Per-model buckets (different models have different quotas)

Behavior:
  - If token available: proceed immediately
  - If bucket empty: calculate wait time, compare against request timeout
    - Wait time < 10s: sleep and retry
    - Wait time > 10s: checkpoint and defer
```

This prevents the system from **ever sending a request it knows will 429**, converting reactive error handling into proactive flow control.

---

### File Change Map

| File | Change Type | Purpose |
|------|------------|---------|
| `lib/services/aiService.ts` | Major refactor | 429 discriminator, token bucket, AbortController support |
| `lib/services/storyGenerator.ts` | Major refactor | Checkpoint-aware generation with surgical resume |
| `lib/services/contentCreator.ts` | Major refactor | Same checkpoint pattern for platform content |
| `lib/services/imageGenerator.ts` | Moderate | Checkpoint for image generation pipeline |
| `lib/services/storyCache.ts` | Moderate | Read-through from generation_tasks |
| `lib/services/userMemoryService.ts` | Minor | Atomic cleanup query |
| `lib/db/client.ts` | Minor | Add instance_id generation |
| `app/api/stories/route.ts` | Major refactor | Idempotency key, lock acquisition, 202 responses |
| `app/api/content/route.ts` | Major refactor | Same pattern |
| `app/api/images/route.ts` | Moderate | Same pattern |
| `app/api/stories/status/[taskId]/route.ts` | **New file** | Polling endpoint for async task status |
| `app/api/cron/retry-tasks/route.ts` | **New file** | Background retry processor |
| `supabase/migrations/YYYYMMDD_generation_tasks.sql` | **New file** | Schema + RLS + indexes |
| `lib/services/generationTaskService.ts` | **New file** | CRUD + locking for generation_tasks |
| `lib/services/tokenBucket.ts` | **New file** | Process-local rate limiter per model |

---

### What This Architecture Does NOT Solve (Explicit Scope Boundaries)

1. **Cross-process token bucket coordination**: The token bucket is per-process. If Next.js runs across multiple serverless instances, each has its own bucket. True coordination would require Redis or Supabase-backed counters. This is a Phase 2 concern.

2. **Gemini daily quota exhaustion**: If the daily quota is exceeded (not a rate limit, but an absolute cap), no amount of retrying helps. The system surfaces this as a distinct error to the user with ETA based on quota reset time.

3. **Client-side deduplication**: The distributed lock prevents server-side duplicates. A misbehaving client that strips the task_id from 202 responses and keeps re-posting is throttled by the idempotency key's time bucket, but not fully blocked. Rate limiting at the API gateway layer (Vercel/Cloudflare) is the correct complementary control.

4. **Partial result UX**: When 2 of 3 story variations succeed, the client currently expects all 3. The client components need to handle a `partial: true` flag and render available variations with a "retry remaining" button. This is a frontend concern outside this plan.

---

## Key Source Files Referenced

All paths relative to repository root.

| File | Role |
|------|------|
| `lib/services/aiService.ts` | Gemini API wrapper — text generation, image generation, vision analysis |
| `lib/services/storyGenerator.ts` | RAG-augmented story generation with user profiling |
| `lib/services/contentCreator.ts` | Platform-specific content generation (LinkedIn, Twitter, Instagram, Facebook) |
| `lib/services/imageGenerator.ts` | Image generation, logo compositing, prompt enhancement |
| `lib/services/storyCache.ts` | In-memory LRU cache for generated stories (24h TTL) |
| `lib/services/userMemoryService.ts` | User preference persistence with auto-cleanup (36 per type) |
| `lib/services/blockStorage.ts` | Supabase-backed block CRUD with multi-tenant isolation |
| `lib/services/vectorStore.ts` | pgvector semantic search over document embeddings |
| `lib/services/embedding.ts` | Embedding service facade |
| `lib/services/embeddingGoogleCloud.ts` | Google Cloud Vertex AI embedding client (gemini-embedding-001) |
| `lib/services/styleExtractor.ts` | AI-powered style analysis for liked/disliked content |
| `lib/services/preferenceExtractor.ts` | User writing style inference from text samples |
| `lib/db/client.ts` | Supabase client initialization |
| `app/api/stories/route.ts` | Story generation + like/dislike API route |
| `app/api/content/route.ts` | Content generation + like/dislike/modify API route |
| `app/api/images/route.ts` | Image generation + modify + like/dislike API route |

---

## Redaction Notice

The following classes of values were redacted from this transcript:

- **Google Cloud Project IDs**: All instances of hardcoded project identifiers replaced with `[REDACTED_PROJECT_ID]`
- **API Key references**: Code patterns like `?key=${process.env.GOOGLE_API_KEY}` are shown as environment variable references only; no actual key values appeared in the session
- **Database URIs**: Supabase URLs are referenced only via `process.env.SUPABASE_URL`; no literal URIs appeared
- **Credential blobs**: `GOOGLE_CLOUD_CREDENTIALS_BASE64` is referenced by env var name only; no base64 payloads appeared

No raw API keys, passwords, database connection strings, or IP addresses were present in the conversation transcript. All sensitive configuration is accessed exclusively via `process.env.*` references in the source code.
