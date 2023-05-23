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

	await removeOldVersionAfterMigration();
}

export function deactivate() { }

// these two variables gonna fill later
let autoSemicolonFormatsIncluded = true;
let autoMoveFormatsIncluded = false;
function getConfig() {
	return vscode.workspace.getConfiguration('autoSemicolon');
}

function isUnallowdEndsIncluded(lastCharacter: string) {
	let unallowedEnds = getConfig().unallowedEnds.split(",");
	if (!Array.isArray(unallowedEnds))
		return false;

	return unallowedEnds.includes(lastCharacter);
}

function isAutoSemicolonFormatsIncluded(languageId: string|null) {
	if (!languageId)
		return false;

	languageId = '*.' + languageId;

	let formats = getConfig().format.autoSemicolon.split(",");
	if (!Array.isArray(formats))
		return false;

	for (const item of formats) {
		if (item.trim() == languageId)
			return true;
	}

	return false;
}

function isAutoMoveFormatsIncluded(languageId: string|null) {
	if (!languageId || getConfig().format.autoMoveEnable)
		return false;

	languageId = '*.' + languageId;

	let formats = getConfig().format.autoMove.split(",");
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
				const line = editor.document.lineAt(selection.active.line);
				const lineText = line.text.trimEnd();
				const currentPos = selection.active.character;
				let position: vscode.Position;
				let match;

				autoSemicolonFormatsIncluded = isAutoSemicolonFormatsIncluded(languageId);
				autoMoveFormatsIncluded = isAutoMoveFormatsIncluded(languageId);

				if (lineText.length === 0 || !languageId) {
					textEdit.insert(selection.active, ';');
					position = newPosition(line, selection.active.character + 1);

				} else if (!autoSemicolonFormatsIncluded && !autoMoveFormatsIncluded) {
					textEdit.insert(selection.active, ';');
					position = newPosition(line, selection.active.character + 1);

				} else if (!forceToEnd && isCommented(lineText, currentPos)) {
					textEdit.insert(selection.active, ';');
					position = newPosition(line, selection.active.character + 1);

				} else if (!forceToEnd && isInStringLiteral(lineText, currentPos)) {
					textEdit.insert(selection.active, ';');
					position = newPosition(line, selection.active.character + 1);

				} else if (!forceToEnd && (match = findTheForStatement(lineText, currentPos)) !== null) {
					// each for(;;) statement has two ";"
					if (match[1].split(";").length - 1 < 2) {
						textEdit.insert(selection.active, ';');
						position = newPosition(line, selection.active.character + 1);
					} else if (!forceToEnd && autoSemicolonFormatsIncluded && (!isUnallowdEndsIncluded(lineText[lineText.length - 1]) || currentPos === line.text.length)) {
						let length = putSemicolonAfterPos(match.index + match[0].length, textEdit, selection, line);
						position = newPosition(line, length);
					}

				} else {
					let length = line.range.end.character + 1;
					if (!forceToEnd && autoSemicolonFormatsIncluded && isBetweenTags('{', '}', lineText, currentPos)) {
						length = putSemicolonBefore('}', textEdit, selection, line);
					} else if (!forceToEnd && autoSemicolonFormatsIncluded && (!isUnallowdEndsIncluded(lineText[lineText.length - 1]) || currentPos === line.text.length)) {
						length = putSemicolonBefore('//', textEdit, selection, line) + 1;
					}

					position = newPosition(line, length);
				}

				selection = new vscode.Selection(position, position);
				selections.push(selection);
			});
		} catch (e) {
			//message(e.toString());
		}
	}).then(() => {
		editor.selections = selections;
	});
}

function putSemicolonAfterPos(position: number, textEdit: vscode.TextEditorEdit, selection: vscode.Selection, line: vscode.TextLine): number {
	position = position >= 0 ? position : 0;
	const currentPos = selection.active.character;
	let lineText = line.text;

	let lineTextTrimmed = lineText.substring(0, position);//.trimEnd();

	if (!isUnallowdEndsIncluded(lineTextTrimmed[lineTextTrimmed.length - 1]) || currentPos === line.text.length) {
		lineText = lineText.replace(lineTextTrimmed, lineTextTrimmed + ';');
		textEdit.delete(new vscode.Selection(newPosition(line, 0), newPosition(line, line.text.length)));
		textEdit.insert(newPosition(line, 0), lineText);
	}
	return position + 1;
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
	const regex = /for\s*\((.*?)\)/g;
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

async function message(message: string) {
	await vscode.window.showWarningMessage(message);
}

async function removeOldVersionAfterMigration() {
	// let oldExists = vscode.commands.executeCommand('workbench.extensions.search', 'myaghobi.auto-semicolon');
	let uninstallOld = vscode.commands.executeCommand('workbench.extensions.uninstallExtension', 'myaghobi.auto-semicolon');
	await Promise.all([uninstallOld]);
}