# pretty · 我的上游变更记录

这是 [s5unty/pretty](https://github.com/s5unty/pretty)，基于 [pifydev/pretty](https://github.com/pifydev/pretty) 的个人派生项目。首页只展示**我在上游基础上已完成的变更**，不再重复上游产品说明。

Backlog 是本项目的任务与变更记录来源。下面的托管区块由脚本生成，请通过 Backlog CLI 更新任务，不要手工修改区块内部。

<!-- BACKLOG:START -->
## 上游基线

- 上游：[pifydev/pretty](https://github.com/pifydev/pretty)
- 基线版本：**0.12.0**（该提交的 package.json 版本，不假定存在同名 tag）
- 基线提交：[00d5c35](https://github.com/pifydev/pretty/commit/00d5c350b02681b5c91c243ddbf79d15c8184840)
- [上游使用说明（基线版本）](https://github.com/pifydev/pretty/blob/00d5c350b02681b5c91c243ddbf79d15c8184840/README.md)

## 变更概览

- [BP-1](backlog/tasks/bp-1%20-%20%E4%BF%AE%E5%A4%8D-edit-%E5%B7%A5%E5%85%B7%E7%BC%BA%E5%B0%91%E8%89%B2%E5%9D%97%E8%83%8C%E6%99%AF.md) · 修复 edit 工具缺少色块背景 · bug
- [BP-2](backlog/tasks/bp-2%20-%20%E5%B0%86-README-%E6%94%B9%E4%B8%BA%E7%94%B1-Backlog-%E8%87%AA%E5%8A%A8%E5%90%8C%E6%AD%A5%E7%9A%84%E4%B8%8A%E6%B8%B8%E5%8F%98%E6%9B%B4%E9%A6%96%E9%A1%B5.md) · 将 README 改为由 Backlog 自动同步的上游变更首页 · feature

## Backlog 文档与决策

暂无独立文档或决策；实施计划、验收证据和经验总结保留在各任务中。
<!-- BACKLOG:END -->

## 首页如何自动更新

一次性准备（每个克隆执行一次，需要 Node.js ≥ 22.19）：

```sh
npm --prefix backlog/workflow ci --ignore-scripts
node backlog/workflow/install-hooks.ts
```

本项目已启用 Backlog 的 `auto_commit`。任务更新并成功提交后，`post-commit` 会从 **HEAD 已提交的 Backlog 快照**重新生成上面的区块；普通 Git 提交也会触发。无需常驻监听进程，也无需每次手动运行导出命令。

**自动化只修改本地 README，不自动暂存、提交或推送。** 请在后续正常提交中带上 README；推送后 GitHub 首页才会更新。关闭自动提交、仅保存未提交任务、切换分支或禁用钩子不会即时同步。

- 保留区块外的手写说明；不覆盖区块内的未提交手工修改，也不动已暂存的 README。
- 已完成任务清理到 `backlog/completed/` 后仍保留在首页；草稿与删除归档不作为承诺变更展示。
- 上游基线固定在 `backlog/workflow/readme.config.json`；同步上游后显式更新版本和提交，不随本项目 HEAD 漂移。
- 列表不等同于发布或上游合并记录：以 Backlog 的完成状态筛选，详细证据见各任务。

这是个人工作流，不改变产品依赖、CI 或发布流程；相关代码、配置、依赖与专用检查集中在 `backlog/workflow/`。详细规则及恢复命令见 [AGENTS.md](AGENTS.md#backlog--readme-自动同步)。

## 使用与许可

插件安装、设置、主题及工具渲染说明见上面的“上游使用说明（基线版本）”。本派生项目沿用 [MIT 许可](LICENSE)，保留上游署名。
