# Workflow Engine - Wave 1 ownership map

Companion to [ADR 0001](./0001-workflow-engine.md). Wave 0 froze the contracts
and added the skeleton; this document says who implements what, and which files
nobody but the lead may touch while that happens.

**Rule:** the contracts in ADR 0001 and in `src/api/workflows/types.ts`,
`const.ts` and `state-machine.ts` are settled. An agent that believes one is
wrong raises it with the lead rather than changing it - a unilateral change
breaks the other three agents silently.

---

## Agent A - SDK + registry

**Owns**

```text
packages/vitnode/src/api/workflows/define.ts
packages/vitnode/src/api/workflows/registry.ts
packages/vitnode/src/api/workflows/step-outputs.ts
packages/vitnode/src/api/workflows/plan.ts
packages/vitnode/src/api/workflows/errors.ts
packages/vitnode/src/api/workflows/retry.ts
packages/vitnode/src/api/workflows/index.ts
packages/vitnode/src/api/workflows/*.test.ts (for the above)
apps/docs/content/docs/dev/workflows/**            (new, user-facing docs)
```

**Scope**

- Harden definition validation as real workflows appear.
- Registry ergonomics: listing, diagnostics, "which versions are deployed".
- The public `@vitnode/core/api/workflows` surface and its documentation.
- The first documented example workflow, in `plugins/example`.

**Must not touch:** the two database tables, the store implementation, the
runner, the queue worker.

**Depends on nothing.** Can start immediately.

---

## Agent B - Database persistence

**Owns**

```text
packages/vitnode/src/database/workflows.ts
packages/vitnode/src/api/workflows/store.ts        (replaces the throwing stub)
packages/vitnode/src/api/workflows/store.test.ts
apps/docs/migrations/**                             (the workflow migration)
```

**Scope**

- Generate and commit the migration for the two tables. `apps/docs` uses
  versioned migrations; `apps/api` uses `drizzle-kit push`. Never regenerate an
  already-applied migration in place - the journal timestamp changes and the
  migrator replays the file.
- Implement every `WorkflowStore` method against Drizzle.
- `createExecution` must honour the partial unique index: on conflict, return
  the existing execution with `deduplicated: true` rather than throwing.
- `createExecution` must use `options.tx` when given, and dispatch the first
  `workflow-step` task through `c.get("queue").dispatch({ ..., tx })` inside the
  same unit of work.
- `claimStep` returning `undefined` is the normal answer for a duplicate
  delivery, not an error.

**Must not touch:** `types.ts` (the interface it implements), `define.ts`,
`registry.ts`, the runner, the queue worker.

**Depends on nothing.** The interface is frozen; can start immediately.

---

## Agent C - Queue reliability + runner plumbing

**Owns**

```text
packages/vitnode/src/api/modules/workflows/**       (runner, task handler)
packages/vitnode/src/api/workflows/queue-task.ts
packages/vitnode/src/api/modules/queue/**           (further queue hardening)
packages/vitnode/src/lib/api/resolve-stale-queue-lease.ts
packages/vitnode/src/lib/api/*queue*.test.ts
```

**Scope**

- Implement the runner behind `workflow-step.task.ts`: resolve the definition
  by exact version, claim the step, build the step context, run it, record the
  outcome, chain the next step or finish the execution.
- Failure handling: `nextWorkflowAttemptAt` decides retry vs fail; a failed
  step fails the execution and marks the remaining steps `skipped`.
- Cancellation check **between** steps only.
- `WORKFLOW_DEFINITION_NOT_FOUND` fails the execution and preserves every row.
- Wave 0 already added stale-lease recovery to `processQueueTasks`; extend it
  rather than replacing the approach, and keep it generic queue behaviour.

**Must not touch:** workflow definition semantics (`define.ts`, `registry.ts`),
the database tables, the store implementation. The runner talks to persistence
only through the `WorkflowStore` interface.

**Depends on:** nothing to start (code against `WorkflowStore`); needs Agent B
merged to run end to end.

---

## Agent D - Trigger contracts

**Owns**

```text
packages/vitnode/src/api/workflows/triggers.ts
packages/vitnode/src/api/workflows/trigger-adapters.ts    (new)
packages/vitnode/src/api/workflows/triggers.test.ts
```

**Scope**

- Turn a `WorkflowEventTriggerDefinition` into an ordinary
  `BuildEventListenerReturn`, and a `WorkflowCronTriggerDefinition` into an
  ordinary `BuildCronReturn`.
- Wire the dedupe contract: `event:{eventId}` and `cron:{name}:{tick}`.
- Decide how triggers are registered on a module (`workflowTriggers: []`, or
  folded into `events`/`cronJobs` at build time) **and agree it with the lead**,
  because it touches `buildModule`.

**Must not touch:** workflow runtime semantics, the runner, the store, the
tables.

**Depends on nothing.** Adapters call `c.get("workflow").start(...)`; whether
the store behind it is implemented does not affect the adapter's shape.

---

## Shared files - LEAD ONLY

No agent edits these without the lead. They are the coupling points: two agents
editing one of them in parallel produces a merge that compiles and is wrong.

```text
packages/vitnode/src/api/lib/module.ts               buildModule surface
packages/vitnode/src/api/lib/plugin.ts               buildApiPlugin collection
packages/vitnode/src/api/middlewares/global.middleware.ts
                                                     c.get("core"), c.get("workflow")
packages/vitnode/src/api/plugin.ts                   core module registration
packages/vitnode/src/database/relations.ts           coreSchema barrel + relations
packages/vitnode/src/api/workflows/types.ts          every cross-agent contract
packages/vitnode/src/api/workflows/const.ts          frozen vocabulary
packages/vitnode/src/api/workflows/state-machine.ts  transition tables
packages/vitnode/src/api/models/workflow.ts          c.get("workflow") surface
apps/*/migrations/meta/**                            drizzle journal + snapshots
```

Wave 0 already made every change these files need for Wave 1 to proceed:
`workflows` is collected, validated, exposed on `c.get("core")`, the model is
registered, the tables are in `coreSchema`, and the `workflow-step` task is
registered. If an agent finds one of them genuinely insufficient, that is a
lead ticket, not a local edit.

---

## Parallel-work verification

| Claim | Why it holds |
| --- | --- |
| A can implement the SDK without touching DB internals | `define.ts`/`registry.ts`/`plan.ts` are pure; `plan.ts` produces a `WorkflowStartPlan` and never inserts. |
| B can implement persistence without redesigning the SDK | `WorkflowStore` in `types.ts` is the whole surface; `WorkflowStartPlan` is handed in finished. |
| C can implement the runner without changing definition semantics | The runner reads a definition through `registry.ts` and persists through `WorkflowStore`; it authors neither. |
| D can implement trigger adapters without changing runtime semantics | Adapters build an envelope/tick into an input and call `start()`; they never touch execution state. |

The one negotiation left is D's registration surface on `buildModule`, which is
flagged above as a lead decision precisely because it is the only remaining
overlap.
