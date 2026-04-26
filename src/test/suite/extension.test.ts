import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { parseRegexInput } from '../../extension';

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

	test('runRule command resolves after edits are applied', async () => {
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
		assert.strictEqual(editor.document.getText(), 'A cAt And A hAt');
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

	test('runRule only updates non-empty selections', async () => {
		await setReplaceRulesConfig(await writeConfigFile({
			rules: {
				'Cat to Dog': {
					find: 'cat',
					replace: 'dog',
					flags: 'g'
				}
			}
		}));

		const editor = await openEditor('cat fox cat');
		editor.selections = [
			new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 3)),
			new vscode.Selection(new vscode.Position(0, 8), new vscode.Position(0, 11))
		];

		await vscode.commands.executeCommand('replacerules.runRule', { ruleName: 'Cat to Dog' });
		await waitForDocumentText(editor.document, 'dog fox dog');
	});

	test('runRule preserves CRLF line endings when replacements occur', async () => {
		await setReplaceRulesConfig(await writeConfigFile({
			rules: {
				'Uppercase b': {
					find: 'b',
					replace: 'B',
					flags: 'g'
				}
			}
		}));

		const editor = await openEditor('a\r\nb\r\n');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('replacerules.runRule', { ruleName: 'Uppercase b' });
		assert.strictEqual(editor.document.getText(), 'a\r\nB\r\n');
	});

	test('runRule preserves CRLF line endings when no replacements occur', async () => {
		await setReplaceRulesConfig(await writeConfigFile({
			rules: {
				'No match': {
					find: 'z',
					replace: 'Z',
					flags: 'g'
				}
			}
		}));

		const editor = await openEditor('a\r\nb\r\n');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('replacerules.runRule', { ruleName: 'No match' });
		assert.strictEqual(editor.document.getText(), 'a\r\nb\r\n');
	});

	test('runRule skips language-restricted rules for other languages', async () => {
		await setReplaceRulesConfig(await writeConfigFile({
			rules: {
				'TypeScript only': {
					find: 'a',
					replace: 'A',
					flags: 'g',
					languages: ['typescript']
				}
			}
		}));

		const editor = await openEditor('a cat and a hat');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('replacerules.runRule', { ruleName: 'TypeScript only' });
		await waitForDocumentText(editor.document, 'a cat and a hat');
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

	test('runRuleset loads external JSONC config from configPath', async () => {
		const fixtureDir = path.join(os.tmpdir(), 'replace rules test');
		const fixturePath = path.join(fixtureDir, `config-${Date.now()}-${Math.random().toString(16).slice(2)}.jsonc`);
		const jsoncConfig = `{
			// Rule definitions
			"rules": {
				"Foo to Bar": {
					"find": "foo",
					"replace": "bar",
					"flags": "g",
				},
				"BarBar to Baz": {
					"find": "barbar",
					"replace": "baz",
					"flags": "g",
				},
			},
			"rulesets": {
				"Collapse": {
					"rules": [
						"Foo to Bar",
						"BarBar to Baz",
					],
				},
			},
		}`;

		await fs.mkdir(fixtureDir, { recursive: true });
		await fs.writeFile(fixturePath, jsoncConfig, 'utf8');
		await setReplaceRulesConfig(fixturePath);

		const editor = await openEditor('foofoo');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('replacerules.runRuleset', { rulesetName: 'Collapse' });
		await waitForDocumentText(editor.document, 'baz');
	});

	test('runRule shows an error for invalid regex config', async () => {
		await setReplaceRulesConfig(await writeConfigFile({
			rules: {
				Broken: {
					find: '[',
					replace: 'x'
				}
			}
		}));

		const editor = await openEditor('sample text');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		const errors = await captureErrorMessages(async () => {
			await vscode.commands.executeCommand('replacerules.runRule', { ruleName: 'Broken' });
			await delay(25);
		});

		assert.strictEqual(errors.length, 1);
		assert.match(errors[0], /^Error executing rule Broken:/);
		assert.strictEqual(editor.document.getText(), 'sample text');
	});

	test('runRule shows an error when configPath cannot be loaded', async () => {
		const missingPath = path.join(os.tmpdir(), 'replace rules test', `missing-${Date.now()}.json`);
		await setReplaceRulesConfig(missingPath);

		const editor = await openEditor('sample text');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		const errors = await captureErrorMessages(async () => {
			await vscode.commands.executeCommand('replacerules.runRule', { ruleName: 'Anything' });
			await delay(25);
		});

		assert.strictEqual(errors.length, 1);
		assert.match(errors[0], /^Error loading replacerules\.configPath:/);
		assert.strictEqual(editor.document.getText(), 'sample text');
	});

	test('runRule shows an error for invalid JSONC in configPath file', async () => {
		const fixtureDir = path.join(os.tmpdir(), 'replace rules test');
		const fixturePath = path.join(fixtureDir, `invalid-${Date.now()}-${Math.random().toString(16).slice(2)}.jsonc`);
		const invalidJsonc = `{
			"rules": {
				"Broken": {
					"find": "a",
					"replace": "b",
				},
			},
			"rulesets": {
				"Any": {
					"rules": ["Broken"]
				}
			}`;

		await fs.mkdir(fixtureDir, { recursive: true });
		await fs.writeFile(fixturePath, invalidJsonc, 'utf8');
		await setReplaceRulesConfig(fixturePath);

		const editor = await openEditor('sample text');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		const errors = await captureErrorMessages(async () => {
			await vscode.commands.executeCommand('replacerules.runRule', { ruleName: 'Broken' });
			await delay(25);
		});

		assert.strictEqual(errors.length, 1);
		assert.match(errors[0], /^Error loading replacerules\.configPath: Invalid JSONC in /);
		assert.strictEqual(editor.document.getText(), 'sample text');
	});

	test('parseRegexInput parses regex literals with flags', () => {
		assert.deepStrictEqual(parseRegexInput('/foo/i'), { pattern: 'foo', flags: 'i' });
		assert.deepStrictEqual(parseRegexInput('foo'), { pattern: 'foo', flags: '' });
	});

	test('parseRegexInput rejects invalid regex literals', () => {
		assert.throws(() => parseRegexInput('/foo'), /Invalid regular expression literal/);
		assert.throws(() => parseRegexInput('/foo/gg'), /Invalid flags supplied to RegExp constructor/);
	});

	test('package metadata baseline matches current VS Code types', async () => {
		const packagePath = path.resolve(__dirname, '../../../package.json');
		const manifest = JSON.parse(await fs.readFile(packagePath, 'utf8')) as {
			engines?: { vscode?: string };
			devDependencies?: { [name: string]: string };
			dependencies?: { [name: string]: string };
		};

		assert.strictEqual(manifest.engines?.vscode, '^1.116.0');
		assert.strictEqual(manifest.devDependencies?.['@types/vscode'], '^1.116.0');
		assert.strictEqual(manifest.dependencies?.['jsonc-parser'], '^3.3.1');
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

async function captureErrorMessages(run: () => Promise<void>): Promise<string[]> {
	const errors: string[] = [];
	const windowAny = vscode.window as any;
	const originalShowErrorMessage = windowAny.showErrorMessage;
	windowAny.showErrorMessage = async (message: string) => {
		errors.push(String(message));
		return undefined;
	};

	try {
		await run();
		return errors;
	} finally {
		windowAny.showErrorMessage = originalShowErrorMessage;
	}
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
