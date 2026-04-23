# Codex Agent Teams

`codex-agent-teams` is a hybrid Codex plugin, CLI, and MCP server that approximates Claude Code Agent Teams with local building blocks Codex exposes today.

It uses:

- one lead Codex session
- a shared task list and mailbox on disk
- detached teammate runner loops backed by `codex exec`
- a project-level MCP server so any Codex session in this repo can coordinate through the same state

## What it does

- Creates named teams with lead-owned shared state under `.codex-agent-teams/<team>/`
- Spawns teammate runner loops that repeatedly invoke Codex against the same project
- Exposes MCP tools for task creation, claiming, updates, direct messages, broadcasts, status, shutdown, and cleanup
- Supports a repo-local Codex plugin wrapper for discoverability and installability

## What it does not do

- It does not patch the Codex TUI with native teammate panes or keyboard switching
- `exec` teammates are independent Codex turns, not long-lived in-process sessions
- Direct teammate-to-teammate chat works through the shared mailbox, not native host runtime messaging

## Install

```bash
npm install
npm run build
```

To use the project-level MCP server, open Codex from this repo after building so it can load [`.mcp.json`](/Users/jimmymacmini/Desktop/codex-project/codex-agent-teams/.mcp.json).

To use the repo-local plugin, point a marketplace entry at [`plugins/codex-agent-teams`](/Users/jimmymacmini/Desktop/codex-project/codex-agent-teams/plugins/codex-agent-teams).

## CLI

Start a team with three runners:

```bash
node dist/src/cli.js start review-pr --member security --member performance --member tests
```

Tune runner behavior or swap the Codex launcher when needed:

```bash
node dist/src/cli.js start review-pr \
  --member security \
  --runner-interval-ms 2000 \
  --codex-command codex \
  --codex-arg -c \
  --codex-arg 'model_reasoning_effort="low"'
```

Create tasks:

```bash
node dist/src/cli.js task-add review-pr "Security review" --description "Audit auth/session handling" --assignee security
node dist/src/cli.js task-add review-pr "Perf review" --description "Review hot paths and obvious regressions" --assignee performance
```

Inspect status:

```bash
node dist/src/cli.js status review-pr --json
```

Start without detached runners for local smoke tests:

```bash
node dist/src/cli.js start review-pr --member security --no-runners
```

Send a direct message:

```bash
node dist/src/cli.js message review-pr --from lead --to security "Focus on cookies, tokens, and authorization gaps."
```

Manually claim or update tasks during testing:

```bash
node dist/src/cli.js claim review-pr --agent security
node dist/src/cli.js task-update review-pr <task-id> --status completed --summary "Review finished"
node dist/src/cli.js messages review-pr --agent lead --json
```

Request shutdown and cleanup:

```bash
node dist/src/cli.js stop review-pr --agent security
node dist/src/cli.js cleanup review-pr
```

## MCP tools

The server exposes:

- `team_start`
- `team_status`
- `agent_spawn`
- `task_create`
- `task_list`
- `task_claim`
- `task_update`
- `message_send`
- `message_broadcast`
- `message_read`
- `agent_stop`
- `team_cleanup`

## Team state

Each team lives under `.codex-agent-teams/<team>/`:

- `team.json`: team metadata, members, mode, cwd, and runner info
- `tasks.json`: task list with dependency and claim state
- `mailbox.jsonl`: append-only mailbox
- `events.jsonl`: append-only audit trail
- `locks/`: atomic lock directories used for claims and writes

## Recommended Codex workflow

After building and restarting Codex from this repo, ask the lead session to create a team:

```text
Create an agent team named review-pr with three teammates: security,
performance, and tests. Use the shared task list. Have each teammate claim
its own work and report back through the mailbox.
```

For higher reliability today, keep two execution modes in mind:

- Detached runner mode: teammates are supervised `codex exec` loops. This is useful for background progress, but still best-effort in the current Codex environment.
- Lead-driven explicit mode: the lead session launches focused `codex exec` teammate turns when a task is ready. This has been the most reliable way to complete longer multi-step demos.

The runtime now treats a claimed task as failed if a runner exits without marking that task complete or failed, so abandoned in-progress work does not stay stuck forever.

## tmux mode

The current implementation records a `mode` of `exec` or `tmux`, but only `exec` is implemented. `tmux` mode is reserved for a later iteration that launches long-lived interactive Codex panes.

## Calculator demo

`npm run demo:calculator` creates a demo team for building a small calculator app in [`examples/calculator-app`](/Users/jimmymacmini/Desktop/codex-project/codex-agent-teams/examples/calculator-app). By default it starts teammate runners; pass `-- --no-runners` to stage the team and tasks without launching Codex workers.

## Todo Cycle Demo

`npm run demo:todo-cycle` creates a longer-lived team in [`examples/todo-cycle-app`](/Users/jimmymacmini/Desktop/codex-project/codex-agent-teams/examples/todo-cycle-app) with `planner`, `builder`, `qa`, and `fixer`.

The intended flow is:

1. `planner` writes the build contract in `README.md`
2. `builder` ships the first static app
3. `qa` writes `QA.md` and recommends one concrete follow-up fix
4. `lead` creates a follow-up task for `fixer`
5. `fixer` applies that single change and reports back

This demo is the clearest way to test that the lead owns the roadmap while teammates share the same task list and mailbox.

## Known limitations

- Existing Codex sessions will not pick up a newly added `.mcp.json` until restarted
- Runner loops assume `codex` is on `PATH`
- Cleanup refuses while any teammate is still active
- If a teammate crashes mid-task, its claimed task is marked `failed` by the runner supervisor
- In this environment, detached `codex exec` workers can still be interrupted after making file edits but before sending mailbox/task updates; the shared task model survives that case, but lead-driven explicit teammate runs are still more reliable for longer tasks
