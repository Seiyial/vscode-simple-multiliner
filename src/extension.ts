// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'

const objectOuterRegexp = new RegExp(/^(\s)*((\w+) (\w)(:( )?(\w)+)?( )?=)?(\s)*([{])((.)*)([}])(\s)*$/)
// const arrayOuterRegexp

const innerRegexp = new RegExp(/^((([\w\d_]+)|(['][\w\d_]+['])|(["][\w\d_]+["])):(\s)*(.)*(,)?)*$/)
const WHITESPACE = '	'

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const COMMAND: string = 'expression-multiliner-js-ts.toggle'

	console.log('Congratulations, your extension "expression-multiliner-js-ts" is now active!')

	let disposable = vscode.commands.registerCommand('expression-multiliner-js-ts.helloWorld', () => {
		const editor = vscode.window.activeTextEditor

		if (!editor) {
			return
		}

		const { selection, document } = editor
		const firstLineOfSelection = document.lineAt(selection.start.line)
		const lastLineOfSelection = document.lineAt(selection.end.line)
		const fullSelection = new vscode.Range(
			firstLineOfSelection.range.start,
			lastLineOfSelection.range.end
		)
		const text = document.getText(fullSelection)

		const matchObject = objectOuterRegexp.exec(text)
		if (matchObject) {
			const content: string = matchObject[11].trim()
			const keyValues = content.split(',')
			const newContent = keyValues.map((kv) => kv.trim()).join(`,\r\n${WHITESPACE}`)
			editor.edit((editBuilder) => editBuilder.replace(fullSelection, `${matchObject[2]} ${matchObject[10]}\r\n${WHITESPACE}${newContent}\r\n${matchObject[13]}`))
			// editor.
			return
		}
		// const matchArray = arrayOuterRegexp.exec(text)
	})

	context.subscriptions.push(disposable)
}

// this method is called when your extension is deactivated
export function deactivate() {}
