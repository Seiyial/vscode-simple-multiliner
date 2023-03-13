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

	const COMMAND: string = 'syx-simple-multiliner.spread'

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
			if (!editor.selection.isEmpty) {
				// find first block
				let startChar = null, startCharPos = null, endChar = null, endCharPos = null
				for (let i = 0; i < text.length; i++) {
					const char = text.charAt(i)
					if (char === '{') {
						startChar = char
						startCharPos = i
						endChar = '}'
						break
					} else if (char === '(') {
						startChar = char
						startCharPos = i
						endChar = ')'
						break
					} else if (char === '[') {
						startChar = char
						startCharPos = i
						endChar = ']'
						break
					}
				}
				if (typeof startCharPos === 'number' && endChar) {
					for (let j = text.length - 1; j > startCharPos; j--) {
						const char = text.charAt(j)
						if (char === endChar) {
							endCharPos = j
							break
						}
					}
				}
				if (startCharPos !== null && endChar && endCharPos && startCharPos !== endCharPos) {
					const preStartChar = text.slice(0, startCharPos)
					let embedded = text.slice(startCharPos + 1, endCharPos)
					const postEndChar = text.slice(endCharPos + 1)

					let nesting = 0
					const insertLineBreakPositions: number[] = []
					for (let k = 0; k < embedded.length; k++) {
						const char = embedded[k]
						if (char === '(' || char === '{' || char === '[') {
							nesting += 1
						} else if (char === ')' || char === '}' || char === ']') {
							nesting -= 1
						} else if (char === ',') {
							if (nesting === 0) { insertLineBreakPositions.push(k) }
						}
					}

					// edit from back so that each next index is still accurate
					for (const [itemIdx, charIdx] of insertLineBreakPositions.reverse().entries()) {
						embedded = `${embedded.slice(0, charIdx)},\n${itemIdx === 0 ? baseIndent : extraIndent}${embedded.slice(charIdx + 1).trimStart()}`
					}
					eb.replace(fullSelection, `${preStartChar}${startChar}\n${extraIndent}${embedded.trimStart()}${endChar}${postEndChar}`)
				} else {
					eb.replace(fullSelection, text.replace(/,( )?/g, `,\n${baseIndent}`))
				}
			}
			
			// const newVal = text.replace(/[{}()]|(, )/g, (c) => c === '}' || c === ')' || c === ']' ? `\r\n${baseIndent}${c}` : `${c.trimEnd()}\r\n${extraIndent}`)
			// eb.replace(fullSelection, newVal)
		}).then(() => {
			// editor seems to set new rows only after edit procedure is done; moving the cursor before the 'then' block results in weird behaviour
			editor.selection = new vscode.Selection(editor.selection.end, editor.selection.end)
		})
		return
	})

	context.subscriptions.push(disposable)
}

const _getWhitespace = (editorOptions: vscode.TextEditorOptions, text: string): {whitespaceChars: string, numBaseIndents: number} => {
	console.log(editorOptions.insertSpaces, editorOptions.tabSize)
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
