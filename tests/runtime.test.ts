import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";

import { AgentTeamsRuntime } from "../src/runtime.js";

async function withRuntime(fn: (runtime: AgentTeamsRuntime) => Promise<void>): Promise<void> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "codex-agent-runtime-test-"));
  const runtime = new AgentTeamsRuntime({ cwd });
  try {
    await fn(runtime);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

test("lead can create shared tasks and teammates can read mailbox updates", async () => {
  await withRuntime(async (runtime) => {
    await runtime.startTeam({
      teamName: "demo",
      members: [{ name: "planner" }, { name: "builder" }],
      autoStartRunners: false
    });

    const task = await runtime.createTask({
      teamName: "demo",
      title: "Plan work",
      description: "Write the first plan",
      assignee: "planner",
      createdBy: "lead"
    });

    await runtime.sendMessage({
      teamName: "demo",
      from: "lead",
      to: "planner",
      body: "Own the README and task breakdown first."
    });

    const claimed = await runtime.claimTask("demo", "planner");
    const inbox = await runtime.readMessages("demo", "planner");
    const snapshot = await runtime.status("demo");

    assert.equal(claimed?.id, task.id);
    assert.equal(inbox[0]?.to, "planner");
    assert.equal(snapshot.tasks.length, 1);
    assert.equal(snapshot.team.members.length, 2);
  });
});

