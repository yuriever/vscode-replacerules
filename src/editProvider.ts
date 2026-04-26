import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { TextEditor, Range } from 'vscode';
import Window = vscode.window;

export default class ReplaceRulesEditProvider {
    private textEditor: TextEditor;
    private configRules: any;
    private configRulesets: any;

    public async pickRuleAndRun() {
        let rules = this.getQPRules();
        let qpItem = await vscode.window.showQuickPick(rules);
        if (qpItem) {
            await this.runSingleRule(qpItem.key);
        }
    }

    public async pickRulesetAndRun() {
        let rulesets = this.getQPRulesets();
        let qpItem = await vscode.window.showQuickPick(rulesets);
        if (qpItem) {
            await this.runRuleset(qpItem.key);
        }
    }

    private getQPRules(): any[] {
        let language = this.textEditor.document.languageId;
        let configRules = this.configRules;
        let items = [];
        for (const r in configRules) {
            let rule = configRules[r];
            if (Array.isArray(rule.languages) && rule.languages.indexOf(language) === -1) {
                continue;
            }
            if (rule.find) {
                try {
                    items.push({
                        label: "Replace Rule: " + r,
                        description: "",
                        key: r
                    });
                } catch (err: any) {
                    Window.showErrorMessage('Error parsing rule ' + r + ': ' + err.message);
                }
            }
        }
        return items;
    }

    private getQPRulesets(): any[] {
        let configRulesets = this.configRulesets;
        let items = [];
        for (const r in configRulesets) {
            let ruleset = configRulesets[r];
            if (Array.isArray(ruleset.rules)) {
                try {
                    items.push({
                        label: "Ruleset: " + r,
                        description: "",
                        key: r
                    });
                } catch (err: any) {
                    Window.showErrorMessage('Error parsing ruleset ' + r + ': ' + err.message);
                }
            }
        }
        return items;
    }

    public async runSingleRule(ruleName: string) {
        let rule = this.configRules[ruleName];
        if (rule) {
            let language = this.textEditor.document.languageId;
            if (Array.isArray(rule.languages) && rule.languages.indexOf(language) === -1) {
                return;
            }
            try {
                await this.doReplace(new ReplaceRule(rule));
            } catch (err: any) {
                Window.showErrorMessage('Error executing rule ' + ruleName + ': ' + err.message);
            }
        }
    }

    public async runRuleset(rulesetName: string) {
        let language = this.textEditor.document.languageId;
        let ruleset = this.configRulesets[rulesetName];
        if (!ruleset || !Array.isArray(ruleset.rules)) {
            return;
        }

        try {
            let matchingRules = [];
            for (const ruleName of ruleset.rules) {
                let rule = this.configRules[ruleName];
                if (!rule) {
                    continue;
                }
                if (Array.isArray(rule.languages) && rule.languages.indexOf(language) === -1) {
                    continue;
                }
                matchingRules.push(rule);
            }

            if (matchingRules.length === 0) {
                return;
            }

            let [firstRule, ...remainingRules] = matchingRules;
            let ruleObject = new ReplaceRule(firstRule);
            remainingRules.forEach(rule => ruleObject.appendRule(rule));
            await this.doReplace(ruleObject);
        } catch (err: any) {
            Window.showErrorMessage('Error executing ruleset ' + rulesetName + ': ' + err.message);
        }
    }

    private async doReplace(rule: ReplaceRule) {
        let e = this.textEditor;
        let d = e.document;
        let editOptions = { undoStopBefore: false, undoStopAfter: false };
        let numSelections = e.selections.length;
        for (const x of Array(numSelections).keys()) {
            let sel = e.selections[x];
            let index = (numSelections === 1 && sel.isEmpty) ? -1 : x;
            let range = rangeUpdate(e, d, index);
            for (const r of rule.steps) {
                let findText = d.getText(range);
                let updatedText = applyReplacement(findText, r);
                if (updatedText === undefined) {
                    continue;
                }
                await e.edit((edit) => {
                    edit.replace(range, updatedText);
                }, editOptions);
                range = rangeUpdate(e, d, index);
            }
        }
        return;
    }

    constructor(textEditor: TextEditor) {
        this.textEditor = textEditor;
        let config = vscode.workspace.getConfiguration("replacerules");
        let configPath = config.get<string>("configPath");

        if (configPath) {
            try {
                let externalConfig = loadExternalConfig(configPath, textEditor.document.uri);
                this.configRules = externalConfig.rules || {};
                this.configRulesets = externalConfig.rulesets || {};
                return;
            } catch (err: any) {
                Window.showErrorMessage('Error loading replacerules.configPath: ' + err.message);
            }
        }

        this.configRules = {};
        this.configRulesets = {};
    }
}

class Replacement {
    static defaultFlags = 'gm';
    public find: RegExp | string;
    public replace: string;

    public constructor(find: string, replace: string, flags: string, literal = false) {
        if (flags) {
            flags = (flags.search('g') === -1) ? flags + 'g' : flags;
        }
        find = literal ? escapeRegExp(find) : find;
        this.find = new RegExp(find, flags || Replacement.defaultFlags);
        this.replace = replace || '';
    }
}

class ReplaceRule {
    public steps: Replacement[];

    public constructor(rule: any) {
        let ruleSteps: Replacement[] = [];
        let find = objToArray(rule.find);
        for (let i = 0; i < find.length; i++) {
            ruleSteps.push(new Replacement(find[i], objToArray(rule.replace)[i], objToArray(rule.flags)[i], rule.literal));
        }
        this.steps = ruleSteps;
    }

    public appendRule(newRule: any) {
        let find = objToArray(newRule.find);
        for (let i = 0; i < find.length; i++) {
            this.steps.push(new Replacement(find[i], objToArray(newRule.replace)[i], objToArray(newRule.flags)[i], newRule.literal));
        }
    }
}

const objToArray = (obj: any) => {
    return (Array.isArray(obj)) ? obj : Array(obj);
}

const rangeUpdate = (e: TextEditor, d: vscode.TextDocument, index: number) => {
    if (index === -1) {
        return new Range(d.positionAt(0), d.lineAt(d.lineCount - 1).range.end)
    } else {
        let sel = e.selections[index];
        return new Range(sel.start, sel.end);
    }
}

const normalizeLineEndings = (str: string) => {
    return str.replace(new RegExp(/\r\n/, 'g'), '\n');
}

const applyReplacement = (originalText: string, replacement: Replacement) => {
    let normalizedOriginal = normalizeLineEndings(originalText);
    let normalizedUpdated = normalizedOriginal.replace(replacement.find, replacement.replace);

    if (normalizedUpdated === normalizedOriginal) {
        return undefined;
    }

    return /\r\n/.test(originalText)
        ? normalizedUpdated.replace(new RegExp(/\n/, 'g'), '\r\n')
        : normalizedUpdated;
}

type ExternalReplaceRulesConfig = {
    rules?: any;
    rulesets?: any;
}

const loadExternalConfig = (configPath: string, documentUri: vscode.Uri): ExternalReplaceRulesConfig => {
    let resolvedPath = resolveConfigPath(configPath, documentUri);
    let rawText = fs.readFileSync(resolvedPath, 'utf8');
    let parsed = JSON.parse(rawText);

    return {
        rules: parsed.rules,
        rulesets: parsed.rulesets
    };
}

const resolveConfigPath = (configPath: string, documentUri: vscode.Uri) => {
    let expandedPath = configPath.startsWith('~/')
        ? path.join(os.homedir(), configPath.slice(2))
        : configPath;

    if (path.isAbsolute(expandedPath)) {
        return expandedPath;
    }

    let workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
    if (workspaceFolder) {
        return path.resolve(workspaceFolder.uri.fsPath, expandedPath);
    }

    return path.resolve(expandedPath);
}

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping
function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
