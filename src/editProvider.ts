import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse as parseJsonc, ParseError, printParseErrorCode } from 'jsonc-parser';

import { Range, TextEditor } from 'vscode';
import Window = vscode.window;

type RuleDefinition = RegexReplaceRule | LiteralMapRule;

type RegexReplaceRule = {
    type: 'regexReplace';
    name?: string;
    description?: string;
    language?: string[];
    post: PostProcessor[];
    steps: RegexReplaceStep[];
};

type LiteralMapRule = {
    type: 'literalMap';
    name?: string;
    description?: string;
    language?: string[];
    post: PostProcessor[];
    steps: [LiteralMapStep];
};

type RegexReplaceStep = {
    kind: 'regexReplace';
    find: RegExp;
    replace: string;
    post: PostProcessor[];
};

type LiteralMapStep = {
    kind: 'literalMap';
    find: RegExp;
    replacements: Record<string, string>;
    post: PostProcessor[];
};

type ExecutionStep = RegexReplaceStep | LiteralMapStep;

type RulePipeline = {
    name?: string;
    description?: string;
    rules: string[];
};

type TextReplaceRuleConfig = {
    rules: Record<string, RuleDefinition>;
    rulePipelines: Record<string, RulePipeline>;
};

type RawRuleDefinition = {
    type?: unknown;
    name?: unknown;
    description?: unknown;
    find?: unknown;
    replace?: unknown;
    flag?: unknown;
    flags?: unknown;
    language?: unknown;
    languages?: unknown;
    literal?: unknown;
    map?: unknown;
    post?: unknown;
};

type RawRulePipeline = {
    name?: unknown;
    description?: unknown;
    rules?: unknown;
};

type RawTextReplaceRuleConfig = {
    rules?: unknown;
    rulePipelines?: unknown;
    rulesets?: unknown;
};

type PostProcessor = {
    type: 'expandTab';
};

type PostProcessContext = {
    tabSize: number;
};

type ReplacementCallbackArg = string | undefined | number | NamedGroupMap;

type NamedGroupMap = Record<string, string | undefined>;

type PendingEdit = {
    range: Range;
    text: string;
};

type ReplaceTarget = {
    range: Range;
    startOffset: number;
};

type QuickPickEntry = vscode.QuickPickItem & {
    key: string;
};

export default class TextReplaceRuleEditProvider {
    private textEditor: TextEditor;
    private config: TextReplaceRuleConfig;

    public async pickRuleAndRun() {
        let rules = this.getQPRules();
        let qpItem = await vscode.window.showQuickPick(rules);
        if (qpItem) {
            await this.runSingleRule(qpItem.key);
        }
    }

    public async pickRulePipelineAndRun() {
        let rulePipelines = this.getQPRulePipelines();
        let qpItem = await vscode.window.showQuickPick(rulePipelines);
        if (qpItem) {
            await this.runRulePipeline(qpItem.key);
        }
    }

    private getQPRules(): QuickPickEntry[] {
        let languageId = this.textEditor.document.languageId;
        let items = [];
        for (const ruleName in this.config.rules) {
            let rule = this.config.rules[ruleName];
            if (!ruleMatchesLanguage(rule, languageId)) {
                continue;
            }
            items.push({
                label: rule.name || ruleName,
                description: rule.description || "",
                detail: rule.name && rule.name !== ruleName ? `Key: ${ruleName}` : "",
                key: ruleName
            });
        }
        return items;
    }

    private getQPRulePipelines(): QuickPickEntry[] {
        let items = [];
        for (const rulePipelineName in this.config.rulePipelines) {
            let rulePipeline = this.config.rulePipelines[rulePipelineName];
            items.push({
                label: rulePipeline.name || rulePipelineName,
                description: rulePipeline.description || "",
                detail: rulePipeline.name && rulePipeline.name !== rulePipelineName ? `Key: ${rulePipelineName}` : "",
                key: rulePipelineName
            });
        }
        return items;
    }

    public async runSingleRule(ruleName: string) {
        let rule = this.config.rules[ruleName];
        if (!rule) {
            return;
        }

        if (!ruleMatchesLanguage(rule, this.textEditor.document.languageId)) {
            return;
        }

        try {
            await this.doReplace(rule.steps);
        } catch (err: any) {
            Window.showErrorMessage('Error executing rule ' + ruleName + ': ' + err.message);
        }
    }

    public async runRulePipeline(rulePipelineName: string) {
        let rulePipeline = this.config.rulePipelines[rulePipelineName];
        if (!rulePipeline) {
            return;
        }

        let languageId = this.textEditor.document.languageId;
        let steps: ExecutionStep[] = [];
        for (const ruleName of rulePipeline.rules) {
            let rule = this.config.rules[ruleName];
            if (ruleMatchesLanguage(rule, languageId)) {
                steps.push(...rule.steps);
            }
        }

        if (steps.length === 0) {
            return;
        }

        try {
            await this.doReplace(steps);
        } catch (err: any) {
            Window.showErrorMessage('Error executing rule pipeline ' + rulePipelineName + ': ' + err.message);
        }
    }

    private async doReplace(steps: ExecutionStep[]) {
        let editor = this.textEditor;
        let document = editor.document;
        let context = getPostProcessContext(editor);
        let targets = getReplaceTargets(editor, document);
        let edits: PendingEdit[] = [];

        for (const target of targets) {
            let originalText = document.getText(target.range);
            let updatedText = applySteps(originalText, steps, context);
            if (updatedText !== originalText) {
                edits.push({
                    range: target.range,
                    text: updatedText
                });
            }
        }

        if (edits.length === 0) {
            return;
        }

        edits.sort((left, right) => {
            let leftOffset = document.offsetAt(left.range.start);
            let rightOffset = document.offsetAt(right.range.start);
            return rightOffset - leftOffset;
        });

        await editor.edit((editBuilder) => {
            edits.forEach((edit) => {
                editBuilder.replace(edit.range, edit.text);
            });
        }, { undoStopBefore: false, undoStopAfter: false });
    }

    constructor(textEditor: TextEditor) {
        this.textEditor = textEditor;
        let config = vscode.workspace.getConfiguration("textReplaceRule");
        let configPath = config.get<string>("configPath");

        if (configPath) {
            try {
                this.config = loadExternalConfig(configPath, textEditor.document.uri);
                return;
            } catch (err: any) {
                Window.showErrorMessage('Error loading textReplaceRule.configPath: ' + err.message);
            }
        }

        this.config = {
            rules: {},
            rulePipelines: {}
        };
    }
}

const ruleMatchesLanguage = (rule: RuleDefinition, languageId: string) => {
    return !Array.isArray(rule.language) || rule.language.indexOf(languageId) !== -1;
}

const getReplaceTargets = (editor: TextEditor, document: vscode.TextDocument): ReplaceTarget[] => {
    if (editor.selections.length === 1 && editor.selections[0].isEmpty) {
        let fullDocumentRange = new Range(document.positionAt(0), document.positionAt(document.getText().length));
        return [{
            range: fullDocumentRange,
            startOffset: 0
        }];
    }

    return editor.selections.map((selection) => ({
        range: new Range(selection.start, selection.end),
        startOffset: document.offsetAt(selection.start)
    })).sort((left, right) => right.startOffset - left.startOffset);
}

const applySteps = (originalText: string, steps: ExecutionStep[], context: PostProcessContext) => {
    let updatedText = originalText;
    for (const step of steps) {
        updatedText = applyStep(updatedText, step, context);
    }
    return updatedText;
}

const applyStep = (originalText: string, step: ExecutionStep, context: PostProcessContext) => {
    let normalizedOriginal = normalizeLineEndings(originalText);
    let normalizedUpdated = step.kind === 'regexReplace'
        ? applyRegexReplaceStep(normalizedOriginal, step, context)
        : applyLiteralMapStep(normalizedOriginal, step, context);

    if (normalizedUpdated === normalizedOriginal) {
        return originalText;
    }

    return restoreLineEndings(originalText, normalizedUpdated);
}

const applyRegexReplaceStep = (originalText: string, step: RegexReplaceStep, context: PostProcessContext) => {
    return originalText.replace(step.find, (...args: ReplacementCallbackArg[]) => {
        let { match, captures, offset, input, groups } = parseReplacementCallbackArgs(args);
        let updatedMatch = expandReplacementString(step.replace, match, captures, offset, input, groups);
        return applyPostProcessors(updatedMatch, step.post, context);
    });
}

const applyLiteralMapStep = (originalText: string, step: LiteralMapStep, context: PostProcessContext) => {
    return originalText.replace(step.find, (match) => {
        return applyPostProcessors(step.replacements[match], step.post, context);
    });
}

const normalizeLineEndings = (str: string) => {
    return str.replace(new RegExp(/\r\n/, 'g'), '\n');
}

const restoreLineEndings = (originalText: string, updatedText: string) => {
    return /\r\n/.test(originalText)
        ? updatedText.replace(new RegExp(/\n/, 'g'), '\r\n')
        : updatedText;
}

const getPostProcessContext = (editor: TextEditor): PostProcessContext => {
    let tabSizeOption = editor.options.tabSize;
    return {
        tabSize: typeof tabSizeOption === 'number' && tabSizeOption > 0 ? tabSizeOption : 4
    };
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

const isNamedGroupMap = (value: unknown): value is NamedGroupMap => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
            return value.replace(/\t/g, ' '.repeat(context.tabSize));
    }
}

const loadExternalConfig = (configPath: string, documentUri: vscode.Uri): TextReplaceRuleConfig => {
    let resolvedPath = resolveConfigPath(configPath, documentUri);
    let rawText = fs.readFileSync(resolvedPath, 'utf8');
    return parseExternalConfig(rawText, resolvedPath);
}

const parseExternalConfig = (rawText: string, resolvedPath: string): TextReplaceRuleConfig => {
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

    let rawConfig = parsed as RawTextReplaceRuleConfig;
    if (rawConfig.rulesets !== undefined) {
        throw new Error(`Use "rulePipelines" instead of "rulesets" in ${resolvedPath}`);
    }

    let rules = parseRules(rawConfig.rules);
    let rulePipelines = parseRulePipelines(rawConfig.rulePipelines);

    validateRulePipelineReferences(rulePipelines, rules);

    return {
        rules,
        rulePipelines
    };
}

const parseRules = (rawRules: unknown) => {
    if (rawRules === undefined) {
        return {};
    }

    if (typeof rawRules !== 'object' || rawRules === null || Array.isArray(rawRules)) {
        throw new Error('Config field "rules" must be a JSON object');
    }

    let parsedRules: Record<string, RuleDefinition> = {};
    for (const [ruleName, rawRule] of Object.entries(rawRules)) {
        parsedRules[ruleName] = parseRuleDefinition(ruleName, rawRule);
    }
    return parsedRules;
}

const parseRulePipelines = (rawRulePipelines: unknown) => {
    if (rawRulePipelines === undefined) {
        return {};
    }

    if (typeof rawRulePipelines !== 'object' || rawRulePipelines === null || Array.isArray(rawRulePipelines)) {
        throw new Error('Config field "rulePipelines" must be a JSON object');
    }

    let parsedRulePipelines: Record<string, RulePipeline> = {};
    for (const [rulePipelineName, rawRulePipeline] of Object.entries(rawRulePipelines)) {
        parsedRulePipelines[rulePipelineName] = parseRulePipeline(rulePipelineName, rawRulePipeline);
    }
    return parsedRulePipelines;
}

const parseRuleDefinition = (ruleName: string, rawRule: unknown): RuleDefinition => {
    if (typeof rawRule !== 'object' || rawRule === null || Array.isArray(rawRule)) {
        throw new Error(`Rule ${ruleName} must be a JSON object`);
    }

    let rule = rawRule as RawRuleDefinition;
    rejectLegacyRuleFields(ruleName, rule);

    if (rule.type !== 'regexReplace' && rule.type !== 'literalMap') {
        throw new Error(`Rule ${ruleName} has unsupported type: ${JSON.stringify(rule.type)}`);
    }

    let language = parseLanguage(ruleName, rule.language);
    let name = parseOptionalString(ruleName, 'name', rule.name);
    let description = parseOptionalString(ruleName, 'description', rule.description);
    let post = parsePostProcessors(ruleName, rule.post);

    switch (rule.type) {
        case 'regexReplace':
            return parseRegexReplaceRule(ruleName, rule, name, description, language, post);
        case 'literalMap':
            return parseLiteralMapRule(ruleName, rule, name, description, language, post);
    }
}

const rejectLegacyRuleFields = (ruleName: string, rule: RawRuleDefinition) => {
    if (rule.literal !== undefined) {
        throw new Error(`Rule ${ruleName} uses unsupported field "literal"`);
    }
    if (rule.flags !== undefined) {
        throw new Error(`Rule ${ruleName} uses unsupported field "flags"; use "flag"`);
    }
    if (rule.languages !== undefined) {
        throw new Error(`Rule ${ruleName} uses unsupported field "languages"; use "language"`);
    }
}

const parseLanguage = (ruleName: string, rawLanguage: unknown) => {
    if (rawLanguage === undefined) {
        return undefined;
    }

    if (!Array.isArray(rawLanguage) || rawLanguage.some((entry) => typeof entry !== 'string')) {
        throw new Error(`Rule ${ruleName} field "language" must be an array of language ids`);
    }

    return rawLanguage.slice();
}

const parseOptionalString = (ownerName: string, fieldName: string, value: unknown) => {
    if (value === undefined) {
        return undefined;
    }

    if (typeof value !== 'string') {
        throw new Error(`${ownerName} field "${fieldName}" must be a string`);
    }

    return value;
}

const parsePostProcessors = (ruleName: string, rawPost: unknown): PostProcessor[] => {
    if (rawPost === undefined) {
        return [];
    }

    if (!Array.isArray(rawPost) || rawPost.length !== 1 || rawPost[0] !== 'expandTab') {
        throw new Error(`Rule ${ruleName} field "post" only supports ["expandTab"]`);
    }

    return [{ type: 'expandTab' }];
}

const parseRegexReplaceRule = (
    ruleName: string,
    rule: RawRuleDefinition,
    name: string | undefined,
    description: string | undefined,
    language: string[] | undefined,
    post: PostProcessor[]
): RegexReplaceRule => {
    if (rule.map !== undefined) {
        throw new Error(`Rule ${ruleName} of type "regexReplace" cannot define "map"`);
    }

    let finds = normalizeStringField(ruleName, 'find', rule.find, false);
    let replacements = normalizeStepField(ruleName, 'replace', rule.replace, finds.length, '');
    let flags = normalizeStepField(ruleName, 'flag', rule.flag, finds.length, undefined);

    let steps = finds.map((find, index) => ({
        kind: 'regexReplace' as const,
        find: new RegExp(find, normalizeFlag(flags[index])),
        replace: replacements[index] || '',
        post
    }));

    return {
        type: 'regexReplace',
        name,
        description,
        language,
        post,
        steps
    };
}

const parseLiteralMapRule = (
    ruleName: string,
    rule: RawRuleDefinition,
    name: string | undefined,
    description: string | undefined,
    language: string[] | undefined,
    post: PostProcessor[]
): LiteralMapRule => {
    if (rule.find !== undefined || rule.replace !== undefined || rule.flag !== undefined) {
        throw new Error(`Rule ${ruleName} of type "literalMap" cannot define "find", "replace", or "flag"`);
    }

    if (typeof rule.map !== 'object' || rule.map === null || Array.isArray(rule.map)) {
        throw new Error(`Rule ${ruleName} field "map" must be a JSON object`);
    }

    let entries = Object.entries(rule.map);
    if (entries.length === 0) {
        throw new Error(`Rule ${ruleName} field "map" must not be empty`);
    }

    let replacements: Record<string, string> = {};
    let keys: string[] = [];
    for (const [key, value] of entries) {
        if (key.length === 0) {
            throw new Error(`Rule ${ruleName} field "map" cannot contain an empty key`);
        }
        if (typeof value !== 'string') {
            throw new Error(`Rule ${ruleName} map value for ${JSON.stringify(key)} must be a string`);
        }
        keys.push(key);
        replacements[key] = value;
    }

    validateLiteralMapKeys(ruleName, keys);

    let matcher = new RegExp(keys.map(escapeRegExp).join('|'), 'g');

    return {
        type: 'literalMap',
        name,
        description,
        language,
        post,
        steps: [{
            kind: 'literalMap',
            find: matcher,
            replacements,
            post
        }]
    };
}

const normalizeStringField = (ruleName: string, fieldName: string, value: unknown, allowUndefined: boolean) => {
    if (value === undefined) {
        if (allowUndefined) {
            return [];
        }
        throw new Error(`Rule ${ruleName} field "${fieldName}" is required`);
    }

    if (typeof value === 'string') {
        return [value];
    }

    if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string')) {
        throw new Error(`Rule ${ruleName} field "${fieldName}" must be a string or non-empty string array`);
    }

    return value.slice();
}

const normalizeStepField = <T extends string | undefined>(
    ruleName: string,
    fieldName: string,
    value: unknown,
    stepCount: number,
    defaultValue: T
) => {
    if (value === undefined) {
        return Array.from({ length: stepCount }, () => defaultValue);
    }

    if (typeof value === 'string') {
        return Array.from({ length: stepCount }, () => value as T extends string ? string : T);
    }

    if (!Array.isArray(value) || value.length !== stepCount || value.some((entry) => typeof entry !== 'string')) {
        throw new Error(`Rule ${ruleName} field "${fieldName}" must be a string or a string array with ${stepCount} entries`);
    }

    return value.slice() as Array<T extends string ? string : T>;
}

const normalizeFlag = (flag: string | undefined) => {
    if (!flag) {
        return 'gm';
    }
    return flag.indexOf('g') === -1 ? flag + 'g' : flag;
}

const parseRulePipeline = (rulePipelineName: string, rawRulePipeline: unknown): RulePipeline => {
    if (typeof rawRulePipeline !== 'object' || rawRulePipeline === null || Array.isArray(rawRulePipeline)) {
        throw new Error(`Rule pipeline ${rulePipelineName} must be a JSON object`);
    }

    let rulePipeline = rawRulePipeline as RawRulePipeline;
    if (!Array.isArray(rulePipeline.rules) || rulePipeline.rules.some((ruleName) => typeof ruleName !== 'string')) {
        throw new Error(`Rule pipeline ${rulePipelineName} field "rules" must be an array of rule names`);
    }

    return {
        name: parseOptionalString(rulePipelineName, 'name', rulePipeline.name),
        description: parseOptionalString(rulePipelineName, 'description', rulePipeline.description),
        rules: rulePipeline.rules.slice()
    };
}

const validateRulePipelineReferences = (
    rulePipelines: Record<string, RulePipeline>,
    rules: Record<string, RuleDefinition>
) => {
    for (const [rulePipelineName, rulePipeline] of Object.entries(rulePipelines)) {
        for (const ruleName of rulePipeline.rules) {
            if (!Object.prototype.hasOwnProperty.call(rules, ruleName)) {
                throw new Error(`Rule pipeline ${rulePipelineName} references missing rule ${JSON.stringify(ruleName)}`);
            }
        }
    }
}

const validateLiteralMapKeys = (ruleName: string, keys: string[]) => {
    let sortedKeys = keys.slice().sort((left, right) => left.length - right.length || left.localeCompare(right));
    for (let i = 0; i < sortedKeys.length; i++) {
        for (let j = i + 1; j < sortedKeys.length; j++) {
            if (sortedKeys[j].startsWith(sortedKeys[i])) {
                throw new Error(
                    `Rule ${ruleName} has ambiguous literal map keys ${JSON.stringify(sortedKeys[i])} and ${JSON.stringify(sortedKeys[j])}`
                );
            }
        }
    }
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

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
