import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("CLI start and status return valid JSON snapshots", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "codex-agent-teams-cli-"));
  try {
    const repoRoot = process.cwd();
    const cliPath = path.join(repoRoot, "src", "cli.ts");
    const tsxPath = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
    await execFileAsync(
      process.execPath,
      [tsxPath, cliPath, "start", "demo", "--member", "alpha", "--no-runners", "--json"],
      { cwd, env: process.env }
    );

    const { stdout } = await execFileAsync(
      process.execPath,
      [tsxPath, cliPath, "status", "demo", "--json"],
      { cwd, env: process.env }
    );
    const parsed = JSON.parse(stdout) as { team: { name: string; members: Array<{ name: string }> } };
    assert.equal(parsed.team.name, "demo");
    assert.equal(parsed.team.members[0]?.name, "alpha");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
