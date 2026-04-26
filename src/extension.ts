import * as vscode from 'vscode';

import ReplaceRulesEditProvider from './editProvider';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('replacerules.runRule', runSingleRule));
    context.subscriptions.push(vscode.commands.registerCommand('replacerules.runRuleset', runRuleset));
    context.subscriptions.push(vscode.commands.registerCommand('replacerules.stringifyRegex', stringifyRegex));
}

export function deactivate() {

}

async function runSingleRule(args?: any) {
    let textEditor = vscode.window.activeTextEditor;
    if (!textEditor) {
        return;
    }
    let editP = new ReplaceRulesEditProvider(textEditor);
    if (args) {
        let ruleName = args['ruleName'];
        await editP.runSingleRule(ruleName);
    } else {
        await editP.pickRuleAndRun();
    }
    return;
}

async function runRuleset(args?: any) {
    let textEditor = vscode.window.activeTextEditor;
    if (!textEditor) {
        return;
    }
    let editP = new ReplaceRulesEditProvider(textEditor);
    if (args) {
        let rulesetName = args['rulesetName'];
        await editP.runRuleset(rulesetName);
    } else {
        await editP.pickRulesetAndRun();
    }
    return;
}

export function parseRegexInput(input: string) {
    if (input.startsWith('/')) {
        let literalMatch = input.match(/^\/([\s\S]*)\/([a-z]*)$/);
        if (!literalMatch) {
            throw new Error('Invalid regular expression literal.');
        }

        let [, pattern, flags] = literalMatch;
        new RegExp(pattern, flags);
        return { pattern, flags };
    }

    new RegExp(input);
    return { pattern: input, flags: '' };
}

async function stringifyRegex() {
    let options = { prompt: 'Enter a valid regular expression.', placeHolder: '(.*)' };
    let input = await vscode.window.showInputBox(options);
    if (input) {
        try {
            let { pattern, flags } = parseRegexInput(input);
            let jString = JSON.stringify(pattern);
            let msg = flags ? `JSON-escaped RegEx: ${jString} (flags: ${flags})` : 'JSON-escaped RegEx: ' + jString;
            let choice = await vscode.window.showInformationMessage(msg, 'Copy to clipboard');
            if (choice && choice === 'Copy to clipboard') {
                await vscode.env.clipboard.writeText(jString);
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(err.message);
        }
    }
}
