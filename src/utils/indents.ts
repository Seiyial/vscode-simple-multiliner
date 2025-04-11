import * as vscode from 'vscode'

export namespace indents {

	export type TBaseIndentSpec = {
		type: 'space'
		numSpaces: number
	} | {
		type: 'tab',
	}
	export const getBaseIndent = (editorOptions: TBaseIndentSpec | vscode.TextEditorOptions): TBaseIndentSpec => {
		if (_isEditorOptions(editorOptions)) {
			if (editorOptions.insertSpaces && typeof editorOptions.tabSize === 'number') {
				return { type: 'space', numSpaces: editorOptions.tabSize }
			} else {
				return { type: 'tab' }
			}
		} else {
			return editorOptions
		}
	}
	const _isEditorOptions = (spec: TBaseIndentSpec | vscode.TextEditorOptions): spec is vscode.TextEditorOptions => {
		return 'insertSpaces' in spec && 'tabSize' in spec
	}
	export const getSingleIndentPayload = (
		spec: TBaseIndentSpec | vscode.TextEditorOptions,
	): string => {
		if (_isEditorOptions(spec)) {
			return spec.insertSpaces && typeof spec.tabSize === 'number'
				? ' '.repeat(spec.tabSize)
				: '	'
		} else {
			return spec.type === 'space'
				? ' '.repeat(spec.numSpaces)
				: '	'
		}
	}
	export const getNumIndentsInText = (
		spec: TBaseIndentSpec | vscode.TextEditorOptions,
		text: string
	): number => {
		const ourSpec = getBaseIndent(spec)
		const indentChar = getSingleIndentPayload(ourSpec)
		const indentRegex = new RegExp(`^(${indentChar})+`, 'gm')
		const match = text.match(indentRegex)
		if (match) {
			const firstLine = match[0]
			const numIndents = firstLine.length / indentChar.length
			return numIndents
		}
		return 0
	}

	export const composeIndents = (
		spec: TBaseIndentSpec | vscode.TextEditorOptions,
		numIndents: number
	): string => {
		const ourSpec = getBaseIndent(spec)
		const indentChar = getSingleIndentPayload(ourSpec)
		return indentChar.repeat(numIndents)
	}

	export const getNumIndentsAndType = (
		spec: TBaseIndentSpec | vscode.TextEditorOptions,
		text: string
	): { numIndents: number, spec: TBaseIndentSpec, payload: string } => {
		const ourSpec = getBaseIndent(spec)
		const indentChar = getSingleIndentPayload(ourSpec)
		const numIndents = getNumIndentsInText(ourSpec, text)
		return { numIndents: 0, spec: ourSpec, payload: '' }
	}

	export const extractCurrentAndPlusOne = (
		text: string,
		spec: TBaseIndentSpec | vscode.TextEditorOptions,
	): { currPayload: string, payloadPlusOne: string, currNum: number, spec: TBaseIndentSpec } => {
		const ourSpec = getBaseIndent(spec)
		const numIndents = getNumIndentsInText(ourSpec, text)
		const currPayload = composeIndents(ourSpec, numIndents)
		const payloadPlusOne = composeIndents(ourSpec, numIndents + 1)
		return { currPayload, payloadPlusOne, currNum: numIndents, spec: ourSpec }
	}
}
