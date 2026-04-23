import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";

import { TeamStore, TeamStoreError } from "../src/store.js";

async function withStore(fn: (store: TeamStore) => Promise<void>): Promise<void> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "codex-agent-teams-test-"));
  const store = new TeamStore({ cwd });
  try {
    await fn(store);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

test("claimNextTask is atomic across concurrent claim attempts", async () => {
  await withStore(async (store) => {
    await store.createTeam({
      teamName: "demo",
      mode: "exec",
      members: [{ name: "alpha" }, { name: "beta" }]
    });
    const task = await store.createTask({
      teamName: "demo",
      title: "One task",
      description: "Single claim target",
      createdBy: "lead"
    });

    const [first, second] = await Promise.all([
      store.claimNextTask("demo", "alpha"),
      store.claimNextTask("demo", "beta")
    ]);

    const claimed = [first, second].filter(Boolean);
    assert.equal(claimed.length, 1);
    assert.equal(claimed[0]?.id, task.id);
    assert.equal(claimed[0]?.status, "in_progress");
  });
});

test("cleanup refuses while active teammates remain", async () => {
  await withStore(async (store) => {
    await store.createTeam({
      teamName: "demo",
      mode: "exec",
      members: [{ name: "alpha" }]
    });
    await store.updateMemberRuntime("demo", "alpha", (member) => ({
      ...member,
      runtime: {
        pid: 12345
      }
    }));

    await assert.rejects(() => store.cleanupTeam("demo"), TeamStoreError);
    await store.updateMemberRuntime("demo", "alpha", (member) => ({
      ...member,
      status: "stopped"
    }));
    await assert.doesNotReject(() => store.cleanupTeam("demo"));
  });
});

test("completed dependencies unblock pending tasks", async () => {
  await withStore(async (store) => {
    await store.createTeam({
      teamName: "demo",
      mode: "exec",
      members: [{ name: "alpha" }]
    });
    const first = await store.createTask({
      teamName: "demo",
      title: "First",
      description: "Complete me",
      createdBy: "lead"
    });
    await store.createTask({
      teamName: "demo",
      title: "Second",
      description: "Blocked until first completes",
      createdBy: "lead",
      dependsOn: [first.id]
    });

    const initialClaim = await store.claimNextTask("demo", "alpha");
    assert.equal(initialClaim?.id, first.id);
    await store.updateTask({
      teamName: "demo",
      taskId: first.id,
      status: "completed",
      resultSummary: "done"
    });
    const secondClaim = await store.claimNextTask("demo", "alpha");
    assert.equal(secondClaim?.title, "Second");
  });
});
