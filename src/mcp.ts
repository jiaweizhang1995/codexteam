import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { AgentTeamsRuntime } from "./runtime.js";

function textResult(data: unknown, summary?: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: summary ?? JSON.stringify(data, null, 2)
      }
    ]
  };
}

export async function startMcpServer(cwd = process.cwd()): Promise<void> {
  const runtime = new AgentTeamsRuntime({ cwd });
  const server = new McpServer({
    name: "codex-agent-teams",
    version: "0.1.0"
  });

  server.tool(
    "team_start",
    "Create a named team with shared task/mailbox state and optionally start detached teammate runners. Use this when the lead wants to begin a new coordinated workflow. Do not use it for adding one more teammate to an existing team; use agent_spawn instead.",
    {
      team_name: z.string().min(1).describe("Unique team name for the shared state directory."),
      mode: z.enum(["exec", "tmux"]).default("exec").describe("Execution mode. Only exec is implemented today."),
      cwd: z.string().optional().describe("Working directory for teammates. Defaults to the current repository root."),
      members: z
        .array(
          z.object({
            name: z.string().min(1).describe("Stable teammate name used for task claims and messages."),
            role_prompt: z.string().optional().describe("Short role instruction such as security reviewer or test owner.")
          })
        )
        .min(1)
        .describe("Named teammates to create."),
      auto_start_runners: z.boolean().default(true).describe("Whether to start detached runner loops immediately.")
    },
    async ({ team_name, mode, cwd: teamCwd, members, auto_start_runners }) => {
      const result = await runtime.startTeam({
        teamName: team_name,
        mode,
        cwd: teamCwd,
        autoStartRunners: auto_start_runners,
        members: members.map((member) => ({
          name: member.name,
          rolePrompt: member.role_prompt
        }))
      });
      return textResult(result, `Started team ${team_name} with ${result.members.length} teammate(s).`);
    }
  );

  server.tool(
    "team_status",
    "Inspect the current team, tasks, and recent lead mailbox items. Use this before assigning work or cleaning up so you can see who is active and what is blocked.",
    {
      team_name: z.string().min(1).describe("Existing team name.")
    },
    async ({ team_name }) => textResult(await runtime.status(team_name))
  );

  server.tool(
    "agent_spawn",
    "Add one teammate to an existing team and optionally start its detached runner loop. Use this when the team needs another specialist after the initial setup.",
    {
      team_name: z.string().min(1).describe("Existing team name."),
      name: z.string().min(1).describe("New teammate name."),
      role_prompt: z.string().optional().describe("Role instruction for the teammate."),
      start_runner: z.boolean().default(true).describe("Whether to launch the teammate runner immediately.")
    },
    async ({ team_name, name, role_prompt, start_runner }) =>
      textResult(
        await runtime.spawnAgent({
          teamName: team_name,
          name,
          rolePrompt: role_prompt,
          startRunner: start_runner
        }),
        `Added teammate ${name} to team ${team_name}.`
      )
  );

  server.tool(
    "task_create",
    "Create a task in the shared task list. Use dependencies for ordering and assignee when only one teammate should claim the work. Avoid embedding multiple unrelated deliverables in one task.",
    {
      team_name: z.string().min(1).describe("Existing team name."),
      title: z.string().min(1).describe("Short task title."),
      description: z.string().min(1).describe("Specific work description and acceptance target."),
      assignee: z.string().optional().describe("Optional teammate name that exclusively owns the task."),
      depends_on: z.array(z.string()).default([]).describe("Task ids that must be completed before this task is claimable."),
      created_by: z.string().default("lead").describe("Actor creating the task.")
    },
    async ({ team_name, title, description, assignee, depends_on, created_by }) =>
      textResult(
        await runtime.createTask({
          teamName: team_name,
          title,
          description,
          assignee,
          dependsOn: depends_on,
          createdBy: created_by
        }),
        `Created task ${title} in team ${team_name}.`
      )
  );

  server.tool(
    "task_list",
    "List tasks for a team, optionally filtered by status. Use this to understand what is pending, blocked, in progress, or done before asking a teammate to claim new work.",
    {
      team_name: z.string().min(1).describe("Existing team name."),
      status: z.enum(["pending", "in_progress", "completed", "blocked", "failed"]).optional().describe("Optional task status filter.")
    },
    async ({ team_name, status }) => textResult(await runtime.listTasks(team_name, status))
  );

  server.tool(
    "task_claim",
    "Claim the next available task for one teammate. The server prevents duplicate claims using file locks. Use this when a teammate is ready for its next unit of work.",
    {
      team_name: z.string().min(1).describe("Existing team name."),
      agent_name: z.string().min(1).describe("Teammate claiming the work.")
    },
    async ({ team_name, agent_name }) => {
      const task = await runtime.claimTask(team_name, agent_name);
      return textResult(task ?? { task: null }, task ? `Claimed task ${task.id}.` : `No claimable task for ${agent_name}.`);
    }
  );

  server.tool(
    "task_update",
    "Update an existing task after work advances. Use this to mark completion, report failures, or attach a concise result summary. Do not create a second task just to record status.",
    {
      team_name: z.string().min(1).describe("Existing team name."),
      task_id: z.string().min(1).describe("Task id to update."),
      status: z.enum(["pending", "in_progress", "completed", "blocked", "failed"]).optional().describe("New task status."),
      result_summary: z.string().optional().describe("Short result summary for completed work."),
      failure_reason: z.string().optional().describe("Human-readable reason when work failed."),
      description: z.string().optional().describe("Replacement description if the task needs refinement."),
      title: z.string().optional().describe("Replacement title if the task needs renaming.")
    },
    async ({ team_name, task_id, status, result_summary, failure_reason, description, title }) =>
      textResult(
        await runtime.updateTask({
          teamName: team_name,
          taskId: task_id,
          status,
          resultSummary: result_summary,
          failureReason: failure_reason,
          description,
          title
        })
      )
  );

  server.tool(
    "message_send",
    "Send a direct mailbox message to one teammate or to lead. Use this for targeted instructions, clarifications, or result summaries that should not go to the whole team.",
    {
      team_name: z.string().min(1).describe("Existing team name."),
      from: z.string().min(1).describe("Sender identity, usually lead or a teammate name."),
      to: z.string().min(1).describe("Recipient identity."),
      body: z.string().min(1).describe("Message content.")
    },
    async ({ team_name, from, to, body }) =>
      textResult(await runtime.sendMessage({ teamName: team_name, from, to, body }), `Sent direct message to ${to}.`)
  );

  server.tool(
    "message_broadcast",
    "Broadcast one mailbox message to the full team. Use sparingly for shared guidance that every teammate needs, such as conflict avoidance or new acceptance criteria.",
    {
      team_name: z.string().min(1).describe("Existing team name."),
      from: z.string().min(1).describe("Sender identity."),
      body: z.string().min(1).describe("Broadcast body.")
    },
    async ({ team_name, from, body }) =>
      textResult(await runtime.broadcast({ teamName: team_name, from, body }), `Broadcast message sent to all teammates.`)
  );

  server.tool(
    "message_read",
    "Read the latest mailbox entries visible to one recipient. Use this before claiming new work or when checking what the lead or teammates most recently said.",
    {
      team_name: z.string().min(1).describe("Existing team name."),
      agent_name: z.string().min(1).describe("Recipient identity to read as."),
      limit: z.number().int().positive().default(20).describe("Maximum number of recent messages to return.")
    },
    async ({ team_name, agent_name, limit }) => textResult(await runtime.readMessages(team_name, agent_name, limit))
  );

  server.tool(
    "agent_stop",
    "Request graceful shutdown for one teammate. Use this before cleanup or when you want a runner to stop taking new work. The request is cooperative and applied on the runner's next loop.",
    {
      team_name: z.string().min(1).describe("Existing team name."),
      agent_name: z.string().min(1).describe("Teammate to stop.")
    },
    async ({ team_name, agent_name }) =>
      textResult(await runtime.stopAgent(team_name, agent_name), `Stop requested for ${agent_name}.`)
  );

  server.tool(
    "team_cleanup",
    "Remove team runtime state after all teammates have stopped. Use this only when the workflow is truly complete; it will refuse while teammates are still active.",
    {
      team_name: z.string().min(1).describe("Existing team name.")
    },
    async ({ team_name }) => {
      await runtime.cleanupTeam(team_name);
      return textResult({ cleaned: true, team_name }, `Cleaned up team ${team_name}.`);
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
