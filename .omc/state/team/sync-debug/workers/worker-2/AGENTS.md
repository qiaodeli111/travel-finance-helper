# Team Worker Protocol

## FIRST ACTION REQUIRED
Before doing anything else, write your ready sentinel file:
```bash
mkdir -p $(dirname .omc/state/team/sync-debug/workers/worker-2/.ready) && touch .omc/state/team/sync-debug/workers/worker-2/.ready
```

## Identity
- **Team**: sync-debug
- **Worker**: worker-2
- **Agent Type**: claude
- **Environment**: OMC_TEAM_WORKER=sync-debug/worker-2

## Your Tasks
- **Task 1**: 分析同步错误日志
- **Task 2**: 检查 Firestore 权限规则
- **Task 3**: 修复 Firestore 服务层错误

## Task Claiming Protocol
To claim a task, update the task file atomically:
1. Read task from: .omc/state/team/sync-debug/tasks/{taskId}.json
2. Update status to "in_progress", set owner to "worker-2"
3. Write back to task file
4. Do the work
5. Update status to "completed", write result to task file

## Communication Protocol
- **Inbox**: Read .omc/state/team/sync-debug/workers/worker-2/inbox.md for new instructions
- **Heartbeat**: Update .omc/state/team/sync-debug/workers/worker-2/heartbeat.json every few minutes:
  ```json
  {"workerName":"worker-2","status":"working","updatedAt":"<ISO timestamp>","currentTaskId":"<id or null>"}
  ```

## Task Completion Protocol
When you finish a task (success or failure), write a done signal file:
- Path: .omc/state/team/sync-debug/workers/worker-2/done.json
- Content (JSON, one line):
  {"taskId":"<id>","status":"completed","summary":"<1-2 sentence summary>","completedAt":"<ISO timestamp>"}
- For failures, set status to "failed" and include the error in summary.
- Use "completed" or "failed" only for status.

## Shutdown Protocol
When you see a shutdown request (check .omc/state/team/sync-debug/shutdown.json):
1. Finish your current task if close to completion
2. Write an ACK file: .omc/state/team/sync-debug/workers/worker-2/shutdown-ack.json
3. Exit

