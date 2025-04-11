import * as vscode from 'vscode'

export namespace selector {
	export const fullySelectAllLines = (editor: vscode.TextEditor) => {
		const { selection, document } = editor
		const fullSelection = new vscode.Range(
			document.lineAt(selection.start.line).range.start,
			document.lineAt(selection.end.line).range.end
		)
		return {
			fullSelection,
			text: document.getText(fullSelection).trimEnd()
		}
	}
}
