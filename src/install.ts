import os from "node:os";
import path from "node:path";
import { access, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { fileURLToPath } from "node:url";

const MANAGED_BLOCK_BEGIN = "# codexteam managed block: begin";
const MANAGED_BLOCK_END = "# codexteam managed block: end";

export interface InstallOptions {
  codexHome?: string;
  codexTeamHome?: string;
  packageRoot?: string;
}

export interface InstallResult {
  codexHome: string;
  codexTeamHome: string;
  runtimeDir: string;
  skillDir: string;
  configPath: string;
  mcpCommand: string;
  mcpArgs: string[];
}

export interface DoctorResult extends InstallResult {
  runtimeInstalled: boolean;
  skillInstalled: boolean;
  configInstalled: boolean;
  configBlock: string | null;
}

function resolveHome(envValue: string | undefined, fallbackSuffix: string): string {
  if (envValue && envValue.trim()) {
    return envValue;
  }
  return path.join(os.homedir(), fallbackSuffix);
}

export function resolveCodexHome(): string {
  return resolveHome(process.env.CODEX_HOME, ".codex");
}

export function resolveCodexTeamHome(): string {
  return resolveHome(process.env.CODEXTEAM_HOME, ".codexteam");
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function findPackageRoot(startDir: string): Promise<string> {
  let current = startDir;
  for (;;) {
    if (await exists(path.join(current, "package.json"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Could not resolve package root from ${startDir}`);
    }
    current = parent;
  }
}

async function resolvePackageRoot(explicitRoot?: string): Promise<string> {
  if (explicitRoot) {
    return explicitRoot;
  }
  return findPackageRoot(path.dirname(fileURLToPath(import.meta.url)));
}

function getLayout(options: InstallOptions, packageRoot: string) {
  const codexHome = options.codexHome ?? resolveCodexHome();
  const codexTeamHome = options.codexTeamHome ?? resolveCodexTeamHome();
  const runtimeDir = path.join(codexTeamHome, "runtime");
  const skillDir = path.join(codexHome, "skills", "codexteam");
  const configPath = path.join(codexHome, "config.toml");
  const launcherPath = path.join(runtimeDir, "dist", "src", "cli.js");
  const distSourceDir = path.join(packageRoot, "dist");

  return {
    codexHome,
    codexTeamHome,
    runtimeDir,
    skillDir,
    configPath,
    launcherPath,
    distSourceDir
  };
}

function buildManagedConfigBlock(launcherPath: string): string {
  return [
    MANAGED_BLOCK_BEGIN,
    '[mcp_servers.codexteam]',
    'type = "stdio"',
    'command = "node"',
    `args = ["${launcherPath}", "mcp"]`,
    MANAGED_BLOCK_END
  ].join("\n");
}

function upsertManagedBlock(existingContent: string, block: string): string {
  const pattern = new RegExp(`${MANAGED_BLOCK_BEGIN}[\\s\\S]*?${MANAGED_BLOCK_END}\\n*`, "g");
  const trimmed = existingContent.replace(pattern, "").trimEnd();
  if (!trimmed) {
    return `${block}\n`;
  }
  return `${trimmed}\n\n${block}\n`;
}

function removeManagedBlock(existingContent: string): string {
  const pattern = new RegExp(`\\n*${MANAGED_BLOCK_BEGIN}[\\s\\S]*?${MANAGED_BLOCK_END}\\n*`, "g");
  const next = existingContent.replace(pattern, "\n").trimEnd();
  return next ? `${next}\n` : "";
}

function buildGlobalSkill(): string {
  return [
    "---",
    "name: codexteam",
    "description: Coordinate named Codex teammates through global codexteam MCP tools when a task benefits from shared tasks, mailbox updates, and lead-managed follow-up work.",
    "---",
    "",
    "# Codex Team",
    "",
    "Use this skill when the user wants a lead Codex session to coordinate named teammates through a shared task list and mailbox.",
    "",
    "## What It Provides",
    "",
    "- Global MCP tools through the user-scoped `codexteam` installer",
    "- Shared task lists stored per project under `.codex-agent-teams/`",
    "- Lead-managed teammate workflows with direct messages and follow-up fixes",
    "",
    "## Recommended Operating Model",
    "",
    "1. Start or inspect a team with `team_start` or `team_status`.",
    "2. Create explicit tasks instead of broadcasting long free-form goals.",
    "3. Let one teammate claim one task at a time.",
    "4. Prefer lead-driven explicit teammate runs for longer tasks.",
    "5. Use `message_send` for status and `task_update` for terminal state.",
    "",
    "## Good Prompt Shape",
    "",
    "```text",
    "Create an agent team named review-pr with security, performance, and tests.",
    "Add one task per teammate, have each teammate claim work, report back to lead,",
    "and avoid same-file conflicts.",
    "```"
  ].join("\n");
}

export async function installUserScope(options: InstallOptions = {}): Promise<InstallResult> {
  const packageRoot = await resolvePackageRoot(options.packageRoot);
  const layout = getLayout(options, packageRoot);

  await mkdir(layout.codexHome, { recursive: true });
  await mkdir(layout.codexTeamHome, { recursive: true });

  const distStat = await stat(layout.distSourceDir).catch(() => undefined);
  if (!distStat?.isDirectory()) {
    throw new Error(`Missing built dist at ${layout.distSourceDir}. Run npm run build before install.`);
  }

  await rm(layout.runtimeDir, { recursive: true, force: true });
  await mkdir(layout.runtimeDir, { recursive: true });
  await cp(layout.distSourceDir, path.join(layout.runtimeDir, "dist"), { recursive: true });

  await mkdir(layout.skillDir, { recursive: true });
  await writeFile(path.join(layout.skillDir, "SKILL.md"), `${buildGlobalSkill()}\n`, "utf8");

  const existingConfig = await readFile(layout.configPath, "utf8").catch(() => "");
  const block = buildManagedConfigBlock(layout.launcherPath);
  await writeFile(layout.configPath, upsertManagedBlock(existingConfig, block), "utf8");

  return {
    codexHome: layout.codexHome,
    codexTeamHome: layout.codexTeamHome,
    runtimeDir: layout.runtimeDir,
    skillDir: layout.skillDir,
    configPath: layout.configPath,
    mcpCommand: "node",
    mcpArgs: [layout.launcherPath, "mcp"]
  };
}

export async function uninstallUserScope(options: InstallOptions = {}): Promise<InstallResult> {
  const packageRoot = await resolvePackageRoot(options.packageRoot);
  const layout = getLayout(options, packageRoot);

  await rm(layout.runtimeDir, { recursive: true, force: true });
  await rm(layout.skillDir, { recursive: true, force: true });

  const existingConfig = await readFile(layout.configPath, "utf8").catch(() => "");
  await writeFile(layout.configPath, removeManagedBlock(existingConfig), "utf8");

  return {
    codexHome: layout.codexHome,
    codexTeamHome: layout.codexTeamHome,
    runtimeDir: layout.runtimeDir,
    skillDir: layout.skillDir,
    configPath: layout.configPath,
    mcpCommand: "node",
    mcpArgs: [layout.launcherPath, "mcp"]
  };
}

export async function doctorUserScope(options: InstallOptions = {}): Promise<DoctorResult> {
  const packageRoot = await resolvePackageRoot(options.packageRoot);
  const layout = getLayout(options, packageRoot);
  const configContent = await readFile(layout.configPath, "utf8").catch(() => "");
  const blockPattern = new RegExp(`${MANAGED_BLOCK_BEGIN}[\\s\\S]*?${MANAGED_BLOCK_END}`);
  const configBlock = configContent.match(blockPattern)?.[0] ?? null;

  return {
    codexHome: layout.codexHome,
    codexTeamHome: layout.codexTeamHome,
    runtimeDir: layout.runtimeDir,
    skillDir: layout.skillDir,
    configPath: layout.configPath,
    mcpCommand: "node",
    mcpArgs: [layout.launcherPath, "mcp"],
    runtimeInstalled: await exists(layout.launcherPath),
    skillInstalled: await exists(path.join(layout.skillDir, "SKILL.md")),
    configInstalled: configBlock !== null,
    configBlock
  };
}
