import path from "node:path";
import { spawn } from "node:child_process";

import { TeamStore, TeamStoreError } from "./store.js";
import type { MailMessage, TaskRecord, TeamConfig, TeamStatusSnapshot } from "./types.js";

export interface CreateTeamInput {
  teamName: string;
  mode?: TeamConfig["mode"];
  cwd?: string;
  members: Array<{ name: string; rolePrompt?: string }>;
  autoStartRunners?: boolean;
  runnerIntervalMs?: number;
  codexCommand?: string;
  codexArgs?: string[];
}

export interface RuntimeOptions {
  cwd?: string;
  store?: TeamStore;
}

export class AgentTeamsRuntime {
  readonly cwd: string;
  readonly store: TeamStore;

  constructor(options: RuntimeOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.store = options.store ?? new TeamStore({ cwd: this.cwd });
  }

  async startTeam(input: CreateTeamInput): Promise<TeamConfig> {
    const team = await this.store.createTeam({
      teamName: input.teamName,
      cwd: input.cwd ?? this.cwd,
      mode: input.mode ?? "exec",
      members: input.members,
      runnerIntervalMs: input.runnerIntervalMs,
      codexCommand: input.codexCommand,
      codexArgs: input.codexArgs
    });

    if (input.autoStartRunners !== false) {
      for (const member of team.members) {
        await this.startRunner(input.teamName, member.name);
      }
    }

    return this.store.readTeam(input.teamName);
  }

  async startRunner(teamName: string, memberName: string): Promise<void> {
    const scriptPath = path.join(this.cwd, "dist", "src", "cli.js");
    const child = spawn(process.execPath, [scriptPath, "agent-loop", teamName, memberName], {
      cwd: this.cwd,
      stdio: "ignore",
      detached: true
    });
    child.unref();

    await this.store.updateMemberRuntime(teamName, memberName, (member) => ({
      ...member,
      status: "idle",
      stopRequested: false,
      runtime: {
        ...member.runtime,
        pid: child.pid,
        startedAt: new Date().toISOString(),
        lastHeartbeatAt: new Date().toISOString()
      }
    }));

    await this.store.writeEvent(teamName, "runner_started", {
      memberName,
      pid: child.pid
    });
  }

  async spawnAgent(input: { teamName: string; name: string; rolePrompt?: string; startRunner?: boolean }): Promise<TeamConfig> {
    await this.store.addMember(input.teamName, {
      name: input.name,
      rolePrompt: input.rolePrompt
    });
    if (input.startRunner !== false) {
      await this.startRunner(input.teamName, input.name);
    }
    return this.store.readTeam(input.teamName);
  }

  async status(teamName: string): Promise<TeamStatusSnapshot> {
    return this.store.snapshot(teamName);
  }

  async createTask(input: {
    teamName: string;
    title: string;
    description: string;
    assignee?: string;
    dependsOn?: string[];
    createdBy: string;
  }): Promise<TaskRecord> {
    return this.store.createTask(input);
  }

  async listTasks(teamName: string, status?: string): Promise<TaskRecord[]> {
    const tasks = await this.store.listTasks(teamName);
    if (!status) {
      return tasks;
    }
    return tasks.filter((task) => task.status === status);
  }

  async claimTask(teamName: string, agentName: string): Promise<TaskRecord | null> {
    return this.store.claimNextTask(teamName, agentName);
  }

  async updateTask(input: {
    teamName: string;
    taskId: string;
    status?: TaskRecord["status"];
    resultSummary?: string;
    failureReason?: string;
    description?: string;
    title?: string;
  }): Promise<TaskRecord> {
    return this.store.updateTask(input);
  }

  async sendMessage(input: {
    teamName: string;
    from: string;
    to: string;
    body: string;
    scope?: MailMessage["scope"];
  }): Promise<MailMessage> {
    return this.store.appendMessage({
      teamName: input.teamName,
      from: input.from,
      to: input.to,
      body: input.body,
      scope: input.scope ?? "direct"
    });
  }

  async broadcast(input: { teamName: string; from: string; body: string }): Promise<MailMessage> {
    return this.store.appendMessage({
      teamName: input.teamName,
      from: input.from,
      to: "*",
      body: input.body,
      scope: "broadcast"
    });
  }

  async readMessages(teamName: string, recipient: string, limit = 20): Promise<MailMessage[]> {
    return this.store.readMessages(teamName, recipient, limit);
  }

  async stopAgent(teamName: string, memberName: string): Promise<TeamConfig> {
    return this.store.requestStop(teamName, memberName);
  }

  async cleanupTeam(teamName: string): Promise<void> {
    return this.store.cleanupTeam(teamName);
  }

  isRecoverableError(error: unknown): error is TeamStoreError {
    return error instanceof TeamStoreError;
  }
}
