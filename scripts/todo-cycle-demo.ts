import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentTeamsRuntime } from "../src/runtime.js";

async function main(): Promise<void> {
  const noRunners = process.argv.includes("--no-runners");
  const runtime = new AgentTeamsRuntime({ cwd: process.cwd() });
  const appDir = path.join(process.cwd(), "examples", "todo-cycle-app");

  await mkdir(appDir, { recursive: true });
  await writeFile(
    path.join(appDir, "README.md"),
    [
      "# Todo Cycle App Target",
      "",
      "This directory is the target for a multi-step agent-team demo.",
      "The expected deliverable is a small browser todo app implemented as static files.",
      "",
      "## Product Goal",
      "",
      "- Add a todo item from an input and submit button.",
      "- Render todos in a visible list.",
      "- Toggle a todo completed state.",
      "- Delete a todo item.",
      "- Show an empty-state message when there are no todos.",
      "- Keep the app small enough to serve as static files with no build step."
    ].join("\n"),
    "utf8"
  );

  await writeFile(
    path.join(appDir, "LEAD_RUNBOOK.md"),
    [
      "# Lead Runbook",
      "",
      "Use this demo to prove a longer agent loop:",
      "",
      "1. Planner writes the implementation plan into `README.md`.",
      "2. Builder implements the first version of the app.",
      "3. QA writes `QA.md` with smoke-test findings and a follow-up recommendation.",
      "4. Lead inspects `QA.md`, creates one follow-up fix task for `fixer`, and waits for that task to complete.",
      "",
      "Recommended fix-task command:",
      "",
      "```bash",
      "node dist/src/cli.js task-add todo-cycle-demo \"Follow-up fix\" \\",
      "  --description \"Apply the specific follow-up fix requested by lead after reviewing QA.md.\" \\",
      "  --assignee fixer --created-by lead --json",
      "```"
    ].join("\n"),
    "utf8"
  );

  const teamName = "todo-cycle-demo";
  await runtime.startTeam({
    teamName,
    members: [
      { name: "planner", rolePrompt: "Define the app shape, acceptance criteria, and file layout." },
      { name: "builder", rolePrompt: "Implement the initial todo app in examples/todo-cycle-app/." },
      { name: "qa", rolePrompt: "Verify behavior, write QA.md, and recommend one concrete follow-up fix." },
      { name: "fixer", rolePrompt: "Apply one follow-up fix after lead creates the task." }
    ],
    codexArgs: ["-c", 'model_reasoning_effort="low"'],
    autoStartRunners: !noRunners
  });

  const planningTask = await runtime.createTask({
    teamName,
    title: "Plan todo app",
    description:
      "Write implementation notes in examples/todo-cycle-app/README.md describing the UI, core interactions, acceptance criteria, and file layout for a static todo app.",
    assignee: "planner",
    createdBy: "lead"
  });

  const buildTask = await runtime.createTask({
    teamName,
    title: "Build todo app",
    description:
      "Create a small static todo app in examples/todo-cycle-app/. It should support adding items, toggling completed state, deleting items, and showing an empty state.",
    assignee: "builder",
    dependsOn: [planningTask.id],
    createdBy: "lead"
  });

  await runtime.createTask({
    teamName,
    title: "QA todo app",
    description:
      "Write examples/todo-cycle-app/QA.md with concise smoke tests, observed behavior, and one recommended follow-up fix for lead to assign.",
    assignee: "qa",
    dependsOn: [buildTask.id],
    createdBy: "lead"
  });

  await runtime.broadcast({
    teamName,
    from: "lead",
    body:
      "Target directory is examples/todo-cycle-app. Planner owns README.md first, builder owns app files, QA owns QA.md, fixer waits for a follow-up task from lead."
  });

  const snapshot = await runtime.status(teamName);
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "todo cycle demo failed"}\n`);
  process.exitCode = 1;
});
