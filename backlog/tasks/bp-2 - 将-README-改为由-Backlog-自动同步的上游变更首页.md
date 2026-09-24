---
id: BP-2
title: 将 README 改为由 Backlog 自动同步的上游变更首页
status: In Progress
assignee:
  - '@pi'
created_date: '2026-09-24 03:08'
updated_date: '2026-09-24 06:04'
labels:
  - documentation
  - automation
dependencies: []
references:
  - README.md
  - backlog/config.yml
documentation:
  - AGENTS.md
modified_files:
  - README.md
  - AGENTS.md
  - backlog/workflow/readme.ts
  - backlog/workflow/install-hooks.ts
  - backlog/workflow/readme.config.json
  - backlog/workflow/hooks/post-commit
  - backlog/workflow/readme.check.ts
  - backlog/workflow/package.json
  - backlog/workflow/package-lock.json
  - backlog/workflow/tsconfig.json
priority: medium
type: feature
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
本仓库是上游 pifydev/pretty 的个人派生项目。根 README 应展示个人相对上游已完成的变更，由 Backlog 作为记录来源自动同步，避免每次手工整理。

最新展示约定：保留可追溯的上游基线；仅在“变更概览”中，以无序列表展示已完成任务的编号（链接）、任务名、任务类型。不展示进行中/计划任务，不保留“已完成的变更”“正在进行”“准备做的变更”独立章节。详细计划、验收证据和实施过程留在任务页。

个人工作流集中于 backlog/workflow，说明放入 AGENTS.md，不改产品依赖、CI、构建和发布；自动化仍为提交后仅生成本地 README，不自动提交/推送。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 README 标明派生项目身份、上游仓库及基线版本/提交，保留上游使用说明入口。
- [ ] #2 变更概览仅用无序列表展示已完成任务，每项只有任务编号（有效链接）、任务名和任务类型；类型缺失时使用未分类。
- [ ] #3 不展示进行中/计划/其它未完成任务及其统计，不再生成已完成的变更、正在进行、准备做的变更独立章节；任务详情保留在任务页。
- [ ] #4 Backlog 成功提交后按约定机制自动生成 README，触发时机、一次性配置、本地/远端边界有说明。
- [ ] #5 生成确定性、幂等，不产生提交循环，不覆盖 Backlog 或无关用户修改，失败可诊断。
- [ ] #6 测试覆盖已完成列表、链接、类型降级、未完成任务排除、幂等及实际自动触发，检查与类型检查通过。
- [ ] #7 个人工作流脚本、配置、钩子、依赖与专用检查集中在 backlog/workflow，说明合并现有 AGENTS.md。
- [ ] #8 产品 CI、package.json、bun.lock、tsconfig.json 无工作流改动。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
本轮调整（保留已完成的工作流隔离与安装）：
1. 将生成器改为仅筛选完成状态，在变更概览生成编号链接/任务名/类型的无序列表；移除卡片摘要、计划分区与相关无用解析。
2. 同步 README 简介、AGENTS 展示规则和完成状态配置。
3. 更新回归检查，覆盖类型缺失、非完成状态排除、移入 completed 后链接、自动触发和修改保护。
4. 运行独立工作流测试/类型检查，确认产品配置无差异；完成 BP-2 并重新生成 README。
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

目录与改动收敛完成：
- 个人工作流全量移至 backlog/workflow：readme.ts、install-hooks.ts、readme.config.json、hooks/post-commit、readme.check.ts，以及独立 private 包/package-lock/tsconfig。工作流依赖 YAML 不再进入产品 package.json 或 bun.lock。专用检查命名为 .check.ts，不进入产品默认测试发现。
- 原根 scripts/、docs/、.githooks/、readme.config.json 与新增 test/readme.test.ts 已撤去。操作说明及隔离原则合并进现有 AGENTS.md。
- git diff --exit-code 对 .github/workflows/ci.yml、package.json、bun.lock、tsconfig.json 确认全无差异；根产品配置没有本任务残留改动。必要的工作流出口仅 README 与 AGENTS；其余全在 backlog/workflow。
- 工作流 15 项独立检查通过（新增旧钩子迁移与拒绝覆盖第三方钩子检查）；工作流类型检查通过。产品原有 124 项 Node 测试及类型检查通过。新路径的真实 Backlog 1.52 创建/完成任务 auto_commit 冒烟通过，无额外提交，其他暂存内容不变；生成/陈旧检查及 git diff --check 通过。
- 网络不可达导致独立包在线安装失败；本地验证复用此前已安装的相同 yaml@2.9.1 内容，依赖范围不变，隔离 package-lock 已通过 npm --package-lock-only --offline 校验。新克隆正常使用 npm --prefix backlog/workflow ci --ignore-scripts。
- 当前仍待用户将本地 core.hooksPath 从旧 .githooks 迁移为 backlog/workflow/hooks：在沙箱外执行 node backlog/workflow/install-hooks.ts。已告知，尚未确认，因此 AC #4 和任务状态继续保持未完成/进行中。

用户已在沙箱外执行新版安装器；本次读取确认 core.hooksPath=backlog/workflow/hooks，post-commit 文件具有执行权限。旧路径迁移阻塞已解除。先前 124 项产品测试、15 项工作流检查及真实 Backlog 自动提交冒烟证据仍有效；产品 CI/依赖/锁文件/构建配置再次确认无差异。工作流实现仍待首次正常提交；提交前缺少该配置的 HEAD 按设计跳过自动生成，本次初始 README 显式同步任务完成状态。

用户进一步精简首页：只在变更概览展示已完成任务的无序列表（编号链接、任务名、类型），删除三处分区；本轮同时修改生成器，避免未来同步恢复旧布局。
<!-- SECTION:NOTES:END -->
