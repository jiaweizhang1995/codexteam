#!/usr/bin/env node
import process from "node:process";

import { startMcpServer } from "./mcp.js";
import { AgentTeamsRuntime } from "./runtime.js";
import { TeamStoreError } from "./store.js";
import { runAgentLoop } from "./worker.js";

type ParsedArgs = {
  positionals: string[];
  flags: Map<string, string | boolean | string[]>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean | string[]>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const name = token.slice(2);
    const next = argv[index + 1];
    const value = next && !next.startsWith("--") ? next : true;
    if (value !== true) {
      index += 1;
    }

    const existing = flags.get(name);
    if (existing === undefined) {
      flags.set(name, value);
    } else if (Array.isArray(existing)) {
      existing.push(String(value));
      flags.set(name, existing);
    } else {
      flags.set(name, [String(existing), String(value)]);
    }
  }

  return { positionals, flags };
}

function getFlag(parsed: ParsedArgs, name: string): string | undefined {
  const value = parsed.flags.get(name);
  if (Array.isArray(value)) {
    return value[value.length - 1];
  }
  return typeof value === "string" ? value : undefined;
}

function getFlagList(parsed: ParsedArgs, name: string): string[] {
  const value = parsed.flags.get(name);
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [String(value)];
}

function hasFlag(parsed: ParsedArgs, name: string): boolean {
  return parsed.flags.has(name);
}

function printOutput(value: unknown, asJson: boolean): void {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage(): string {
  return [
    "Usage:",
    "  codex-agent-teams start <team> --member <name> [--member <name>] [--mode exec] [--no-runners]",
    "  codex-agent-teams status <team> [--json]",
    "  codex-agent-teams task-add <team> <title> --description <text> [--assignee <name>] [--depends-on <task-id>]",
    "  codex-agent-teams claim <team> --agent <name> [--json]",
    "  codex-agent-teams task-update <team> <task-id> [--status <status>] [--summary <text>] [--failure <text>] [--json]",
    "  codex-agent-teams task-list <team> [--status <status>] [--json]",
    "  codex-agent-teams messages <team> --agent <name> [--limit <n>] [--json]",
    "  codex-agent-teams message <team> --from <name> --to <name> <body>",
    "  codex-agent-teams broadcast <team> --from <name> <body>",
    "  codex-agent-teams spawn <team> --member <name> [--role <text>] [--no-runner]",
    "  codex-agent-teams stop <team> --agent <name>",
    "  codex-agent-teams cleanup <team>",
    "  codex-agent-teams mcp",
    "  codex-agent-teams agent-loop <team> <agent>"
  ].join("\n");
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const [command, ...rest] = parsed.positionals;
  const runtime = new AgentTeamsRuntime({ cwd: process.cwd() });
  const asJson = hasFlag(parsed, "json");

  switch (command) {
    case "start": {
      const [teamName] = rest;
      if (!teamName) {
        throw new Error("Missing team name");
      }
      const members = getFlagList(parsed, "member").map((name) => ({ name }));
      if (members.length === 0) {
        throw new Error("At least one --member is required");
      }
      const result = await runtime.startTeam({
        teamName,
        mode: (getFlag(parsed, "mode") as "exec" | "tmux" | undefined) ?? "exec",
        members,
        autoStartRunners: !hasFlag(parsed, "no-runners")
      });
      printOutput(result, asJson);
      return;
    }
    case "status": {
      const [teamName] = rest;
      if (!teamName) {
        throw new Error("Missing team name");
      }
      printOutput(await runtime.status(teamName), true);
      return;
    }
    case "task-add": {
      const [teamName, title] = rest;
      const description = getFlag(parsed, "description");
      if (!teamName || !title || !description) {
        throw new Error("task-add requires <team> <title> --description <text>");
      }
      const task = await runtime.createTask({
        teamName,
        title,
        description,
        assignee: getFlag(parsed, "assignee"),
        dependsOn: getFlagList(parsed, "depends-on"),
        createdBy: getFlag(parsed, "created-by") ?? "lead"
      });
      printOutput(task, asJson);
      return;
    }
    case "task-list": {
      const [teamName] = rest;
      if (!teamName) {
        throw new Error("Missing team name");
      }
      printOutput(await runtime.listTasks(teamName, getFlag(parsed, "status")), true);
      return;
    }
    case "claim": {
      const [teamName] = rest;
      const agent = getFlag(parsed, "agent");
      if (!teamName || !agent) {
        throw new Error("claim requires <team> --agent <name>");
      }
      printOutput(await runtime.claimTask(teamName, agent), true);
      return;
    }
    case "task-update": {
      const [teamName, taskId] = rest;
      if (!teamName || !taskId) {
        throw new Error("task-update requires <team> <task-id>");
      }
      printOutput(
        await runtime.updateTask({
          teamName,
          taskId,
          status: getFlag(parsed, "status") as
            | "pending"
            | "in_progress"
            | "completed"
            | "blocked"
            | "failed"
            | undefined,
          resultSummary: getFlag(parsed, "summary"),
          failureReason: getFlag(parsed, "failure")
        }),
        true
      );
      return;
    }
    case "messages": {
      const [teamName] = rest;
      const agent = getFlag(parsed, "agent");
      if (!teamName || !agent) {
        throw new Error("messages requires <team> --agent <name>");
      }
      const limit = Number.parseInt(getFlag(parsed, "limit") ?? "20", 10);
      printOutput(await runtime.readMessages(teamName, agent, limit), true);
      return;
    }
    case "message": {
      const [teamName, ...bodyParts] = rest;
      const from = getFlag(parsed, "from");
      const to = getFlag(parsed, "to");
      const body = bodyParts.join(" ").trim();
      if (!teamName || !from || !to || !body) {
        throw new Error("message requires <team> --from <name> --to <name> <body>");
      }
      printOutput(await runtime.sendMessage({ teamName, from, to, body }), asJson);
      return;
    }
    case "broadcast": {
      const [teamName, ...bodyParts] = rest;
      const from = getFlag(parsed, "from");
      const body = bodyParts.join(" ").trim();
      if (!teamName || !from || !body) {
        throw new Error("broadcast requires <team> --from <name> <body>");
      }
      printOutput(await runtime.broadcast({ teamName, from, body }), asJson);
      return;
    }
    case "spawn": {
      const [teamName] = rest;
      const member = getFlag(parsed, "member");
      if (!teamName || !member) {
        throw new Error("spawn requires <team> --member <name>");
      }
      printOutput(
        await runtime.spawnAgent({
          teamName,
          name: member,
          rolePrompt: getFlag(parsed, "role"),
          startRunner: !hasFlag(parsed, "no-runner")
        }),
        true
      );
      return;
    }
    case "stop": {
      const [teamName] = rest;
      const agent = getFlag(parsed, "agent");
      if (!teamName || !agent) {
        throw new Error("stop requires <team> --agent <name>");
      }
      printOutput(await runtime.stopAgent(teamName, agent), asJson);
      return;
    }
    case "cleanup": {
      const [teamName] = rest;
      if (!teamName) {
        throw new Error("cleanup requires <team>");
      }
      await runtime.cleanupTeam(teamName);
      printOutput({ cleaned: true, teamName }, asJson);
      return;
    }
    case "mcp": {
      await startMcpServer(process.cwd());
      return;
    }
    case "agent-loop": {
      const [teamName, agentName] = rest;
      if (!teamName || !agentName) {
        throw new Error("agent-loop requires <team> <agent>");
      }
      await runAgentLoop(teamName, agentName, process.cwd());
      return;
    }
    case "help":
    case "--help":
    case "-h":
    case undefined: {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  if (error instanceof TeamStoreError) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = 1;
    return;
  }

  if (error instanceof Error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
    return;
  }

  process.stderr.write("Error: unexpected failure\n");
  process.exitCode = 1;
});
