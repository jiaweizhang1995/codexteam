# Codexteam Quick Start | 快速开始

## 1. Install Once | 一次安装，全局可用

```bash
npx @jimmyzhang95/codexteam install
```

EN: Restart Codex after install.  
中文：安装完成后，重启 Codex。

## 2. Check Install | 检查安装

```bash
npx @jimmyzhang95/codexteam doctor
```

EN: You want `runtimeInstalled`, `skillInstalled`, and `configInstalled` to be `true`.  
中文：你需要看到 `runtimeInstalled`、`skillInstalled`、`configInstalled` 都是 `true`。

## 3. Start a Team | 启动一个团队

```bash
codexteam start my-team --member planner --member builder --member qa --no-runners
```

EN: This creates one lead-managed team with three teammates.  
中文：这会创建一个由主 agent 管理的团队，包含三个成员。

## 4. Add Tasks | 添加任务

```bash
codexteam task-add my-team "Plan the app" --description "Write the implementation plan" --assignee planner
codexteam task-add my-team "Build the app" --description "Implement the feature" --assignee builder
codexteam task-add my-team "QA review" --description "Test and report issues" --assignee qa
```

EN: The team shares one task list and one mailbox. Lead owns planning and assignment.  
中文：整个团队共享一份任务列表和一个邮箱。主 agent 负责规划和分配任务。

## 5. Check Status | 查看状态

```bash
codexteam status my-team --json
codexteam task-list my-team --json
codexteam messages my-team --agent lead --json
```

EN: Use these commands to see team state, tasks, and teammate reports.  
中文：用这些命令查看团队状态、任务列表和成员回报。

## 6. Run Background Teammates | 启动后台成员

```bash
codexteam start my-team --member planner --member builder --member qa
```

EN: Remove `--no-runners` if you want detached teammate runner loops.  
中文：如果你想让后台 runner 自动运行，把 `--no-runners` 去掉。

## 7. Use It Inside Codex Chat | 在 Codex 对话里使用

Use this prompt:

```text
Create an agent team named my-team with planner, builder, and qa.
Use the shared task list and mailbox.
Lead owns the roadmap and assigns tasks.
Have teammates report progress back through the mailbox.
```

中文提示词：

```text
创建一个名为 my-team 的 agent team，成员是 planner、builder、qa。
使用共享任务列表和共享邮箱。
由主 agent 负责整体规划和任务分配。
让每个成员通过 mailbox 回报进度。
```

## 8. Stop and Clean Up | 停止和清理

```bash
codexteam stop my-team --agent builder
codexteam cleanup my-team
```

EN: Stop active runners before cleanup.  
中文：清理前先停止还在运行的成员。
