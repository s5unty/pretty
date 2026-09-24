---
id: BP-2
title: 将 README 改为由 Backlog 自动同步的上游变更首页
status: Done
assignee:
  - '@pi'
created_date: '2026-09-24 03:08'
updated_date: '2026-09-24 03:29'
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
- [x] #4 Backlog 内容更新后按约定机制自动同步 README，无需逐次手动执行生成命令；触发时机、一次性配置及本地/远端边界有文档说明。
- [x] #5 生成过程确定性、幂等，避免更新循环；不会覆盖 Backlog 源数据或无关用户修改，失败可见。
- [x] #6 自动化测试覆盖生成内容、任务链接、状态分类、幂等和实际自动触发；项目测试与类型检查通过。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
已与用户确认方案：
1. 固定上游基线为 pifydev/pretty 的 0.12.0 / 00d5c350b02681b5c91c243ddbf79d15c8184840，保留到该提交上游 README 的链接。
2. 编写确定性的只读 Backlog 导出器，根 README 中使用托管区块展示基线、已完成任务、进行中/计划任务及验收/标签/优先级/依赖等摘要；链接实际任务路径，保留 completed 中已完成记录。
3. 安装项目 post-commit hook。Backlog 1.52 临时索引会过滤 pre-commit 新增文件，故采用提交后生成。用户明确选择只生成、不自动提交 README；不改暂存区、不递归提交、不自动 push。
4. hook 从 HEAD 已提交快照生成，不混入未提交任务；保留 README 托管区块外的手写内容，手工修改托管区块或已有暂存 README 时停止并可见报错。使用可追溯的本地生成状态保护上次生成内容。
5. 一次性安装钩子时检测现有 hooksPath/钩子冲突，不能覆盖用户已有配置；为新克隆提供显式安装命令，并记录自动化边界与故障恢复方式。
6. 用临时 Git 仓库验证真实 post-commit 触发、幂等、仅生成不提交、不污染索引、已有修改保护、completed 和任务链接；运行项目测试与类型检查。
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
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
将根 README 改为个人派生项目变更首页：固定上游 0.12.0 / 00d5c35，按 Backlog 展示已完成、进行中和计划变更，附任务链接与验收摘要。post-commit 从 HEAD 自动生成本地 README，不暂存/提交/推送；保护手写与暂存内容，CI 检查陈旧首页。136 项测试、类型检查通过，真实 Backlog 自动提交链路验证通过，用户已安装钩子。首次提交工作流文件后启用后续自动生成；远端首页仍需正常提交并推送 README。
<!-- SECTION:FINAL_SUMMARY:END -->
