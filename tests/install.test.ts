import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

import { doctorUserScope, installUserScope, uninstallUserScope } from "../src/install.js";

async function withFixture(
  fn: (fixture: { packageRoot: string; codexHome: string; codexTeamHome: string }) => Promise<void>
): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "codexteam-install-test-"));
  const packageRoot = path.join(root, "package");
  const codexHome = path.join(root, "codex-home");
  const codexTeamHome = path.join(root, "codexteam-home");

  try {
    await mkdir(path.join(packageRoot, "dist", "src"), { recursive: true });
    await writeFile(path.join(packageRoot, "package.json"), '{ "name": "codexteam" }\n', "utf8");
    await writeFile(path.join(packageRoot, "dist", "src", "cli.js"), '#!/usr/bin/env node\n', "utf8");
    await fn({ packageRoot, codexHome, codexTeamHome });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("user-scope install writes runtime, skill, and managed config block", async () => {
  await withFixture(async ({ packageRoot, codexHome, codexTeamHome }) => {
    const result = await installUserScope({ packageRoot, codexHome, codexTeamHome });
    const configContent = await readFile(result.configPath, "utf8");
    const skillContent = await readFile(path.join(result.skillDir, "SKILL.md"), "utf8");
    const doctor = await doctorUserScope({ packageRoot, codexHome, codexTeamHome });

    assert.match(configContent, /\[mcp_servers\.codexteam\]/);
    assert.match(configContent, /codexteam managed block: begin/);
    assert.match(skillContent, /name: codexteam/);
    assert.equal(doctor.runtimeInstalled, true);
    assert.equal(doctor.skillInstalled, true);
    assert.equal(doctor.configInstalled, true);
  });
});

test("reinstall replaces the managed block instead of duplicating it", async () => {
  await withFixture(async ({ packageRoot, codexHome, codexTeamHome }) => {
    await installUserScope({ packageRoot, codexHome, codexTeamHome });
    await installUserScope({ packageRoot, codexHome, codexTeamHome });

    const configContent = await readFile(path.join(codexHome, "config.toml"), "utf8");
    const blockCount = configContent.match(/codexteam managed block: begin/g)?.length ?? 0;

    assert.equal(blockCount, 1);
  });
});

test("user-scope uninstall removes the managed config block and installed files", async () => {
  await withFixture(async ({ packageRoot, codexHome, codexTeamHome }) => {
    await installUserScope({ packageRoot, codexHome, codexTeamHome });
    await uninstallUserScope({ packageRoot, codexHome, codexTeamHome });

    const doctor = await doctorUserScope({ packageRoot, codexHome, codexTeamHome });
    const configContent = await readFile(path.join(codexHome, "config.toml"), "utf8");

    assert.equal(doctor.runtimeInstalled, false);
    assert.equal(doctor.skillInstalled, false);
    assert.equal(doctor.configInstalled, false);
    assert.doesNotMatch(configContent, /codexteam managed block: begin/);
  });
});
