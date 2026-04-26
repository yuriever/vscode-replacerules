import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

type ConfigSnapshot = {
	configPath: unknown;
};

const CONFIG_SCOPE = vscode.ConfigurationTarget.Global;

suite('Extension Test Suite', () => {
	let snapshot: ConfigSnapshot;

	suiteSetup(async () => {
		const config = vscode.workspace.getConfiguration('replacerules');
		snapshot = {
			configPath: config.inspect('configPath')?.globalValue
		};
	});

	setup(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
		await setReplaceRulesConfig(undefined);
	});

	teardown(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	suiteTeardown(async () => {
		await setReplaceRulesConfig(snapshot.configPath);
	});

	test('runRule replaces full document when selection is empty', async () => {
		await setReplaceRulesConfig(await writeConfigFile({
			rules: {
				'Uppercase a': {
					find: 'a',
					replace: 'A',
					flags: 'g'
				}
			}
		}));

		const editor = await openEditor('a cat and a hat');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('replacerules.runRule', { ruleName: 'Uppercase a' });
		await waitForDocumentText(editor.document, 'A cAt And A hAt');
	});

	test('runRuleset applies rules in sequence', async () => {
		await setReplaceRulesConfig(await writeConfigFile({
			rules: {
				'Foo to Bar': {
					find: 'foo',
					replace: 'bar',
					flags: 'g'
				},
				'BarBar to Baz': {
					find: 'barbar',
					replace: 'baz',
					flags: 'g'
				}
			},
			rulesets: {
				Collapse: {
					rules: ['Foo to Bar', 'BarBar to Baz']
				}
			}
		}));

		const editor = await openEditor('foofoo');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('replacerules.runRuleset', { rulesetName: 'Collapse' });
		await waitForDocumentText(editor.document, 'baz');
	});

	test('clipboard replace commands are not registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.strictEqual(commands.includes('replacerules.pasteAndReplace'), false);
		assert.strictEqual(commands.includes('replacerules.pasteAndReplaceRuleset'), false);
	});

	test('runRuleset loads external config from configPath with spaces', async () => {
		const fixtureDir = path.join(os.tmpdir(), 'replace rules test');
		const fixturePath = path.join(fixtureDir, 'config with spaces.json');
		await fs.mkdir(fixtureDir, { recursive: true });
		await fs.writeFile(fixturePath, JSON.stringify({
			rules: {
				'Foo to Bar': {
					find: 'foo',
					replace: 'bar',
					flags: 'g'
				},
				'BarBar to Baz': {
					find: 'barbar',
					replace: 'baz',
					flags: 'g'
				}
			},
			rulesets: {
				Collapse: {
					rules: ['Foo to Bar', 'BarBar to Baz']
				}
			}
		}), 'utf8');

		await setReplaceRulesConfig(fixturePath);

		const editor = await openEditor('foofoo');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('replacerules.runRuleset', { rulesetName: 'Collapse' });
		await waitForDocumentText(editor.document, 'baz');
	});
});

async function setReplaceRulesConfig(configPath: unknown): Promise<void> {
	const config = vscode.workspace.getConfiguration('replacerules');
	await config.update('configPath', configPath, CONFIG_SCOPE);
}

async function writeConfigFile(config: unknown): Promise<string> {
	const fixtureDir = path.join(os.tmpdir(), 'replace rules test');
	const fixturePath = path.join(fixtureDir, `config-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
	await fs.mkdir(fixtureDir, { recursive: true });
	await fs.writeFile(fixturePath, JSON.stringify(config), 'utf8');
	return fixturePath;
}

async function openEditor(content: string): Promise<vscode.TextEditor> {
	const document = await vscode.workspace.openTextDocument({ content, language: 'plaintext' });
	return vscode.window.showTextDocument(document);
}

async function waitForDocumentText(document: vscode.TextDocument, expected: string, timeoutMs = 3000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (document.getText() === expected) {
			return;
		}
		await delay(25);
	}
	assert.strictEqual(document.getText(), expected);
}

async function delay(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}
