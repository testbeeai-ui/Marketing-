# Deterministic 429 Fallback Architecture with State Checkpointing & Distributed Locking

## Problem Statement — The Actual Failure Topology

A 429 from Gemini does not hit one place. It hits at **seven distinct call-sites**, each leaving the system in a different partial state. This plan addresses each one with a unified architecture rather than sprinkling retries.

---

## Part 1: Precise Enumeration of Mid-Generation Failure Points

A single user action ("generate content for my story across 4 platforms") triggers this **call graph**, where every `→` is a separate Gemini HTTP call that can independently 429:

```
POST /api/stories
 ├─ storyGenerator.generateStories()
 │   ├─ vectorStore.searchSimilarChunks()
 │   │   └─→ [CALL A] embeddingGoogleCloud.generateEmbedding(query)   // Vertex AI embedding
 │   ├─→ [CALL B] preferenceExtractor.extractPreferences()            // Gemini text gen
 │   └─ Promise.all(3 variations)
 │       ├─→ [CALL C1] aiService.generateContent(professional)        // Gemini text gen
 │       ├─→ [CALL C2] aiService.generateContent(viral)               // Gemini text gen
 │       └─→ [CALL C3] aiService.generateContent(storyteller)         // Gemini text gen
 │
POST /api/content  (after story selection)
 ├─ contentCreator.generateContent()
 │   └─ Promise.all(4 platforms)
 │       ├─→ [CALL D1] aiService.generateContent(linkedin)            // Gemini text gen
 │       ├─→ [CALL D2] aiService.generateContent(twitter)             // Gemini text gen
 │       ├─→ [CALL D3] aiService.generateContent(instagram)           // Gemini text gen
 │       └─→ [CALL D4] aiService.generateContent(facebook)            // Gemini text gen
 │
POST /api/images  (after content generation)
 ├─→ [CALL E] aiService.generateContent(enhancePrompt)                // Gemini text gen
 └─→ [CALL F] aiService.generateImage(imagen)                         // Imagen API
```

**Key insight**: A 429 at [CALL C2] means C1 succeeded and C3 may have succeeded. The system currently **discards the successful results** and returns a blanket 500 to the client. This is the waste the architecture must eliminate.

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

## Part 2: Generation Task State Machine

Every generation request transitions through deterministic phases. The fallback architecture persists state at each phase boundary so recovery never redoes completed work.

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌───────────────┐
│  SUBMITTED   │────▸│  CONTEXT     │────▸│  GENERATING    │────▸│  FINALIZING   │
│              │     │  GATHERING   │     │                │     │               │
│ request_id   │     │ rag_chunks   │     │ partial_results│     │ cache_written │
│ user_id      │     │ user_profile │     │ per-variation  │     │ sub_block_ok  │
│ prompt       │     │ preferences  │     │ per-platform   │     │ storage_ok    │
│ block_id     │     │              │     │                │     │               │
└─────────────┘     └──────────────┘     └────────────────┘     └───────────────┘
       │                    │                     │                      │
       │                    │                     │                      │
       ▼                    ▼                     ▼                      ▼
   ┌────────┐          ┌────────┐           ┌─────────┐           ┌──────────┐
   │ FAILED │          │ FAILED │           │ PARTIAL │           │ COMPLETED│
   │ (retry │          │ (retry │           │ (resume │           │          │
   │  all)  │          │  from  │           │  from   │           │          │
   │        │          │  here) │           │ missing │           │          │
   └────────┘          └────────┘           │ items)  │           └──────────┘
                                            └─────────┘
```

### Checkpoint Schema (new Supabase table: `generation_tasks`)

```
generation_tasks
├── id: uuid (PK)                          -- deterministic: hash(user_id, block_id, prompt, timestamp_bucket)
├── user_id: uuid (FK)
├── block_id: uuid (FK)
├── sub_block_id: uuid (FK, nullable)
├── task_type: enum('story', 'content', 'image')
├── phase: enum('submitted', 'context_gathering', 'generating', 'finalizing', 'completed', 'failed')
├── request_params: jsonb                  -- original request body (immutable)
├── context_snapshot: jsonb                -- { rag_chunks, user_profile, preferences }
├── partial_results: jsonb                 -- { "professional": "...", "viral": null, "storyteller": "..." }
├── error_log: jsonb[]                     -- [{ call_site, status, retry_after, timestamp }]
├── retry_count: int (default 0)
├── max_retries: int (default 5)
├── next_retry_at: timestamptz             -- computed from Retry-After header or exponential backoff
├── lock_holder: text (nullable)           -- instance_id holding the distributed lock
├── lock_expires_at: timestamptz           -- TTL for lock auto-release
├── created_at: timestamptz
├── updated_at: timestamptz
├── completed_at: timestamptz (nullable)
```

---

## Part 3: Deterministic Retry with Surgical Resume

### 3a. The 429 Discriminator

The current `aiService.generateContent` loop (lines 91–128) treats all failures identically. The new architecture classifies every non-2xx response:

```
Response Analysis:
  ├── 429 + Retry-After header present
  │     → Parse header value (seconds or HTTP-date)
  │     → Set next_retry_at = now + retry_after + jitter(0-2s)
  │     → Checkpoint current partial_results
  │     → Return RETRIABLE_429
  │
  ├── 429 + No Retry-After
  │     → Use exponential backoff: min(2^retry_count * 1000, 64000) + jitter
  │     → Checkpoint current partial_results
  │     → Return RETRIABLE_429
  │
  ├── 429 + "quota exceeded" in body (daily/monthly quota, not rate limit)
  │     → This is NOT retriable on short timescales
  │     → Mark task phase = 'failed', error = QUOTA_EXHAUSTED
  │     → Return partial_results to client with degraded flag
  │     → Do NOT retry automatically
  │
  ├── 404 (model not found)
  │     → Skip to next model in fallback list (existing behavior)
  │     → Do NOT checkpoint — this is model selection, not state
  │
  └── 500/503 (server error)
        → Treat as retriable with shorter backoff ceiling (16s max)
        → Checkpoint partial_results
```

### 3b. Surgical Resume — Only Regenerate What's Missing

When a story generation 429s at variation 2 of 3:

```
partial_results = {
  "professional": "The future of AI in marketing...",   // ✓ completed
  "viral": null,                                         // ✗ 429'd
  "storyteller": null                                    // ✗ never attempted
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

### 3c. The Concurrency Problem with Promise.all

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

## Part 4: Distributed Lock — Preventing Duplicate Posts

### Why This Is Necessary

Three scenarios cause duplicate generation without locking:

1. **User double-click**: Two POST /api/stories arrive < 100ms apart with identical params
2. **Retry storm**: Client-side retry + server-side retry both execute; or the browser retry-on-timeout fires while the server is still in backoff
3. **Background resume**: A scheduled retry picks up a checkpointed task while the user manually re-triggers

### Lock Design Using Supabase Advisory Locks + Row-Level Locking

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

### Request Flow with Locking

```
Client POST /api/stories { prompt, blockId }
  │
  ├── Compute task_id = hash(userId, blockId, normalize(prompt), time_bucket)
  │
  ├── SELECT ... FOR UPDATE SKIP LOCKED where id = task_id
  │     │
  │     ├── Row returned (lock acquired):
  │     │     ├── phase = 'completed' → Return cached result immediately
  │     │     ├── phase = 'generating', partial_results has data → Resume from checkpoint
  │     │     └── No row → INSERT new task, begin generation
  │     │
  │     └── No row returned (locked by another worker):
  │           └── Return HTTP 202 { task_id, status: 'processing', retry_after: 5 }
  │               Client polls GET /api/stories/status/:task_id
  │
  ├── Execute generation with checkpointing
  │     ├── After each successful variation: UPDATE partial_results
  │     ├── On 429: checkpoint, release lock, set next_retry_at
  │     └── On completion: set phase = 'completed', release lock
  │
  └── Return result
```

---

## Part 5: Background Retry Processor

A 429'd task that's been checkpointed needs to be retried. Two mechanisms:

### 5a. Inline Retry (Synchronous — for short Retry-After values)

If `Retry-After` <= 10 seconds:
- Hold the request open
- Sleep for the indicated duration
- Retry the failed call(s) only
- This avoids the complexity of background processing for brief rate limits

### 5b. Deferred Retry (Asynchronous — for longer backoffs)

If `Retry-After` > 10 seconds or retry_count > 2:

**Option A (recommended for this stack): Next.js Cron Route**

A new API route `GET /api/cron/retry-tasks` that:
1. Queries `generation_tasks WHERE phase IN ('generating', 'failed') AND next_retry_at <= now() AND retry_count < max_retries`
2. Acquires locks on returned rows
3. Resumes generation from `partial_results`
4. Triggered by Vercel Cron (if deployed there) or external cron every 30 seconds

**Option B (if Supabase Edge Functions available): Database Trigger**

A Supabase Edge Function triggered by `pg_cron` that processes the retry queue. This keeps retry logic closer to the data and avoids cold-start latency.

### 5c. Client Notification

When a task completes asynchronously, the client needs to know. Two options:
- **Polling**: Client hits `GET /api/stories/status/:task_id` every 5 seconds after receiving a 202
- **Supabase Realtime**: Subscribe to `generation_tasks` changes filtered by `user_id`. When `phase` flips to `completed`, client receives the push and fetches results

---

## Part 6: Interaction with Existing Components

### StoryCache (storyCache.ts) — Becomes a Read-Through Layer

Currently the cache is the **only** persistence for generated stories. Under this architecture:
- `generation_tasks.partial_results` is the source of truth during generation
- `storyCache` becomes a **read-through cache** that hydrates from `generation_tasks` on miss
- Cache eviction (24h TTL) no longer causes data loss — the generation task row persists

### UserMemoryService (userMemoryService.ts) — Cleanup Race Fix

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

### AIService Singleton (aiService.ts) — Token Bucket Gating

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

## Part 7: New Database Migration Required

One new table, one new index, one modified function:

```
Table: generation_tasks (schema above)

Indexes:
  - idx_gen_tasks_retry: (next_retry_at) WHERE phase NOT IN ('completed', 'failed')
  - idx_gen_tasks_user_phase: (user_id, phase)
  - idx_gen_tasks_idempotency: UNIQUE (id)  -- deterministic hash is the PK

RLS Policies:
  - Users can SELECT/UPDATE their own tasks (user_id = auth.uid())
  - Service role can SELECT/UPDATE all tasks (for cron worker)
```

---

## Part 8: File Change Map

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

## Part 9: What This Architecture Does NOT Solve (Explicit Scope Boundaries)

1. **Cross-process token bucket coordination**: The token bucket is per-process. If Next.js runs across multiple serverless instances, each has its own bucket. True coordination would require Redis or Supabase-backed counters. This is a Phase 2 concern.

2. **Gemini daily quota exhaustion**: If the daily quota is exceeded (not a rate limit, but an absolute cap), no amount of retrying helps. The system surfaces this as a distinct error to the user with ETA based on quota reset time.

3. **Client-side deduplication**: The distributed lock prevents server-side duplicates. A misbehaving client that strips the task_id from 202 responses and keeps re-posting is throttled by the idempotency key's time bucket, but not fully blocked. Rate limiting at the API gateway layer (Vercel/Cloudflare) is the correct complementary control.

4. **Partial result UX**: When 2 of 3 story variations succeed, the client currently expects all 3. The client components need to handle a `partial: true` flag and render available variations with a "retry remaining" button. This is a frontend concern outside this plan.
