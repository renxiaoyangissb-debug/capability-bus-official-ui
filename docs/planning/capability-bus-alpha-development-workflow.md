# Capability Bus Alpha 开发工作流与提取交接

> 状态：PLANNED；本文固化开发顺序，不表示新项目已创建或代码已迁移。  
> 新核心初始版本：`0.1.0-alpha.1`。官方 UI 独立从 `0.1.0-alpha.1` 编号。  
> 核心完整节点：`0.1.0-alpha.3`。平台集成节点：`0.1.0-alpha.4`。

## 1. 事实源与使用方式

实施时先阅读本文件、[核心设计](capability-bus-core-alpha-design-prompt.md) 和 [官方 UI 设计](official-ui-plugin-alpha-design-prompt.md)。本文件明确阶段范围，核心设计定义架构边界，UI 设计定义界面插件行为。更改边界必须记录 ADR，不能以阶段拆分为理由跳过授权或状态所有权约束。

旧仓库参考路径：

```text
/Users/butterburger/Documents/WorkPlace/Codes/personal-ai-control-plane
```

当前交接参考提交为 `7f82511`（tag `v1.0`）。实际提取时必须重新记录完整 Git SHA、分支、工作区修改和所选文件摘要。当前新增设计及部分文档尚未提交，不能声称它们包含于 `v1.0` 标签。

旧项目历史测试记录不代替新项目测试。旧项目的自治开发授权也不自动授权新项目创建、发布或访问真实服务。

## 2. 总体顺序

```text
P0 来源快照与复用决定
 → P1 协议、目录、ADR、威胁模型
 → alpha.1 最小 CLI 调用闭环
 → alpha.2 独立进程与生命周期恢复
 → alpha.3 完整 CLI 核心与前端接口
 → alpha.4 官方 UI 与 MCP 插件实接
```

UI 可在 P1 后设计页面和模拟客户端，不能依赖未发布的核心内部接口。所有版本均为 Alpha，不表示生产成熟度或 Beta 承诺。

Core与官方 UI确定为两个独立项目和 Git仓库。Core任务负责协议、SDK、核心与插件宿主；UI任务负责界面、本地桥接服务和 UI插件包。两边分别保存实施计划和验收证据；集成通过固定协议版本及 Core/UI兼容矩阵协调。

## 3. 每阶段统一工作流

1. 核对 HEAD、工作区、阶段状态及上一阶段验收证据。
2. 明确本次交付、协议变化、数据迁移和风险边界。
3. 对新依赖或插件执行复用调研，记录许可、维护、安全、Apple Silicon 支持、资源测量与决定；固定上游版本。
4. 实现最小纵向场景，再补必要的失败、拒绝、并发和恢复行为。
5. 使用新项目本地验证环境运行该阶段验证，记录实际命令和结果。
6. 更新阶段检查点、接口文档及迁移说明，保留可回退的变更。
7. Gate 通过后推进下一阶段；正式发布标签按该任务的发布授权执行。

硬阻塞包括：无法确定授权主体或权威状态所有者、发现调用绕过授权、幂等可能重复高风险副作用、必须读取用户真实密钥或覆盖现有业务数据才能推进。停止依赖该条件的工作并报告具体证据；不扩大授权范围。

## 4. P0：来源快照与提取

交付 `docs/migration/source-snapshot.md` 与 `docs/migration/reuse-decisions.md`：

- 来源路径、完整提交 SHA、时间、分支、dirty 状态；
- 所选源码、测试、契约、设计文档及 SHA-256；
- 每项复用属于直接复制、适配、重写、仅参考或排除；
- 来源许可证和 notice；没有确认许可证的代码不得作为可公开分发资产；
- 现有已验证行为、已知失败及新项目验证要求；
- 复制后新路径、修改说明及上游来源。

源码默认来自固定提交。确需采用用户未提交的文件时单独列出路径和摘要，不把整个工作区打包。运行数据库、`.venv`、`data/`、凭据、缓存、构建产物和用户内容不属于提取资产。

本文件提供初步清单；完成逐函数与依赖核验后才能确定实际复制范围。

| 来源 | 可复用内容 | 建议处理 | 目标 |
|---|---|---|---|
| `contracts/v1/`、`contracts.py` | Envelope、ContentRef、错误字段、兼容规则 | 适配为新协议，生成完整 Schema | `contracts/`、SDK |
| `manifest.py` | 清单解析与验证 | 适配 Provider/Consumer、进程运行时、风险描述 | Manifest Validator |
| `registry.py` | 唯一活动 Provider、入口路径检查 | 保留规则，重写持久注册与生命周期 | Registry |
| `plugin.py` | 插件接口和独立数据目录 | 适配为进程插件 SDK，不强制继承 Core 类 | SDK |
| `router.py` | Envelope 路由、授权先于缓存、错误转换 | 重写调用链，移除业务能力特判及 fail-open | Router |
| `governance.py` | Scope、有效期、签名校验与拒绝码 | 重写身份持久化、Grant和跨进程验证 | Authorization |
| `governor.py` | 并发与磁盘准入 | 适配配额与压力行为，实测资源 | Resource Admission |
| `state.py` | SQLite WAL、事务、审计和调用存储思路 | 按控制平面职责重写；不整表复制 | Core Store |
| `events.py`、`executor.py` | outbox、receipt、lease、重试、恢复 | 留作可选执行插件候选 | Durable Execution Plugin |
| `reference_flow.py`、CLI demo | 原闭环验收思路 | 留作后续参考 Recipe，排除核心 | Reference Integration |
| `tests/test_governance.py` | 越权、证据、授权与幂等负向测试 | 保留测试意图，替换旧业务绑定 | Security Tests |
| `tests/test_event_dispatcher.py`、`test_task_executor.py` | 重复、崩溃、租约、恢复场景 | 作为执行插件测试候选 | Plugin Tests |
| `tests/test_system.py` | Provider 隔离、闭环和恢复 | 拆成新核心独立测试，不绑定五个旧插件 | Acceptance Tests |
| `AGENTS.md`、资源预算及复用政策 | 小核心、SQLite、本地资源、安全与调研约束 | 适配新项目；验证命令按新代码确定 | 开发规则 |

必须修复或排除的旧行为：硬编码治理清单、清单外放行、第三方同进程加载、易失身份签名密钥、以 Provider ID决定幂等身份、固定个人 AI 编排。继续保持“不访问其他插件数据库或私有 API”的边界。

## 5. P1：设计冻结

交付：目录结构、状态所有权 ADR、调用与失败语义 ADR、身份与授权 ADR、Runtime 隔离 ADR、Manifest/Envelope/Grant/配置 Schema，以及阶段测试矩阵。

明确区别：进程隔离能隔离崩溃，不自动限制文件和网络。没有 OS 强制边界时，不得宣称任意恶意插件已被沙箱保护；未知包可注册到 quarantine，但执行资格须按实际隔离能力限制。

管理能力必须从设计时与业务能力使用同一授权入口，CLI 也不能直接修改数据库绕过它。持久 Task/Event、工作流、Agent和业务数据各有独立所有权。

## 6. `0.1.0-alpha.1`：最小闭环

实现：

- 新包名、版本和 CLI；init/version/doctor；
- SQLite migrations、持久 Registry、稳定 ID；
- Manifest与 Capability Schema 校验、所有权冲突拒绝；
- 最小本机主体和显式 Grant，所有调用均检查身份与 Scope；
- 最小配置 Schema 校验与调用审计；
- 原子幂等预留，逻辑操作身份不依赖 Provider ID；
- 一个受控 Echo 进程示例与最小 RPC；禁用时不可调用。

Gate：空插件核心启动；注册、检查、授予、调用、禁用和移除 Echo；重启后注册与稳定 ID保留；未授权调用被拒绝；并发同键不会重复执行；授权拒绝和调用结果可审计。

此阶段有受控进程示例，完整 Supervisor和恢复能力在 `alpha.2` 完成。不得对高风险外部副作用自动重试。

## 7. `0.1.0-alpha.2`：运行时与恢复

实现：完整 stdio RPC、协议污染处理、超时与取消、健康和退出原因、生命周期持久化、进程与子进程清理、本地控制通道、资源准入、日志配额、安装包摘要与版本兼容检查。

Gate：插件崩溃不终止 Core；重启不误认旧 PID；未完成调用恢复为明确状态；未知副作用不盲目重放；禁用停止插件；非法路径和污染输出被拒绝；移除所有插件后 CLI仍可运行。

## 8. `0.1.0-alpha.3`：完整初版核心

实现：持久安装身份与凭证轮换、Grant撤销/过期/资源范围、Trust Zone、配置版本/并发检查/历史/回滚、SecretRef与最小受控密钥注入边界、审计脱敏和保留、幂等请求指纹冲突校验、Provider替换语义、完整公开管理能力和协议客户端。

Gate：身份与注册状态可跨重启恢复；越权、撤销、过期、跨 Workspace和 Secret访问失败关闭；配置不会并发覆盖；相同逻辑操作更换 Provider不重复执行；Secret不进入导出或审计；公开协议能完成全部 CLI管理。

本阶段交付完整初版 CLI 核心，并冻结 UI所需管理协议。完整指核心设计中十一项基础职责达到 Alpha验收，不要求 Agent、工作流、知识库或其他平台插件已实现。

## 9. `0.1.0-alpha.4`：平台集成

实现官方 UI插件和 `runtime.mcp` 插件；UI独立版本从 `0.1.0-alpha.1` 开始。MCP采用固定版本官方 SDK，按所选协议版本处理发现与调用，不把某个握手流程当成永不变化的协议事实。

Gate：

- 无 UI时没有 Web监听；注册但未启用也不监听；
- CLI注册、授权、启用 UI后只在 loopback可访问；
- UI只调用公开管理能力，Viewer无法执行写操作；
- 配对、Session、Origin/CSRF、失效会话拒绝验证通过；
- UI停止或移除后端口释放，CLI与其他插件保持可用；
- MCP发现生成候选能力，经核心批准才进入注册表；
- MCP工具调用受同一 Grant、配置、幂等和审计约束；
- 禁用或替换 UI/MCP Provider后裸核心正常运行。

此阶段代表初版 Alpha平台可用，不承诺 n8n、Node-RED、Temporal、Dify等全部接入。它们是后续按需实施的可选插件。

## 10. 在当前对话提取还是新项目提取

建议当前仓库固化设计和初步清单，在新项目任务执行实际提取与改造。这样复制后的源文件、依赖、测试、迁移和提交都落在新项目自己的版本历史中。

同一台 Mac上，只要新任务能够读取旧仓库，就可以直接按固定提交读取源码，不需要旧对话记忆。若新任务运行在云端或其他机器，应提供含选定源码、契约、测试、许可证与 source-snapshot的提取包；单独上传设计 Markdown不等于提供源代码。

如果先准备提取包，必须在许可和依赖检查后生成带文件摘要的独立 snapshot，不修改旧项目，不携带运行数据。该包只是来源资产，不能宣称为可运行新核心。

## 11. 新项目起始提示词

以下内容可复制到新项目任务，并附上三份设计文档：

```text
开始实现 capability-bus-core，新项目从 0.1.0-alpha.1 起步。
阅读核心设计、官方 UI设计和 Alpha开发工作流，以其作为新项目设计基线。
旧仓库位于 /Users/butterburger/Documents/WorkPlace/Codes/personal-ai-control-plane。
先核验其 AGENTS.md、README、Git HEAD、工作区状态、许可证及相关源码测试。
记录完整来源 SHA与所选文件摘要；基于固定提交提取通用资产，用户未提交文档单独列明。
按 P0/P1完成来源与复用决定、架构 ADR、协议 Schema和测试计划，然后实施 alpha.1。
依次推进 alpha.2、alpha.3、alpha.4，每阶段保存验收证据。
alpha.3形成完整 CLI核心，alpha.4接入独立版本的官方 UI与 MCP Runtime插件。
保留旧项目及其用户修改；仅将经审查的通用内容迁移到新项目。
核心统一注册、授权、配置、运行管理、能力路由、幂等与审计。
工作流、Agent、Skill、知识库、审批、外部平台与前端均通过插件接入。
不访问真实业务服务、不迁移运行数据库、不发布正式标签，除非另有明确授权。
遇到工作流规定的硬阻塞，报告证据和所需条件。
```

新任务创建时分别确定 Core与 UI的目标目录，并分别建立独立 Git仓库。UI必须独立版本、独立打包并通过公开协议接入，不采用 Core仓库内 UI子包或 monorepo。

## 12. 独立 UI项目起始提示词

```text
开始实现独立项目 capability-bus-official-ui，版本从 0.1.0-alpha.1起步。
阅读官方 UI设计、核心设计和 Alpha开发工作流。
为 UI维护独立 Git仓库、AGENTS.md、README、依赖锁、测试和发布记录。
先核验 Core公开管理协议、Schema与客户端 SDK，固定版本并记录兼容矩阵。
按 UI-01至 UI-07推进；Core未就绪时用 mock server与固定 fixtures开发。
构建可由 capbus CLI注册、授权、启用和启动的 ui.official.web插件包。
所有管理操作使用 Core公开 capability，不读取 Core数据库或导入其内部模块。
Core alpha.3提供完整接入条件，Core alpha.4完成与 UI首版的集成验收。
保留 Core和旧项目的已有修改，UI构建与单元测试不依赖 Core源码复制。
```
