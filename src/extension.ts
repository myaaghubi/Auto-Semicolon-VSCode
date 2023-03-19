import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	removeOldVersionAfterMigration();

	let semicolone = vscode.commands.registerTextEditorCommand('auto-semicolon-vscode.insert-semicolon', (editor, textEdit) => {
		return semiColonCommand(editor, textEdit);
	});

	let autoSemicolone = vscode.commands.registerTextEditorCommand('auto-semicolon-vscode.auto-insert-semicolon', (editor, textEdit) => {
		return autoSemiColonCommand(editor, textEdit);
	});

	context.subscriptions.push(semicolone);
	context.subscriptions.push(autoSemicolone);
}

export function deactivate() { }

async function removeOldVersionAfterMigration() {
		// let oldExists = vscode.commands.executeCommand('workbench.extensions.search', 'myaghobi.auto-semicolon');
		let uninstallOld = vscode.commands.executeCommand('workbench.extensions.uninstallExtension', 'myaghobi.auto-semicolon');
		await Promise.all([uninstallOld]);
}

function semiColonCommand(editor: vscode.TextEditor, textEdit: vscode.TextEditorEdit) {
	editor.edit((edit: vscode.TextEditorEdit) => {
		for (let selection of editor.selections) {
			edit.insert(selection.active, ';');
		}
	});
}

const unallowedEnd = [';', '{', '}'];
function autoSemiColonCommand(editor: vscode.TextEditor, textEdit: vscode.TextEditorEdit) {
	const selections: vscode.Selection[] = [];
	editor.edit((editBuilder) => {
		try {
			editor.selections.forEach(function (selection) {
				const line = editor.document.lineAt(selection.active.line);
				const lineText = line.text.trimEnd();
				const linelastText = lineText[lineText.length - 1];
				const currentPos = selection.active.character;

				let position: vscode.Position;

				if (lineText.length === 0 || isCommented(lineText, currentPos)) {
					textEdit.insert(selection.active, ';');
					position = newPosition(line, selection.active.character + 1);

				} else if (isBetweenTags('for', ')', lineText, currentPos)) {
					textEdit.insert(selection.active, ';');
					position = newPosition(line, selection.active.character + 1);

				} else if (isBetweenTags('{', '}', lineText, currentPos)) {
					let length = putSemicolonBefore('}', textEdit, selection, line);
					position = newPosition(line, length);

				} else {
					if (!unallowedEnd.includes(linelastText)) {
						let length = putSemicolonBefore('//', textEdit, selection, line);
					}
					position = newPosition(line, line.range.end.character + 1);
					
				}
				selection = new vscode.Selection(position, position);
				selections.push(selection);
			});
		} catch (e) {
			console.log(e);
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

		if (!unallowedEnd.includes(lineTextTrimmed[lineTextTrimmed.length - 1])) {
			lineText = lineText.replace(lineTextTrimmed, lineTextTrimmed + ';');
			length += 1;
			textEdit.delete(new vscode.Selection(newPosition(line, 0), newPosition(line, line.text.length)));
			textEdit.insert(newPosition(line, 0), lineText);
		}
		return length;
	}

	textEdit.insert(newPosition(line, line.range.end.character+1), ';');
	return length;
}

function newPosition(line: vscode.TextLine, position: number): vscode.Position {
	return new vscode.Position(line.lineNumber, position);
}

function isBetweenTags(open: string, close: string, lineText: string, currentPos: number): boolean {
	const posOpen = lineText.lastIndexOf(open, currentPos);
	const posClose = lineText.indexOf(close, currentPos);
	const posClose_ = lineText.lastIndexOf(close, currentPos-1);
	return posOpen >= 0 && posOpen < currentPos && currentPos <= posClose && posClose_<posOpen;
}

function isCommented(lineText: string, currentPos: number): boolean {
	const pos = lineText.lastIndexOf('//', currentPos);
	return pos >= 0;
}
