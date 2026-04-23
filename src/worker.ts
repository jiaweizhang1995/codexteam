import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { writeFile, rm } from "node:fs/promises";

import { AgentTeamsRuntime } from "./runtime.js";
import { createTemporaryDirectory } from "./store.js";
import type { MailMessage, TaskRecord } from "./types.js";

const execFileAsync = promisify(execFile);

function buildWorkerPrompt(
  teamName: string,
  agentName: string,
  task: TaskRecord,
  inbox: MailMessage[],
  rolePrompt?: string
): string {
  const roleSection = rolePrompt ? `Role guidance: ${rolePrompt}\n` : "";
  const inboxSection =
    inbox.length > 0
      ? inbox.map((message) => `- From ${message.from}: ${message.body}`).join("\n")
      : "- No unread mailbox guidance.";
  return [
    `You are teammate ${agentName} on team ${teamName}.`,
    roleSection,
    "The host runtime already claimed your task. Do not claim another task in this turn.",
    `Claimed task id: ${task.id}`,
    `Claimed task title: ${task.title}`,
    `Claimed task description: ${task.description}`,
    "Mailbox context:",
    inboxSection,
    "",
    "Coordinate completion through the local CLI, not by guessing file formats.",
    "Use these commands exactly from the repository root:",
    `- Message lead: node dist/src/cli.js message ${teamName} --from ${agentName} --to lead \"<summary>\"`,
    `- Complete task: node dist/src/cli.js task-update ${teamName} ${task.id} --status completed --summary \"<summary>\" --json`,
    `- Fail task: node dist/src/cli.js task-update ${teamName} ${task.id} --status failed --failure \"<reason>\" --json`,
    "Your turn protocol:",
    "1. Complete only the claimed task in this repository.",
    "2. Send lead a short direct summary after the work is done.",
    "3. Mark the claimed task completed or failed before exiting.",
    "Avoid same-file conflicts when you can. Do not invent task ids. Do not spend time exploring the repo unless it directly helps complete the claimed task."
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runAgentLoop(teamName: string, agentName: string, cwd = process.cwd()): Promise<void> {
  const runtime = new AgentTeamsRuntime({ cwd });

  for (;;) {
    const snapshot = await runtime.status(teamName);
    const member = snapshot.team.members.find((candidate) => candidate.name === agentName);
    if (!member) {
      throw new Error(`Unknown teammate ${agentName}`);
    }

    if (member.stopRequested) {
      await runtime.store.updateMemberRuntime(teamName, agentName, (current) => ({
        ...current,
        status: "stopped",
        runtime: {
          ...current.runtime,
          lastHeartbeatAt: new Date().toISOString()
        }
      }));
      await runtime.sendMessage({
        teamName,
        from: agentName,
        to: "lead",
        body: `${agentName} shut down cleanly.`,
        scope: "status"
      });
      return;
    }

    const inbox = await runtime.readMessages(teamName, agentName, 10);
    const claimedTask = await runtime.claimTask(teamName, agentName);
    if (!claimedTask) {
      await runtime.store.updateMemberRuntime(teamName, agentName, (current) => ({
        ...current,
        status: "idle",
        runtime: {
          ...current.runtime,
          lastHeartbeatAt: new Date().toISOString()
        }
      }));
      await new Promise((resolve) => setTimeout(resolve, snapshot.team.settings.runnerIntervalMs));
      continue;
    }

    await runtime.store.updateMemberRuntime(teamName, agentName, (current) => ({
      ...current,
      status: "busy",
      runtime: {
        ...current.runtime,
        lastHeartbeatAt: new Date().toISOString()
      }
    }));

    const tempDir = await createTemporaryDirectory("codex-agent-teams-");
    const outputFile = path.join(tempDir, "last-message.txt");
    const prompt = buildWorkerPrompt(teamName, agentName, claimedTask, inbox, member.rolePrompt);

    try {
      await writeFile(outputFile, "", "utf8");
      await execFileAsync(
        snapshot.team.settings.codexCommand,
        [
          "exec",
          "--skip-git-repo-check",
          "--full-auto",
          "-C",
          snapshot.team.cwd,
          "-o",
          outputFile,
          ...snapshot.team.settings.codexArgs,
          prompt
        ],
        {
          cwd: snapshot.team.cwd,
          maxBuffer: 1024 * 1024 * 4
        }
      );

      await runtime.store.updateMemberRuntime(teamName, agentName, (current) => ({
        ...current,
        status: "idle",
        runtime: {
          ...current.runtime,
          lastHeartbeatAt: new Date().toISOString(),
          lastExitCode: 0
        }
      }));
    } catch (error) {
      const message =
        error instanceof Error && "stderr" in error && typeof error.stderr === "string"
          ? error.stderr
          : error instanceof Error
            ? error.message
            : "unknown codex exec failure";
      await runtime.store.failClaimedTasks(teamName, agentName, `Runner failure: ${message.trim()}`);
      await runtime.store.updateMemberRuntime(teamName, agentName, (current) => ({
        ...current,
        status: "failed",
        runtime: {
          ...current.runtime,
          lastHeartbeatAt: new Date().toISOString(),
          lastExitCode: 1
        }
      }));
      await runtime.sendMessage({
        teamName,
        from: agentName,
        to: "lead",
        body: `Runner failure for ${agentName}: ${message.trim()}`,
        scope: "status"
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }

    await new Promise((resolve) => setTimeout(resolve, snapshot.team.settings.runnerIntervalMs));
  }
}
