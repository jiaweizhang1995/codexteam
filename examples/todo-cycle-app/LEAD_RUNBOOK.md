# Lead Runbook

Use this demo to prove a longer agent loop:

1. Planner writes the implementation plan into `README.md`.
2. Builder implements the first version of the app.
3. QA writes `QA.md` with smoke-test findings and a follow-up recommendation.
4. Lead inspects `QA.md`, creates one follow-up fix task for `fixer`, and waits for that task to complete.

Recommended fix-task command:

```bash
node dist/src/cli.js task-add todo-cycle-demo "Follow-up fix" \
  --description "Apply the specific follow-up fix requested by lead after reviewing QA.md." \
  --assignee fixer --created-by lead --json
```