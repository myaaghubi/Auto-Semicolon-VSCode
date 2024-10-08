/* eslint-disable curly */
import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
	devMode = context.extensionMode === vscode.ExtensionMode.Development;

	let semicolonAtPosition = vscode.commands.registerTextEditorCommand('auto-semicolon-vscode.position-insert-semicolon',
		(editor: vscode.TextEditor, textEdit: vscode.TextEditorEdit) => {
			return semicolonCommand(editor, textEdit);
		}
	);

	let autoSemicolon = vscode.commands.registerTextEditorCommand('auto-semicolon-vscode.auto-insert-semicolon',
		(editor: vscode.TextEditor, textEdit: vscode.TextEditorEdit) => {
			return autoSemicolonCommand(editor, textEdit, false);
		}
	);

	// auto put the semicolon (ignore the {}) at the end 
	let autoSemicolonFTE = vscode.commands.registerTextEditorCommand('auto-semicolon-vscode.auto-insert-semicolon-fte',
		(editor: vscode.TextEditor, textEdit: vscode.TextEditorEdit) => {
			return autoSemicolonCommand(editor, textEdit, true);
		}
	);

	context.subscriptions.push(semicolonAtPosition);
	context.subscriptions.push(autoSemicolon);
	context.subscriptions.push(autoSemicolonFTE);

	await taskChecker(context);
}

export function deactivate() { }

type RegExpMatchArrayWithIndex = RegExpMatchArray & { index: number };

// these variables will fill later
let devMode = false;
let autoSemicolonFormatsIncluded = true;
let autoMoveFormatsIncluded = false;
let commentDelimiter = '//';
let commentDelimiterIndex = -1;


type StringDictionary = {
	[key: string]: string;
};

const languagesDelimiter: StringDictionary = {
	"dotenv": '#',
	"dockerfile": '#',
	"snippets": '#',
	"python": '#',
	"ruby": '#',
	"perl": '#',
	"bash": '#',
	"shellscript": '#',
	"r": '#',
	"julia": '#',
	"coffeescript": '#',
	"ini": ';',
	"bat": ':',
	"sql": '%',
	"tex": '%',
};

function getConfig() {
	return vscode.workspace.getConfiguration('autoSemicolon');
}

function isQuotesIgnored() {
	return getConfig().supportedLanguageId.ignores.quotes;
}

function isForStatementIgnored() {
	return getConfig().supportedLanguageId.ignores.theForStatement;
}

function isUnallowedEndsIncluded(lineText: string) {
	let lastCharacter = lineText[lineText.length - 1];

	let unallowedEnds = getConfig().autoInsertSemicolon.unallowedEnds.split(",");

	if (!Array.isArray(unallowedEnds))
		return false;

	return unallowedEnds.includes(lastCharacter);
}

function isAutoSemicolonLanguageIdIncluded(languageId: string | undefined) {
	if (!languageId)
		return false;

	let formats = getConfig().supportedLanguageId.autoInsertSemicolon.split(",");
	if (!Array.isArray(formats))
		return false;

	for (const item of formats) {
		if (item.trim() == languageId)
			return true;
	}
	return false;
}

function isAutoMoveLanguageIdIncluded(languageId: string | null | undefined) {
	if (isEmpty(languageId) || !getConfig().supportedLanguageId.autoMoveEnable)
		return false;

	let formats = getConfig().supportedLanguageId.autoMoveFormats.split(",");
	if (!Array.isArray(formats))
		return false;

	for (const item of formats) {
		if (item.trim() == languageId)
			return true;
	}

	return false;
}

function semicolonCommand(editor: vscode.TextEditor, textEdit: vscode.TextEditorEdit) {
	editor.edit((edit: vscode.TextEditorEdit) => {
		for (let selection of editor.selections) {
			edit.insert(selection.active, ';');
		}
	});
}

function autoSemicolonCommand(editor: vscode.TextEditor, textEdit: vscode.TextEditorEdit, forceToEnd: boolean) {
	const selections: vscode.Selection[] = [];
	const languageId = vscode.window.activeTextEditor?.document.languageId;

	autoSemicolonFormatsIncluded = isAutoSemicolonLanguageIdIncluded(languageId);
	autoMoveFormatsIncluded = isAutoMoveLanguageIdIncluded(languageId);
	commentDelimiter = getCommentDelimiter(languageId);

	editor.edit(() => {
		try {
			editor.selections.forEach((selection) => {
				try {
					const line = editor.document.lineAt(selection.active.line);
					const lineText = line.text.trimEnd();
					const currentPos = selection.active.character;
					let position: vscode.Position;
					let match;

					commentDelimiterIndex = indexTagOutOfQuotes(lineText, commentDelimiter);
					position = newPosition(line, selection.active.character + 1);

					if (lineText.length === 0 || !languageId) {
						textEdit.insert(selection.active, ';');

					} else if (!autoSemicolonFormatsIncluded && !autoMoveFormatsIncluded) {
						textEdit.insert(selection.active, ';');

					} else if (!forceToEnd && commentDelimiterIndex >= 0 && commentDelimiterIndex < currentPos) {
						textEdit.insert(selection.active, ';');

					} else if (!forceToEnd && isQuotesIgnored() && isInStringLiteral(lineText, currentPos)) {
						textEdit.insert(selection.active, ';');

					} else if (!forceToEnd && isForStatementIgnored() && (match = findTheForStatement(lineText, currentPos)) !== null) {
						// each for(;;) statement has two ";"
						if (match[1].split(";").length - 1 < 2) {
							textEdit.insert(selection.active, ';');
							position = newPosition(line, selection.active.character + 1);
						} else if (autoSemicolonFormatsIncluded) {
							let length = putSemicolonAfterPos((match as RegExpMatchArrayWithIndex).index, textEdit, selection, line, true);
							position = newPosition(line, length);
						}

					} else if (!forceToEnd && autoSemicolonFormatsIncluded) {
						let length = line.range.end.character + 1;
						if (isBetweenTags('{', '}', lineText, currentPos)) {
							length = putSemicolonBefore('}', textEdit, selection, line);
						} else if (!isUnallowedEndsIncluded(lineText) || currentPos === line.text.length) {
							length = autoSemicolonBeforeComment(textEdit, selection, line) + 1;
						}

						position = newPosition(line, length);

					} else {
						// just move to the end
						let length = line.range.end.character + 1;
						if (autoMoveFormatsIncluded) {
							length = lineText.substring(0, commentDelimiterIndex).trimEnd().length;
						}
						position = newPosition(line, length);
					}

					selection = new vscode.Selection(position, position);
					selections.push(selection);
				} catch (error: any) {
					logIt(error.message);
				}
			});
		} catch (error: any) {
			logIt(error.message);
		}
	}).then(() => {
		editor.selections = selections;
	});
}

function putSemicolonAfterPos(position: number, textEdit: vscode.TextEditorEdit, selection: vscode.Selection, line: vscode.TextLine, justMove: boolean = false): number {
	position = position >= 0 ? position : 0;
	return autoSemicolonBeforeComment(textEdit, selection, line, justMove) + 1;
}

function putSemicolonBefore(tag: string, textEdit: vscode.TextEditorEdit, selection: vscode.Selection, line: vscode.TextLine, justMove: boolean = false): number {
	let lineText = line.text.trimEnd();
	const currentPos = selection.active.character;
	const posClose = lineText.indexOf(tag, currentPos);
	let length = lineText.length;

	if (posClose >= 0) {
		const lineTextTrimmed = lineText.substring(0, posClose).trimEnd();
		length = lineTextTrimmed.length;

		if (!isUnallowedEndsIncluded(lineTextTrimmed) || currentPos === line.text.length) {
			lineText = lineText.replace(lineTextTrimmed, lineTextTrimmed + ';');
			length += 1;
			textEdit.delete(new vscode.Selection(newPosition(line, 0), newPosition(line, line.text.length)));
			textEdit.insert(newPosition(line, 0), lineText);
		}

		return length - tag.length + 1;
	}

	if (!justMove) {
		textEdit.insert(newPosition(line, length), ';');
	}
	return length;
}

function autoSemicolonBeforeComment(textEdit: vscode.TextEditorEdit, selection: vscode.Selection, line: vscode.TextLine, justMove: boolean = false): number {
	let lineText = line.text.trimEnd();
	const currentPos = selection.active.character;
	let length = lineText.length;

	if (commentDelimiterIndex >= 0) {
		const lineTextTrimmed = lineText.substring(0, commentDelimiterIndex).trimEnd();
		length = lineTextTrimmed.length;

		if (!isUnallowedEndsIncluded(lineTextTrimmed) || currentPos === length) {
			lineText = lineText.replace(lineTextTrimmed, lineTextTrimmed + ';');
			length += 1;
			textEdit.delete(new vscode.Selection(newPosition(line, 0), newPosition(line, line.text.length)));
			textEdit.insert(newPosition(line, 0), lineText);
		}

		return length - commentDelimiter.length + 1;
	}

	if (!justMove) {
		textEdit.insert(newPosition(line, length), ';');
	}
	return length;
}

function newPosition(line: vscode.TextLine, position: number): vscode.Position {
	return new vscode.Position(line.lineNumber, position);
}

function isBetweenTags(open: string, close: string, lineText: string, currentPos: number): boolean {
	const posOpen = lineText.lastIndexOf(open, currentPos);
	const posClose = lineText.indexOf(close, currentPos);
	const posClose_ = lineText.lastIndexOf(close, currentPos - 1);
	return posOpen >= 0 && posOpen < currentPos && currentPos <= posClose && posClose_ < posOpen;
}

function isBetweenTagsB(open: string, close: string, lineText: string, currentPos: number): boolean {
	const posOpen = lineText.lastIndexOf(open, currentPos);
	const posClose = lineText.indexOf(close, currentPos);

	return (
		posOpen >= 0 && // open tag exists before current position
		posOpen < currentPos && // open tag is before current position
		posClose >= currentPos // close tag is after current position
	);
}

function getCommentDelimiter(languageId: string | undefined): string {
	let delimiterDefault = '//';

	if (!languageId)
		return delimiterDefault;

	for (const key in languagesDelimiter) {
		if (key == languageId) {
			return languagesDelimiter[key];
		}
	}

	return delimiterDefault;
}

function indexTagOutOfQuotes(line: string, tag: string): number {
	const regex = new RegExp(`${commentDelimiter}(?!['"\`]\S)`, 'g');
	const matches = [];

	let match;
	while ((match = regex.exec(line)) !== null) {
		// Check the preceding characters
		const precedingChars = line.slice(0, match.index);
		const quoteCount = (precedingChars.match(/['"`]/g) || []).length;

		// If the count of quotes is even, add the match
		if (quoteCount % 2 == 0) {
			matches.push(match);
		}
	}

	if (matches.length == 0) {
		return -1;
	}

	return matches[0].index;
}

function findTheForStatement(lineText: string, currentPos: number): string[] | null {
	const regex = /for\s*\((.*)\)/g;
	let match;

	while ((match = regex.exec(lineText)) !== null) {
		if (isBetweenTagsB("(", ")", lineText, currentPos)) {
			return match;
		}
	}

	return null;
}

const stringLiteralMarks = ["'", "\"", "`"];
function isInStringLiteral(lineText: string, currentPos: number): boolean {
	let matchingQuote = null;
	let char = '';
	let i = 0;
	while (i < currentPos) {
		char = lineText.charAt(i++);

		if (stringLiteralMarks.includes(char)) {
			if (matchingQuote === null) {
				matchingQuote = char;
			} else if (matchingQuote === char) {
				matchingQuote = null;
			}
		}
	}

	// if is the cursor after an opening string literal mark
	return matchingQuote !== null;
}

function isEmpty(value: string | any[] | null | undefined): boolean {
	if (Array.isArray(value))
		return false;
	return (value == null || value.length === 0);
}

async function logIt(message: string | any | any[] | null | undefined) {
	if (devMode) {
		console.log(message);
		// vscode.window.showWarningMessage(message?.toString());
	}
}

async function taskChecker(context: vscode.ExtensionContext) {
	let runCounter = 1;
	let runCounterStr = await context.secrets.get(`runCounter`);
	if (runCounterStr) {
		runCounter = parseInt(runCounterStr) + 1;
	}
	context.secrets.store(`runCounter`, runCounter.toString());


	let commented = await context.secrets.get(`commented`);
	if (!commented || commented === undefined) {
		context.secrets.store(`commented`, '0');
	}

	if (runCounter <= 1) {
		await showSettingsCheckMessage();
		await removeOldVersionAfterMigration();
	} else if (runCounter >= 100) {
		if (commented === '0' && runCounter % 5 === 0) {
			const resp = await showRateRequestMessage(context);
			if (resp) {
				await context.secrets.store(`commented`, '1');
			}
		}
	}
}

async function showSettingsCheckMessage() {
	const resp = await vscode.window.showInformationMessage(
		"Do you want to check the settings for Auto-Semicolon first?",
		"Check Settings...",
		"Later"
	);

	if (resp === "Check Settings...") {
		vscode.commands.executeCommand('workbench.action.openSettings', 'Auto Semicolon');
	}
}

async function showRateRequestMessage(context: vscode.ExtensionContext): Promise<boolean> {
	const resp = await vscode.window.showInformationMessage(
		"You are using this extension for a while, please give me your opinion about it with a 5 stars comment",
		"Open Comments...",
		"Later"
	);

	if (resp === "Open Comments...") {
		const link = 'https://marketplace.visualstudio.com/items?itemName=myaaghubi.auto-semicolon-vscode&ssr=false#review-details';
		vscode.env.openExternal(vscode.Uri.parse(link));
		return true;
	}

	return false;
}

async function removeOldVersionAfterMigration() {
	// let oldExists = vscode.commands.executeCommand('workbench.extensions.search', 'myaghobi.auto-semicolon');
	let uninstallOld = vscode.commands.executeCommand('workbench.extensions.uninstallExtension', 'myaghobi.auto-semicolon');
	await Promise.all([uninstallOld]);
}