import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse as parseJsonc, ParseError, printParseErrorCode } from 'jsonc-parser';

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
        let postProcessContext = getPostProcessContext(e);
        let editOptions = { undoStopBefore: false, undoStopAfter: false };
        let numSelections = e.selections.length;
        for (const x of Array(numSelections).keys()) {
            let sel = e.selections[x];
            let index = (numSelections === 1 && sel.isEmpty) ? -1 : x;
            let range = rangeUpdate(e, d, index);
            for (const r of rule.steps) {
                let findText = d.getText(range);
                let updatedText = applyReplacement(findText, r, postProcessContext);
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
    public post: PostProcessor[];

    public constructor(find: string, replace: string, flags: string, post: PostProcessor[], literal = false) {
        if (flags) {
            flags = (flags.search('g') === -1) ? flags + 'g' : flags;
        }
        find = literal ? escapeRegExp(find) : find;
        this.find = new RegExp(find, flags || Replacement.defaultFlags);
        this.replace = replace || '';
        this.post = post;
    }
}

class ReplaceRule {
    public steps: Replacement[];

    public constructor(rule: any) {
        let ruleSteps: Replacement[] = [];
        let find = objToArray(rule.find);
        let posts = resolvePostProcessorSteps(rule.post, find.length);
        for (let i = 0; i < find.length; i++) {
            ruleSteps.push(new Replacement(find[i], objToArray(rule.replace)[i], objToArray(rule.flags)[i], posts[i], rule.literal));
        }
        this.steps = ruleSteps;
    }

    public appendRule(newRule: any) {
        let find = objToArray(newRule.find);
        let posts = resolvePostProcessorSteps(newRule.post, find.length);
        for (let i = 0; i < find.length; i++) {
            this.steps.push(new Replacement(find[i], objToArray(newRule.replace)[i], objToArray(newRule.flags)[i], posts[i], newRule.literal));
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

type PostProcessor = ExpandTabPostProcessor | TrimWhitespacePostProcessor;

type ExpandTabPostProcessor = {
    type: 'expandTab';
    tabSize?: number;
};

type TrimWhitespacePostProcessor = {
    type: 'trimWhitespace';
};

type RawPostProcessor = string | {
    type: string;
    tabSize?: number;
};

type PostProcessContext = {
    tabSize: number;
};

const applyReplacement = (originalText: string, replacement: Replacement, context: PostProcessContext) => {
    let normalizedOriginal = normalizeLineEndings(originalText);
    let normalizedUpdated = normalizedOriginal.replace(replacement.find, (...args: ReplacementCallbackArg[]) => {
        let { match, captures, offset, input, groups } = parseReplacementCallbackArgs(args);
        let updatedMatch = expandReplacementString(
            replacement.replace,
            match,
            captures,
            offset,
            input,
            groups
        );

        return applyPostProcessors(updatedMatch, replacement.post, context);
    });

    if (normalizedUpdated === normalizedOriginal) {
        return undefined;
    }

    return /\r\n/.test(originalText)
        ? normalizedUpdated.replace(new RegExp(/\n/, 'g'), '\r\n')
        : normalizedUpdated;
}

type ReplacementCallbackArg = string | undefined | number | NamedGroupMap;

type NamedGroupMap = Record<string, string | undefined>;

const getPostProcessContext = (editor: TextEditor): PostProcessContext => {
    let tabSizeOption = editor.options.tabSize;
    return {
        tabSize: typeof tabSizeOption === 'number' && tabSizeOption > 0 ? tabSizeOption : 4
    };
}

const isNamedGroupMap = (value: unknown): value is NamedGroupMap => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const parseReplacementCallbackArgs = (args: ReplacementCallbackArg[]) => {
    if (args.length < 3) {
        throw new Error('Unexpected replacement callback arguments');
    }

    let groups = undefined;
    let argsWithoutGroups = args;
    let lastArg = args[args.length - 1];
    if (isNamedGroupMap(lastArg)) {
        groups = lastArg;
        argsWithoutGroups = args.slice(0, -1);
    }

    let input = argsWithoutGroups[argsWithoutGroups.length - 1];
    let offset = argsWithoutGroups[argsWithoutGroups.length - 2];
    let captures = argsWithoutGroups.slice(1, -2);

    if (typeof argsWithoutGroups[0] !== 'string' || typeof offset !== 'number' || typeof input !== 'string') {
        throw new Error('Unexpected replacement callback argument types');
    }

    return {
        match: argsWithoutGroups[0],
        captures: captures.map((capture) => {
            if (capture === undefined || typeof capture === 'string') {
                return capture;
            }
            throw new Error('Unexpected capture type in replacement callback');
        }),
        offset,
        input,
        groups
    };
}

const expandReplacementString = (
    template: string,
    match: string,
    captures: Array<string | undefined>,
    offset: number,
    input: string,
    groups?: NamedGroupMap
) => {
    return template.replace(/\$([$&`']|[1-9][0-9]?|<[^>]+>)/g, (token, specifier: string) => {
        switch (specifier) {
            case '$':
                return '$';
            case '&':
                return match;
            case '`':
                return input.slice(0, offset);
            case '\'':
                return input.slice(offset + match.length);
            default:
                if (specifier.startsWith('<') && specifier.endsWith('>')) {
                    let groupName = specifier.slice(1, -1);
                    return groups && Object.prototype.hasOwnProperty.call(groups, groupName)
                        ? groups[groupName] || ''
                        : token;
                }

                return resolveIndexedCapture(specifier, captures, token);
        }
    });
}

const resolveIndexedCapture = (specifier: string, captures: Array<string | undefined>, token: string) => {
    if (specifier.length === 2) {
        let twoDigitIndex = Number(specifier);
        if (twoDigitIndex <= captures.length) {
            return captures[twoDigitIndex - 1] || '';
        }

        let oneDigitIndex = Number(specifier[0]);
        if (oneDigitIndex <= captures.length) {
            return (captures[oneDigitIndex - 1] || '') + specifier[1];
        }
    }

    let captureIndex = Number(specifier);
    return captureIndex <= captures.length
        ? captures[captureIndex - 1] || ''
        : token;
}

const applyPostProcessors = (value: string, processors: PostProcessor[], context: PostProcessContext) => {
    return processors.reduce((updatedValue, processor) => applyPostProcessor(updatedValue, processor, context), value);
}

const applyPostProcessor = (value: string, processor: PostProcessor, context: PostProcessContext) => {
    switch (processor.type) {
        case 'expandTab':
            return value.replace(/\t/g, ' '.repeat(processor.tabSize || context.tabSize));
        case 'trimWhitespace':
            return value.replace(/[ \t]+(?=\n|$)/g, '');
    }
}

const resolvePostProcessorSteps = (rawPost: unknown, stepCount: number) => {
    if (rawPost === undefined) {
        return Array.from({ length: stepCount }, () => []);
    }

    if (stepCount === 1) {
        return [normalizePostProcessors(rawPost)];
    }

    if (!Array.isArray(rawPost) || rawPost.every(isRawPostProcessor)) {
        let sharedProcessors = normalizePostProcessors(rawPost);
        return Array.from({ length: stepCount }, () => sharedProcessors.slice());
    }

    if (rawPost.length !== stepCount) {
        throw new Error(`Rule post array length ${rawPost.length} does not match find length ${stepCount}`);
    }

    return rawPost.map(normalizePostProcessors);
}

const normalizePostProcessors = (rawPost: unknown) => {
    if (rawPost === undefined) {
        return [];
    }

    if (Array.isArray(rawPost)) {
        return rawPost.map(parsePostProcessor);
    }

    return [parsePostProcessor(rawPost)];
}

const isRawPostProcessor = (value: unknown): value is RawPostProcessor => {
    if (typeof value === 'string') {
        return true;
    }

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }

    return typeof (value as { type?: unknown }).type === 'string';
}

const parsePostProcessor = (rawProcessor: unknown): PostProcessor => {
    if (rawProcessor === 'expandTab' || rawProcessor === 'expandTabs') {
        return { type: 'expandTab' };
    }

    if (rawProcessor === 'trimWhitespace') {
        return { type: 'trimWhitespace' };
    }

    if (!isRawPostProcessor(rawProcessor) || typeof rawProcessor === 'string') {
        throw new Error(`Unsupported post processor: ${JSON.stringify(rawProcessor)}`);
    }

    if (rawProcessor.type === 'expandTab' || rawProcessor.type === 'expandTabs') {
        if (rawProcessor.tabSize !== undefined && (!Number.isInteger(rawProcessor.tabSize) || rawProcessor.tabSize <= 0)) {
            throw new Error(`Invalid expandTab tabSize: ${rawProcessor.tabSize}`);
        }

        return {
            type: 'expandTab',
            tabSize: rawProcessor.tabSize
        };
    }

    if (rawProcessor.type === 'trimWhitespace') {
        return { type: 'trimWhitespace' };
    }

    throw new Error(`Unsupported post processor type: ${rawProcessor.type}`);
}

type ExternalReplaceRulesConfig = {
    rules?: any;
    rulesets?: any;
}

const loadExternalConfig = (configPath: string, documentUri: vscode.Uri): ExternalReplaceRulesConfig => {
    let resolvedPath = resolveConfigPath(configPath, documentUri);
    let rawText = fs.readFileSync(resolvedPath, 'utf8');
    let parsed = parseExternalConfig(rawText, resolvedPath);

    return {
        rules: parsed.rules,
        rulesets: parsed.rulesets
    };
}

const parseExternalConfig = (rawText: string, resolvedPath: string): ExternalReplaceRulesConfig => {
    let parseErrors: ParseError[] = [];
    let parsed = parseJsonc(rawText, parseErrors, {
        allowTrailingComma: true,
        disallowComments: false
    }) as unknown;

    if (parseErrors.length > 0) {
        let firstError = parseErrors[0];
        throw new Error(
            `Invalid JSONC in ${resolvedPath}: ${printParseErrorCode(firstError.error)} at offset ${firstError.offset}`
        );
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error(`Config root must be a JSON object in ${resolvedPath}`);
    }

    let parsedConfig = parsed as ExternalReplaceRulesConfig;

    return {
        rules: parsedConfig.rules,
        rulesets: parsedConfig.rulesets
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
