# Codexteam

**Lead one Codex agent, coordinate many teammates.**  
**一个主 Codex agent，带多个协作队友。**

`codexteam` is a user-scoped installer, CLI, and MCP runtime that brings a practical "agent team" workflow to Codex today.  
`codexteam` 是一个用户级安装器、CLI 和 MCP runtime，用来在今天的 Codex 里实现可落地的多 agent 协作。

It is designed around one lead agent, one shared task list, one shared mailbox, and optional detached teammate runners.  
它的核心结构是：一个主 agent、一份共享任务列表、一个共享邮箱，以及可选的后台 teammate runner。

## Why

Codex already works well as a single strong agent. The missing piece is team coordination.  
Codex 作为单个强 agent 已经很好用，缺的是“团队协作层”。

`codexteam` adds that coordination layer without requiring per-project plugin setup. Install once, then use it in any project.  
`codexteam` 在不要求每个项目单独安装的前提下补上了这一层。安装一次，就能在任何项目里使用。

## What You Get

- One lead agent that owns planning and task assignment  
  一个主 agent，负责整体规划和任务分配
- Shared team state under `.codex-agent-teams/<team>/`  
  团队共享状态保存在 `.codex-agent-teams/<team>/`
- Shared task list and mailbox for teammate coordination  
  队友通过共享任务列表和共享邮箱协作
- User-scope install under `~/.codexteam/` and `~/.codex/`  
  用户级安装，写入 `~/.codexteam/` 和 `~/.codex/`
- CLI plus MCP tools so Codex can operate the team directly  
  同时提供 CLI 和 MCP 工具，Codex 本身可以直接操作团队

## Install

Install once for your user account:

```bash
npx @jimmyzhang95/codexteam install
```

Then restart Codex.  
然后重启 Codex。

Check install health:

```bash
npx @jimmyzhang95/codexteam doctor
```

You want these fields to be `true`:

- `runtimeInstalled`
- `skillInstalled`
- `configInstalled`

The npm package is scoped because the unscoped name `codexteam` was blocked by npm naming policy. After install, the actual command on disk is still `codexteam`.  
由于 npm 命名策略限制，发布包使用 scoped 名称。安装完成后，你本地真正使用的命令仍然是 `codexteam`。

## 3-Minute Start

Start a team:

```bash
codexteam start my-team --member planner --member builder --member qa --no-runners
```

Add tasks:

```bash
codexteam task-add my-team "Plan the app" --description "Write the implementation plan" --assignee planner
codexteam task-add my-team "Build the app" --description "Implement the feature" --assignee builder
codexteam task-add my-team "QA review" --description "Test and report issues" --assignee qa
```

Check status:

```bash
codexteam status my-team --json
codexteam task-list my-team --json
codexteam messages my-team --agent lead --json
```

If you want background runners, remove `--no-runners`.  
如果你想启用后台 runner，把 `--no-runners` 去掉。

## Best Prompt To Use In Codex

```text
Create an agent team named my-team with planner, builder, and qa.
Use the shared task list and mailbox.
Lead owns the roadmap and assigns tasks.
Have teammates report progress back through the mailbox.
```

中文版本：

```text
创建一个名为 my-team 的 agent team，成员是 planner、builder、qa。
使用共享任务列表和共享邮箱。
由主 agent 负责整体规划和任务分配。
让每个成员通过 mailbox 回报进度。
```

## How It Works

1. Lead creates a named team.
2. Lead adds tasks and assigns ownership.
3. Teammates claim work from the shared task list.
4. Teammates report progress and results through the shared mailbox.
5. Lead reviews status, adds follow-up tasks, and drives the project forward.

1. 主 agent 创建团队。
2. 主 agent 添加任务并分配负责人。
3. Teammates 从共享任务列表中领取任务。
4. Teammates 通过共享邮箱汇报进度和结果。
5. 主 agent 统一查看状态、追加任务、推进项目。

## Good Fit

- Multi-step implementation work  
  多步骤开发任务
- Review flows with planner, builder, QA, fixer roles  
  planner、builder、qa、fixer 这类角色分工
- Projects where one lead should stay in control  
  需要由一个主 agent 持续控盘的项目

## Current Limits

- This does not patch Codex with native teammate panes  
  这不是原生的 Codex 多窗格 teammate UI
- Detached runners use `codex exec`, not long-lived in-process sessions  
  后台 runner 基于 `codex exec`，不是长驻内存会话
- Existing Codex sessions need a restart after install  
  安装后需要重启现有 Codex 会话
- `tmux` mode is reserved and not implemented yet  
  `tmux` 模式暂未实现

## Docs

- [Quick Start / 快速开始](./QUICKSTART.md)
- [Calculator Demo](./examples/calculator-app/)
- [Todo Cycle Demo](./examples/todo-cycle-app/)

## Common Commands

```bash
codexteam start my-team --member planner --member builder --member qa
codexteam task-add my-team "Plan work" --description "Write the plan" --assignee planner
codexteam message my-team --from lead --to builder "Start implementation now"
codexteam stop my-team --agent builder
codexteam cleanup my-team
```

## Uninstall

```bash
npx @jimmyzhang95/codexteam uninstall
```
