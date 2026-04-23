export type TeamMode = "exec" | "tmux";

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "blocked"
  | "failed";

export interface MemberRuntimeState {
  pid?: number;
  startedAt?: string;
  lastHeartbeatAt?: string;
  lastExitCode?: number;
}

export interface TeamMember {
  name: string;
  rolePrompt?: string;
  status: "idle" | "busy" | "stopped" | "failed";
  stopRequested: boolean;
  runtime: MemberRuntimeState;
}

export interface TeamConfig {
  name: string;
  cwd: string;
  mode: TeamMode;
  createdAt: string;
  updatedAt: string;
  settings: {
    runnerIntervalMs: number;
    codexCommand: string;
    codexArgs: string[];
  };
  members: TeamMember[];
}

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  dependsOn: string[];
  assignee?: string;
  claimedBy?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  resultSummary?: string;
  failureReason?: string;
}

export interface MailMessage {
  id: string;
  teamName: string;
  from: string;
  to: string;
  body: string;
  scope: "direct" | "broadcast" | "status";
  createdAt: string;
}

export interface TeamStatusSnapshot {
  team: TeamConfig;
  tasks: TaskRecord[];
  recentMessages: MailMessage[];
}

