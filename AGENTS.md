
<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.52.0 -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**At the beginning of each conversation in this project, run `backlog instructions overview` before answering or taking action. Re-read it only if you have not read it yet in the current conversation.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:
- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->

## 个人工作流与产品变更隔离

- 尽量减少相对上游的无谓变更。每次改动明确区分产品功能与个人工作流。
- Backlog/README 自动化是个人工作流：脚本、配置、钩子、依赖及专用检查统一放在 `backlog/workflow/`，不要为此新增根 `scripts/`、`docs/`、`.githooks/`，也不要修改产品的 CI、依赖、锁文件和构建配置。
- 根 `README.md` 是必要的展示出口。本文件集中记录工作流规则，不再维护独立的 readme-workflow.md。产品测试可复用已有 `test/`；工作流专用检查独立执行，不改变上游默认测试/发布流程。

## Backlog → README 自动同步

### 安装与运行

需要 Node.js ≥ 22.19、Git。每个克隆显式安装一次（不使用 npm 生命周期偷偷配置 Git）：

```sh
npm --prefix backlog/workflow ci --ignore-scripts
node backlog/workflow/install-hooks.ts
```

安装器把当前仓库的 `core.hooksPath` 设为 `backlog/workflow/hooks`。已有其他钩子时拒绝覆盖，需人工串接现有 post-commit；旧版 Pretty 的 `.githooks` 安装可安全迁移。若沙箱不允许写 `.git/config`，请用户在沙箱外执行安装器，不绕过权限。

本项目 Backlog 开启 `auto_commit`。成功提交后，post-commit 读取 **HEAD 的已提交快照**，只更新 README 的 `BACKLOG:START/END` 托管区块；区块外的手写内容保留。Backlog 1.52 使用限定路径的临时索引，pre-commit 添加 README 不保证进入提交，所以采用 post-commit。

**仅生成本地 README，不暂存、不提交、不 amend、不 push。** 用户在下一次正常提交中携带 README，推送后 GitHub 首页才更新。未提交任务、关闭 auto_commit、切换分支、禁用钩子时不即时同步；普通 Git 的 `--no-verify` 不跳过 post-commit。首次引入需先提交 `backlog/workflow/` 和带标记的 README，旧 HEAD 缺少工作流配置时钩子跳过。

### 数据与保护规则

- `backlog/workflow/readme.config.json` 固定上游仓库、基线版本/完整提交 SHA、Backlog 目录及完成状态。同步上游后显式更新，不能自动用个人分支 HEAD 替代基线。版本取基线 package.json，不假定有对应 tag。
- 仅从 `tasks/`、`completed/` 筛选已完成任务，在“变更概览”中展示无序列表：编号（任务链接）、任务名、任务类型；类型缺失时显示“未分类”。任务链接使用编码后的仓库相对 Markdown 路径，不是文件系统软链接。
- 不展示进行中、计划、其它未完成任务及其统计；不生成“已完成的变更”“正在进行”“准备做的变更”独立章节。摘要、验收、优先级、依赖与实施细节留在任务页。
- README 是任务记录摘要，不替代 Git diff 审计，也不代表发布或上游合并。独立 Backlog 文档/决策提供索引。
- 不写 Backlog 源数据。生成器不调用 Backlog CLI，不引入远程 fetch 或递归提交；输入相同输出不变，不写入当前时间。
- 已暂存 README 且需更新时拒绝覆盖。托管区块若既不是已提交内容，也不是上次成功生成内容，视为未提交手改并拒绝覆盖。Git 私有目录中的 `pretty-readme-state.json` 记录上次生成摘要。
- 失败不回滚已完成提交。Backlog 可能吞掉钩子报错，诊断保存在 `git rev-parse --git-path pretty-readme-hook.log` 指向的位置。

### 检查与恢复

```sh
# 从工作树生成（包括未提交任务），用于预览或恢复
npm --prefix backlog/workflow run generate
# 只检查是否陈旧，不写文件
npm --prefix backlog/workflow run check
# 明确允许替换托管区块内手改；仍保护已暂存的 README
npm --prefix backlog/workflow run accept
# 重放自动钩子的 HEAD 快照生成
node backlog/workflow/readme.ts --hook
# 个人工作流专用检查，不注入产品 CI
npm --prefix backlog/workflow test
npm --prefix backlog/workflow run typecheck
```

工作流类型检查复用产品已有的 TypeScript/@types/node（先按上游方式安装产品开发依赖），不另改产品配置。运行时 YAML 解析依赖与锁文件独立保存在 `backlog/workflow/`；该目录是 private npm 包，不用于发布。专用检查名为 `readme.check.ts`，避免被产品默认测试发现。需要检查文档时显式运行 `check`，不强制修改上游 CI。

修改 Backlog 内容须使用 CLI；修改此处的工作流代码/配置不是修改任务数据，可正常编辑。不要把临时日志、node_modules 或个人环境配置提交到仓库。
