---
id: BP-4
title: 强制所有项目变更走 Backlog 流程
status: Done
assignee:
  - '@pi'
created_date: '2026-10-12 07:40'
updated_date: '2026-10-12 07:41'
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
- [x] #1 AGENTS.md 明确所有项目变更必须先关联任务，不豁免机械操作、上游同步或文档修改
- [x] #2 明确任务执行和验收顺序，纯只读查询无需新建任务，临时 todo 不能替代 Backlog
- [x] #3 规则修改已提交，README 完成任务摘要与 Backlog 一致
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 在 AGENTS.md 自动托管区块外加入项目强制规则，覆盖通用指南的机械操作豁免。
2. 明确先建任务、记录计划、实施、验证、完成及只读边界。
3. 提交规则后验收任务，同步并提交 README 摘要，验证一致性。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
已在自动托管区块外增加强制规则，覆盖机械操作豁免，明确所有变更、生命周期、只读边界及补录要求。规则提交为 7fc4bfb。脚本读取已提交 AGENTS.md 逐项断言通过；README generate/check 与 git diff --check 通过，BP-3 摘要已提交。自动生成摘要归属触发任务，不递归建任务。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
AGENTS.md 已规定所有项目变更先走 Backlog，不再豁免机械同步或文档修改。已提交规则并验证关键条款和 README 摘要一致性。
<!-- SECTION:FINAL_SUMMARY:END -->
