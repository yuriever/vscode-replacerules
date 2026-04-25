import * as assert from 'assert';
import * as vscode from 'vscode';

type ConfigSnapshot = {
	rules: unknown;
	rulesets: unknown;
};

const CONFIG_SCOPE = vscode.ConfigurationTarget.Global;

suite('Extension Test Suite', () => {
	let snapshot: ConfigSnapshot;

	suiteSetup(async () => {
		const config = vscode.workspace.getConfiguration('replacerules');
		snapshot = {
			rules: config.inspect('rules')?.globalValue,
			rulesets: config.inspect('rulesets')?.globalValue
		};
	});

	setup(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
		await setReplaceRulesConfig({}, {});
	});

	teardown(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	suiteTeardown(async () => {
		await setReplaceRulesConfig(snapshot.rules, snapshot.rulesets);
	});

	test('runRule replaces full document when selection is empty', async () => {
		await setReplaceRulesConfig({
			'Uppercase a': {
				find: 'a',
				replace: 'A',
				flags: 'g'
			}
		}, {});

		const editor = await openEditor('a cat and a hat');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('replacerules.runRule', { ruleName: 'Uppercase a' });
		await waitForDocumentText(editor.document, 'A cAt And A hAt');
	});

	test('runRuleset applies rules in sequence', async () => {
		await setReplaceRulesConfig({
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
		}, {
			Collapse: {
				rules: ['Foo to Bar', 'BarBar to Baz']
			}
		});

		const editor = await openEditor('foofoo');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('replacerules.runRuleset', { rulesetName: 'Collapse' });
		await waitForDocumentText(editor.document, 'baz');
	});

	test('pasteAndReplace transforms clipboard and keeps clipboard unchanged', async () => {
		const clipboardText = 'hello world';
		await vscode.env.clipboard.writeText(clipboardText);

		await setReplaceRulesConfig({
			'Dash spaces': {
				find: '\\s+',
				replace: '-',
				flags: 'g'
			}
		}, {});

		const editor = await openEditor('X');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 1));

		await vscode.commands.executeCommand('replacerules.pasteAndReplace', { ruleName: 'Dash spaces' });
		await waitForDocumentText(editor.document, 'hello-world');

		const currentClipboard = await vscode.env.clipboard.readText();
		assert.strictEqual(currentClipboard, clipboardText);
	});

	test('pasteAndReplaceRuleset applies chained clipboard replacements', async () => {
		await vscode.env.clipboard.writeText('xx');

		await setReplaceRulesConfig({
			'X to Y': {
				find: 'x',
				replace: 'y',
				flags: 'g'
			},
			'YY to Z': {
				find: 'yy',
				replace: 'z',
				flags: 'g'
			}
		}, {
			'Clipboard chain': {
				rules: ['X to Y', 'YY to Z']
			}
		});

		const editor = await openEditor('_');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 1));

		await vscode.commands.executeCommand('replacerules.pasteAndReplaceRuleset', { rulesetName: 'Clipboard chain' });
		await waitForDocumentText(editor.document, 'z');
	});
});

async function setReplaceRulesConfig(rules: unknown, rulesets: unknown): Promise<void> {
	const config = vscode.workspace.getConfiguration('replacerules');
	await config.update('rules', rules, CONFIG_SCOPE);
	await config.update('rulesets', rulesets, CONFIG_SCOPE);
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
