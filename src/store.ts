import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile, appendFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { accessSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { MailMessage, TaskRecord, TaskStatus, TeamConfig, TeamMember } from "./types.js";

const DEFAULT_HOME = ".codex-agent-teams";
const LOCK_STALE_MS = 60_000;

export class TeamStoreError extends Error {}

export interface TeamStoreOptions {
  cwd?: string;
  homeDirName?: string;
}

export class TeamStore {
  readonly cwd: string;
  readonly baseDir: string;

  constructor(options: TeamStoreOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.baseDir = path.join(this.cwd, options.homeDirName ?? DEFAULT_HOME);
  }

  async init(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
  }

  resolveTeamDir(teamName: string): string {
    return path.join(this.baseDir, teamName);
  }

  private resolveLocksDir(teamName: string): string {
    return path.join(this.resolveTeamDir(teamName), "locks");
  }

  private resolveTeamFile(teamName: string): string {
    return path.join(this.resolveTeamDir(teamName), "team.json");
  }

  private resolveTasksFile(teamName: string): string {
    return path.join(this.resolveTeamDir(teamName), "tasks.json");
  }

  private resolveMailboxFile(teamName: string): string {
    return path.join(this.resolveTeamDir(teamName), "mailbox.jsonl");
  }

  private resolveEventsFile(teamName: string): string {
    return path.join(this.resolveTeamDir(teamName), "events.jsonl");
  }

  private async withLock<T>(teamName: string, lockName: string, fn: () => Promise<T>): Promise<T> {
    await this.init();
    const locksDir = this.resolveLocksDir(teamName);
    await mkdir(locksDir, { recursive: true });
    const lockPath = path.join(locksDir, lockName);
    const start = Date.now();

    for (;;) {
      try {
        await mkdir(lockPath);
        break;
      } catch (error) {
        const lockStat = await stat(lockPath).catch(() => undefined);
        if (lockStat && Date.now() - lockStat.mtimeMs > LOCK_STALE_MS) {
          await rm(lockPath, { recursive: true, force: true });
          continue;
        }

        if (Date.now() - start > LOCK_STALE_MS) {
          throw new TeamStoreError(`Timed out waiting for lock ${lockName} on team ${teamName}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }

    try {
      return await fn();
    } finally {
      await rm(lockPath, { recursive: true, force: true });
    }
  }

  private async readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
    try {
      const content = await readFile(filePath, "utf8");
      return JSON.parse(content) as T;
    } catch (error) {
      return fallback;
    }
  }

  private async writeJsonFile(filePath: string, data: unknown): Promise<void> {
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  private async appendJsonLine(filePath: string, payload: unknown): Promise<void> {
    await appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
  }

  async createTeam(input: {
    teamName: string;
    cwd?: string;
    mode: TeamConfig["mode"];
    members: Array<Pick<TeamMember, "name" | "rolePrompt">>;
    runnerIntervalMs?: number;
    codexCommand?: string;
    codexArgs?: string[];
  }): Promise<TeamConfig> {
    await this.init();
    const teamDir = this.resolveTeamDir(input.teamName);
    try {
      accessSync(teamDir, fsConstants.F_OK);
      throw new TeamStoreError(`Team ${input.teamName} already exists`);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        if (error instanceof TeamStoreError) {
          throw error;
        }
      }
    }

    await mkdir(teamDir, { recursive: true });
    await mkdir(this.resolveLocksDir(input.teamName), { recursive: true });
    const now = new Date().toISOString();
    const config: TeamConfig = {
      name: input.teamName,
      cwd: input.cwd ?? this.cwd,
      mode: input.mode,
      createdAt: now,
      updatedAt: now,
      settings: {
        runnerIntervalMs: input.runnerIntervalMs ?? 5_000,
        codexCommand: input.codexCommand ?? "codex",
        codexArgs: input.codexArgs ?? []
      },
      members: input.members.map((member) => ({
        name: member.name,
        rolePrompt: member.rolePrompt,
        status: "idle",
        stopRequested: false,
        runtime: {}
      }))
    };

    await this.writeJsonFile(this.resolveTeamFile(input.teamName), config);
    await this.writeJsonFile(this.resolveTasksFile(input.teamName), []);
    await writeFile(this.resolveMailboxFile(input.teamName), "", "utf8");
    await writeFile(this.resolveEventsFile(input.teamName), "", "utf8");
    await this.writeEvent(input.teamName, "team_created", {
      members: config.members.map((member) => member.name),
      mode: config.mode
    });
    return config;
  }

  async readTeam(teamName: string): Promise<TeamConfig> {
    const team = await this.readJsonFile<TeamConfig | null>(this.resolveTeamFile(teamName), null);
    if (!team) {
      throw new TeamStoreError(`Team ${teamName} does not exist`);
    }
    return team;
  }

  async updateTeam(teamName: string, updater: (team: TeamConfig) => TeamConfig): Promise<TeamConfig> {
    return this.withLock(teamName, "team", async () => {
      const current = await this.readTeam(teamName);
      const next = updater(current);
      next.updatedAt = new Date().toISOString();
      await this.writeJsonFile(this.resolveTeamFile(teamName), next);
      return next;
    });
  }

  async addMember(teamName: string, member: Pick<TeamMember, "name" | "rolePrompt">): Promise<TeamConfig> {
    return this.updateTeam(teamName, (team) => {
      if (team.members.some((existing) => existing.name === member.name)) {
        throw new TeamStoreError(`Team ${teamName} already has member ${member.name}`);
      }
      team.members.push({
        name: member.name,
        rolePrompt: member.rolePrompt,
        status: "idle",
        stopRequested: false,
        runtime: {}
      });
      return team;
    });
  }

  async listTasks(teamName: string): Promise<TaskRecord[]> {
    return this.readJsonFile<TaskRecord[]>(this.resolveTasksFile(teamName), []);
  }

  async createTask(input: {
    teamName: string;
    title: string;
    description: string;
    dependsOn?: string[];
    assignee?: string;
    createdBy: string;
  }): Promise<TaskRecord> {
    const task: TaskRecord = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      status: "pending",
      dependsOn: input.dependsOn ?? [],
      assignee: input.assignee,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.withLock(input.teamName, "tasks", async () => {
      const tasks = await this.listTasks(input.teamName);
      tasks.push(task);
      await this.writeJsonFile(this.resolveTasksFile(input.teamName), tasks);
    });

    await this.writeEvent(input.teamName, "task_created", {
      taskId: task.id,
      title: task.title,
      assignee: task.assignee ?? null
    });
    return task;
  }

  private taskDependenciesResolved(task: TaskRecord, tasks: TaskRecord[]): boolean {
    return task.dependsOn.every((dependencyId) =>
      tasks.some((candidate) => candidate.id === dependencyId && candidate.status === "completed")
    );
  }

  async claimNextTask(teamName: string, agentName: string): Promise<TaskRecord | null> {
    return this.withLock(teamName, "tasks", async () => {
      const tasks = await this.listTasks(teamName);
      const claimable = tasks.find((task) => {
        if (task.status !== "pending") {
          return false;
        }
        if (task.assignee && task.assignee !== agentName) {
          return false;
        }
        return this.taskDependenciesResolved(task, tasks);
      });

      if (!claimable) {
        return null;
      }

      claimable.status = "in_progress";
      claimable.claimedBy = agentName;
      claimable.updatedAt = new Date().toISOString();
      await this.writeJsonFile(this.resolveTasksFile(teamName), tasks);
      await this.writeEvent(teamName, "task_claimed", {
        taskId: claimable.id,
        claimedBy: agentName
      });
      return claimable;
    });
  }

  async updateTask(input: {
    teamName: string;
    taskId: string;
    status?: TaskStatus;
    resultSummary?: string;
    failureReason?: string;
    description?: string;
    title?: string;
  }): Promise<TaskRecord> {
    return this.withLock(input.teamName, "tasks", async () => {
      const tasks = await this.listTasks(input.teamName);
      const task = tasks.find((candidate) => candidate.id === input.taskId);
      if (!task) {
        throw new TeamStoreError(`Task ${input.taskId} does not exist`);
      }
      if (input.status) {
        task.status = input.status;
      }
      if (input.resultSummary !== undefined) {
        task.resultSummary = input.resultSummary;
      }
      if (input.failureReason !== undefined) {
        task.failureReason = input.failureReason;
      }
      if (input.description !== undefined) {
        task.description = input.description;
      }
      if (input.title !== undefined) {
        task.title = input.title;
      }
      task.updatedAt = new Date().toISOString();
      await this.writeJsonFile(this.resolveTasksFile(input.teamName), tasks);
      await this.writeEvent(input.teamName, "task_updated", {
        taskId: task.id,
        status: task.status
      });
      return task;
    });
  }

  async failClaimedTasks(teamName: string, agentName: string, reason: string): Promise<TaskRecord[]> {
    return this.withLock(teamName, "tasks", async () => {
      const tasks = await this.listTasks(teamName);
      const updated: TaskRecord[] = [];
      for (const task of tasks) {
        if (task.claimedBy === agentName && task.status === "in_progress") {
          task.status = "failed";
          task.failureReason = reason;
          task.updatedAt = new Date().toISOString();
          updated.push(task);
        }
      }
      if (updated.length > 0) {
        await this.writeJsonFile(this.resolveTasksFile(teamName), tasks);
      }
      return updated;
    });
  }

  async appendMessage(input: {
    teamName: string;
    from: string;
    to: string;
    body: string;
    scope: MailMessage["scope"];
  }): Promise<MailMessage> {
    const message: MailMessage = {
      id: randomUUID(),
      teamName: input.teamName,
      from: input.from,
      to: input.to,
      body: input.body,
      scope: input.scope,
      createdAt: new Date().toISOString()
    };
    await this.withLock(input.teamName, "mailbox", async () => {
      await this.appendJsonLine(this.resolveMailboxFile(input.teamName), message);
    });
    await this.writeEvent(input.teamName, "message_appended", {
      messageId: message.id,
      from: message.from,
      to: message.to,
      scope: message.scope
    });
    return message;
  }

  async readMessages(teamName: string, recipient: string, limit = 20): Promise<MailMessage[]> {
    const filePath = this.resolveMailboxFile(teamName);
    const content = await readFile(filePath, "utf8").catch(() => "");
    const messages = content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as MailMessage)
      .filter((message) => message.to === recipient || message.to === "*")
      .slice(-limit);
    return messages;
  }

  async writeEvent(teamName: string, action: string, payload: Record<string, unknown>): Promise<void> {
    await this.appendJsonLine(this.resolveEventsFile(teamName), {
      id: randomUUID(),
      action,
      createdAt: new Date().toISOString(),
      payload
    });
  }

  async updateMemberRuntime(
    teamName: string,
    memberName: string,
    updater: (member: TeamMember) => TeamMember
  ): Promise<TeamConfig> {
    return this.updateTeam(teamName, (team) => {
      const index = team.members.findIndex((member) => member.name === memberName);
      if (index === -1) {
        throw new TeamStoreError(`Unknown member ${memberName}`);
      }
      team.members[index] = updater(team.members[index]);
      return team;
    });
  }

  async requestStop(teamName: string, memberName: string): Promise<TeamConfig> {
    const next = await this.updateMemberRuntime(teamName, memberName, (member) => ({
      ...member,
      stopRequested: true
    }));
    await this.writeEvent(teamName, "member_stop_requested", { memberName });
    return next;
  }

  async snapshot(teamName: string): Promise<{
    team: TeamConfig;
    tasks: TaskRecord[];
    recentMessages: MailMessage[];
  }> {
    const team = await this.readTeam(teamName);
    const tasks = await this.listTasks(teamName);
    const recentMessages = await this.readMessages(teamName, "lead", 10);
    return { team, tasks, recentMessages };
  }

  async cleanupTeam(teamName: string): Promise<void> {
    const team = await this.readTeam(teamName);
    const activeMembers = team.members.filter(
      (member) => member.status !== "stopped" && member.runtime.pid !== undefined
    );
    if (activeMembers.length > 0) {
      throw new TeamStoreError(
        `Cannot clean up team ${teamName}; active teammates remain: ${activeMembers
          .map((member) => member.name)
          .join(", ")}`
      );
    }
    await rm(this.resolveTeamDir(teamName), { recursive: true, force: true });
  }
}

export function resolveRepositoryRoot(startDir = process.cwd()): string {
  return startDir;
}

export async function createTemporaryDirectory(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}
