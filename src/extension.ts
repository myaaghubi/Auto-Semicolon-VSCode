/* eslint-disable curly */
import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
	let semicolonAtPosition = vscode.commands.registerTextEditorCommand('auto-semicolon-vscode.position-insert-semicolon',
		(editor: vscode.TextEditor, textEdit: vscode.TextEditorEdit) => {
			return semicolonCommand(editor, textEdit);
		}
	);

	let autoSemicolone = vscode.commands.registerTextEditorCommand('auto-semicolon-vscode.auto-insert-semicolon',
		(editor: vscode.TextEditor, textEdit: vscode.TextEditorEdit) => {
			return autoSemicolonCommand(editor, textEdit, false);
		}
	);

	// auto put the semicolon (ignore the {}) at the end 
	let autoSemicoloneFTE = vscode.commands.registerTextEditorCommand('auto-semicolon-vscode.auto-insert-semicolon-fte',
		(editor: vscode.TextEditor, textEdit: vscode.TextEditorEdit) => {
			return autoSemicolonCommand(editor, textEdit, true);
		}
	);

	context.subscriptions.push(semicolonAtPosition);
	context.subscriptions.push(autoSemicolone);
	context.subscriptions.push(autoSemicoloneFTE);

	await taskChecker(context);
}

export function deactivate() { }

type RegExpMatchArrayWithIndex = RegExpMatchArray & { index: number };

// these two variables gonna fill later
let autoSemicolonFormatsIncluded = true;
let autoMoveFormatsIncluded = false;

function getConfig() {
	return vscode.workspace.getConfiguration('autoSemicolon');
}

function isQuotesIgnored() {
	return getConfig().supportedLanguageId.ignores.quotes;
}

function isForStatementIgnored() {
	return getConfig().supportedLanguageId.ignores.theForStatement;
}

function isUnallowdEndsIncluded(lastCharacter: string) {
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
	editor.edit(() => {
		try {
			editor.selections.forEach((selection) => {
				try {
					const line = editor.document.lineAt(selection.active.line);
					const lineText = line.text.trimEnd();
					const currentPos = selection.active.character;
					let position: vscode.Position;
					let match;

					autoSemicolonFormatsIncluded = isAutoSemicolonLanguageIdIncluded(languageId);
					autoMoveFormatsIncluded = isAutoMoveLanguageIdIncluded(languageId);

					position = newPosition(line, selection.active.character + 1);

					if (lineText.length === 0 || !languageId) {
						textEdit.insert(selection.active, ';');

					} else if (!autoSemicolonFormatsIncluded && !autoMoveFormatsIncluded) {
						textEdit.insert(selection.active, ';');

					} else if (!forceToEnd && isCommented(lineText, currentPos)) {
						textEdit.insert(selection.active, ';');

					} else if (!forceToEnd && isQuotesIgnored() && isInStringLiteral(lineText, currentPos)) {
						textEdit.insert(selection.active, ';');

					} else if (!forceToEnd && isForStatementIgnored() && (match = findTheForStatement(lineText, currentPos)) !== null) {
						// each for(;;) statement has two ";"
						if (match[1].split(";").length - 1 < 2) {
							console.log("1");
							textEdit.insert(selection.active, ';');
							position = newPosition(line, selection.active.character + 1);
						} else if (autoSemicolonFormatsIncluded) {
							console.log("2");
							let length = putSemicolonAfterPos((match as RegExpMatchArrayWithIndex).index, textEdit, selection, line);
							position = newPosition(line, length);
						}

					} else if (!forceToEnd && autoSemicolonFormatsIncluded) {
						let length = line.range.end.character + 1;
						if (isBetweenTags('{', '}', lineText, currentPos)) {
							length = putSemicolonBefore('}', textEdit, selection, line);
						} else if (!isUnallowdEndsIncluded(lineText[lineText.length - 1]) || currentPos === line.text.length) {
							length = putSemicolonBefore('//', textEdit, selection, line) + 1;
						}

						position = newPosition(line, length);

					} else {
						// just move to the end
						let length = line.range.end.character + 1;
						position = newPosition(line, length);
					}

					selection = new vscode.Selection(position, position);
					selections.push(selection);
				} catch (error) {
					// logIt(error.message);
				}
			});
		} catch (error) {
			// logIt(error.message);
		}
	}).then(() => {
		editor.selections = selections;
	});
}

function putSemicolonAfterPos(position: number, textEdit: vscode.TextEditorEdit, selection: vscode.Selection, line: vscode.TextLine): number {
	position = position >= 0 ? position : 0;
	return putSemicolonBefore('//', textEdit, selection, line) + 1;
}

function putSemicolonBefore(tag: string, textEdit: vscode.TextEditorEdit, selection: vscode.Selection, line: vscode.TextLine): number {
	let lineText = line.text.trimEnd();
	const currentPos = selection.active.character;
	const posClose = lineText.indexOf(tag, currentPos);
	let length = lineText.length;

	if (posClose >= 0) {
		const lineTextTrimmed = lineText.substring(0, posClose).trimEnd();
		length = lineTextTrimmed.length;

		if (!isUnallowdEndsIncluded(lineTextTrimmed[lineTextTrimmed.length - 1]) || currentPos === line.text.length) {
			lineText = lineText.replace(lineTextTrimmed, lineTextTrimmed + ';');
			length += 1;
			textEdit.delete(new vscode.Selection(newPosition(line, 0), newPosition(line, line.text.length)));
			textEdit.insert(newPosition(line, 0), lineText);
		}

		return length - tag.length + 1;
	}

	textEdit.insert(newPosition(line, length), ';');
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

function isCommented(lineText: string, currentPos: number): boolean {
	const pos = lineText.lastIndexOf('//', currentPos);
	return pos >= 0;
}

function findTheForStatement(lineText: string, currentPos: number): string[] | null {
	const regex = /for\s*\((.*)\)/g;
	let match;

	while ((match = regex.exec(lineText)) !== null) {
		if (match.index <= currentPos && match.index + match[0].length >= currentPos && isBetweenTags("(", ")", lineText, currentPos)) {
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

async function logIt(message: string | any[] | null | undefined) {
	console.log(message);
	// vscode.window.showWarningMessage(message?.toString());
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