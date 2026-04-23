import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

import { TeamStore } from "../src/store.js";
import { runAgentLoop } from "../src/worker.js";

async function waitFor<T>(fn: () => Promise<T>, predicate: (value: T) => boolean, timeoutMs = 3_000): Promise<T> {
  const startedAt = Date.now();
  for (;;) {
    const value = await fn();
    if (predicate(value)) {
      return value;
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function setupWorkerFixture(mode: "complete" | "protocol") {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "codex-agent-worker-test-"));
  const store = new TeamStore({ cwd });
  const observeFile = path.join(cwd, "observe.json");
  const fakeCodexPath = path.join(cwd, "fake-codex.mjs");

  await writeFile(
    fakeCodexPath,
    `#!/usr/bin/env node
import path from "node:path";
import { readdir, readFile, writeFile } from "node:fs/promises";

const argv = process.argv.slice(2);
const outputIndex = argv.indexOf("-o");
const outputFile = outputIndex === -1 ? undefined : argv[outputIndex + 1];
const prompt = argv.at(-1) ?? "";
const modeIndex = argv.indexOf("--fake-mode");
const observeIndex = argv.indexOf("--observe-file");
const mode = modeIndex === -1 ? "complete" : argv[modeIndex + 1];
const observeFile = observeIndex === -1 ? undefined : argv[observeIndex + 1];

let stdinEnded = false;
await new Promise((resolve) => {
  process.stdin.on("end", () => {
    stdinEnded = true;
    resolve(undefined);
  });
  process.stdin.on("error", () => resolve(undefined));
  process.stdin.resume();
  setTimeout(() => resolve(undefined), 150);
});

if (observeFile) {
  await writeFile(observeFile, JSON.stringify({ argv, prompt, stdinEnded }, null, 2), "utf8");
}

if (outputFile) {
  await writeFile(outputFile, "fake teammate output\\n", "utf8");
}

if (mode === "protocol") {
  process.exit(0);
}

const taskIdLine = prompt.split("\\n").find((line) => line.startsWith("Claimed task id: "));
const taskId = taskIdLine ? taskIdLine.slice("Claimed task id: ".length) : undefined;
const teamsDir = path.join(process.cwd(), ".codex-agent-teams");
const [teamName] = await readdir(teamsDir);
const tasksFile = path.join(teamsDir, teamName, "tasks.json");
const tasks = JSON.parse(await readFile(tasksFile, "utf8"));
const task = tasks.find((candidate) => candidate.id === taskId);

if (task) {
  task.status = "completed";
  task.resultSummary = "Fake codex finished the task";
  task.updatedAt = new Date().toISOString();
  await writeFile(tasksFile, JSON.stringify(tasks, null, 2) + "\\n", "utf8");
}
`,
    "utf8"
  );
  await chmod(fakeCodexPath, 0o755);

  await store.createTeam({
    teamName: "demo",
    mode: "exec",
    members: [{ name: "alpha", rolePrompt: "Own the task." }],
    runnerIntervalMs: 25,
    codexCommand: fakeCodexPath,
    codexArgs: ["--fake-mode", mode, "--observe-file", observeFile]
  });

  return { cwd, store, observeFile };
}

test("agent loop closes stdin and passes claimed task context to codex exec", async () => {
  const { cwd, store, observeFile } = await setupWorkerFixture("complete");

  try {
    const task = await store.createTask({
      teamName: "demo",
      title: "Write plan",
      description: "Document the implementation steps",
      assignee: "alpha",
      createdBy: "lead"
    });
    await store.appendMessage({
      teamName: "demo",
      from: "lead",
      to: "alpha",
      body: "Focus on task ordering and file ownership.",
      scope: "direct"
    });

    const loopPromise = runAgentLoop("demo", "alpha", cwd);

    const completedTask = await waitFor(
      () => store.listTasks("demo").then((tasks) => tasks.find((candidate) => candidate.id === task.id)),
      (candidate) => candidate?.status === "completed"
    );
    assert.equal(completedTask?.resultSummary, "Fake codex finished the task");

    const observation = JSON.parse(await readFile(observeFile, "utf8")) as {
      prompt: string;
      stdinEnded: boolean;
    };
    assert.equal(observation.stdinEnded, true);
    assert.match(observation.prompt, new RegExp(`Claimed task id: ${task.id}`));
    assert.match(observation.prompt, /Claimed task title: Write plan/);
    assert.match(observation.prompt, /Focus on task ordering and file ownership\./);

    await store.requestStop("demo", "alpha");
    await loopPromise;
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("agent loop fails claimed work when codex exits cleanly without updating the task", async () => {
  const { cwd, store } = await setupWorkerFixture("protocol");

  try {
    const task = await store.createTask({
      teamName: "demo",
      title: "Implement feature",
      description: "Ship the feature and report back",
      assignee: "alpha",
      createdBy: "lead"
    });

    const loopPromise = runAgentLoop("demo", "alpha", cwd);

    const failedTask = await waitFor(
      () => store.listTasks("demo").then((tasks) => tasks.find((candidate) => candidate.id === task.id)),
      (candidate) => candidate?.status === "failed"
    );
    assert.match(failedTask?.failureReason ?? "", /Runner exited without updating claimed task/);

    const team = await waitFor(
      () => store.readTeam("demo"),
      (snapshot) => snapshot.members.some((member) => member.name === "alpha" && member.status === "failed")
    );
    const member = team.members.find((candidate) => candidate.name === "alpha");
    assert.equal(member?.runtime.lastExitCode, 2);

    const messages = await store.readMessages("demo", "lead", 10);
    assert.ok(messages.some((message) => message.body.includes("Runner protocol failure for alpha")));

    await store.requestStop("demo", "alpha");
    await loopPromise;
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
