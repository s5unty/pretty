---
id: BP-2
title: 将 README 改为由 Backlog 自动同步的上游变更首页
status: In Progress
assignee:
  - '@pi'
created_date: '2026-09-24 03:08'
updated_date: '2026-09-24 05:31'
labels:
  - documentation
  - automation
dependencies: []
references:
  - README.md
  - backlog/config.yml
documentation:
  - docs/readme-workflow.md
modified_files:
  - README.md
  - readme.config.json
  - scripts/readme.ts
  - scripts/install-hooks.ts
  - .githooks/post-commit
  - docs/readme-workflow.md
  - test/readme.test.ts
  - .github/workflows/ci.yml
  - package.json
  - bun.lock
  - tsconfig.json
priority: medium
type: feature
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
本仓库是上游 pifydev/pretty 的个人派生项目。现有 README 仍是上游官方产品说明，无法清楚表达本项目相对上游的实际改动和后续计划。用户希望以 Backlog 为事实来源，将根 README 变为派生项目首页，并在 Backlog 更新后自动同步，不再每次手动整理或执行导出命令。

首页至少展示上游基线版本与提交、已完成变更、计划/进行中的变更；每项变更带可点击的 Backlog 任务编号，并选择性展示验收、优先级、依赖等有价值信息。自动化应说明本地更新与远端首页生效的边界，不能把计划当作已完成改动。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README 清楚标明派生项目身份、上游仓库、可追溯的基线版本/提交，并保留上游使用文档的可访问入口。
- [x] #2 已完成与计划/进行中的变更分区展示，每项包含任务编号及指向仓库内对应 Backlog 任务的有效 Markdown 链接。
- [x] #3 首页展示有价值的任务摘要与进展信息，缺失字段有明确降级，不把未完成任务描述为已交付变更。
- [ ] #4 Backlog 内容更新后按约定机制自动同步 README，无需逐次手动执行生成命令；触发时机、一次性配置及本地/远端边界有文档说明。
- [ ] #5 生成过程确定性、幂等，避免更新循环；不会覆盖 Backlog 源数据或无关用户修改，失败可见。
- [ ] #6 自动化测试覆盖生成内容、任务链接、状态分类、幂等和实际自动触发；项目测试与类型检查通过。
- [ ] #7 个人工作流的脚本、配置、钩子、依赖与专用检查集中到 backlog/workflow；根目录仅保留必要 README 与现有 AGENTS.md 说明，不新增 scripts、docs、.githooks 或工作流配置。
- [ ] #8 恢复产品 .github/workflows/ci.yml、package.json、bun.lock、tsconfig.json，个人工作流不改变产品依赖、CI 或发布行为。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
按用户新要求收敛 BP-2（尚未提交的实现）：
1. 将个人工作流脚本、配置、钩子与专用检查迁入 backlog/workflow，YAML 解析依赖放入独立 private npm 包；不改变产品依赖和构建。
2. 精确撤回本任务对根 package.json、bun.lock、tsconfig.json 与产品 CI 的修改。
3. 使用说明与工作流/产品变更隔离原则写入现有 AGENTS.md，删除独立 readme-workflow.md，更新 README 指向和安装命令。
4. 安全迁移用户已经安装的钩子路径；保留原有修改保护、HEAD 快照与仅生成不提交语义。
5. 分别运行产品测试/类型检查和 backlog/workflow 专用检查，真实 Git/Backlog 链路复验，确认产品配置无差异后完成验收。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
开始调研自动化触发机制与现有上游基线。候选基线来自本地历史：00d5c350b02681b5c91c243ddbf79d15c8184840，package.json 版本 0.12.0；尚需确定自动同步时机与部署方式。

用户确认：随 Backlog 自动提交触发；因 pre-commit 限定路径行为，最终选择 post-commit 只生成 README，不自动追加 README 提交。GitHub 首页需后续正常提交/推送 README 才更新。此边界为明确约定，不要求即时远端同步。

实现与验收证据：
- README 已重写为个人派生项目首页，保留固定基线上游说明入口。readme.config.json 明确 0.12.0 / 00d5c350b02681b5c91c243ddbf79d15c8184840。
- scripts/readme.ts 只读 Backlog YAML/Markdown，支持 tasks/completed、完成/进行/计划/其它状态分类、URL 编码任务链接、完成摘要/需求摘要降级、验收进度/优先级/标签/依赖及文档决策索引。
- .githooks/post-commit 从 HEAD 快照生成，仅更新 README 托管区块，不暂存/提交/推送；保留外部手写内容，拒绝覆盖内部手改或已暂存 README，幂等且没有递归提交。失败写入 Git 私有日志（Backlog 可能吞掉钩子输出）。
- docs/readme-workflow.md 记录首次安装、触发时机、未提交/远端边界、冲突与故障恢复；CI 加入 readme:check。
- 自动化：node --test test/*.test.ts 136/136 通过，其中新增 12 项 README/真实 Git hook 测试，覆盖中文链接、状态分类、completed、幂等、输入错误、实际 post-commit、索引隔离与冲突保护。npm run typecheck、npm run readme:check、git diff --check 通过。
- 真实 Backlog 1.52 冒烟：临时 Git 仓库中通过 CLI 初始化/配置并创建和完成 BP-1；两次 auto_commit 均自动更新 README，提交数只增加两次，其他暂存内容不变。执行记录 /tmp/pretty-readme-backlog-smoke.log（临时日志，非长期项目产物）。
- 环境限制：尝试运行 Bun 测试时 npm 获取 Bun 因网络不可达/离线无缓存失败；使用 Node 原生 node:test 全量测试成功，未声称实际运行 bun test。
- 本仓库 hooks:install 曾因沙箱 .git/config 写入受限失败；用户已在沙箱外安装成功，已读取确认 core.hooksPath=.githooks。首次提交工作流脚本与配置前，hook 按设计跳过尚无 readme.config.json 的 HEAD；本次初始首页由显式生成完成。实现文件尚未替用户提交/推送。

用户要求最小化产品目录污染：这不是产品功能变更，是个人工作流。CI freshness 门禁并非必需，应撤回；根 YAML 依赖与锁文件变更也改为工作流目录内独立依赖。说明合并进已有 AGENTS.md，不保留单独说明文档。重新打开任务并重新验收。
<!-- SECTION:NOTES:END -->
