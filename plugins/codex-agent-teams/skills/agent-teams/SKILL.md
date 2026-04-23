---
name: agent-teams
description: Coordinate multiple Codex teammate runners through the codex-agent-teams MCP tools when the task benefits from shared tasks, direct mailbox messaging, and lead-managed cleanup.
---

# Agent Teams

Use this skill when the user wants a lead Codex session to coordinate named teammates through a shared task list and mailbox.

## When to use it

- Parallel review with different lenses
- Cross-layer work split into clean ownership boundaries
- Debugging with competing hypotheses
- Any workflow where the lead should assign or inspect tasks instead of manually re-prompting every worker

## When not to use it

- Small one-off delegated tasks
- Same-file implementation work likely to conflict
- Sequential workflows where a single Codex session is cheaper and clearer

## Operating rules

1. Start or inspect the team with `team_start` or `team_status`.
2. Create explicit tasks instead of sending long free-form instructions.
3. Prefer one deliverable per task.
4. Use `assignee` only when ownership must be exclusive.
5. Send targeted updates with `message_send`; reserve `message_broadcast` for shared policy changes.
6. Before cleanup, stop active teammates with `agent_stop`.
7. Never clean up a team from a teammate context while runners are still active.

## Good prompt shape

```text
Create an agent team named review-pr with three teammates: security,
performance, and tests. Add separate tasks for auth review, hot-path review,
and coverage review. Have each teammate claim work, report to lead, and avoid
same-file conflicts.
```

