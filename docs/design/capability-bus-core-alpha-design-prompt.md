# Capability Bus Core Alpha：开发提示词与设计基线

> 文档类型：新项目开发提示词 / 初版设计基线  
> 工作名称：`capability-bus-core`（可在建项时由所有者改名）  
> 初始版本：`0.1.0-alpha.1`  
> 产品成熟度：Alpha  
> 状态：DESIGN ONLY；本文不表示新项目已经创建或实现  
> 来源基线：`personal-ai-control-plane` v1.0 的可验证实现、仓库文档及当前已确认的“一切皆插件”方向

## 1. 如何使用本文

本文同时承担两项用途：

1. 作为从现有项目提取通用技术底座时的架构基线；
2. 作为可直接交给开发 Agent 的约束型实施提示词。

实施者必须先阅读本文全部内容，再创建代码或依赖。遇到本文的硬约束与便利性冲突时，以硬约束为准；遇到尚未决定的产品选择时，不得自行扩张 Alpha 范围。

## 2. 项目定义

开发一个与 AI、Agent、知识库、工作流和具体业务无绑定关系的本地优先插件能力总线。系统初始形态只有 CLI；任何图形界面、Agent、Skill、工作流、审批、知识库、MCP、脚本工具和业务功能都通过插件接入。

核心不是工作流产品，也不是 Agent 框架。它是一个统一管理插件、能力、调用、授权、配置、运行时和审计元数据的技术底座。

一句话定义：

> `capability-bus-core` 是一个 CLI-first、local-first、deny-by-default 的插件能力控制平面。

## 3. 独立版本线

- 新项目从 `0.1.0-alpha.1` 开始，不继承 `personal-ai-control-plane` 的 `v1.0` 版本号。
- 插件清单和调用协议也从 `0.1.0-alpha.1` 建立独立版本线。
- `personal-ai-control-plane` v1.0 是提取来源和回归证据，不是新核心的发行前身。
- Alpha 阶段允许兼容性调整，但每次不兼容调整必须记录 migration note，不允许静默改变字段语义。
- 首个稳定版本是否命名为 `0.1.0` 或 `1.0.0`，在 Alpha 验收后另行决定。

建议递进标签：

```text
0.1.0-alpha.1  契约、CLI、注册表和最小调用闭环
0.1.0-alpha.2  跨进程运行时、生命周期与恢复
0.1.0-alpha.3  授权、配置、SecretRef 和审计闭环
0.1.0-alpha.4  官方 UI 插件与 MCP Runtime 互操作 Gate
```

这些标签是 Alpha 内部 Gate，不授权加入其他产品能力。

阶段工作项与验收以 [Alpha 开发工作流与提取交接](capability-bus-alpha-development-workflow.md) 为准。`alpha.1` 提供最小闭环，`alpha.3` 形成完整初版 CLI 核心和前端接入条件，`alpha.4` 完成官方 UI 与 MCP 插件的实接验收。任何阶段都必须保留最小授权闸门，不能等待 `alpha.3` 才开始检查身份和权限。

Core 与官方 UI采用两个独立项目和 Git仓库，各自拥有版本、依赖、构建、测试和发布记录。Core提供版本化管理协议和可独立消费的契约/SDK包；UI以 Interface Plugin安装，Core不构建或内置 UI源码。

## 4. 设计目标

Alpha 必须证明：

1. 裸核心可以单独启动、验证和管理，不需要 UI、LLM、Agent 或网络。
2. 符合协议的未知第三方插件可以在不修改核心代码的前提下注册、授权、启用和调用。
3. 插件可以同时是能力 Provider、Consumer，或管理界面等 Interface Plugin。
4. 一个插件只能通过版本化协议调用另一个插件，不能导入其代码、读取其数据库或依赖私有 API。
5. 授权执行点不可绕过；审批流程可以缺席或插件化。
6. 配置与授权的权威状态由核心管理，业务配置含义由插件拥有。
7. 禁用或移除任何可选插件后，核心仍可通过 CLI运行。
8. 大正文和文件不在总线上复制，只传递 `ContentRef`。
9. 默认网络关闭、默认最小权限、默认无需任何真实凭据。
10. 在 Apple M4、16 GB 内存、256 GB SSD 环境下可长期运行，并为并行运行多个 Agent 留出资源。

## 5. 明确非目标

下列内容不得进入 Alpha 核心：

- 固定的 Agent 主控逻辑；
- 内置 LLM Provider；
- 内置知识库、向量数据库或长期记忆；
- 内置工作流编辑器或具体 PDF 处理功能；
- 内置 Human Review 流程；
- 内置 Web UI；
- 云端多租户 IAM、Kubernetes 或分布式一致性；
- 插件市场、自动下载未知代码或自动授信；
- 复制现有 RSS、Hermes、SiYuan 等产品插件进入核心；
- 以“万能业务状态表”保存插件自己的业务数据。

## 6. 不可插件化的最小核心

“一切皆插件”不代表执行插件的规则本身也可以被任意插件替换。以下能力构成不可绕过的最小 Reference Monitor：

| 核心能力 | Alpha 职责 |
|---|---|
| Bootstrap / CLI | 初始化、恢复、诊断以及无 UI 管理入口 |
| Manifest Validator | 校验插件身份、版本、运行时、能力、权限与配置 Schema |
| Persistent Registry | 保存插件、版本、能力所有权、启停状态和稳定系统 ID |
| Capability Router | 只通过 Request/Result Envelope 路由调用 |
| Identity / Authorization Gate | 在能力执行和幂等命中之前验证调用主体与 Grant |
| Configuration Registry | 保存配置文档、Schema 版本、变更历史和生效状态 |
| SecretRef Boundary | 只保存密钥引用；密钥正文不进入配置、Envelope、审计或日志 |
| Runtime Supervisor | 启停跨进程插件，维护健康状态、超时和有界资源信息 |
| Invocation Ledger | 保存调用元数据、幂等预留、结果引用和失败分类 |
| Audit Metadata | 记录身份、能力、授权裁决、配置和生命周期变更，不记录正文 |
| Local Control Channel | 为 CLI和受权 Interface Plugin 提供唯一管理协议入口 |

核心不得包含某类业务如何执行的知识。

## 7. 系统插件与普通插件

下列能力可以实现为系统插件，但仍受核心注册表、授权闸门和运行时监管：

- `runtime.mcp`：MCP stdio / Streamable HTTP 客户端桥；
- `runtime.http`、`runtime.docker`、`runtime.desktop`；
- 持久 Task/Event、checkpoint、lease、retry、dead-letter；
- 工作流编排和可视化工作流定义；
- Approval、受信 Agent 审核和 PromotionProof；
- Policy Advice、风险评分和组织策略；
- Secret Store 后端；
- Agent、Skill、Memory、Knowledge、Model 管理；
- Scheduler、通知、日志导出和指标；
- 官方 UI 和第三方 UI；
- PDF、图像、搜索、开发工具和任意个人功能。

系统插件可以获得受限的管理能力，但不能绕过核心闸门、直接改核心数据库或给自己授权。

## 8. 授权模型

### 8.1 核心与插件的分工

- 核心拥有并执行 Identity、Grant、Scope、Resource、Trust Zone、Expiry 和 Revoke。
- 策略插件可以返回建议或附加条件，不能代替最终执行点。
- 审批插件可以签发受核心验证的审批结果，不能直接放行调用。
- 插件不能自我提权，也不能把自身凭据转授给其他插件。

### 8.2 无审批插件时

无审批插件不等于无授权：

1. 所有者在安装或启用时一次性授予能力与资源范围；
2. 授信区内且未超出 Grant 的调用可以直接执行，不要求逐次审核；
3. 未授权调用仍由核心拒绝；
4. 非授信区默认只允许明确授予的低风险能力；
5. 关闭高风险保护只能由本机所有者通过有时限、可审计的 break-glass 操作完成。

### 8.3 Trust Zone

Alpha 至少支持：

```text
quarantine  已注册但不可执行，用于检查未知包
untrusted   进程隔离、最小资源、显式能力和资源授权
trusted     已由所有者授信；授权范围内可免逐次审批
```

Trust Zone 不能覆盖具体 Grant；`trusted` 不是全权限。

## 9. 配置与密钥

核心拥有：

- 谁可以修改配置；
- 插件当前使用哪个配置版本；
- 配置是否通过插件 Schema 校验；
- 配置变更、回滚和生效记录；
- SecretRef 的名称、授权范围和引用关系。

插件拥有：

- 业务字段的含义；
- 默认值和配置 Schema；
- 对自身业务配置的二次校验；
- 自身业务数据。

Secret 的实际值由独立 Secret Store 保存。核心数据库和插件配置中只出现类似：

```text
secretref://github/readonly-token
```

Interface Plugin 只能通过核心配置能力读写配置，不能建立第二套权威配置库。

## 10. 协议基线

### 10.1 Plugin Manifest

Alpha Manifest 至少包含：

```yaml
manifest_version: 0.1.0-alpha.1
id: example.echo
version: 0.1.0-alpha.1
kind: tool
runtime:
  type: process
  command: example-echo
  args: [serve, --stdio]
provides:
  - capability: example.echo
    operation: query
    input_schema: schemas/echo-input.json
    output_schema: schemas/echo-output.json
consumes: []
permissions:
  network: []
  filesystem: []
  workspaces: []
  secrets: []
resources:
  max_concurrency: 1
  timeout_seconds: 30
config_schema: schemas/config.json
```

具体 YAML 字段可以在实现前形成 JSON Schema，但不得删除稳定 ID、版本、能力、运行时、权限和资源声明。

### 10.2 Envelope

至少定义并版本化：

- `RequestEnvelope`
- `ResultEnvelope`
- `EventEnvelope`
- `ContentRef`
- `ErrorEnvelope`
- `CallerIdentityRef`
- `GrantRef`

请求必须包含稳定 `request_id`、`trace_id`、调用主体引用、能力名和协议版本。状态变更请求必须包含幂等键；核心必须在授权之后执行幂等检查，并为并发同键调用建立原子预留。

### 10.3 能力命名

使用：

```text
<domain>.<action>
```

例如：

```text
content.read
pdf.normalize
pdf.merge
agent.run
system.plugins.list
system.config.update
```

不从名称猜测风险、读写性或幂等性，这些属性必须在 Capability Descriptor 中声明。

### 10.4 传输

Alpha 必须支持：

1. 核心 CLI到本地核心的直接调用；
2. 插件独立进程的 stdio RPC；
3. macOS 本地控制通道，优先 Unix Domain Socket；
4. 可由 `runtime.mcp` 插件实现 MCP stdio。

远程 HTTP、OAuth、Docker 和公网入口不是 `alpha.1` 的必要条件。任何 HTTP 服务默认只能绑定 loopback。

## 11. 权威状态所有权

核心 SQLite 只保存控制平面和恢复所需状态：

```text
schema_migrations
plugins
plugin_versions
capabilities
grants
config_documents
runtime_instances
invocations
idempotency_records
audit_records
```

插件业务状态必须保存在插件自己的数据目录或外部后端。核心不打开插件数据库，插件不打开核心数据库。关联使用稳定系统 ID 和 ContentRef，不使用其他插件的内部主键。

持久工作流、Agent Memory、知识正文、PDF 文件和 UI Session 不属于核心业务表。

## 12. 生命周期与包格式

生命周期至少包含：

```text
discovered → registered → disabled
registered/disabled → enabled → starting → healthy
healthy → degraded / failed / stopped
enabled → disabled
registered → removed
```

安装包至少包含 Manifest、Schema、入口点、许可证、校验和及版本信息。Alpha 可以暂不实现签名信任链，但必须保留签名元数据位置，并在安装时记录包摘要。

注册、启用和启动必须分离；未知插件注册后默认处于 `quarantine + disabled`。

## 13. CLI 基线

Alpha 至少提供：

```text
capbus version
capbus init
capbus doctor

capbus plugin validate <package>
capbus plugin register <package>
capbus plugin list
capbus plugin inspect <plugin-id>
capbus plugin enable|disable <plugin-id>
capbus plugin start|stop|status <plugin-id>
capbus plugin remove <plugin-id>

capbus capability list|describe
capbus capability call <capability> --input <json>

capbus grant create|list|inspect|revoke
capbus config schema|get|set|history|rollback
capbus audit list|inspect
```

所有 UI 管理能力都必须能由 CLI完成。UI 损坏或移除时不得阻塞核心管理。

## 14. 从现有 v1.0 提取什么

保留并重新实现的设计资产：

- 版本化 Manifest 和 Envelope；
- 稳定插件 ID、能力 ID 和 ContentRef；
- 插件独立数据目录；
- 能力唯一活动 Provider 的 Alpha 规则；
- 授权先于幂等命中；
- 审计只记录元数据和引用；
- 默认网络关闭和资源预算；
- 幂等、副作用和可恢复性测试思路。

不得原样继承的实现：

- `personal_ai` 包名和 `1.0.0` 版本；
- RSS → Hermes → Review → SiYuan 的固定编排；
- 硬编码受治理 capability 列表；
- 清单外 fail-open；
- 同进程 `importlib` 作为第三方插件默认边界；
- 每次启动重新生成且无法跨进程使用的身份密钥；
- 包含 `plugin_id`、导致替换 Provider 后失效的幂等身份；
- 核心对插件数据库或私有 API 的依赖。

## 15. Alpha 参考闭环

必须提供至少三个独立验收场景：

### 场景 A：裸核心

```text
init → doctor → plugin list → capability list
```

不安装任何插件也能安全完成。

### 场景 B：未知工具插件

```text
register example.echo
→ inspect permissions
→ grant example.echo
→ enable/start
→ capability call example.echo
→ audit inspect
→ disable/remove
```

全过程不修改核心源代码。

### 场景 C：官方 UI

```text
只有 CLI，无监听端口
→ register ui.official.web
→ grant/enable/start
→ loopback UI 可访问
→ stop/disable
→ 监听端口消失，CLI仍可管理
```

MCP 互操作可以在 `alpha.4` 加入第四个 Gate，但其 Runtime 必须是插件或桥接层，不得把具体 MCP Server 写入核心。

## 16. 测试与完成定义

下列项目是 `alpha.1` 至 `alpha.4` 的累计完成条件，不要求全部在 `alpha.1` 实现；各阶段归属见开发工作流。每个阶段不以“可以启动”作为完成标准。累计至少验证：

- Manifest 正反向 Schema 测试；
- 注册表重启持久化和稳定 ID；
- 重复 capability ownership 冲突；
- 插件目录逃逸和非法入口拒绝；
- 未授权、过期、撤销及跨插件 Grant 拒绝；
- 授权检查先于幂等缓存；
- 并发同幂等键只执行一次；
- 插件超时、崩溃和协议污染失败关闭；
- 禁用、替换、移除 Provider 后核心仍可启动；
- 配置 Schema 校验、历史和回滚；
- Secret 不进入配置导出、错误、日志或审计；
- 审计可重建注册、授权、配置和调用链；
- 默认配置无网络、无真实密钥也能运行；
- 重型后台工作默认并发 1；
- 数据、日志、缓存存在配额和清理策略。

## 17. 实施工作规则

1. 创建新项目之前先形成目录结构、ADR、威胁模型和协议 Schema 评审。
2. 新依赖必须说明用途、许可证、维护状态、Apple Silicon 支持和可移除性。
3. 先实现 CLI和协议，再实现官方 UI；二者可以并行设计，但 UI 不得倒逼核心加入产品逻辑。
4. 每个状态变更能力必须明确幂等策略和副作用状态。
5. 所有跨进程输入均按不可信数据处理。
6. 所有外部工具先进入 quarantine，检查工具列表和权限后才能启用。
7. 不允许存在第二套插件注册表、授权库或配置权威状态。
8. 遇到需要新增核心职责时，先证明该职责不能由受治理插件完成。
9. 在 Alpha Gate 通过前，不开发市场、云端控制台、自动 Agent 编排或业务插件集合。

## 18. 交付物

完整初版核心 `0.1.0-alpha.3` 实施完成时应累计交付（`alpha.1` 只要求开发工作流中该阶段的交付物）：

- 独立源码仓库；
- `AGENTS.md`、`README.md`、架构 ADR 和威胁模型；
- Manifest 与 Envelope JSON Schema；
- CLI、SQLite migration 和本地控制通道；
- 最小进程插件 SDK 与 `example.echo`；
- 授权、配置、生命周期、审计和恢复测试；
- 默认离线演示；
- 可复现打包、安装、升级、回滚和卸载说明；
- `alpha.1`、`alpha.2`、`alpha.3` 各阶段验收证据；官方 UI 与 MCP 集成证据在 `alpha.4` 交付。

## 19. 给开发 Agent 的最终指令

按照本文及开发工作流设计一个新的、独立版本线的 Capability Bus Core。先记录来源快照与提取决定，产出架构决策、协议和可执行测试计划，再按 `alpha.1 → alpha.2 → alpha.3 → alpha.4` 推进。保持核心最小、默认拒绝、CLI-first，并确保官方 UI、MCP、Agent、工作流和审批都只能以插件身份接入。不得修改或废弃现有 `personal-ai-control-plane` v1.0；只把其中经过验证的通用设计资产迁移到新项目，并修复已知的 fail-open、身份不持久、同进程边界和权威状态混杂问题。新项目实施权限以新任务的明确请求为准，旧项目自治授权不自动扩展到新项目。
