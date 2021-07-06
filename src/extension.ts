// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'

// const objectOuterRegexp = new RegExp(/^((\w+) (\w+)(:( )?(\w)+)?( )?=)?(\s)*([{])((.)*)([}])$/)
// const arrayOuterRegexp = new RegExp(/^((\w+) (\w+)(:( )?(\w)+)?( )?=)?(\s)*([\[])((.)*)([\]])$/)
// const fnRegexp = new RegExp(/^((public|private)( ))?(readonly )?(async )?$/)
// // const myFn: xxxxxx = (<-->) => { ... }
// // const myFn = (<-->): XXXXX => { ... }
// // function myFn (<-->)(:( )?(\w)+)?( )?([{](.)*[}])
// // 
// const innerRegexp = new RegExp(/^((([\w\d_]+)|(['][\w\d_]+['])|(["][\w\d_]+["])):(\s)*(.)*(,)?)*$/)
// const WHITESPACE = '	'

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const COMMAND: string = 'daybreak-simple-multiliner.spread'

	let disposable = vscode.commands.registerCommand(COMMAND, () => {
		const editor = vscode.window.activeTextEditor

		if (!editor) {
			return
		}

		const { selection, document } = editor
		const fullSelection = new vscode.Range(
			document.lineAt(selection.start.line).range.start,
			document.lineAt(selection.end.line).range.end
		)
		const text = document.getText(fullSelection).trimEnd()

		const { whitespaceChars, numBaseIndents } = _getWhitespace(editor.options, text)
		const baseIndent = whitespaceChars.repeat(numBaseIndents)
		const extraIndent = whitespaceChars.repeat(numBaseIndents + 1)
		editor.edit((eb) => {
			editor.selection = new vscode.Selection(fullSelection.start, fullSelection.end)
			const newVal = text.replace(/[{}()]|(, )/g, (c) => c === '}' || c === ')' || c === ']' ? `\r\n${baseIndent}${c}` : `${c.trimEnd()}\r\n${extraIndent}`)
			eb.replace(fullSelection, newVal)
		}).then(() => {
			// editor seems to set new rows only after edit procedure is done; moving the cursor before the 'then' block results in weird behaviour
			editor.selection = new vscode.Selection(editor.selection.end, editor.selection.end)
		})
		return
	})

	context.subscriptions.push(disposable)
}

const _getWhitespace = (editorOptions: vscode.TextEditorOptions, text: string): {whitespaceChars: string, numBaseIndents: number} => {
	const whitespaceChar = editorOptions.insertSpaces && typeof editorOptions.tabSize === 'number'
		? ' '.repeat(editorOptions.tabSize)
		: '	'
	const numIndents = _getNumIndentsRoundedUp(whitespaceChar, text)
	return {numBaseIndents: numIndents, whitespaceChars: whitespaceChar}
}

const _getNumIndentsRoundedUp = (whitespaceChar: string, text: string) => {
	const wscLen = whitespaceChar.length
	const textLen = text.length
	const maxIndent = Math.floor(text.length / whitespaceChar.length)
	for (let i = 0; i < maxIndent; i++) {
		const pos = wscLen * i
		if (text.charAt(pos) !== whitespaceChar[0]) {
			return i
		}
		continue
	}
	return maxIndent
}

// this method is called when your extension is deactivated
export function deactivate() {}
