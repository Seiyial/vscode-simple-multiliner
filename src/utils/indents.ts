export namespace indents {

	export type TBaseIndentSpec = {
		type: 'space'
		numSpaces: number
	} | {
		type: 'tab',
	}

	// structural stand-in for vscode.TextEditorOptions so the splat core can
	// stay free of vscode imports and run in plain unit tests
	export type TEditorOptionsLike = {
		insertSpaces?: boolean | string
		tabSize?: number | string
	}

	export type TIndentSource = TBaseIndentSpec | TEditorOptionsLike

	const isEditorOptions = (source: TIndentSource): source is TEditorOptionsLike =>
		'insertSpaces' in source || 'tabSize' in source

	export const getBaseIndent = (source: TIndentSource): TBaseIndentSpec => {
		if (isEditorOptions(source)) {
			return source.insertSpaces && typeof source.tabSize === 'number'
				? { type: 'space', numSpaces: source.tabSize }
				: { type: 'tab' }
		}
		return source
	}

	export const getSingleIndentPayload = (spec: TBaseIndentSpec): string =>
		spec.type === 'space' ? ' '.repeat(spec.numSpaces) : '\t'

	// matches only at the very start of the text: the indent of its first line
	export const getNumIndentsInText = (spec: TBaseIndentSpec, text: string): number => {
		const indentChar = getSingleIndentPayload(spec)
		const match = text.match(new RegExp(`^(${indentChar})+`))
		if (match === null) {
			return 0
		}
		return match[0].length / indentChar.length
	}

	export const composeIndents = (spec: TBaseIndentSpec, numIndents: number): string => {
		const indentChar = getSingleIndentPayload(spec)
		return indentChar.repeat(Math.max(0, numIndents))
	}
}
