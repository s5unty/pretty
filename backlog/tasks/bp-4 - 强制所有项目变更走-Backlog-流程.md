---
id: BP-4
title: 强制所有项目变更走 Backlog 流程
status: In Progress
assignee:
  - '@pi'
created_date: '2026-10-12 07:40'
updated_date: '2026-10-12 07:40'
labels: []
dependencies: []
type: docs
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
用户明确要求任何项目变更均走 Backlog 流程，避免再次以机械操作为由漏建任务。此要求属于个人工作流，不改变产品行为或上游发布流程。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AGENTS.md 明确所有项目变更必须先关联任务，不豁免机械操作、上游同步或文档修改
- [ ] #2 明确任务执行和验收顺序，纯只读查询无需新建任务，临时 todo 不能替代 Backlog
- [ ] #3 规则修改已提交，README 完成任务摘要与 Backlog 一致
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 在 AGENTS.md 自动托管区块外加入项目强制规则，覆盖通用指南的机械操作豁免。
2. 明确先建任务、记录计划、实施、验证、完成及只读边界。
3. 提交规则后验收任务，同步并提交 README 摘要，验证一致性。
<!-- SECTION:PLAN:END -->
