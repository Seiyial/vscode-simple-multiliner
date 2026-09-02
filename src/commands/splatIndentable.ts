import * as vscode from 'vscode'
import { splat, type TSplatFailureReason } from '../splat/core'
import { selector } from '../utils/selector'

const failureMessages: Record<TSplatFailureReason, string> = {
	'no-block-found': 'Simple Multiliner: no expandable block (object, array, call, or JSX tag) found in the selection.',
	'nothing-to-expand': 'Simple Multiliner: nothing to expand, the block is already flat.',
	'unbalanced': 'Simple Multiliner: skipped, the selection has unbalanced brackets, quotes, or tags.',
}

export const splatIndentableCommand = async () => {
	const editor = vscode.window.activeTextEditor
	if (editor === undefined) {
		return
	}

	const { fullSelection, text } = selector.fullySelectAllLines(editor)
	const result = splat(text, editor.options)

	if (!result.changed) {
		vscode.window.showInformationMessage(failureMessages[result.reason])
		return
	}

	await editor.edit(editBuilder => {
		editBuilder.replace(fullSelection, result.text)
	})
}
