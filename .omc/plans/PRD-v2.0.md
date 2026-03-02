# Travel Finance Helper - 产品需求文档 (PRD)

## 文档信息
- **版本**: v2.0
- **日期**: 2026-03-02
- **状态**: 待实现

---

## 一、需求概述

本次更新旨在解决以下核心问题：
1. 数据同步问题 - 加入账本后无法下载最新数据
2. 费用记录可追溯性 - 缺少创建者信息
3. 邀请流程优化 - 当前流程与用户期望相反
4. 账本管理完善 - 缺少删除、归档功能
5. 首次使用体验 - 自动创建账本不符合用户期望
6. 界面精简 - 移除不必要的备份导出功能

---

## 二、功能需求详细说明

### 需求1: 账本同步修复 (优先级: P0 - 关键)

#### 问题描述
当前账本的费用记录只能上传，无法下载。别人加入账本后，无法正常下载到最新数据。

#### 根因分析
1. `CloudSyncContext.tsx` 中的 `syncNow` 方法只处理单向同步（本地 -> 云端）
2. `subscribeToLedgerUpdates` 订阅逻辑未正确触发数据拉取
3. 加入账本后未主动拉取云端数据
4. `CloudExpense` 已有 `createdBy` 和 `createdByDisplayName` 字段，但本地 `Expense` 类型缺少

#### 解决方案
1. **双向同步机制**
   - 在 `syncNow` 中增加从云端拉取费用的逻辑
   - 实现费用合并策略（以云端为准，保留本地新增）

2. **加入账本后主动拉取**
   - 在 `InviteModal.tsx` 的 `onJoinSuccess` 回调中触发数据拉取
   - 确保 `loadFromCloud` 正确加载所有费用

3. **实时订阅优化**
   - 修复 `subscribeToExpenses` 的订阅逻辑
   - 确保订阅回调正确更新本地状态

#### 验收标准
- [ ] 用户A创建费用后，用户B能在3秒内看到更新
- [ ] 离线添加的费用在联网后自动同步
- [ ] 加入账本后立即显示所有历史费用

#### 影响文件
- `src/contexts/CloudSyncContext.tsx`
- `components/InviteModal.tsx`
- `services/firestoreService.ts`
- `types.ts` (增加 createdBy 字段)

---

### 需求2: 费用明细显示创建者信息 (优先级: P1 - 高)

#### 问题描述
费用明细中不显示是谁在什么时间添加的记录。

#### 解决方案
1. **数据模型更新**
   ```typescript
   // types.ts - Expense 接口扩展
   interface Expense {
     id: string;
     date: number;
     description: string;
     amount: number;
     category: Category;
     payerId: string;
     sharedWithFamilyIds?: string[];
     // 新增字段
     createdBy?: string;           // 创建者用户ID
     createdByDisplayName?: string; // 创建者显示名称
     createdAt?: number;           // 创建时间戳
   }
   ```

2. **UI 显示**
   - 在 `ExpenseList.tsx` 中显示创建者头像和名称
   - 显示创建时间（已存在 `date` 字段为消费日期，新增 `createdAt` 为记录创建时间）

3. **同步更新**
   - 确保 `CloudExpense` 与本地 `Expense` 字段一致
   - 修改 `CloudSyncContext.tsx` 中的数据转换逻辑

#### 验收标准
- [ ] 每条费用显示 "由 XXX 添加于 YYYY-MM-DD HH:mm"
- [ ] 云端数据正确存储创建者信息
- [ ] 本地数据迁移兼容旧数据（无创建者信息时显示为空）

#### 影响文件
- `types.ts`
- `components/ExpenseList.tsx`
- `components/ExpenseForm.tsx`
- `src/contexts/CloudSyncContext.tsx`
- `types/firestore.ts`

---

### 需求3: 通过邀请码加入账本 (优先级: P1 - 高)

#### 问题描述
当前邀请流程是"让别人加入"，用户期望是"输入邀请码加入别人的账本"。

#### 当前实现分析
- `InviteModal.tsx` 已有两种模式：`create`（创建邀请）和 `join`（加入）
- 但触发入口不明确，用户需要点击"通过邀请码加入"按钮

#### 解决方案
1. **UI 入口优化**
   - 在账本列表菜单中添加"加入账本"入口（已存在 `joinWithCode`）
   - 点击后显示输入框，输入邀请码后直接加入

2. **流程优化**
   ```
   用户点击"加入账本"
     -> 显示邀请码输入框
     -> 用户输入邀请码
     -> 验证邀请码有效性
     -> 显示账本信息确认
     -> 用户确认加入
     -> 加入成功，切换到该账本
     -> 拉取账本数据
   ```

3. **增加手动输入入口**
   - 在登录页面/首次使用界面增加"已有邀请码？加入账本"链接

#### 验收标准
- [ ] 用户可通过输入邀请码直接加入账本
- [ ] 加入流程清晰，不超过3步
- [ ] 加入后立即显示账本数据

#### 影响文件
- `components/InviteModal.tsx`
- `App.tsx`
- `components/AuthModal.tsx` (可选)

---

### 需求4: 账本列表显示创建者信息 (优先级: P2 - 中)

#### 问题描述
左上角账本列表不显示是谁创建的账本，还是本地账本。

#### 解决方案
1. **数据模型扩展**
   ```typescript
   // LedgerMeta 接口扩展
   interface LedgerMeta {
     id: string;
     name: string;
     lastAccess: number;
     // 新增字段
     ownerId?: string;           // 创建者用户ID
     ownerDisplayName?: string;  // 创建者显示名称
     isLocal?: boolean;          // 是否为本地账本
     isCloudSynced?: boolean;    // 是否已同步到云端
   }
   ```

2. **UI 显示**
   - 云端账本显示创建者头像/名称
   - 本地账本显示"本地账本"标签
   - 已归档账本显示归档状态

#### 验收标准
- [ ] 云端账本显示创建者信息
- [ ] 本地账本显示"本地"标签
- [ ] 已归档账本有视觉区分

#### 影响文件
- `App.tsx`
- `components/LedgerManagePanel.tsx`

---

### 需求5: 账本管理 - 删除和归档 (优先级: P1 - 高)

#### 问题描述
缺少账本删除和归档功能。

#### 功能设计

##### 5.1 删除账本
- **权限**: 只有账本创建者可删除
- **行为**:
  - 删除云端数据（包括费用、成员、邀请）
  - 删除本地数据
  - 从账本列表中移除
- **确认**: 需要二次确认，输入账本名称确认删除

##### 5.2 归档账本
- **权限**: 只有账本创建者可归档
- **行为**:
  - 账本状态变为"已归档"
  - 状态同步给所有成员
  - 所有成员无法再添加费用（添加按钮消失）
  - 可查看历史数据
  - 可取消归档（创建者）

##### 5.3 数据模型
```typescript
// CloudLedger 接口扩展
interface CloudLedger {
  // ... 现有字段
  status: 'active' | 'archived';  // 账本状态
  archivedAt?: Timestamp;         // 归档时间
  archivedBy?: string;            // 归档操作者
}

// LedgerMeta 接口扩展
interface LedgerMeta {
  // ... 现有字段
  status?: 'active' | 'archived';
}
```

#### 验收标准
- [ ] 创建者可删除账本，数据彻底清除
- [ ] 创建者可归档账本，成员无法添加费用
- [ ] 归档状态实时同步给所有成员
- [ ] 已归档账本有视觉标识
- [ ] 创建者可取消归档

#### 影响文件
- `types/firestore.ts`
- `App.tsx`
- `components/LedgerManagePanel.tsx`
- `services/firestoreService.ts`
- `src/contexts/CloudSyncContext.tsx`

---

### 需求6: 游客模式优化 (优先级: P1 - 高)

#### 问题描述
游客模式与登录模式的关系需要明确，注册登录后应自动同步本地账本。

#### 功能设计

##### 6.1 游客模式（本地模式）
- 数据仅存储在本地 localStorage
- 无法与他人共享
- 无法跨设备访问
- 显示"游客模式"标识

##### 6.2 游客转正式用户
- 用户从游客模式注册/登录后：
  - 当前本地账本自动上传到云端
  - 用户成为账本创建者
  - 可开始邀请他人

##### 6.3 实现方案
```typescript
// AuthContext.tsx - 登录成功后检查本地账本
async function onLoginSuccess(user: User) {
  // 检查是否有本地账本需要迁移
  const localLedgers = getLocalLedgers();
  if (localLedgers.length > 0) {
    // 显示迁移确认对话框
    // 用户确认后上传到云端
  }
}
```

#### 验收标准
- [ ] 游客模式明确标识
- [ ] 登录后自动提示迁移本地账本
- [ ] 迁移成功后账本可共享

#### 影响文件
- `src/contexts/AuthContext.tsx`
- `App.tsx`
- 新增 `components/MigrationPrompt.tsx`

---

### 需求7: 首次使用引导界面 (优先级: P0 - 关键)

#### 问题描述
网站打开后自动创建账本，应改为显示引导界面。

#### 功能设计

##### 7.1 引导界面流程
```
首次访问
  -> 显示欢迎界面
  -> 询问：你来自哪里？（国家选择）
  -> 询问：要去哪里游玩？（目的地选择）
  -> 询问：参与者？（家庭/成员设置）
  -> 询问：预算多少？（可选，本国货币或目标国货币）
  -> 点击"创建账本"
  -> 自动创建账本，命名：{目的地}-travel-ledger
  -> 显示登录/游客模式选择对话框
     - 登录：可与他人共享
     - 游客模式：数据仅存本地，提示无法共享
  -> 进入记账界面
```

##### 7.2 UI 设计要点
- 步骤式向导，每步一个问题
- 支持跳过可选步骤
- 根据出发地自动设置语言
- 根据目的地自动设置货币

##### 7.3 数据模型
```typescript
interface WelcomeWizardData {
  originCountry: string;   // 出发地
  destination: string;     // 目的地
  families: Family[];      // 参与者
  budget?: number;         // 预算（可选）
  budgetCurrency?: string; // 预算货币
  ledgerName: string;      // 自动生成
}
```

#### 验收标准
- [ ] 首次访问显示引导界面
- [ ] 完成引导后创建账本
- [ ] 显示登录/游客模式选择
- [ ] 游客模式有明确提示
- [ ] 老用户直接进入上次使用的账本

#### 影响文件
- `App.tsx` (修改初始化逻辑)
- `components/WelcomeWizard.tsx` (已存在，需完善)
- 新增 `components/AuthChoiceModal.tsx`

---

### 需求8: 移除备份导出功能 (优先级: P3 - 低)

#### 问题描述
页面最下方的数据备份和导出功能不需要，需删除。

#### 具体删除内容
- 删除"备份数据"按钮
- 删除"恢复数据"按钮
- 删除"导出Markdown"按钮
- 保留"导出PDF"功能（可能有用）

#### 验收标准
- [ ] 底部不再显示备份/恢复/Markdown导出按钮
- [ ] 相关函数可保留但不在UI显示

#### 影响文件
- `App.tsx`

---

## 三、技术实现计划

### 阶段1: 核心同步修复 (预计工作量: 2-3天)
1. 修复 `CloudSyncContext.tsx` 双向同步逻辑
2. 修复 `subscribeToExpenses` 订阅
3. 添加加入账本后的数据拉取
4. 单元测试

### 阶段2: 数据模型扩展 (预计工作量: 1天)
1. 扩展 `Expense` 接口
2. 扩展 `CloudLedger` 接口
3. 扩展 `LedgerMeta` 接口
4. 数据迁移脚本

### 阶段3: UI 功能开发 (预计工作量: 3-4天)
1. 费用明细显示创建者
2. 账本列表显示创建者
3. 账本管理面板（删除/归档）
4. 游客模式迁移提示
5. 首次使用引导界面

### 阶段4: 测试与优化 (预计工作量: 1-2天)
1. 集成测试
2. 端到端测试
3. 性能优化
4. Bug 修复

---

## 四、风险与依赖

### 技术风险
1. **数据迁移**: 旧数据缺少新字段，需要兼容处理
2. **实时同步**: Firestore 订阅可能存在延迟
3. **离线冲突**: 多人离线编辑后的合并策略

### 外部依赖
1. Firebase Firestore 稳定性
2. ExchangeRate API 可用性

---

## 五、附录

### A. 相关文件清单
- `App.tsx` - 主应用组件
- `types.ts` - 类型定义
- `types/firestore.ts` - Firestore 类型
- `src/contexts/CloudSyncContext.tsx` - 云同步上下文
- `src/contexts/AuthContext.tsx` - 认证上下文
- `services/firestoreService.ts` - Firestore 服务
- `services/storageService.ts` - 本地存储服务
- `components/InviteModal.tsx` - 邀请模态框
- `components/ExpenseList.tsx` - 费用列表
- `components/ExpenseForm.tsx` - 费用表单
- `components/LedgerManagePanel.tsx` - 账本管理面板
- `components/WelcomeWizard.tsx` - 欢迎向导

### B. 数据库 Schema 变更
需要更新 Firestore 安全规则以支持新字段。