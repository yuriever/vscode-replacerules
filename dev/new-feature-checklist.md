# 新增功能开发清单

## 需求定义

- 明确用户问题、使用场景和预期行为。
- 确认命令名、参数和兜底行为。
- 列出不做范围，避免需求膨胀。

## 扩展入口与配置变更

- 新增命令时，更新 `package.json` 中的 `contributes.commands`。
- 新增设置项时，更新 `contributes.configuration.properties` 的配置 schema。
- 避免为同一份用户数据同时维护多套配置入口；优先保持单一配置源。

## 实现

- 在 `src/extension.ts` 注册新的命令处理函数。
- 核心逻辑尽量放在 `src/editProvider.ts`，或在 `src/` 下拆分独立模块。
- 校验编辑器状态：活动编辑器、选区、语言和命令参数。
- 用户可见的错误和成功提示要清晰可执行。
- 保持现有 rule/ruleset 行为兼容，避免破坏旧配置。

## 编译与调试

- 运行 `npm run watch` 进行增量 TypeScript 编译。
- 在“运行和调试”面板中，选择 `launch.json` 里的 `Run Extension` 并启动。
- 在 Extension Development Host 窗口中验证功能。
- 逻辑改动后可先在宿主窗口执行 `Developer: Reload Window`。
- 如果改动了 commands/keybindings/configuration 等贡献点，建议停止后重新启动调试会话。

## 测试

- 在 `src/test/suite/` 下新增或更新测试。
- 建议覆盖：正常路径、非法规则输入、空选区、无活动编辑器、配置边界场景。
- 运行 `npm test`。

## 文档与变更说明

- 如果使用方式或交互变更，更新 `README.md` 示例和快捷键说明。
- 在 `CHANGELOG.md` 新增变更记录。
- 如果配置格式或默认行为变化，补充迁移说明。
- 如果开发流程、打包规则或仓库约定变化，更新 `dev/` 下文档。

## 打包前检查

- 运行 `npm run compile`。
- 确认 TypeScript 无报错，且编译产物输出到 `out/`。
- 确认 `.vscodeignore` 没有把运行时文件排掉，也没有把 `src/`、`dev/`、`out/test/`、源码映射等非运行时文件带进包。
- 可选：打一个 VSIX 包做最终本地验证。

## 提交前检查

- 确认没有误提交 `out/`、`node_modules/`、`.vscode-test/`、`*.vsix` 等生成物。
- 如果依赖发生变化，确认 `package-lock.json` 已同步更新。
- 如果本地协作文件有变化，确认 `AGENTS.md` 这类本地文件没有混入提交范围。

## 本地长期安装（给自己使用）

- 先确认扩展标识策略：
    - 若沿用原始 `publisher` + `name`，安装后可能覆盖同 ID 的已安装版本。
    - 若不想覆盖，先在 `package.json` 调整 `publisher` 或 `name`，再打包安装。
- 执行 `npm run compile`。
- 运行 `npx @vscode/vsce package` 生成 VSIX（通常在项目根目录）。
- 在 VS Code 扩展面板右上角菜单中选择 Install from VSIX... 并选中生成的文件。
- 安装后重载窗口，确认命令可见且功能正常。
- 后续更新时，重新打包并再次 Install from VSIX... 覆盖安装即可。

## PR 自查

- 没有无关文件改动。
- 命令 ID、设置键名、文档描述保持一致。
- 错误提示信息对用户可操作。
- PR 描述中包含测试结果与手工验证步骤。
