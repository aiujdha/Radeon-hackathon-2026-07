# ProjectPack Office Agent：管理员 / 技术负责人工作计划

## 1. 角色定位

你是项目管理员和技术负责人，不承担所有功能编码；你的职责是让项目**可运行、可集成、可验收、可提交**。

你拥有以下最终决策权：

- GitHub `main` 分支、分支保护规则和 PR 合并；
- 云端 AMD GPU 实例、模型服务、密钥与环境变量；
- 产品范围、接口 Schema、项目数据落点和安全边界；
- 演示验收、性能证据和比赛最终 PR。

## 2. 你的交付目标

在队友提交应用功能时，你应始终能回答：

1. 代码是否能从 GitHub fork 复现？
2. 是否能调用云端 `qwen3.6-office-agent`？
3. 资料是否只落在当前项目的受控目录？
4. 每个结论是否能回到来源文件、页码、章节或 Sheet？
5. 失败时是否能定位到文件解析、检索、规则判定、模型调用或报告生成？

## 3. 阶段任务

### 阶段 A：项目基础与契约（优先完成）

- [ ] 保持 `main` 受保护；只合并通过 required checks 的 PR。
- [ ] 维护 GitHub fork：`origin` 为个人仓库，`upstream` 为官方仓库。
- [ ] 建立项目根目录、`.env.example`、`.gitignore`、依赖文件和启动说明。
- [ ] 固定模型调用配置：

  ```text
  LLM_BASE_URL=http://127.0.0.1:8000/v1
  LLM_MODEL=qwen3.6-office-agent
  ```

- [ ] 固定云端数据落点，禁止应用访问项目目录外文件：

  ```text
  /workspace/office-agent/data/projects/<project_id>/source/
  /workspace/office-agent/data/projects/<project_id>/derived/
  /workspace/office-agent/data/vector_db/
  /workspace/office-agent/data/sqlite/
  /workspace/office-agent/outputs/
  /workspace/office-agent/logs/
  ```

- [ ] 提供最小 `LLMClient` 和 `/health` 检查，能调用本地 llama-server。
- [ ] 与队友确认并提交数据契约：`Project`、`Task`、`Evidence`、`TaskEvaluation`、`Report`。

**验收标准**：空项目可启动；API 能返回模型列表/健康状态；无资料、无模型、非法路径都有清楚错误信息。

### 阶段 B：集成与受控编排

- [ ] 负责项目导入后的端到端流程编排，而不是让模型自由执行工具。
- [ ] 固定工作流：扫描 → 解析/索引 → 读任务 → 检索证据 → 规则判断 → 模型解释 → 报告草稿。
- [ ] 设置安全边界：工具白名单、Pydantic 参数校验、项目路径校验、最多 8 步、重复调用检测。
- [ ] 定义确认策略：只有覆盖、修改、删除已有文件或任务数据时阻断并要求确认；证据不足只标记“待确认”。
- [ ] 统一 JSONL 日志字段：`run_id`、步骤、工具、参数摘要、耗时、状态、错误、来源数量。

**验收标准**：一条周报请求的每一步都可查看，失败能定位，报告不会把“证据不足”写成“已完成”。

### 阶段 C：云端验证与比赛材料

- [ ] 用 Git 拉取代码到 PVC 工作区；云端不作为代码唯一来源。
- [ ] 验证 llama-server：`/health`、`/v1/models`、一次中文对话、GPU 显存和 Tokens/s。
- [ ] 维护演示资料集，确保不含真实敏感项目数据。
- [ ] 执行完整冒烟：导入 → 问答带引用 → 任务核验 → 周报/风险表/下周计划。
- [ ] 收集 AMD 适配证据：GPU 型号 gfx1100、ROCm、llama.cpp HIP、模型量化格式、上下文、Prompt/Generation Tokens/s。
- [ ] 组织英文 README、架构图、项目说明、3–5 分钟演示视频和最终比赛 PR。

**验收标准**：在新的云端实例中，按 README 可重建服务并完整演示；项目输出和性能证据可追溯。

## 4. 每日工作节奏

### 开始前（10 分钟）

- 查看 GitHub Issues/PR、当前 `main` 和待集成分支。
- 与队友确认当天唯一可验收目标和输入/输出契约。
- 明确该任务是 `S0`、`S1`、`S2` 还是 `S3`；S1 以上先建立 Spec。

### 集成前（15 分钟）

- 先阅读 PR 的范围、Spec ID、测试证据和风险说明。
- 本地拉取分支并查看 `git diff --stat`，拒绝无关重构或大文件。
- 验证接口/数据模型是否与已约定 Schema 一致。

### 合并前（20–40 分钟）

- required checks 必须通过；检查 PR 标题符合官方格式。
- 运行与改动相符的最小检查，而非盲目全量检查。
- 涉及模型/RAG/报告的 PR，必须至少做一次云端或可复现集成验证。
- 以 Squash merge 合并，并在 PR 中记录结论或后续风险。

## 5. 你不应该做的事

- 不直接在 `main` 写代码或直接 push。
- 不把 GGUF、私钥、`.env`、真实项目资料、向量库或运行日志提交到 Git。
- 不让队友共享你的 SSH 私钥、GitHub Token 或云端账户密码。
- 不在没有来源证据时宣称任务完成。
- 不为赶进度同时更换模型、推理框架和 Agent 框架。

## 6. 你的 PR 模板补充内容

除默认模板外，涉及集成/云端的 PR 必须写：

```md
## Integration evidence

- Model endpoint tested:
- Cloud instance / environment:
- Input fixture:
- Output files:
- GPU / performance evidence:
- Known limitation:
- Rollback:
```

## 7. 与队友的交接清单

队友交付前必须提供：

- PR 链接和 Spec ID（或 `S0/no-spec` 原因）；
- 修改模块、输入/输出 Schema；
- 最小样例资料；
- 运行命令和测试结果；
- 失败场景与当前已知限制；
- 是否需要云端模型、哪些环境变量、是否新增依赖。

你合并后必须反馈：

- 是否已合并；
- 云端验证结论；
- 是否需要修复、补测试或补文档；
- 下一步集成任务。
