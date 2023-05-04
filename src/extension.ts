import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
	let semicolonAtPosition = vscode.commands.registerTextEditorCommand('auto-semicolon-vscode.position-insert-semicolon',
		(editor: vscode.TextEditor, textEdit: vscode.TextEditorEdit) => {
			return semiColonCommand(editor, textEdit);
		}
	);

	let autoSemicolone = vscode.commands.registerTextEditorCommand('auto-semicolon-vscode.auto-insert-semicolon',
		(editor: vscode.TextEditor, textEdit: vscode.TextEditorEdit) => {
			return autoSemiColonCommand(editor, textEdit, false);
		}
	);

	// auto put the semicolon (ignore the {}) at the end 
	let autoSemicoloneFTE = vscode.commands.registerTextEditorCommand('auto-semicolon-vscode.auto-insert-semicolon-fte',
		(editor: vscode.TextEditor, textEdit: vscode.TextEditorEdit) => {
			return autoSemiColonCommand(editor, textEdit, true);
		}
	);

	context.subscriptions.push(semicolonAtPosition);
	context.subscriptions.push(autoSemicolone);
	context.subscriptions.push(autoSemicoloneFTE);

	await removeOldVersionAfterMigration();
}

export function deactivate() { }

function semiColonCommand(editor: vscode.TextEditor, textEdit: vscode.TextEditorEdit) {
	editor.edit((edit: vscode.TextEditorEdit) => {
		for (let selection of editor.selections) {
			edit.insert(selection.active, ';');
		}
	});
}

const unallowedEnds = [';', '{', '}'];
function autoSemiColonCommand(editor: vscode.TextEditor, textEdit: vscode.TextEditorEdit, forceToEnd: boolean) {
	const selections: vscode.Selection[] = [];
	editor.edit(() => {
		try {
			editor.selections.forEach((selection) => {
				const line = editor.document.lineAt(selection.active.line);
				const lineText = line.text.trimEnd();
				const linelastText = lineText[lineText.length - 1];
				const currentPos = selection.active.character;

				let position: vscode.Position;

				if (lineText.length === 0 || isCommented(lineText, currentPos) || isInStringLiteral(lineText, currentPos)) {
					textEdit.insert(selection.active, ';');
					position = newPosition(line, selection.active.character + 1);

				} else if (!forceToEnd && isBetweenTags('for', ')', lineText, currentPos - 4)) { // -4 ? 'for('.length=4
					textEdit.insert(selection.active, ';');
					position = newPosition(line, selection.active.character + 1);

				} else if (!forceToEnd && isBetweenTags('{', '}', lineText, currentPos)) {
					let length = putSemicolonBefore('}', textEdit, selection, line);
					position = newPosition(line, length);

				} else {
					let length = line.range.end.character + 1;

					if (!unallowedEnds.includes(linelastText)) {
						length = putSemicolonBefore('//', textEdit, selection, line) + 1;
					} else if (currentPos === line.text.length) {
						length = putSemicolonBefore('//', textEdit, selection, line) + 1;
					}

					position = newPosition(line, length);
				}

				selection = new vscode.Selection(position, position);
				selections.push(selection);
			});
		} catch (e) {
			//console.log(e);
		}
	}).then(() => {
		editor.selections = selections;
	});
}

function putSemicolonBefore(tag: string, textEdit: vscode.TextEditorEdit, selection: vscode.Selection, line: vscode.TextLine): number {
	let lineText = line.text.trimEnd();
	let posClose = lineText.indexOf(tag, selection.active.character);
	let length = lineText.length;

	if (posClose >= 0) {
		let lineTextTrimmed = lineText.substring(0, posClose).trimEnd();
		length = lineTextTrimmed.length;

		if (!unallowedEnds.includes(lineTextTrimmed[lineTextTrimmed.length - 1])) {
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

async function removeOldVersionAfterMigration() {
	// let oldExists = vscode.commands.executeCommand('workbench.extensions.search', 'myaghobi.auto-semicolon');
	let uninstallOld = vscode.commands.executeCommand('workbench.extensions.uninstallExtension', 'myaghobi.auto-semicolon');
	await Promise.all([uninstallOld]);
}