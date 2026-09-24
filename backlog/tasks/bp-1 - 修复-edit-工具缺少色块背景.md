---
id: BP-1
title: 修复 edit 工具缺少色块背景
status: Done
assignee:
  - '@pi'
created_date: '2026-09-24 02:53'
updated_date: '2026-09-24 02:54'
labels:
  - rendering
  - tui
dependencies: []
references:
  - extensions/pretty.ts
  - test/wire.test.ts
modified_files:
  - extensions/pretty.ts
  - test/wire.test.ts
priority: medium
type: bug
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
本项目 Backlog 首个任务，追溯补录本会话中已完成的修复，而非新开未实现需求。

现象：用户截图中 write 调用及结果有正常色块背景，edit 只有文字与增删统计，没有同样的背景。

复现：启用 Pretty，在同一会话中先 write 创建文本文件，再 edit 修改内容，对比折叠工具块。

根因：Pi 内置 edit 定义携带 renderShell: "self"。Pretty 展开复制原定义并替换 renderCall/renderResult，却未覆盖 renderShell；新的 Text 渲染器不负责背景，而 self 又绕过 Pi 的默认背景 Box。write 使用默认外框，因此没有此问题。

影响：工具视觉不一致，不影响实际文件写入或编辑。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pretty 启用时，edit 明确使用 default 渲染外框，与 write 一致，由 Pi 负责状态背景。
- [x] #2 关闭 Pretty 的 edit 渲染时恢复原生 self 外框和原生渲染器，重新开启后恢复 default 外框。
- [x] #3 开关渲染不改变 edit 的 execute、parameters、prepareArguments、promptSnippet 和 promptGuidelines。
- [x] #4 新增背景外框与开关回归测试通过，全量测试及 TypeScript 类型检查通过。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
追溯记录（实现已在本会话前序完成）：
1. 对照 Pretty 注册逻辑与 Pi ToolExecutionComponent，定位继承的 self 外框。
2. 仅在 renderersFor("edit") 返回值中增加 renderShell: "default"，避免改变原定义与关闭状态。
3. 在 test/wire.test.ts 验证外框一致性、关闭/开启恢复和执行元数据不变。
4. 复跑全量测试、类型检查及 diff 检查，记录证据后标记 Done，任务保留在看板。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
本任务为事后补录。实现文件 extensions/pretty.ts；回归测试 test/wire.test.ts。之前已通过 124 项测试和类型检查；补录时再次验证。未声称完成真实终端截图复验或发布。

补录验收结果：
- AC #1：wire 测试 edit uses the default colored shell like write 通过，运行真实扩展注册流程验证 edit/default 与 write 默认外框一致。
- AC #2、#3：wire 测试 edit shell override follows pretty toggles without changing execution 通过，执行 off/on 命令验证外框与渲染器恢复，并检查执行与提示元数据引用未变。
- AC #4：node --test test/*.test.ts：124/124 通过；npm run typecheck 通过；git diff --check 通过。当前环境未提供 bun，使用 Node 原生测试运行器执行现有 node:test 测试。
- 验证范围：渲染配置与生命周期自动化测试；未进行真实终端截图复验，未发布。
- Backlog 查询及创建时尝试刷新 origin 失败（远程连接/沙箱权限），本地查询、任务创建与更新成功；未更改项目远程配置。

经验：覆盖内置工具渲染器时，应同时核对 renderShell 等外框契约；保留执行与模型提示元数据，并验证 opt-out 恢复。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Pretty 的 edit 显式使用 default 外框，修复继承 self 导致默认背景缺失；关闭 Pretty 仍恢复原生外框，工具执行不变。新增两项生命周期回归测试，全量 124 项测试、类型检查和 diff 检查均通过。本任务是首个 Backlog 追溯记录，未包含发布或真实终端截图复验。
<!-- SECTION:FINAL_SUMMARY:END -->
