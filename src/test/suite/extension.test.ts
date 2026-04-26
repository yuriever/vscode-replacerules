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
		const config = vscode.workspace.getConfiguration('text-replace-rule');
		snapshot = {
			configPath: config.inspect('configPath')?.globalValue
		};
	});

	setup(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
		await setTextReplaceRuleConfig(undefined);
	});

	teardown(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	suiteTeardown(async () => {
		await setTextReplaceRuleConfig(snapshot.configPath);
	});

	test('runRule replaces full document when selection is empty', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Uppercase a': {
					type: 'regexReplace',
					find: 'a',
					replace: 'A',
					flag: 'g'
				}
			}
		}));

		const editor = await openEditor('a cat and a hat');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Uppercase a' });
		assert.strictEqual(editor.document.getText(), 'A cAt And A hAt');
	});

	test('runRulePipeline applies rules in sequence', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Foo to Bar': {
					type: 'regexReplace',
					find: 'foo',
					replace: 'bar',
					flag: 'g'
				},
				'BarBar to Baz': {
					type: 'regexReplace',
					find: 'barbar',
					replace: 'baz',
					flag: 'g'
				}
			},
			rulePipelines: {
				Collapse: {
					rules: ['Foo to Bar', 'BarBar to Baz']
				}
			}
		}));

		const editor = await openEditor('foofoo');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRulePipeline', { rulePipelineName: 'Collapse' });
		assert.strictEqual(editor.document.getText(), 'baz');
	});

	test('runRule only updates non-empty selections', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Cat to Dog': {
					type: 'regexReplace',
					find: 'cat',
					replace: 'dog',
					flag: 'g'
				}
			}
		}));

		const editor = await openEditor('cat fox cat');
		editor.selections = [
			new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 3)),
			new vscode.Selection(new vscode.Position(0, 8), new vscode.Position(0, 11))
		];

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Cat to Dog' });
		assert.strictEqual(editor.document.getText(), 'dog fox dog');
	});

	test('runRule preserves CRLF line endings when replacements occur', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Uppercase b': {
					type: 'regexReplace',
					find: 'b',
					replace: 'B',
					flag: 'g'
				}
			}
		}));

		const editor = await openEditor('a\r\nb\r\n');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Uppercase b' });
		assert.strictEqual(editor.document.getText(), 'a\r\nB\r\n');
	});

	test('runRule preserves CRLF line endings when no replacements occur', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'No match': {
					type: 'regexReplace',
					find: 'z',
					replace: 'Z',
					flag: 'g'
				}
			}
		}));

		const editor = await openEditor('a\r\nb\r\n');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'No match' });
		assert.strictEqual(editor.document.getText(), 'a\r\nb\r\n');
	});

	test('runRule defaults missing flag to global-only matching', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Anchor first line only': {
					type: 'regexReplace',
					find: '^b$',
					replace: 'B'
				}
			}
		}));

		const editor = await openEditor('b\nb');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Anchor first line only' });
		assert.strictEqual(editor.document.getText(), 'b\nb');
	});

	test('runRule applies expandTab post-processing to regexReplace results', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Indent parentheses': {
					type: 'regexReplace',
					find: '^([ ]*)\\((.*)\\)$',
					replace: '$1[\n$1\t$2\n$1]',
					flag: 'gm',
					post: ['expandTab']
				}
			}
		}));

		const editor = await openEditor('  (x)');
		editor.options = { tabSize: 2, insertSpaces: true };
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Indent parentheses' });
		assert.strictEqual(editor.document.getText(), '  [\n    x\n  ]');
	});

	test('runRule applies indentLine before expandTab for whitespace-indented selections', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Wrap selection as equation': {
					type: 'regexReplace',
					find: '^(.*)$',
					replace: '\\begin{equation}\n\t$1\n\\end{equation}',
					post: ['indentLine', 'expandTab']
				}
			}
		}));

		const editor = await openEditor('    a=b');
		editor.options = { tabSize: 4, insertSpaces: true };
		editor.selection = new vscode.Selection(new vscode.Position(0, 4), new vscode.Position(0, 7));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Wrap selection as equation' });
		assert.strictEqual(editor.document.getText(), '    \\begin{equation}\n        a=b\n    \\end{equation}');
	});

	test('runRule skips indentLine when selection prefix contains non-whitespace', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Wrap selection as equation': {
					type: 'regexReplace',
					find: '^(.*)$',
					replace: '\\begin{equation}\n\t$1\n\\end{equation}',
					post: ['indentLine', 'expandTab']
				}
			}
		}));

		const editor = await openEditor('xxxx (a+b) xxxx');
		editor.options = { tabSize: 4, insertSpaces: true };
		editor.selection = new vscode.Selection(new vscode.Position(0, 5), new vscode.Position(0, 10));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Wrap selection as equation' });
		assert.strictEqual(editor.document.getText(), 'xxxx \\begin{equation}\n    (a+b)\n\\end{equation} xxxx');
	});

	test('runRule applies alignLine before expandTab for inline selections', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Inline LR block': {
					type: 'regexReplace',
					find: '^\\((.*)\\)$',
					replace: '\\LR{\n\t$1\n}',
					post: ['alignLine', 'expandTab']
				}
			}
		}));

		const editor = await openEditor('    xxxx (a+b) xxxx');
		editor.options = { tabSize: 4, insertSpaces: true };
		editor.selection = new vscode.Selection(new vscode.Position(0, 9), new vscode.Position(0, 14));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Inline LR block' });
		assert.strictEqual(editor.document.getText(), '    xxxx \\LR{\n             a+b\n         } xxxx');
	});

	test('runRule applies expandTab post-processing to literalMap results without token expansion', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Literal token output': {
					type: 'literalMap',
					map: {
						x: '\t$&'
					},
					post: ['expandTab']
				}
			}
		}));

		const editor = await openEditor('x');
		editor.options = { tabSize: 2, insertSpaces: true };
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Literal token output' });
		assert.strictEqual(editor.document.getText(), '  $&');
	});

	test('runRule applies removeBlankLine post-processing to regexReplace results', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Latex equation without blank lines': {
					type: 'regexReplace',
					find: '^eq$',
					replace: '\\begin{equation}\n\n  x = y\n  \n\\end{equation}',
					post: ['removeBlankLine']
				}
			}
		}));

		const editor = await openEditor('eq');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Latex equation without blank lines' });
		assert.strictEqual(editor.document.getText(), '\\begin{equation}\n  x = y\n\\end{equation}');
	});

	test('runRule applies multiple post processors in order', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Clean indented block': {
					type: 'regexReplace',
					find: '^block$',
					replace: '[\n\n\titem\n]',
					post: ['removeBlankLine', 'expandTab']
				}
			}
		}));

		const editor = await openEditor('block');
		editor.options = { tabSize: 2, insertSpaces: true };
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Clean indented block' });
		assert.strictEqual(editor.document.getText(), '[\n  item\n]');
	});

	test('runRule applies alignLine, expandTab, and removeBlankLine in listed order', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Inline block cleanup': {
					type: 'regexReplace',
					find: '^x$',
					replace: '{\n\n\titem\n}',
					post: ['alignLine', 'expandTab', 'removeBlankLine']
				}
			}
		}));

		const editor = await openEditor('foo x bar');
		editor.options = { tabSize: 2, insertSpaces: true };
		editor.selection = new vscode.Selection(new vscode.Position(0, 4), new vscode.Position(0, 5));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Inline block cleanup' });
		assert.strictEqual(editor.document.getText(), 'foo {\n      item\n    } bar');
	});

	test('runRule skips language-restricted rules for other languages', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'TypeScript only': {
					type: 'regexReplace',
					find: 'a',
					replace: 'A',
					flag: 'g',
					language: ['typescript']
				}
			}
		}));

		const editor = await openEditor('a cat and a hat');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'TypeScript only' });
		assert.strictEqual(editor.document.getText(), 'a cat and a hat');
	});

	test('runRule applies language-restricted literalMap rules when language matches', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Wolfram greek': {
					type: 'literalMap',
					language: ['plaintext'],
					map: {
						α: '\\[Alpha]'
					}
				}
			}
		}));

		const editor = await openEditor('α');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Wolfram greek' });
		assert.strictEqual(editor.document.getText(), '\\[Alpha]');
	});

	test('runRule quick pick uses optional name and description metadata', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'latex: parenthesis -> LR': {
					type: 'regexReplace',
					name: 'LaTeX LR Pair',
					description: 'Wrap a parenthesized block in \\LR{...}',
					find: '^x$',
					replace: 'y'
				}
			}
		}));

		const editor = await openEditor('x');
		const items = await captureQuickPickItems(async () => {
			await vscode.commands.executeCommand('text-replace-rule.runRule');
		});

		assert.strictEqual(items.length, 1);
		assert.strictEqual(items[0].label, 'LaTeX LR Pair');
		assert.strictEqual(items[0].description, 'Wrap a parenthesized block in \\LR{...}');
		assert.strictEqual(items[0].detail, 'Key: latex: parenthesis -> LR');
		assert.strictEqual(editor.document.getText(), 'x');
	});

	test('runRulePipeline quick pick uses optional name and description metadata', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Foo to Bar': {
					type: 'regexReplace',
					find: 'foo',
					replace: 'bar'
				}
			},
			rulePipelines: {
				Collapse: {
					name: 'Collapse Pipeline',
					description: 'Run the foo-to-bar cleanup chain',
					rules: ['Foo to Bar']
				}
			}
		}));

		const editor = await openEditor('foo');
		const items = await captureQuickPickItems(async () => {
			await vscode.commands.executeCommand('text-replace-rule.runRulePipeline');
		});

		assert.strictEqual(items.length, 1);
		assert.strictEqual(items[0].label, 'Collapse Pipeline');
		assert.strictEqual(items[0].description, 'Run the foo-to-bar cleanup chain');
		assert.strictEqual(items[0].detail, 'Key: Collapse');
		assert.strictEqual(editor.document.getText(), 'foo');
	});

	test('registered commands include runRulePipeline and exclude removed commands', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.strictEqual(commands.includes('text-replace-rule.runRule'), true);
		assert.strictEqual(commands.includes('text-replace-rule.runRulePipeline'), true);
		assert.strictEqual(commands.includes('replacerules.runRule'), false);
		assert.strictEqual(commands.includes('replacerules.runRulePipeline'), false);
		assert.strictEqual(commands.includes('replacerules.runRuleset'), false);
		assert.strictEqual(commands.includes('text-replace-rule.runRuleset'), false);
		assert.strictEqual(commands.includes('replacerules.stringifyRegex'), false);
		assert.strictEqual(commands.includes('replacerules.pasteAndReplace'), false);
		assert.strictEqual(commands.includes('replacerules.pasteAndReplaceRuleset'), false);
	});

	test('runRulePipeline loads external config from configPath with spaces', async () => {
		const fixtureDir = path.join(os.tmpdir(), 'text replace rule test');
		const fixturePath = path.join(fixtureDir, 'config with spaces.json');
		await fs.mkdir(fixtureDir, { recursive: true });
		await fs.writeFile(fixturePath, JSON.stringify({
			rules: {
				'Foo to Bar': {
					type: 'regexReplace',
					find: 'foo',
					replace: 'bar',
					flag: 'g'
				},
				'BarBar to Baz': {
					type: 'regexReplace',
					find: 'barbar',
					replace: 'baz',
					flag: 'g'
				}
			},
			rulePipelines: {
				Collapse: {
					rules: ['Foo to Bar', 'BarBar to Baz']
				}
			}
		}), 'utf8');

		await setTextReplaceRuleConfig(fixturePath);

		const editor = await openEditor('foofoo');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRulePipeline', { rulePipelineName: 'Collapse' });
		assert.strictEqual(editor.document.getText(), 'baz');
	});

	test('runRulePipeline loads external JSONC config from configPath', async () => {
		const fixtureDir = path.join(os.tmpdir(), 'text replace rule test');
		const fixturePath = path.join(fixtureDir, `config-${Date.now()}-${Math.random().toString(16).slice(2)}.jsonc`);
		const jsoncConfig = `{
			// Rule definitions
			"rules": {
				"Foo to Bar": {
					"type": "regexReplace",
					"find": "foo",
					"replace": "bar",
					"flag": "g",
				},
				"BarBar to Baz": {
					"type": "regexReplace",
					"find": "barbar",
					"replace": "baz",
					"flag": "g",
				},
			},
			"rulePipelines": {
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
		await setTextReplaceRuleConfig(fixturePath);

		const editor = await openEditor('foofoo');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRulePipeline', { rulePipelineName: 'Collapse' });
		assert.strictEqual(editor.document.getText(), 'baz');
	});

	test('runRule reuses cached external config when the config file changes', async () => {
		const fixturePath = await writeConfigFile({
			rules: {
				'Word rule': {
					type: 'regexReplace',
					find: 'word',
					replace: 'cached',
					flag: 'g'
				}
			}
		});
		await setTextReplaceRuleConfig(fixturePath);

		const firstEditor = await openEditor('word');
		firstEditor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Word rule' });
		assert.strictEqual(firstEditor.document.getText(), 'cached');

		await fs.writeFile(fixturePath, JSON.stringify({
			rules: {
				'Word rule': {
					type: 'regexReplace',
					find: 'word',
					replace: 'updated',
					flag: 'g'
				}
			}
		}), 'utf8');

		const secondEditor = await openEditor('word');
		secondEditor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Word rule' });
		assert.strictEqual(secondEditor.document.getText(), 'cached');
	});

	test('runRule reloads cached external config after configPath changes', async () => {
		const fixturePath = await writeConfigFile({
			rules: {
				'Word rule': {
					type: 'regexReplace',
					find: 'word',
					replace: 'cached',
					flag: 'g'
				}
			}
		});
		await setTextReplaceRuleConfig(fixturePath);

		const firstEditor = await openEditor('word');
		firstEditor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Word rule' });
		assert.strictEqual(firstEditor.document.getText(), 'cached');

		await fs.writeFile(fixturePath, JSON.stringify({
			rules: {
				'Word rule': {
					type: 'regexReplace',
					find: 'word',
					replace: 'updated',
					flag: 'g'
				}
			}
		}), 'utf8');
		await setTextReplaceRuleConfig(undefined);
		await setTextReplaceRuleConfig(fixturePath);

		const secondEditor = await openEditor('word');
		secondEditor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Word rule' });
		assert.strictEqual(secondEditor.document.getText(), 'updated');
	});

	test('runRule executes multi-step regexReplace rules with per-step flag arrays', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Collapse in steps': {
					type: 'regexReplace',
					find: ['foo', 'bar'],
					replace: ['bar', 'baz'],
					flag: ['gi', 'g']
				}
			}
		}));

		const editor = await openEditor('Foo bar');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Collapse in steps' });
		assert.strictEqual(editor.document.getText(), 'baz baz');
	});

	test('runRule performs a single editor.edit call for multi-step regexReplace rules', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Two step collapse': {
					type: 'regexReplace',
					find: ['foo', 'bar'],
					replace: ['bar', 'baz'],
					flag: 'g'
				}
			}
		}));

		const editor = await openEditor('foo bar');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		const editCount = await withDocumentChangeSpy(editor.document, async () => {
			await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Two step collapse' });
		});

		assert.strictEqual(editCount, 1);
		assert.strictEqual(editor.document.getText(), 'baz baz');
	});

	test('runRulePipeline performs a single editor.edit call for multi-rule pipelines', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				'Foo to Bar': {
					type: 'regexReplace',
					find: 'foo',
					replace: 'bar',
					flag: 'g'
				},
				'Bar to Baz': {
					type: 'regexReplace',
					find: 'bar',
					replace: 'baz',
					flag: 'g'
				}
			},
			rulePipelines: {
				Collapse: {
					rules: ['Foo to Bar', 'Bar to Baz']
				}
			}
		}));

		const editor = await openEditor('foo bar');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		const editCount = await withDocumentChangeSpy(editor.document, async () => {
			await vscode.commands.executeCommand('text-replace-rule.runRulePipeline', { rulePipelineName: 'Collapse' });
		});

		assert.strictEqual(editCount, 1);
		assert.strictEqual(editor.document.getText(), 'baz baz');
	});

	test('runRule shows an error for invalid regex config', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				Broken: {
					type: 'regexReplace',
					find: '[',
					replace: 'x'
				}
			}
		}));

		const editor = await openEditor('sample text');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		const errors = await captureErrorMessages(async () => {
			await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Broken' });
			await delay(25);
		});

		assert.strictEqual(errors.length, 1);
		assert.match(errors[0], /^Error loading text-replace-rule\.configPath:/);
		assert.strictEqual(editor.document.getText(), 'sample text');
	});

	test('runRule shows an error for unsupported post processors', async () => {
		await setTextReplaceRuleConfig(await writeConfigFile({
			rules: {
				Broken: {
					type: 'regexReplace',
					find: 'a',
					replace: 'b',
					post: [{ type: 'expandTab', tabSize: 4 }]
				}
			}
		}));

		const editor = await openEditor('sample text');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		const errors = await captureErrorMessages(async () => {
			await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Broken' });
			await delay(25);
		});

		assert.strictEqual(errors.length, 1);
		assert.match(errors[0], /^Error loading text-replace-rule\.configPath:/);
		assert.strictEqual(editor.document.getText(), 'sample text');
	});

	test('runRule shows an error for missing type', async () => {
		await assertConfigLoadFailure({
			rules: {
				Broken: {
					find: 'a',
					replace: 'b'
				}
			}
		});
	});

	test('runRule shows an error for unknown rule types', async () => {
		await assertConfigLoadFailure({
			rules: {
				Broken: {
					type: 'replace',
					find: 'a',
					replace: 'b'
				}
			}
		});
	});

	test('runRule rejects legacy flags, languages, and literal fields', async () => {
		await assertConfigLoadFailure({
			rules: {
				Broken: {
					type: 'regexReplace',
					find: 'a',
					replace: 'b',
					flags: 'g',
					languages: ['plaintext'],
					literal: true
				}
			}
		});
	});

	test('runRule rejects mixed regexReplace and literalMap fields', async () => {
		await assertConfigLoadFailure({
			rules: {
				Broken: {
					type: 'literalMap',
					find: 'a',
					map: {
						a: 'b'
					}
				}
			}
		});
	});

	test('runRulePipeline rejects the legacy rulesets root key', async () => {
		await assertConfigLoadFailure({
			rules: {
				Anything: {
					type: 'regexReplace',
					find: 'a',
					replace: 'b'
				}
			},
			rulesets: {
				Old: {
					rules: ['Anything']
				}
			}
		});
	});

	test('runRulePipeline rejects pipelines that reference missing rules', async () => {
		await assertConfigLoadFailure({
			rules: {
				Anything: {
					type: 'regexReplace',
					find: 'a',
					replace: 'b'
				}
			},
			rulePipelines: {
				Broken: {
					rules: ['Anything', 'Missing']
				}
			}
		});
	});

	test('runRule rejects ambiguous literalMap keys', async () => {
		await assertConfigLoadFailure({
			rules: {
				Broken: {
					type: 'literalMap',
					map: {
						α: 'one',
						'αβ': 'two'
					}
				}
			}
		});
	});

	test('runRule shows an error when configPath cannot be loaded', async () => {
		const missingPath = path.join(os.tmpdir(), 'text replace rule test', `missing-${Date.now()}.json`);
		await setTextReplaceRuleConfig(missingPath);

		const editor = await openEditor('sample text');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		const errors = await captureErrorMessages(async () => {
			await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Anything' });
			await delay(25);
		});

		assert.strictEqual(errors.length, 1);
		assert.match(errors[0], /^Error loading text-replace-rule\.configPath:/);
		assert.strictEqual(editor.document.getText(), 'sample text');
	});

	test('runRule shows an error for invalid JSONC in configPath file', async () => {
		const fixtureDir = path.join(os.tmpdir(), 'text replace rule test');
		const fixturePath = path.join(fixtureDir, `invalid-${Date.now()}-${Math.random().toString(16).slice(2)}.jsonc`);
		const invalidJsonc = `{
			"rules": {
				"Broken": {
					"type": "regexReplace",
					"find": "a",
					"replace": "b",
				},
			},
			"rulePipelines": {
				"Any": {
					"rules": ["Broken"]
				}
			}`;

		await fs.mkdir(fixtureDir, { recursive: true });
		await fs.writeFile(fixturePath, invalidJsonc, 'utf8');
		await setTextReplaceRuleConfig(fixturePath);

		const editor = await openEditor('sample text');
		editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

		const errors = await captureErrorMessages(async () => {
			await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Broken' });
			await delay(25);
		});

		assert.strictEqual(errors.length, 1);
		assert.match(errors[0], /^Error loading text-replace-rule\.configPath: Invalid JSONC in /);
		assert.strictEqual(editor.document.getText(), 'sample text');
	});

	test('package metadata baseline matches current VS Code types', async () => {
		const packagePath = path.resolve(__dirname, '../../../package.json');
		const manifest = JSON.parse(await fs.readFile(packagePath, 'utf8')) as {
			engines?: { vscode?: string };
			name?: string;
			displayName?: string;
			activationEvents?: string[];
			contributes?: { commands?: Array<{ command?: string }> };
			devDependencies?: { [name: string]: string };
			dependencies?: { [name: string]: string };
		};

		assert.strictEqual(manifest.engines?.vscode, '^1.116.0');
		assert.strictEqual(manifest.devDependencies?.['@types/vscode'], '^1.116.0');
		assert.strictEqual(manifest.dependencies?.['jsonc-parser'], '^3.3.1');
		assert.strictEqual(manifest.name, 'text-replace-rule');
		assert.strictEqual(manifest.displayName, 'TextReplaceRule');
		assert.strictEqual(manifest.activationEvents?.includes('onCommand:text-replace-rule.runRule'), true);
		assert.strictEqual(manifest.activationEvents?.includes('onCommand:text-replace-rule.runRulePipeline'), true);
		assert.strictEqual(manifest.activationEvents?.includes('onCommand:replacerules.runRule'), false);
		assert.strictEqual(manifest.activationEvents?.includes('onCommand:replacerules.runRulePipeline'), false);
		assert.strictEqual(manifest.activationEvents?.includes('onCommand:replacerules.runRuleset'), false);
		assert.strictEqual(manifest.activationEvents?.includes('onCommand:text-replace-rule.runRuleset'), false);
		assert.strictEqual(manifest.activationEvents?.includes('onCommand:replacerules.stringifyRegex'), false);
		assert.strictEqual(manifest.contributes?.commands?.some((command) => command.command === 'text-replace-rule.runRule'), true);
		assert.strictEqual(manifest.contributes?.commands?.some((command) => command.command === 'text-replace-rule.runRulePipeline'), true);
		assert.strictEqual(manifest.contributes?.commands?.some((command) => command.command === 'replacerules.stringifyRegex'), false);
	});
});

async function setTextReplaceRuleConfig(configPath: unknown): Promise<void> {
	const config = vscode.workspace.getConfiguration('text-replace-rule');
	await config.update('configPath', configPath, CONFIG_SCOPE);
}

async function writeConfigFile(config: unknown): Promise<string> {
	const fixtureDir = path.join(os.tmpdir(), 'text replace rule test');
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

async function captureQuickPickItems(run: () => Promise<void>): Promise<vscode.QuickPickItem[]> {
	const windowAny = vscode.window as any;
	const originalShowQuickPick = windowAny.showQuickPick;
	let capturedItems: vscode.QuickPickItem[] = [];
	windowAny.showQuickPick = async (items: vscode.QuickPickItem[]) => {
		capturedItems = Array.isArray(items) ? items.map((item) => ({ ...item })) : [];
		return undefined;
	};

	try {
		await run();
		return capturedItems;
	} finally {
		windowAny.showQuickPick = originalShowQuickPick;
	}
}

async function assertConfigLoadFailure(config: unknown): Promise<void> {
	await setTextReplaceRuleConfig(await writeConfigFile(config));

	const editor = await openEditor('sample text');
	editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

	const errors = await captureErrorMessages(async () => {
		await vscode.commands.executeCommand('text-replace-rule.runRule', { ruleName: 'Broken' });
		await delay(25);
	});

	assert.strictEqual(errors.length, 1);
	assert.match(errors[0], /^Error loading text-replace-rule\.configPath:/);
	assert.strictEqual(editor.document.getText(), 'sample text');
}

async function withDocumentChangeSpy(document: vscode.TextDocument, run: () => Promise<void>): Promise<number> {
	let changeCount = 0;
	const subscription = vscode.workspace.onDidChangeTextDocument((event) => {
		if (event.document.uri.toString() === document.uri.toString()) {
			changeCount += 1;
		}
	});

	try {
		await run();
		return changeCount;
	} finally {
		subscription.dispose();
	}
}

async function openEditor(content: string, language = 'plaintext'): Promise<vscode.TextEditor> {
	const document = await vscode.workspace.openTextDocument({ content, language });
	return vscode.window.showTextDocument(document);
}

async function delay(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}
