# Travel Finance Helper - 项目记忆文档

本文档详细记录了项目的代码结构、功能实现和调用流程，帮助快速上手维护和修复问题。

---

## 一、项目概述

**项目名称**: 巴厘岛分账助手 (Travel Finance Helper)
**技术栈**: React 19 + TypeScript + Vite + Firebase + Tailwind CSS
**核心功能**: 多家庭旅行费用分摊、云同步、协作账本

### 常用命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

---

## 二、项目架构

```
travel-finance-helper/
├── App.tsx                 # 主应用组件，核心状态管理
├── index.tsx               # React入口，Provider嵌套
├── types/
│   ├── index.ts            # 核心类型定义 (AppState, Expense, Family等)
│   └── firestore.ts        # Firestore数据模型定义
├── services/               # 服务层
│   ├── firebaseConfig.ts   # Firebase初始化配置
│   ├── firestoreService.ts # Firestore CRUD操作
│   ├── storageService.ts   # 本地存储服务
│   ├── offlineService.ts   # 离线队列服务
│   ├── collaborationService.ts # 协作功能服务
│   └── exportService.ts    # 导出服务 (Markdown/PDF)
├── components/             # UI组件
│   ├── ExpenseForm.tsx     # 账单表单
│   ├── ExpenseList.tsx     # 账单列表
│   ├── Summary.tsx         # 结算概览
│   ├── SettingsModal.tsx   # 设置弹窗
│   ├── AuthModal.tsx       # 认证弹窗
│   └── ...                 # 其他组件
├── src/
│   ├── contexts/
│   │   ├── AuthContext.tsx     # 认证状态管理
│   │   └── CloudSyncContext.tsx # 云同步状态管理
│   ├── services/
│   │   └── authService.ts      # Firebase认证封装
│   └── types/
│       └── auth.ts             # 认证类型定义
└── i18n/
    ├── translations.ts     # 多语言翻译配置
    └── useTranslation.tsx  # 国际化Hook
```

---

## 三、核心数据模型

### 3.1 AppState (应用状态)

**文件**: `types/index.ts`

```typescript
interface AppState {
  ledgerName: string;          // 账本名称
  expenses: Expense[];         // 账单列表
  exchangeRate: number;        // 汇率
  families: Family[];          // 家庭列表
  currencyCode: string;        // 目的地货币代码
  destination: string;         // 目的地
  baseCurrency: string;        // 基础货币 (结算货币)
  originCountry: string;       // 出发国
  lastUpdated: number;         // 最后更新时间戳
}
```

### 3.2 Expense (账单)

**文件**: `types/index.ts`

```typescript
interface Expense {
  id: string;
  date: number;                        // 消费日期时间戳
  description: string;                 // 描述
  amount: number;                      // 金额
  category: Category;                  // 类别
  payerId: string;                     // 付款人家庭ID
  sharedWithFamilyIds: string[];       // 共享家庭ID列表
  createdBy?: string;                  // 创建者UID
  createdByDisplayName?: string;       // 创建者显示名
  createdAt?: number;                  // 创建时间
  version?: number;                    // 版本号(用于冲突解决)
  updatedAt?: number;                  // 更新时间
}
```

### 3.3 Family (家庭)

**文件**: `types/index.ts`

```typescript
interface Family {
  id: string;      // 家庭ID (如 'f1', 'f2')
  name: string;    // 家庭名称
  count: number;   // 人数
}
```

### 3.4 Firestore数据模型

**文件**: `types/firestore.ts`

- `UserProfile`: 用户资料 (uid, email, displayName, defaultLedgerId等)
- `CloudLedger`: 云账本 (id, name, ownerId, families, status等)
- `CloudExpense`: 云账单 (带版本控制和软删除)
- `LedgerMember`: 账本成员 (role: owner/admin/member/viewer)
- `Invitation`: 邀请记录

---

## 四、服务层详解

### 4.1 firebaseConfig.ts - Firebase配置

**核心功能**: 初始化Firebase App, Auth, Firestore

**导出内容**:
- `auth`: Firebase Auth实例
- `db`: Firestore实例
- `isCloudEnabled`: 是否启用云功能

**关键逻辑**:
- 检查环境变量是否配置完整
- 启用IndexedDB持久化 (离线支持)
- 未配置时提供null导出，不阻塞应用运行

### 4.2 firestoreService.ts - Firestore服务

**最核心的服务文件，超过1000行代码**

#### 用户操作 (User Operations)

| 方法名 | 功能 | 参数 |
|--------|------|------|
| `createUserProfile` | 创建用户资料 | uid, data |
| `getUserProfile` | 获取用户资料 | uid |
| `updateUserProfile` | 更新用户资料 | uid, data |
| `updateUserDefaultLedger` | 更新默认账本 | uid, ledgerId |
| `getUserDefaultLedger` | 获取默认账本ID | uid |
| `subscribeToUserProfile` | 订阅用户资料变更 | uid, callback |

#### 账本操作 (Ledger Operations)

| 方法名 | 功能 | 参数 |
|--------|------|------|
| `checkLedgerNameExists` | 检查账本名是否存在 | userId, name, excludeLedgerId |
| `createLedger` | 创建账本 | ledger |
| `getLedger` | 获取账本 | ledgerId |
| `updateLedger` | 更新账本 | ledgerId, data |
| `deleteLedger` | 删除账本及关联数据 | ledgerId |
| `subscribeToUserLedgers` | 订阅用户账本列表 | userId, callback |

#### 账单操作 (Expense Operations)

| 方法名 | 功能 | 参数 |
|--------|------|------|
| `createExpense` | 创建账单 | ledgerId, expense |
| `getExpenses` | 获取账单列表 | ledgerId |
| `updateExpense` | 更新账单 | ledgerId, expenseId, data |
| `softDeleteExpense` | 软删除账单 | ledgerId, expenseId, currentVersion |
| `deleteExpense` | 硬删除账单 | ledgerId, expenseId |
| `subscribeToExpenses` | 订阅账单变更 | ledgerId, callback |

#### 成员操作 (Member Operations)

| 方法名 | 功能 | 参数 |
|--------|------|------|
| `addMember` | 添加成员 | ledgerId, member |
| `getLedgerMembers` | 获取成员列表 | ledgerId |
| `updateMemberRole` | 更新成员角色 | ledgerId, userId, role |
| `removeMember` | 移除成员 | ledgerId, userId |
| `subscribeToLedgerMembers` | 订阅成员变更 | ledgerId, callback |

#### 邀请操作 (Invitation Operations)

| 方法名 | 功能 | 参数 |
|--------|------|------|
| `createInvitation` | 创建邀请 | invitation |
| `getInvitationByCode` | 通过邀请码获取邀请 | code |
| `useInvitation` | 使用邀请 | code, userId |
| `subscribeToLedgerInvitations` | 订阅邀请变更 | ledgerId, callback |

#### 离线支持 (Offline Support)

| 方法名 | 功能 | 说明 |
|--------|------|------|
| `useOfflineQueue` | 设置离线队列处理 | 监听online事件 |
| `processOfflineQueue` | 处理离线队列 | 网络恢复后执行 |
| `createWithOfflineSupport` | 支持离线的创建操作 | 失败时入队 |
| `updateWithOfflineSupport` | 支持离线的更新操作 | 失败时入队 |
| `deleteWithOfflineSupport` | 支持离线的删除操作 | 失败时入队 |

### 4.3 storageService.ts - 本地存储

**功能**: 纯localStorage操作，用于本地账本数据持久化

| 方法名 | 功能 | 说明 |
|--------|------|------|
| `saveLedger` | 保存账本到本地 | key: `ledger_data_${id}` |
| `loadLedger` | 从本地加载账本 | 返回AppState或null |
| `deleteLedger` | 删除本地账本 | 移除localStorage项 |
| `createLedgerId` | 生成账本ID | 使用crypto.randomUUID() |

### 4.4 offlineService.ts - 离线队列

**功能**: 管理离线操作队列，存储在localStorage

**数据结构**:
```typescript
interface QueuedOperation {
  id: string;                  // 操作ID
  type: 'create' | 'update' | 'delete';  // 操作类型
  collection: string;          // 集合名
  data: any;                   // 操作数据
  timestamp: number;           // 时间戳
}
```

**方法列表**:

| 方法名 | 功能 |
|--------|------|
| `queueOperation` | 将操作加入队列 |
| `getQueuedOperations` | 获取所有队列操作 |
| `removeQueuedOperation` | 移除特定操作 |
| `clearQueue` | 清空队列 |
| `isOnline` | 检查网络状态 |
| `setupOnlineListener` | 设置网络监听 |

### 4.5 collaborationService.ts - 协作服务

**功能**: 成员管理和邀请系统

**权限矩阵**:
```typescript
const PERMISSION_MATRIX = {
  owner: ['edit_expenses', 'delete_expenses', 'manage_members', 'change_settings', 'delete_ledger'],
  admin: ['edit_expenses', 'delete_expenses', 'manage_members', 'change_settings'],
  member: ['edit_expenses', 'delete_expenses'],
  viewer: [],
};
```

**方法列表**:

| 方法名 | 功能 |
|--------|------|
| `getLedgerMembers` | 获取成员列表 |
| `addMemberToLedger` | 添加成员到账本 |
| `updateMemberRole` | 更新成员角色 |
| `removeMemberFromLedger` | 移除成员 |
| `checkPermission` | 检查权限 |
| `createInvitation` | 创建邀请 |
| `acceptInvitation` | 接受邀请 |
| `getInvitationDetails` | 获取邀请详情 |
| `revokeInvitation` | 撤销邀请 |
| `generateShareLink` | 生成分享链接 |

### 4.6 exportService.ts - 导出服务

**功能**: 导出账单为Markdown或PDF格式

| 方法名 | 功能 | 说明 |
|--------|------|------|
| `exportToMarkdown` | 导出Markdown | 生成账单明细MD文件 |
| `exportToPDF` | 导出PDF | 使用html2canvas + jsPDF |

---

## 五、Context层详解

### 5.1 AuthContext.tsx - 认证状态管理

**功能**: 管理用户登录状态和认证操作

**状态结构**:
```typescript
interface AuthState {
  user: User | null;      // 当前用户
  loading: boolean;       // 加载中
  error: string | null;   // 错误信息
  initialized: boolean;   // 是否已初始化
}
```

**提供的方法**:

| 方法名 | 功能 |
|--------|------|
| `signUp` | 邮箱注册 |
| `signIn` | 邮箱登录 |
| `signInAnonymously` | 匿名登录 |
| `signOut` | 登出 |
| `resetPassword` | 重置密码 |
| `updateProfile` | 更新用户资料 |
| `refreshUser` | 刷新用户信息 |
| `clearError` | 清除错误 |

**使用方式**:
```typescript
const { user, signIn, signOut } = useAuth();
```

### 5.2 CloudSyncContext.tsx - 云同步状态管理

**功能**: 管理云同步状态、账本列表、同步操作

**状态结构**:
```typescript
interface CloudSyncState {
  isOnline: boolean;           // 是否在线
  syncStatus: SyncStatus;      // 同步状态
  lastSyncAt: Date | null;     // 最后同步时间
  pendingChanges: number;      // 待同步变更数
  error: string | null;        // 错误信息
  isCloudEnabled: boolean;     // 是否启用云同步
  cloudLedgers: CloudLedger[]; // 云账本列表
  isLoadingLedgers: boolean;   // 加载账本中
}
```

**提供的方法**:

| 方法名 | 功能 |
|--------|------|
| `syncNow` | 立即同步 |
| `enableCloud` | 启用云同步 |
| `disableCloud` | 禁用云同步 |
| `loadFromCloud` | 从云端加载 |
| `subscribeToLedgerUpdates` | 订阅账本更新 |
| `markPendingChange` | 标记待同步变更 |
| `refreshCloudLedgers` | 刷新云账本列表 |

**同步流程** (syncNow):
1. 检查云同步是否启用
2. 检查用户是否登录
3. 检查网络状态
4. 检查账本是否存在于云端
   - 存在：更新账本元数据 (仅owner)
   - 不存在：创建账本并添加成员
5. 获取云端账单，与本地对比
6. 上传本地新增账单
7. 下载云端新增账单
8. 处理本地删除 (软删除)
9. 更新同步状态

---

## 六、组件详解

### 6.1 App.tsx - 主应用组件

**职责**: 核心状态管理、路由逻辑、全局UI框架

**状态管理**:
- `ledgerId`: 当前账本ID
- `state`: 当前账本数据 (AppState)
- `showSettings/showExpenseForm`: 控制弹窗显示
- `userRole`: 当前用户在账本中的角色

**核心流程**:

1. **初始化流程** (useEffect):
   - 检查URL参数 (inviteCode, ledgerId)
   - 加载默认账本或显示欢迎向导
   - 订阅云同步更新

2. **账单操作流程**:
   - `handleAddExpense`: 添加账单 → 更新state → 保存本地 → 同步云端
   - `handleDeleteExpense`: 删除账单 → 更新state → 保存本地 → 同步云端

3. **设置保存流程**:
   - `handleSaveSettings`: 保存设置 → 更新state → 保存本地 → 同步云端

### 6.2 ExpenseForm.tsx - 账单表单

**功能**: 添加新账单的表单弹窗

**表单字段**:
- date: 消费日期
- description: 描述
- amount: 金额
- category: 类别 (住宿/交通/餐饮/娱乐/购物/其他)
- payerId: 付款人
- sharedWithFamilyIds: 共享家庭

**默认行为**:
- 默认日期为今天
- 默认付款人为第一个家庭
- 默认共享所有其他家庭

### 6.3 ExpenseList.tsx - 账单列表

**功能**: 显示账单列表，支持删除

**显示信息**:
- 家庭头像 (颜色区分)
- 描述、类别、日期
- 金额 (本地货币 + 基础货币)
- 创建者信息
- 共享家庭标签

### 6.4 Summary.tsx - 结算概览

**功能**: 显示费用统计和结算方案

**核心计算逻辑**:

1. **家庭份额计算**:
   - 遍历每笔账单
   - 根据`sharedWithFamilyIds`确定分摊家庭
   - 按人数比例计算份额

2. **结算方案计算**:
   - 找出债权人和债务人
   - 贪心算法匹配金额
   - 生成转账方案

**显示内容**:
- 总支出卡片
- 各家庭统计卡片 (已付/应付/应收/应付)
- 结算方案列表
- 消费类别饼图

### 6.5 SettingsModal.tsx - 设置弹窗

**功能**: 账本设置、数据管理、导出功能

**设置项**:
- 云同步状态
- 数据备份/恢复
- 导出Markdown/PDF
- 账本名称
- 出发国 (决定结算货币)
- 目的地 (决定本地货币)
- 家庭列表 (2-5个)

### 6.6 WelcomeWizard.tsx - 欢迎向导

**功能**: 新用户引导，创建第一个账本

**步骤**:
1. 语言选择
2. 出发国 + 目的地
3. 账本名称 + 家庭设置
4. 设为默认账本选项

### 6.7 AuthModal.tsx - 认证弹窗

**功能**: 登录/注册弹窗切换

**模式**:
- login: 显示LoginForm
- register: 显示RegisterForm

---

## 七、国际化 (i18n)

### 文件结构

- `translations.ts`: 翻译配置 (中/英)
- `useTranslation.tsx`: 翻译Hook

### 使用方式

```typescript
const { t, language, setLanguage } = useTranslation();

// 使用翻译
<p>{t('settingsTitle')}</p>

// 带参数翻译
<p>{t('addedBy', { name: '张三' })}</p>

// 切换语言
setLanguage('zh');
```

### 辅助函数

| 函数名 | 功能 |
|--------|------|
| `getCategoryTranslation` | 获取类别翻译 |
| `getCountryTranslation` | 获取国家翻译 |
| `getCurrencyLabel` | 获取货币标签 |
| `getCountryDisplayText` | 获取国家显示文本 |

---

## 八、关键业务流程

### 8.1 添加账单流程

```
用户点击添加按钮
    ↓
显示ExpenseForm
    ↓
用户填写表单并提交
    ↓
handleAddExpense (App.tsx)
    ↓
更新state.expenses
    ↓
saveLedger (storageService) → 保存到localStorage
    ↓
syncNow (CloudSyncContext) → 同步到Firestore
    ↓
createExpense (firestoreService) → 写入云端
```

### 8.2 登录流程

```
用户点击登录
    ↓
显示AuthModal
    ↓
用户输入邮箱密码并提交
    ↓
signIn (authService) → Firebase认证
    ↓
AuthContext更新user状态
    ↓
CloudSyncContext检测到用户登录
    ↓
自动订阅用户账本列表
    ↓
加载默认账本数据
```

### 8.3 邀请协作流程

```
账本所有者点击邀请
    ↓
显示InviteModal
    ↓
createInvitation (collaborationService)
    ↓
生成邀请码和链接
    ↓
分享链接给被邀请者
    ↓
被邀请者打开链接 (/join/:code)
    ↓
acceptInvitation (collaborationService)
    ↓
验证邀请有效性
    ↓
添加成员记录到Firestore
    ↓
标记邀请已使用
```

### 8.4 离线同步流程

```
用户离线操作
    ↓
操作失败，捕获错误
    ↓
queueOperation (offlineService) → 加入队列
    ↓
网络恢复 (online事件)
    ↓
processOfflineQueue (firestoreService)
    ↓
遍历队列执行操作
    ↓
成功后移除队列项
```

---

## 九、数据流图

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    State (AppState)                  │   │
│  │  - ledgerName, expenses, families, exchangeRate...  │   │
│  └─────────────────────────────────────────────────────┘   │
│              ↓                              ↑               │
│    ┌─────────────────┐            ┌──────────────────┐     │
│    │  Components     │            │   Services       │     │
│    │  - ExpenseForm  │            │ - storageService │     │
│    │  - ExpenseList  │            │ - firestoreService│    │
│    │  - Summary      │            │ - exportService  │     │
│    │  - SettingsModal│            │ - offlineService │     │
│    └─────────────────┘            └──────────────────┘     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Contexts                                 │
│  ┌─────────────────────┐    ┌──────────────────────────┐   │
│  │   AuthContext       │    │   CloudSyncContext       │   │
│  │   - user            │    │   - syncStatus           │   │
│  │   - signIn/signOut  │    │   - cloudLedgers         │   │
│  └─────────────────────┘    │   - syncNow/loadFromCloud│   │
│                              └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 十、常见问题修复指南

### 10.1 同步问题

**问题**: 账单无法同步到云端

**排查步骤**:
1. 检查 `CloudSyncContext` 的 `isCloudEnabled` 状态
2. 检查用户是否已登录 (`AuthContext.user`)
3. 检查网络状态 (`navigator.onLine`)
4. 检查 Firestore 安全规则是否正确配置
5. 检查成员ID格式: `${ledgerId}_${userId}`

**关键代码位置**:
- `CloudSyncContext.tsx:136` - syncNow方法
- `firestoreService.ts:569` - createExpense方法

### 10.2 权限问题

**问题**: 用户无法编辑/删除账单

**排查步骤**:
1. 检查用户在账本中的角色 (`getLedgerMembers`)
2. 使用 `checkPermission` 验证权限
3. 检查 `PERMISSION_MATRIX` 配置

**关键代码位置**:
- `collaborationService.ts:10-15` - 权限矩阵定义
- `collaborationService.ts:78-84` - checkPermission方法

### 10.3 结算计算问题

**问题**: 结算金额不正确

**排查步骤**:
1. 检查 `sharedWithFamilyIds` 是否正确设置
2. 检查家庭人数 (`Family.count`) 是否正确
3. 检查汇率 (`exchangeRate`) 是否正确

**关键代码位置**:
- `Summary.tsx:25-67` - 家庭份额计算逻辑
- `Summary.tsx:76-104` - 结算方案计算

### 10.4 离线数据丢失

**问题**: 离线操作后数据丢失

**排查步骤**:
1. 检查 localStorage 中的 `travel_finance_offline_queue`
2. 确认 `setupOnlineListener` 是否正确注册
3. 检查 `processOfflineQueue` 执行日志

**关键代码位置**:
- `offlineService.ts` - 离线队列管理
- `firestoreService.ts:858-902` - 离线队列处理

---

## 十一、环境变量配置

创建 `.env.local` 文件:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 十二、Firestore安全规则要点

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 用户只能读写自己的用户资料
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // 账本访问需要通过成员关系验证
    match /ledgers/{ledgerId} {
      allow read: if request.auth != null &&
        exists(/databases/$(database)/documents/members/$(ledgerId)_$(request.auth.uid));
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/members/$(ledgerId)_$(request.auth.uid)).data.role in ['owner', 'admin'];
    }

    // 成员记录ID格式: {ledgerId}_{userId}
    match /members/{memberId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        memberId.matches('.*_.*') &&
        memberId.split('_')[1] == request.auth.uid;
    }
  }
}
```

---

*文档生成时间: 2026-03-05*
*文档版本: 1.0.0*