import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AgentTeamsRuntime } from "../src/runtime.js";

async function main(): Promise<void> {
  const noRunners = process.argv.includes("--no-runners");
  const runtime = new AgentTeamsRuntime({ cwd: process.cwd() });
  const appDir = path.join(process.cwd(), "examples", "calculator-app");

  await mkdir(appDir, { recursive: true });
  await writeFile(
    path.join(appDir, "README.md"),
    [
      "# Calculator App Target",
      "",
      "This directory is the target for the Codex Agent Teams calculator demo.",
      "The expected deliverable is a simple browser calculator implemented as a static app."
    ].join("\n"),
    "utf8"
  );

  const teamName = "calculator-demo";
  await runtime.startTeam({
    teamName,
    members: [
      { name: "planner", rolePrompt: "Define the app shape, acceptance criteria, and implementation notes." },
      { name: "builder", rolePrompt: "Implement the calculator app in examples/calculator-app/." },
      { name: "qa", rolePrompt: "Verify behavior, document manual tests, and report regressions." }
    ],
    autoStartRunners: !noRunners
  });

  const planningTask = await runtime.createTask({
    teamName,
    title: "Plan calculator app",
    description:
      "Write implementation notes in examples/calculator-app/README.md describing the UI, supported operations, keyboard behavior, and file layout.",
    assignee: "planner",
    createdBy: "lead"
  });

  const buildTask = await runtime.createTask({
    teamName,
    title: "Build calculator app",
    description:
      "Create a small static calculator app in examples/calculator-app/. It should support add, subtract, multiply, divide, clear, and decimal input in a browser UI.",
    assignee: "builder",
    dependsOn: [planningTask.id],
    createdBy: "lead"
  });

  await runtime.createTask({
    teamName,
    title: "QA calculator app",
    description:
      "Write manual smoke-test steps in examples/calculator-app/TESTPLAN.md and send the lead a concise quality report.",
    assignee: "qa",
    dependsOn: [buildTask.id],
    createdBy: "lead"
  });

  await runtime.broadcast({
    teamName,
    from: "lead",
    body:
      "Target directory is examples/calculator-app. Avoid same-file conflicts. Planner owns README.md first, builder owns app files, QA owns TESTPLAN.md and final report."
  });

  const snapshot = await runtime.status(teamName);
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "calculator demo failed"}\n`);
  process.exitCode = 1;
});

