import * as vscode from 'vscode';

import TextReplaceRuleEditProvider from './editProvider';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('text-replace-rule.runRule', runSingleRule));
    context.subscriptions.push(vscode.commands.registerCommand('text-replace-rule.runRulePipeline', runRulePipeline));
}

export function deactivate() {

}

async function runSingleRule(args?: any) {
    let textEditor = vscode.window.activeTextEditor;
    if (!textEditor) {
        return;
    }
    let editP = new TextReplaceRuleEditProvider(textEditor);
    if (args) {
        let ruleName = args['ruleName'];
        await editP.runSingleRule(ruleName);
    } else {
        await editP.pickRuleAndRun();
    }
    return;
}

async function runRulePipeline(args?: any) {
    let textEditor = vscode.window.activeTextEditor;
    if (!textEditor) {
        return;
    }
    let editP = new TextReplaceRuleEditProvider(textEditor);
    if (args) {
        let rulePipelineName = args['rulePipelineName'];
        await editP.runRulePipeline(rulePipelineName);
    } else {
        await editP.pickRulePipelineAndRun();
    }
    return;
}
