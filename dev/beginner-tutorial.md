# VS Code Extension + Node 新手教程（本仓库版）

本教程基于当前仓库结构和配置编写，目标是让新手可以快速上手开发、测试、提交和发布。

## 0. 先看当前仓库规则

- 本项目是 VS Code Extension（TypeScript）。
- 核心源码在 `src/`，编译产物在 `out/`。
- `.gitignore` 当前忽略了 `out/`、`node_modules/`、`.vscode-test`、`.DS_Store`、`*.vsix` 等本地产物与环境文件。
- `package-lock.json` 建议纳入版本控制，保证依赖解析更稳定。
- `.vscodeignore` 会在打包 VSIX 时排除 `src/`、`dev/`、`out/test/`、源码映射和其他非运行时文件。

## 1. 当前目录下各目录/文件的作用

### 1.1 根目录主要目录

- `.git/`
    - Git 元数据目录（分支、提交、索引）。
- `.vscode/`
    - VS Code 工作区配置（调试、任务、搜索显示设置）。
- `src/`
    - 扩展源码与测试源码。
- `out/`
    - TypeScript 编译后的 JS（运行测试和调试会读取这里）。
- `images/`
    - 扩展图标等静态资源。
- `node_modules/`
    - npm 安装的依赖目录（本地生成）。
- `dev/`
    - 开发辅助资料（建议纳入版本控制，但不会进入 VSIX 包）。

### 1.2 根目录主要文件

- `package.json`
    - 扩展元信息、命令贡献点、`textReplaceRule.configPath` 的配置 schema、npm scripts、依赖版本。
- `tsconfig.json`
    - TypeScript 编译配置。
- `.vscodeignore`
    - 打包 VSIX 时排除的文件列表。
- `.gitignore`
    - git 忽略规则。
- `README.md`
    - 用户文档与配置说明。
- `CHANGELOG.md`
    - 版本变更记录。
- `LICENSE`
    - 许可证。
- `AGENTS.md`
    - 本地协作规则文件（当前默认不提交，也不会进入 VSIX 包）。

### 1.3 `src/` 下文件说明

- `src/extension.ts`
    - 扩展入口；负责注册命令并转发到执行逻辑。
- `src/editProvider.ts`
    - 核心替换逻辑（外部配置文件加载、rule/rulePipeline、语言过滤、选区与全文件替换）。
- `src/test/runTest.ts`
    - 测试启动器；拉起 VS Code Extension Host 执行测试。
- `src/test/suite/index.ts`
    - 测试收集与 mocha 运行入口。
- `src/test/suite/extension.test.ts`
    - 集成回归测试用例。

### 1.4 `dev/doc/src/` 下文件说明

- `dev/doc/src/editProvider.ts.md`
- `dev/doc/src/extension.ts.md`
- `dev/doc/src/test/runTest.ts.md`
- `dev/doc/src/test/suite/index.ts.md`
- `dev/doc/src/test/suite/extension.test.ts.md`

这些是对 `src/` 对应文件的解释文档，方便阅读源码。

## 2. git commit 需要哪些？发布需要哪些？

### 2.1 commit 前后你要做什么

建议流程：

1. 先确认改动范围
   - `git status --short`
2. 本地编译测试通过
   - `npm run compile`
   - `npm test`
3. 更新文档与变更说明（如果行为/配置变化）
   - `README.md`
   - `CHANGELOG.md`
4. 只提交与本次需求相关的文件
   - 常见会提交：`src/**`、`package.json`、`package-lock.json`、`tsconfig.json`、`README.md`、`CHANGELOG.md`，以及相关 `dev/**` 文档。
5. 统一 commit message（建议带范围）
   - 例如：`feat: add rule pipeline validation`

当前仓库默认应被跟踪的核心文件（节选）：

- `.vscode/launch.json`
- `.vscode/settings.json`
- `.vscode/tasks.json`
- `.vscodeignore`
- `CHANGELOG.md`
- `LICENSE`
- `README.md`
- `dev/**`
- `images/icon.png`
- `package-lock.json`
- `package.json`
- `src/**`
- `tsconfig.json`

注意：`out/`、`node_modules/`、`.vscode-test/`、`*.vsix` 等生成物不应进 commit；`package-lock.json` 在依赖变更时应一并提交。

### 2.2 发布前你要做什么（VS Code 扩展）

建议流程：

1. 更新版本号
   - 在 `package.json` 调整 `version`。
2. 更新发布说明
   - 在 `CHANGELOG.md` 写本次发布内容。
3. 编译与测试
   - `npm run compile`
   - `npm test`
4. 打包 VSIX
   - `npx @vscode/vsce package`
5. 本地安装验证
   - VS Code 扩展面板 -> `Install from VSIX...`
6. 检查打包内容是否干净
   - 由 `.vscodeignore` 控制，不应把 `src/`、`dev/`、`out/test/`、`.git/`、源码映射等开发文件带入包。

## 3. 如何做功能更改、测试

这个仓库可用下面的最小闭环：

1. 明确需求
   - 写清楚输入、输出、边界（空选区、多选区、非法规则、语言过滤）。
2. 更新扩展贡献点（如有需要）
   - 命令：改 `package.json -> contributes.commands`
   - 配置：改 `package.json -> contributes.configuration.properties`
   - 当前用户配置入口应保持单一：`textReplaceRule.configPath`
3. 实现逻辑
   - 入口注册：`src/extension.ts`
   - 核心逻辑：`src/editProvider.ts`
4. 增加测试
   - 在 `src/test/suite/extension.test.ts` 补用例（正常路径 + 边界场景）。
5. 调试验证
   - `npm run watch`
   - VS Code 里运行 `Run Extension`
6. 回归检查
   - `npm run compile`
   - `npm test`

推荐优先覆盖的测试场景：

- 单 rule 对整文档替换
- rule pipeline 顺序执行
- 空选区与多选区行为
- 非法规则/配置错误提示

## 4. 对新手有帮助的建议（VS Code Extension + Node）

### 4.1 工程习惯

- 改动尽量小步提交，便于回滚和审查。
- 不要直接手改 `out/`，它是编译产物。
- 先写失败测试，再补实现，能减少回归风险。

### 4.2 Node 与依赖管理

- 固定 Node 大版本（团队建议统一版本管理工具，如 nvm/volta）。
- 升级依赖后，第一时间跑 `npm run compile` + `npm test`。
- 依赖版本发生变化时，检查并提交 `package-lock.json`。
- 关注 transitive deprecation warning：有些来自上游，不能强行 override 到不兼容版本。

### 4.3 VS Code Extension 开发要点

- 命令 ID 一旦公开，尽量保持兼容。
- 用户可见错误要明确可执行，不要只抛原始异常。
- 配置 schema 要写清类型与默认值，避免用户配置误用。
- 涉及编辑器文本变更时，优先考虑撤销/重做体验。

### 4.4 测试与稳定性

- 集成测试会启动 Extension Host，耗时较长，建议先本地小范围调试再全量 `npm test`。
- 测试中尽量隔离全局配置与编辑器状态，避免用例互相污染。

## 5. 常用命令速查

- 安装依赖：`npm install`
- 增量编译：`npm run watch`
- 一次编译：`npm run compile`
- 跑测试：`npm test`
- 打包 VSIX：`npx @vscode/vsce package`
