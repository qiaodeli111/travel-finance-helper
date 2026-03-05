# PRD: 修复数据云同步功能

## 问题陈述

用户登录后，数据云同步功能存在两个严重问题：

1. **云端账本列表问题**：用户登录后无法列出所有云端账本，也无法下载之前同步过的云端账本
2. **删除同步问题**：本地删除账单的操作没有正确同步到云端，云端账单没有被标记为已删除，导致重新同步时已删除的账单又会出现

## 目标

1. 修复云端账本列表获取功能，确保用户登录后能正确列出所有已加入的云端账本
2. 修复删除同步逻辑，确保本地删除的账单能正确同步到云端（软删除机制）
3. 确保同步过程的可靠性和数据一致性

## 非目标

- 新增功能（如批量操作、高级筛选等）
- 重构整个同步架构
- 添加离线优先支持（虽然代码中有基础支持）
- 多设备并发编辑冲突解决（目前使用简单的版本号机制）

## 接受标准（可测试）

### AC1: 云端账本列表显示
**Given** 用户已登录且有网络连接
**When** 用户打开账本管理页面
**Then** 系统应显示用户所有已加入的云端账本列表
**And** 每个账本应显示账本名称、目的地、货币等基本信息

### AC2: 下载云端账本
**Given** 用户已登录且云端存在账本数据
**When** 用户点击下载/同步某个云端账本
**Then** 系统应将该账本的所有数据（账单、家庭成员、汇率等）下载到本地
**And** 用户可以在本地正常使用该账本

### AC3: 删除同步 - 本地到云端
**Given** 用户已登录且云端同步已启用
**When** 用户在本地删除一条账单
**Then** 该账单在云端应被标记为已删除（设置 `deletedAt` 时间戳）
**And** 下次同步时不应重新出现

### AC4: 删除同步 - 云端到本地
**Given** 用户已登录且云端同步已启用
**When** 云端有账单被标记为已删除
**Then** 同步后本地也应过滤掉这些已删除的账单
**And** 本地账单列表不应显示已删除的账单

### AC5: 同步状态反馈
**Given** 用户触发同步操作
**When** 同步进行中或完成后
**Then** 系统应显示同步状态（同步中、成功、失败）
**And** 如果失败，应显示错误信息

## 技术约束

1. 使用现有的 Firebase Firestore 后端
2. 保持与现有数据结构的兼容性（`CloudExpense` 已有 `deletedAt` 和 `version` 字段）
3. 不修改 Firestore 安全规则（除非必要）
4. 保持 React Context 架构不变

## 实现阶段

### Phase 1: 问题调查与分析
- 分析 `subscribeToUserLedgers` 函数的执行流程
- 验证 Firestore 查询是否正确
- 检查认证状态与订阅的时机问题
- 分析删除操作的完整流程（UI -> Context -> Service -> Firestore）

### Phase 2: 修复云端账本列表
- 修复 `subscribeToUserLedgers` 中的查询逻辑
- 确保 Member 订阅正确触发并获取 Ledger 数据
- 添加必要的错误处理和日志
- 在 UI 层添加账本列表组件（如果缺失）

### Phase 3: 修复删除同步
- 在 `syncNow` 函数中添加删除同步逻辑
- 上传本地删除状态到云端（调用 `softDeleteExpense`）
- 下载云端删除状态到本地（过滤 `deletedAt` 不为空的账单）
- 确保双向同步的一致性

### Phase 4: 测试与验证
- 编写/更新单元测试
- 进行手动端到端测试
- 验证所有接受标准

## 关键文件

- `services/firestoreService.ts` - Firestore 数据操作
- `src/contexts/CloudSyncContext.tsx` - 云同步上下文和逻辑
- `services/migrationService.ts` - 数据迁移和同步辅助函数
- `types/firestore.ts` - Firestore 数据类型定义
- `types.ts` - 应用数据类型定义

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Firestore 索引问题导致查询失败 | 高 | 检查现有索引，必要时添加复合索引 |
| 认证状态变化时的订阅泄漏 | 中 | 确保正确清理旧的订阅 |
| 网络不稳定导致同步失败 | 中 | 利用现有离线队列机制 |
| 数据版本冲突 | 低 | 使用现有的 version 字段进行乐观锁 |

## 定义完成

- [x] 所有问题根因已定位并修复
- [x] 所有接受标准已实现（需手动测试验证）
- [x] 代码通过 TypeScript 类型检查
- [x] 构建成功无错误
- [x] 代码有适当的错误处理
- [x] 架构师验证通过（代码审查完成）

## 已完成的修复

### Phase 1: 问题调查与分析 ✅
- 分析了 `subscribeToUserLedgers` 函数 - 发现登录后没有调用该函数来订阅云端账本
- 分析了删除同步流程 - 发现使用硬删除而非软删除，且 `syncNow` 没有处理删除同步

### Phase 2: 修复云端账本列表 ✅
- 在 `CloudSyncContext` 中添加了 `cloudLedgers` 状态和 `isLoadingLedgers` 状态
- 添加了 `ledgerSubscriptionRef` 来追踪云端账本订阅
- 用户登录后自动订阅云端账本列表（通过 useEffect）
- 更新了 `LedgerManagePanel` 组件以显示云端账本
- 添加了下载云端账本到本地的功能
- 添加了 `refreshCloudLedgers` 函数用于手动刷新

### Phase 3: 修复删除同步 ✅
- 将 `App.tsx` 中的 `deleteExpense` 改为 `softDeleteExpense`
- 在 `syncNow` 函数中添加了 `lastSyncedIdsRef` 追踪本地删除
- 在 `syncNow` 函数中添加了删除同步逻辑（检测本地删除并软删除云端）
- 在 `loadFromCloud` 和 `subscribeToLedgerUpdates` 中过滤 `deletedAt` 不为空的账单

### Phase 4: 翻译和UI ✅
- 添加了新的翻译键用于云端账本管理
- 更新了 LedgerManagePanel UI 显示云端账本状态

### Phase 5: 修复 Member ID 格式问题 ✅ (2026-03-05)
- 发现问题：Firestore 安全规则期望 member ID 格式为 `{ledgerId}_{userId}`
- 但代码使用的是随机 UUID (`crypto.randomUUID()`)，导致 `isMember()` 检查失败
- 修复位置：
  - `src/contexts/CloudSyncContext.tsx` - syncNow 函数中创建 member 的逻辑
  - `services/migrationService.ts` - migrateLocalToCloud 函数中创建 member 的逻辑
- 添加了详细的调试日志到 `subscribeToUserLedgers` 函数