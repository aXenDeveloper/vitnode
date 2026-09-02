# ADR 0001 - Workflow Engine

**Status:** contracts frozen (Wave 0). Runner, persistence, triggers and AdminCP are not implemented.
**Applies to:** `@vitnode/core`

Wave 1 agents treat this document as the contract. Anything it fixes may not be
redesigned without changing this document first.

---

## 1. Goals

- Durable, restartable orchestration of multi-step business operations.
- Sequential, deterministic execution: step 1, then step 2, then step 3.
- Explicit versioning; an in-flight execution never migrates to newer code.
- At-least-once execution with a first-class idempotency contract.
- Per-step business retry, separate from queue delivery retry.
- A transaction boundary that lets a business row and its workflow commit together.
- Compensation and cancellation contracts frozen now, implemented later.

## 2. Non-goals (explicitly out of the first engine)

Parallel branches, DAG execution, loops, visual builders, `wait-for-signal`,
human approval steps, child workflows, dynamic graphs, webhooks, and
exactly-once semantics. Each is a future extension; none may be assumed by
Wave 1 code.

## 3. Responsibility boundaries

```text
Events   = something happened
Queue    = execute something later
CRON     = initiate something on a schedule
Workflow = orchestrate durable multi-step business operations
```

The Workflow Engine is an **orchestration layer over existing VitNode systems**.
It does not ship:

- a second queue - steps are delivered through `core_queue`;
- a second scheduler - cron triggers register ordinary `buildCron` jobs;
- a second event bus - event triggers register ordinary `buildEventListener`s;
- separate worker infrastructure - the existing `process-queue` cron drains it.

Queue and Events stay fully usable without the Workflow Engine. Nothing in core
starts a workflow.

## 4. Execution model

`durable | sequential | queue-backed | versioned | idempotent | retryable | restart-safe`

```text
c.get("workflow").start(workflow, input, { tx })
  │  validate input against the definition's zod schema
  │  resolve the owning plugin from the registry (by object identity)
  │  write core_workflow_executions       (status: pending)
  │  write core_workflow_step_executions  (one row per step, pending, in order)
  │  dispatch one @vitnode/core:workflow-step task { executionId, stepId }
  └─ return { executionId, status: "pending", deduplicated }

... later, in the queue worker's cron request ...

workflow-step task
  │  load execution + steps
  │  resolve pluginId + workflowId + workflowVersion -> registered definition
  │  claim the step (pending -> running, attempts += 1)
  │  run step.run(ctx)
  │  record output, complete the step
  │  cancellation requested? -> skip the rest, execution -> cancelled
  │  otherwise dispatch the next step's workflow-step task
  └─ no next step -> execution -> completed
```

**`start()` never runs a step.** Step 1 does not execute inside the caller's
HTTP request: a slow inventory call must not become a slow checkout response,
and a crash a millisecond after the commit must still leave the work queued.

The whole step plan is written at start rather than one row at a time. That is
what makes the engine restart-safe - after a crash the runner reads state
instead of re-deriving it - and what lets an operator see where a stuck
execution stopped.

## 5. State machines

### Execution status

```text
pending   -> running | cancelled
running   -> completed | failed | cancelled
completed -> (terminal)
failed    -> (terminal)
cancelled -> (terminal)
```

`failed` is terminal. Operator-initiated resume (`failed -> running`) is a
deliberate future extension and must be added to
`WORKFLOW_EXECUTION_TRANSITIONS` first.

### Step status

```text
pending   -> running | skipped
running   -> completed | failed | pending
completed -> (terminal)
failed    -> (terminal)
skipped   -> (terminal)
```

`running -> pending` is a scheduled retry (`nextAttemptAt` says when).
`pending -> skipped` is a step the runner never started - cancellation, or an
earlier step failed.

### Compensation status (separate property, on both tables)

```text
none      -> pending
pending   -> running
running   -> completed | failed | pending
```

Compensation is tracked **beside** status, never folded into it. A combined
vocabulary (`failed_compensating`, `failed_compensated`,
`failed_compensation_failed`) makes every "did this succeed" query enumerate
compensation states it does not care about, and doubles each time a new one
appears.

Code: `src/api/workflows/state-machine.ts`.

## 6. Versioning

Every definition declares `version: number` (positive integer, bumped by hand).
Definition identity is:

```text
pluginId + workflowId + version
```

- Duplicates are rejected at plugin build (`buildApiPlugin`) and again across
  all plugins at boot (`globalMiddleware`).
- `place-order@1` and `place-order@2` may be registered side by side. That is
  the supported deployment, not an edge case.
- The runner resolves **only** the exact version on the execution row. There is
  no `workflowId -> latest` lookup anywhere in the codebase, and
  `resolveWorkflowDefinition` deliberately has no "latest" variant.

Bump the version whenever the step list changes meaning: a step added, removed,
renamed or reordered.

### Missing version behaviour

```text
DB execution:   @vitnode/shop / place-order / v1
deployed code:  only v2 exists
```

The runner must **not** run v2. It fails the execution with
`WORKFLOW_DEFINITION_NOT_FOUND` (`WorkflowDefinitionNotFoundError`), writes the
code into `lastError`, and leaves every row in place for an operator.

**Deployment guidance:** keep old workflow versions registered until no active
execution requires them. `core_workflow_executions_definition_idx` covers the
query that answers "is anything still running on v1".

## 7. Public SDK contract

```ts
export const placeOrderWorkflow = defineWorkflow({
  id: "place-order",
  version: 1,

  input: z.object({ orderId: z.number().int().positive() }),

  steps: ({ step }) => [
    step({
      id: "reserve-inventory",
      retry: { maxAttempts: 3, strategy: "exponential" },
      run: async ({ input, idempotencyKey }) => ({ reservationId: 1 }),
      compensate: async ({ output, idempotencyKey }) => {
        // future wave
      },
    }),

    step({
      id: "authorize-payment",
      output: z.object({ chargeId: z.string() }),
      run: async ({ outputs, idempotencyKey }) => {
        const { reservationId } = outputs.parse(
          "reserve-inventory",
          z.object({ reservationId: z.number() }),
        );

        return { chargeId: `ch_${reservationId}` };
      },
    }),
  ],
});
```

Frozen concepts: `workflow.id`, `workflow.version`, `workflow.input`,
`workflow.steps`, `step.id`, `step.run`, `step.output`, `step.retry`,
`step.compensate`.

### Definition-time validation (all throw `WorkflowError`)

| Rule | Code |
| --- | --- |
| Non-empty id matching `^[a-z0-9][a-z0-9._-]*$`, <= 100 chars | `WORKFLOW_INVALID_ID` |
| `version` is a positive integer | `WORKFLOW_INVALID_VERSION` |
| At least one step | `WORKFLOW_EMPTY` |
| Step ids unique within a workflow | `WORKFLOW_DUPLICATE_STEP` |
| Retry policy is coherent | `WORKFLOW_INVALID_RETRY_POLICY` |

Declaration order is frozen into each step's `position` at definition time.

### Step context

```ts
interface WorkflowStepContext<TInput> {
  readonly actor: WorkflowActor;          // metadata only, never authorization
  readonly attempt: number;               // 1 on the first run
  readonly c: Context<EnvVitNode>;        // background request: no user, no admin
  readonly execution: WorkflowExecutionRef;
  readonly idempotencyKey: string;        // workflow:{executionId}:{stepId}
  readonly input: TInput;
  readonly outputs: WorkflowStepOutputs;  // get / has / parse(stepId, schema)
  readonly step: { id: string; position: number };
  readonly trigger: WorkflowTriggerRef;
}
```

There is no compile-time typing of *other* steps' outputs. The array form
`steps: ({ step }) => [...]` cannot thread a growing tuple through, and outputs
come back out of JSONB after a restart anyway - so `outputs.get()` is `unknown`
and `outputs.parse(stepId, schema)` is the supported way across that boundary.
This is the only place the engine uses `unknown`, and it is a genuine runtime
boundary.

### Ownership and registration

```ts
buildModule({
  pluginId: "@vitnode/shop",
  name: "orders",
  routes: [],
  workflows: [placeOrderWorkflow],
});
```

Collected **recursively** through the module tree (like `contentTypes`,
`contentModels` and `searchIndexers`, unlike `cronJobs`/`events`/`queueTasks`),
keeping the *owning* module's name. Exposed to background work as
`c.get("core").workflows`, the same way `contentModels` is - the runner has no
plugin context and needs a lookup from the row back to the code.

`start()` resolves the owning plugin by **object identity**, not by
`c.get("plugin")`: guessing would be wrong the moment one plugin starts
another's workflow, and would write an execution row nothing can resolve. An
unregistered definition is a hard error.

## 8. Storage

Definitions are **source code**. Postgres stores identity and runtime state
only. JSONB is used for genuinely schema-dynamic values (workflow input, step
output) and nothing else.

### `core_workflow_executions`

```text
id                          serial pk
pluginId                    varchar(100)  not null
module                      varchar(100)  not null
workflowId                  varchar(100)  not null
workflowVersion             integer       not null
status                      enum          not null default 'pending'
compensationStatus          enum          not null default 'none'
triggerType                 enum          not null default 'manual'
triggerName                 varchar(255)  null
triggerId                   varchar(255)  null
actorType                   enum          not null default 'system'
actorId                     integer       null      (no FK - see below)
input                       jsonb         not null default {}
output                      jsonb         null
idempotencyKey              varchar(255)  null
lastError                   text          null
cancellationRequestedAt     timestamp     null
createdAt                   timestamp     not null default now()
startedAt                   timestamp     null
completedAt                 timestamp     null
cancelledAt                 timestamp     null
updatedAt                   timestamp     not null
```

Indexes:

- `core_workflow_executions_idempotency_unique` - **partial** unique on
  `(pluginId, workflowId, workflowVersion, idempotencyKey)`
  `WHERE "idempotencyKey" is not null`. An execution with no key is not
  de-duplicated at all, and any number of them may exist.
- `core_workflow_executions_status_idx` on `(status, createdAt)` - the AdminCP
  list and "what is stuck".
- `core_workflow_executions_definition_idx` on
  `(pluginId, workflowId, workflowVersion, status)` - "is anything still
  running on v1", the question a deploy must answer before removing an old
  version.

`actorId` carries no foreign key: the actor is a fact about the past and must
stay readable after the account is gone.

### `core_workflow_step_executions`

```text
id                     serial pk
executionId            integer      not null  -> core_workflow_executions.id (cascade)
stepId                 varchar(100) not null
position               integer      not null   -- 0-based, frozen at plan time
status                 enum         not null default 'pending'
attempts               integer      not null default 0
maxAttempts            integer      not null default 3
output                 jsonb        null
lastError              text         null
nextAttemptAt          timestamp    null
compensationStatus     enum         not null default 'none'
compensationAttempts   integer      not null default 0
compensationError      text         null
startedAt              timestamp    null
completedAt            timestamp    null
updatedAt              timestamp    not null
```

Invariants and indexes:

- `UNIQUE(executionId, stepId)` - the invariant the runner rests on. "Has this
  step already run" becomes a key lookup, and a duplicated queue delivery
  cannot create a second attempt row.
- `(executionId, position)` - the runner's ordered read.
- `(status, nextAttemptAt)` - retries that have come due.

The three `compensation*` columns extend the originally sketched field list.
They are required, not decorative: compensation is resumable per step, so a
crash halfway through a rollback has to continue where it stopped without
undoing anything twice. `nextAttemptAt` is shared between run-retry and
compensation-retry because a step is never running and compensating at once;
the error columns are separate so a rollback failure does not erase the
original one.

Code: `src/database/workflows.ts`, registered in `src/database/relations.ts`.

## 9. Transaction boundary

`WorkflowModel.start()` accepts `{ tx }` with exactly the semantics of
`QueueModel.dispatch({ tx })`.

```text
transaction
│
├── business row
├── workflow execution
├── workflow step rows
└── workflow queue task
│
COMMIT
```

Everything or nothing. Without `tx` the execution row can commit while the row
it refers to rolls back, and the runner wakes up to orchestrate something that
does not exist.

## 10. Queue integration

One generic core task:

```text
@vitnode/core:workflow-step        payload: { executionId, stepId }
```

Never one task per step. The queue resolves handlers by
`` `${pluginId}:${name}` ``, so `shop-authorize-payment`-style names would put
every plugin's business vocabulary into core's namespace and force registration
to happen before the step list is known. Here the payload names the execution
and the step, and the runner reads plugin, workflow, version, input and prior
outputs from the row - which is also why a task that sat in the queue across a
deploy still resolves against the version its execution started on.

Code: `src/api/workflows/queue-task.ts`,
`src/api/modules/workflows/tasks/workflow-step.task.ts`.

### Queue lease recovery (implemented in Wave 0)

The pre-existing worker had a durability gap: `processQueueTasks` claims rows by
flipping them `pending -> processing` and stamping `reservedAt`, then runs the
handlers. If the process dies in between - deploy, OOM kill, container
reschedule - nothing writes the finishing update and the row is invisible to
every later tick, because the claim query only selects `pending`. That task is
lost permanently.

A workflow step stuck in `processing` forever is an execution that never
advances *and* never fails - the one state a durable engine must not have. So
the invariant is established now, as **generic queue infrastructure**:

```text
pending -> processing, reservedAt = now
worker dies
processing AND reservedAt < now - QUEUE_LEASE_TIMEOUT_MS
  -> attempts < maxAttempts  ? pending (available immediately)
  -> otherwise               : failed  (lastError says the lease expired)
```

- Lease timeout: **15 minutes**. Long enough that a legitimately slow batch of
  25 tasks is never reclaimed while still running; short enough that a crashed
  worker's tasks resume within a deploy cycle.
- Recovery counts against the task's own `maxAttempts` - the attempt was
  already incremented at claim time - so a handler that reliably kills its
  process fails eventually instead of cycling forever.
- Runs before the claim, so a recovered task can be picked up in the same tick.
- No heartbeats. Nothing in the current architecture justifies them; the lease
  plus the attempt counter is sufficient.

Code: `src/lib/api/resolve-stale-queue-lease.ts`,
`src/api/modules/queue/helpers/process-queue-tasks.ts`.

## 11. Retry ownership

```text
Queue retry           = runner/infrastructure delivery retry (core_queue.maxAttempts)
Workflow step retry   = business step retry (step.retry, core_workflow_step_executions)
Compensation retry    = its own budget again, independent of the step's
```

```ts
retry: {
  maxAttempts: 5,        // total runs of the step body, not retries after the first
  strategy: "exponential" | "fixed",
  initialDelayMs: 1000,
  maxDelayMs: 60_000,
}
```

Defaults: `{ maxAttempts: 3, strategy: "exponential", initialDelayMs: 1000, maxDelayMs: 60_000 }`.
Validated at definition time (`maxAttempts` a positive integer <= 25,
non-negative delays, `maxDelayMs >= initialDelayMs`), so a nonsense backoff
fails at boot rather than the first time a step happens to throw.

`workflowRetryDelayMs` and `nextWorkflowAttemptAt` are the only places the
backoff curve is written down. No runner may compute `2 ** n` itself.
`nextWorkflowAttemptAt` returning `null` is what fails a step.

Code: `src/api/workflows/retry.ts`.

## 12. At-least-once semantics and idempotency

The engine is **at-least-once**. It does not claim exactly-once, and no
documentation may say otherwise.

```text
external side effect succeeds
        ↓
worker dies before the DB step completion is recorded
        ↓
the step runs again
```

Idempotency is therefore a **developer contract**, not a nicety. Every step
context carries a deterministic key:

```text
step         workflow:{executionId}:{stepId}
compensation workflow:{executionId}:{stepId}:compensate
```

```ts
await stripe.paymentIntents.create(payload, {
  idempotencyKey: ctx.idempotencyKey,
});
```

Compensation gets its own key because sharing one would make the provider
answer "refund this charge" with the cached response of "create this charge".

Execution-level de-duplication is scoped by
`pluginId + workflowId + workflowVersion + idempotencyKey`, enforced by the
partial unique index. Two workflows may react to the same event, and
`place-order@2` is a different subscriber from `place-order@1`.

Code: `src/api/workflows/idempotency.ts`.

## 13. Actor handling

`actorType` is `admin | user | system`; `actorId` is `number | null`. Defaults
from `c.get("admin")`, then `c.get("user")`, then `system`.

**Queued steps never impersonate the original actor.** The runner executes as
system infrastructure: its request has no session, and `c.get("admin")` /
`c.get("user")` stay `null`. Reconstructing a fake request auth would make
every permission check, log line and model sharing that context lie about who
is present. The original actor is metadata, reachable as `ctx.actor`.

## 14. Triggers

Definition and trigger are separate. `defineWorkflow({ trigger })` would bind
one workflow to one way of starting it; the same `place-order` has to be
reachable from direct code, an event, a cron tick, the AdminCP, the API and a
test.

```ts
buildWorkflowEventTrigger({
  name: "start-place-order",
  workflow: placeOrderWorkflow,
  event: "order.created",
  input: payload => ({ orderId: payload.orderId }),
  when: payload => payload.total > 0,     // optional
});

buildWorkflowCronTrigger({
  name: "nightly-reconciliation",
  schedule: "0 3 * * *",
  workflow: reconcileLedgerWorkflow,
  input: tick => ({ day: tick.toISOString().slice(0, 10) }),
});
```

Both are **adapters over existing infrastructure**: the event trigger becomes
an ordinary `buildEventListener`, the cron trigger an ordinary `buildCron` job
whose body does nothing but call `start()`. No new scheduler, no new bus.

Dedupe contract:

| Trigger | `idempotencyKey` | `triggerName` | `triggerId` |
| --- | --- | --- | --- |
| event | `event:{envelope.eventId}` | event name | `envelope.eventId` |
| cron | `cron:{name}:{tick to the minute}` | cron job name | tick key |
| manual | none unless the caller passes one | caller label | `null` |

A broker delivering the same envelope twice must produce **one** execution.
Mapper functions (`input`, `when`) must be pure: they run once, at start, and
their result is what every attempt of every step sees.

Code: `src/api/workflows/triggers.ts`.

## 15. Compensation contract (not implemented)

```ts
step({
  id: "reserve-inventory",
  run: async () => ({ reservationId: 123 }),
  compensate: async ({ output, idempotencyKey }) => { /* future */ },
});
```

Frozen rules:

1. Only **completed** steps are compensated.
2. Compensation runs in **reverse completion order**.
3. Compensation retries **independently** of the step's retry budget.
4. Compensation uses **its own idempotency key**.
5. Compensation is **not a SQL rollback** - the step already committed, and
   possibly charged a card.
6. Progress is tracked per step (`compensationStatus`, `compensationAttempts`,
   `compensationError`) so a crash mid-rollback resumes where it stopped.

## 16. Cancellation contract (not implemented)

VitNode cannot interrupt arbitrary running JavaScript and does not claim to.

```text
cancel(executionId) -> cancellationRequestedAt = now

Step B running
  -> Step B completes normally
runner checks the cancellation request between steps
  -> Step C never starts, becomes "skipped"
  -> execution -> cancelled, cancelledAt = now
```

`cancellationRequestedAt` and `cancelledAt` are separate columns precisely
because the request and the effect are different moments.

## 17. AdminCP integration boundaries (not implemented)

Reserved, so Wave 1 does not invent conflicting names:

- Routes: `admin/advanced/workflows`, alongside the existing `cron` and `queue`
  advanced modules.
- Staff permission module: `workflows`, with
  `can_view`, `{ can_cancel, dependsOn: [can_view] }`,
  `{ can_retry, dependsOn: [can_view] }`.
- Read-only listing first (`core_workflow_executions` + its steps), following
  `admin/advanced/queue/routes/get.route.ts` and `withPagination`.
- Cancel and retry go through `WorkflowModel`, never through direct table
  writes - the state machine lives in code, not in a route handler.

Nothing above is registered in Wave 0: a permission with no route behind it is
noise in the staff catalogue.

## 18. Files

```text
packages/vitnode/src/api/workflows/
  const.ts          frozen vocabulary; imports nothing (drizzle-kit loads it)
  types.ts          every contract type, including WorkflowStore
  errors.ts         WorkflowError + stable codes
  define.ts         defineWorkflow + step builder + definition-time validation
  registry.ts       identity, duplicate validation, exact-version resolution
  retry.ts          RetryPolicy, resolution, the one backoff curve
  idempotency.ts    key builders and scope
  state-machine.ts  transition tables and assertions
  step-outputs.ts   the unknown -> typed boundary
  plan.ts           planWorkflowStart (pure)
  triggers.ts       event and cron trigger builders
  queue-task.ts     workflow-step payload schema
  store.ts          WorkflowStore implementation (Wave 0: throws)
  index.ts

packages/vitnode/src/api/models/workflow.ts       c.get("workflow")
packages/vitnode/src/database/workflows.ts        the two tables
packages/vitnode/src/api/modules/workflows/       core's runtime module
packages/vitnode/src/lib/api/resolve-stale-queue-lease.ts
```

## 19. Future extensions

Parallel branches and DAG execution (would need `dependsOn` on steps and a
different runner), loops, `wait-for-signal` and human approval steps (would
need an execution status such as `waiting`), child workflows, a visual builder,
operator resume of a `failed` execution (`failed -> running`), and per-step
timeouts. Each needs a new ADR or an amendment here; none may be assumed.
