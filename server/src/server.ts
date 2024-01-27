import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    TextDocumentSyncKind,
    InitializeResult,
    CompletionParams,
    CancellationToken,
    WorkDoneProgressReporter,
    CompletionList,
    TextDocumentChangeEvent,
    CompletionItem,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams) => {
    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {}
        },
    };

    return result;
});

const variablesByDocument = new Map<string, CompletionItem[]>();

documents.onDidChangeContent((e: TextDocumentChangeEvent<TextDocument>) => {
    const key = e.document.uri;
    const source = e.document.getText();
    const variables = [...source.matchAll(/^[\$\*][A-Za-z]+\w*/g)]
        .map(m => m[0])
        .flatMap(v => v.startsWith("*") ? [v.replace('*', '&'), v] : [v])
        .map(v => ({ label: v } as CompletionItem));
    variablesByDocument.set(key, variables);
});

const keywords = "end|nop|mov|swp|jmp|slp|slx|gen|add|sub|mul|div|not|cst|inc|dec|dgt|dst|teq|tgt|tlt|tcp"
    .split('|')
    .map(it => ({ label: it } as CompletionItem));
const registers = "null|acc|clk|stdin|stdout|stderr|gfx|wsz|hsz|xsz|ysz|&pxl|*pxl|kb0"
    .split('|')
    .map(it => ({ label: it } as CompletionItem));

connection.onCompletion((
    params: CompletionParams, 
    _token: CancellationToken, 
    _: WorkDoneProgressReporter) => {
        const doc = documents.get(params.textDocument.uri)!;
        const pos = params.position;
        const lines = doc.getText().split("\n");
        const line = lines[pos.line];
        const untilCursor = line.slice(0, pos.character);
        const untilIsBlank = untilCursor.trim() === '';
        const prefix = untilCursor.replace(/.*\W(.*?)/, "$1");
        if (untilIsBlank) {
            return CompletionList.create(
                keywords.filter(it => it.label.startsWith(prefix)), 
                false
            );
        }
        const predicate = (it: CompletionItem) => it.label.startsWith(prefix);
        const relevant = (variablesByDocument
            .get(doc.uri) ?? [])
            .filter(predicate)
            .concat(registers.filter(predicate));
        return CompletionList.create(
            relevant,
            false
        );
})

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
