# Official UI Plugin Alpha：开发提示词与设计基线

> 文档类型：官方 UI 插件开发提示词 / 初版设计基线  
> 工作名称：`capability-bus-official-ui`  
> 项目形态：独立项目、独立 Git 仓库；与 Core 分别开发和发布  
> 稳定插件 ID：`ui.official.web`  
> 初始版本：`0.1.0-alpha.1`  
> 核心接入最低阶段：`capability-bus-core 0.1.0-alpha.3`；具体协议与版本范围在集成时固定  
> 产品成熟度：Alpha  
> 状态：DESIGN ONLY；本文不表示 UI 项目已经创建或实现

## 1. 项目定义

开发 Capability Bus 的第一个官方图形管理界面。该 UI 不是核心内置页面，而是一个符合相同插件协议、必须经过 CLI注册、授权、启用和启动的 Interface Plugin。

裸核心启动后不提供 Web 端口。只有完成以下流程后才出现 UI：

```text
capbus plugin validate <official-ui-package>
capbus plugin register <official-ui-package>
capbus grant create ...
capbus plugin enable ui.official.web
capbus plugin start ui.official.web
```

停止或禁用插件后，UI 服务必须消失，而核心 CLI保持完整可用。

实施顺序见 [Alpha 开发工作流与提取交接](capability-bus-alpha-development-workflow.md)。UI 自身从 `0.1.0-alpha.1` 开始独立编号；可提前进行设计和模拟开发，核心 `alpha.3` 提供完整管理接口，核心 `alpha.4` 完成与 UI 首版的集成验收。核心版本与 UI 版本不能按同名 Alpha 标签直接判断兼容性。

## 2. 版本与发布规则

- Core 与官方 UI必须采用两个独立项目和 Git 仓库，不采用 Core 仓库内的 UI子包或 monorepo。
- UI项目独立维护 `AGENTS.md`、README、依赖锁文件、构建、测试、CI、发布记录和开发工作流。
- UI不依赖 Core 源码检出或内部 Python包。协议 Schema与公开客户端 SDK通过固定版本的契约包消费；契约包由 Core 协议维护方发布，UI不维护另一份权威协议。
- UI可以在 Core尚未就绪时使用 mock server和固定协议 fixtures独立开发；实接验收使用明确固定的 Core版本。
- UI 从 `0.1.0-alpha.1` 开始，不继承旧项目的 `v1.0`。
- UI 与核心拥有独立版本号，通过协议兼容范围关联。
- Alpha 插件包必须固定核心协议主版本和所需管理 capability。
- UI 升级不能直接迁移核心数据库；需要的 Schema 变化由核心协议和 migration 负责。
- 官方身份不意味着自动授信。官方包与第三方包遵循相同注册、摘要校验和授权流程。

## 3. 目标

官方 UI Alpha 必须做到：

1. 展示核心、插件、能力和运行时的真实状态；
2. 通过 Schema 驱动的表单查看和修改插件配置；
3. 创建、查看和撤销 Grant；
4. 注册包、启停插件并查看健康信息；
5. 浏览能力描述并手动发起受授权调用；
6. 查看不含正文和密钥的结构化审计记录；
7. 所有写操作都经过核心授权闸门，而不是由 UI 后端直接落库；
8. UI 被卸载、崩溃或版本不兼容时不影响 CLI和其他插件。

## 4. 非目标

Alpha 不实现：

- Agent 对话产品；
- 工作流画布和业务工作台；
- PDF、知识库、电影院、图书馆等专用页面；
- 插件市场和在线代码下载；
- 公网访问、远程多用户或云同步；
- Electron/Tauri 桌面壳；
- 在 UI 中保存 API Token 明文；
- 绕过 CLI的超级管理员后门；
- 任意插件注入自定义 JavaScript 到官方 UI；
- 用 UI 自己的数据库复制插件注册、授权或配置状态。

未来业务界面可作为独立 Interface Plugin，或在形成安全扩展协议后再加入 UI Extension；不属于本 Alpha。

## 5. 运行拓扑

```text
Browser
  │  loopback HTTP
  ▼
ui.official.web process
  │  versioned RequestEnvelope
  │  Unix Domain Socket + plugin identity
  ▼
Core Local Control Channel
  ▼
Identity / Authorization Gate
  ▼
Registry · Capability Router · Config · Grants · Audit
```

硬边界：

- 浏览器不直接连接核心数据库、插件端口或 MCP Server；
- UI 后端不读取 SQLite 文件；
- UI 后端不导入核心内部包；
- 所有读取和写入都走公开、版本化的管理 capability；
- UI 不能给自己授权，也不能扩大安装时得到的 Scope。

## 6. 插件包

建议插件包包含：

```text
ui.official.web/
  plugin.yaml
  schemas/
    config.json
  server/
    <thin local bridge>
  web/
    <compiled static assets>
  LICENSES/
  checksums.json
  README.md
```

建议前端采用 TypeScript、React 和 Vite，构建为静态资源；本地桥接服务保持轻量，不使用 Electron。若选择其他技术栈，必须证明其资源占用、安全更新和 Apple Silicon 支持不更差。

生产包不得在目标机器上动态执行 `npm install`。依赖必须在构建阶段锁定，并生成许可证与完整性清单。

## 7. Manifest 基线

示意：

```yaml
manifest_version: 0.1.0-alpha.1
id: ui.official.web
version: 0.1.0-alpha.1
kind: interface
runtime:
  type: process
  command: capability-bus-official-ui
  args: [serve, --stdio-control]
provides:
  - capability: ui.session.status
    operation: query
consumes:
  - system.status.read
  - system.plugins.read
  - system.plugins.manage
  - system.capabilities.read
  - system.capabilities.call
  - system.grants.read
  - system.grants.manage
  - system.config.read
  - system.config.manage
  - system.audit.read
permissions:
  network:
    bind:
      - 127.0.0.1
  filesystem:
    - plugin-data://ui.official.web
  workspaces: []
  secrets: []
resources:
  max_concurrency: 4
  memory_soft_limit_mb: 256
config_schema: schemas/config.json
```

实际管理 capability 名称以 Core Alpha 的最终协议为准；UI 不得通过猜测或私有端点实现同等功能。

## 8. 初始授权

安装时按功能分组申请 Scope，所有者可以只授予只读界面：

```text
Viewer
  system.status.read
  system.plugins.read
  system.capabilities.read
  system.grants.read
  system.config.read
  system.audit.read

Operator
  Viewer scopes
  system.plugins.manage
  system.capabilities.call

Owner UI
  Operator scopes
  system.grants.manage
  system.config.manage
```

UI 的 `Owner` 角色只是核心 Grant 的显示名称，不是 UI 自己维护的另一套权威 RBAC。

高风险操作必须展示将要使用的调用主体、能力、资源范围和影响，但最终裁决始终由核心完成。

## 9. 本地访问安全

Alpha 仅允许本机访问：

- 默认绑定 `127.0.0.1`，不得绑定 `0.0.0.0`；
- 启动端口由核心批准，冲突时失败关闭或选择授权范围内的临时端口；
- 首次登录使用 CLI生成的一次性配对码或等价短时凭证；
- 浏览器 Session 使用短时、HttpOnly、SameSite=Strict Cookie；
- 所有写请求启用 CSRF 和 Origin 校验；
- WebSocket/SSE 如启用，必须复用同一身份和授权上下文；
- 不在 Local Storage 保存长期 Token；
- UI 页面、错误和开发工具中不得显示 Secret 正文；
- 反向代理、frp、公网入口和局域网监听均不在 Alpha 支持范围。

CLI 配对凭证只授权浏览器会话，不赋予 UI 插件自身额外 Scope。

## 10. 信息架构

### 10.1 Dashboard

- 核心版本和协议版本；
- Core health；
- 已注册、运行、降级和失败插件数量；
- 最近授权拒绝、运行时失败和配置变更；
- 磁盘预算和后台任务资源状态；
- 明确显示当前为 Alpha。

### 10.2 Plugins

- 插件列表、稳定 ID、版本、来源摘要和 Trust Zone；
- 注册、启用、禁用、启动、停止和移除；
- Manifest、能力、权限、资源、配置 Schema、健康和兼容性；
- 未知插件默认显示 `quarantine`，不能一键全权限启用；
- 升级前后权限差异必须显式展示。

### 10.3 Capabilities

- 按 domain、Provider、读写性、风险和副作用筛选；
- 查看输入/输出 Schema；
- 生成 Schema 驱动的试调用表单；
- 状态变更调用要求显式幂等键或由 UI生成后展示；
- 显示最终 Provider、Grant 和 trace ID；
- 不允许调用当前会话未获 Scope 的能力。

### 10.4 Grants

- 展示 subject、capability、resource scope、Trust Zone、有效期和状态；
- 创建最小范围 Grant；
- 撤销和查看历史；
- 区分“无需逐次审批”与“没有授权”；
- break-glass 只能发起核心规定的本地高权限流程，UI不能自行实现。

### 10.5 Configuration

- 从核心读取插件发布的 JSON Schema；
- 根据 Schema 生成字段、枚举、说明和校验错误；
- Secret 字段只选择或创建 SecretRef，不读取已有值；
- 保存前显示配置 diff；
- 支持历史、回滚和重启要求提示；
- 配置保存后以核心返回的版本号为准。

### 10.6 Runtime

- 状态、PID 引用、启动时间、健康、最近退出原因；
- 并发、超时和资源预算；
- 有界日志只显示经过核心或 Runtime Bridge 脱敏的内容；
- 提供 start、stop、restart，但无终端命令注入入口。

### 10.7 Audit

- 按时间、主体、插件、能力、decision 和 trace 筛选；
- 展示稳定引用，不展示知识正文、Prompt、文件内容或 Secret；
- 可以从一次 UI 操作跳转到对应 Grant、配置版本和调用 trace；
- 导出前再次走核心授权。

## 11. UI 状态边界

UI 插件自己的数据目录只允许保存：

- 浏览器 Session；
- 非权威显示偏好；
- 页面布局、主题和本地缓存；
- 可重建的 Schema/UI 缓存。

以下状态禁止在 UI 数据库中成为权威副本：

- 插件注册与启停；
- Capability ownership；
- Grant 和 Trust Zone；
- 插件配置版本；
- 核心调用、幂等或审计记录；
- Secret 内容。

页面刷新或 UI 重启后必须从核心重新同步权威状态。

## 12. 配置 Schema

UI 自身 Alpha 配置应保持很小：

```yaml
bind_host: 127.0.0.1
port: 0
session_ttl_minutes: 30
theme: system
language: zh-CN
audit_page_size: 50
```

- `bind_host` 在 Alpha 固定为 loopback；即使配置提交其他地址也必须拒绝。
- `port: 0` 表示由运行时选择可用本机端口。
- 配置中不得出现核心数据库路径、永久管理员 Token 或其他插件端点。

## 13. 交互原则

- 页面状态必须区分 `registered`、`enabled`、`running` 和 `healthy`，不能合并成一个开关。
- 危险操作先展示精确对象和影响，再提交；不使用模糊的“确认全部”。
- 核心拒绝时展示稳定错误码、简短说明和 trace ID，不自行改写为成功。
- 长操作显示真实阶段，不伪造百分比。
- 插件离线时显示 degraded/unavailable，不使用旧缓存假装在线。
- 所有能力都可用通用 Schema 表单操作；业务定制页不是首版前提。
- UI不替用户自动扩大权限，也不把 `trusted` 表述为“完全安全”。

## 14. Alpha 开发顺序

```text
UI-01  插件包、Manifest、注册/启停空壳
  ↓
UI-02  Core Local Control Channel 客户端与兼容握手
  ↓
UI-03  本地配对、Session、CSRF/Origin 防护
  ↓
UI-04  Dashboard + Plugin/Capability 只读视图
  ↓
UI-05  Schema 驱动配置与 Grant 管理
  ↓
UI-06  生命周期操作、能力试调用与 Audit
  ↓
UI-07  打包、升级、禁用/移除和恢复 Gate
```

UI-01 可以与 Core 协议设计并行，但 UI-02 之后必须以已冻结的公开协议开发，禁止导入 Core 内部模块赶进度。

## 15. 验收测试

至少覆盖：

### 插件性

- 未注册 UI 时核心无 UI 端口；
- 注册但未启用时无 UI 端口；
- 启用并启动后仅 loopback 可访问；
- 禁用、停止或移除后端口释放；
- UI 崩溃后 CLI和其他插件正常；
- Core/UI 协议不兼容时明确拒绝启动。

### 授权

- 只读 Grant 不能执行启停、配置和授权修改；
- UI 不能给自己增加 Scope；
- 已撤销或过期 Session 立即失效；
- Core deny 必须在 UI显示为失败；
- break-glass 不可由普通 UI Session 触发。

### 配置与密钥

- JSON Schema 表单验证与核心验证一致；
- 并发配置更新使用版本检查，不能静默覆盖；
- Secret 只显示引用和是否已配置；
- 页面、网络响应、日志和前端状态中不存在 Secret 正文；
- 回滚后显示核心返回的实际版本。

### Web 安全

- 非 loopback bind 被拒绝；
- CSRF、错误 Origin、伪造 Session 和重放配对码被拒绝；
- 静态资源设置合理 CSP；
- 用户可见内容按不可信输入转义；
- 不允许任意命令、任意文件路径和任意 URL 注入。

### 一致性与恢复

- Core 重启后 UI重新握手并刷新状态；
- UI 重启后不依赖缓存恢复权威状态；
- Plugin start/stop 过程显示中间状态和最终状态；
- 审计记录能关联 UI 操作、调用主体和 trace；
- 插件升级失败可回退到上一可运行版本。

### 资源

- 空闲时 CPU 接近零；
- 设定并验证内存软预算；
- 前端构建产物和缓存有大小上限；
- 日志有轮转与保留上限；
- 不启动浏览器自动化、LLM或其他重型后台服务。

## 16. Alpha 完成定义

`0.1.0-alpha.1` 完成时，用户应当能够完全通过 CLI安装并启用官方 UI，在浏览器中完成插件查看、最小权限授权、配置和生命周期管理，然后禁用 UI 并继续只使用 CLI。整个过程中：

- UI没有直接数据库权限；
- UI没有默认超级权限；
- UI不包含 AI 或工作流产品逻辑；
- UI所有状态变更均可在核心审计中重建；
- UI包可独立升级和移除；
- 默认无公网暴露、无真实 Secret、无第二套权威状态。

## 17. 交付物

- 独立 UI 插件源码仓库；
- 锁定依赖和许可证清单；
- 可复现静态构建与插件打包；
- `plugin.yaml` 和配置 Schema；
- 本地桥接服务与 Core 协议客户端；
- Dashboard、Plugins、Capabilities、Grants、Configuration、Runtime、Audit 页面；
- 单元、协议、浏览器和安全负向测试；
- 安装、配对、升级、回滚、禁用和卸载说明；
- `0.1.0-alpha.1` 验收证据。

## 18. 给开发 Agent 的最终指令

按照本文实现 `capability-bus-official-ui 0.1.0-alpha.1`。它必须是可注册、可授权、可启停、可移除的 Interface Plugin，而不是 Core 内置页面。先实现协议握手、最小权限和只读管理视图，再开放状态变更。任何 UI 写操作都必须调用 Core 的公开管理 capability；不得读写 Core SQLite、导入 Core 私有模块、保存长期管理员 Token，或为提高开发速度建立第二套插件、授权和配置状态。

为 UI创建独立项目和 Git仓库。先核验 Core发布的协议 Schema与 SDK版本，记录兼容矩阵；Core尚不可用时用 mock server进行独立开发。最终交付可由 Core CLI注册的 UI插件包，在 Core `alpha.3` 或之后完成连接，在 Core `alpha.4` 保存集成验收证据。UI构建和单元测试不得要求将 Core源码复制进 UI仓库。
