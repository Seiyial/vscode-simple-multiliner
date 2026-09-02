export type TLangOpener = '{' | '[' | '('
export type TLangCloser = '}' | ']' | ')'
export type TStringOpener = "'" | '"' | '`'

export type Level =
	| { type: 'lang_block', openToken: TLangOpener, closeToken: TLangCloser, numIndentsInSiblings: number }
	| { type: 'string_block', openToken: TStringOpener, closeToken: TStringOpener, numIndentsInSiblings: number }
	| { type: 'jsx_tag', name: string, phase: 'props' | 'children', numIndentsInSiblings: number }

const langClosers: Record<TLangOpener, TLangCloser> = {
	'{': '}',
	'[': ']',
	'(': ')',
}

export const isWhitespace = (char: string | undefined): boolean =>
	char === ' ' || char === '\t' || char === '\n' || char === '\r'

const isLangOpener = (char: string): char is TLangOpener =>
	char === '{' || char === '[' || char === '('

const isStringOpener = (char: string): char is TStringOpener =>
	char === "'" || char === '"' || char === '`'

const jsxNameRe = /[A-Za-z][\w$.:-]*/y

export const matchJsxNameAt = (text: string, i: number): string | null => {
	jsxNameRe.lastIndex = i
	const match = jsxNameRe.exec(text)
	return match === null ? null : match[0]
}

export const createLangLevel = (openToken: TLangOpener, numIndentsHere: number): Level => ({
	type: 'lang_block',
	openToken,
	closeToken: langClosers[openToken],
	numIndentsInSiblings: numIndentsHere + 1,
})

export const createStringLevel = (openToken: TStringOpener, numIndentsHere: number): Level => ({
	type: 'string_block',
	openToken,
	closeToken: openToken,
	numIndentsInSiblings: numIndentsHere + 1,
})

export const createJsxLevel = (name: string, numIndentsHere: number, phase: 'props' | 'children' = 'props'): Level => ({
	type: 'jsx_tag',
	name,
	phase,
	numIndentsInSiblings: numIndentsHere + 1,
})

export const openTokenOf = (level: Level): string => {
	if (level.type === 'lang_block') {
		return level.openToken
	}
	if (level.type === 'string_block') {
		return level.openToken
	}
	return level.name === '' ? '<>' : `<${level.name}`
}

export const jsxCloseTokenOf = (name: string): string =>
	name === '' ? '</>' : `</${name}>`

export type TCloseMatch =
	| { kind: 'none' }
	| { kind: 'pop', token: string }
	| { kind: 'enter-children', token: string }

// string_block and jsx children levels are consumed verbatim by their own
// branch in the traversal loop, so they never match here
export const matchClose = (level: Level, text: string, i: number): TCloseMatch => {
	const char = text[i]
	if (level.type === 'lang_block') {
		return char === level.closeToken
			? { kind: 'pop', token: level.closeToken }
			: { kind: 'none' }
	}
	if (level.type === 'jsx_tag' && level.phase === 'props') {
		if (char === '/' && text[i + 1] === '>') {
			return { kind: 'pop', token: '/>' }
		}
		if (char === '>') {
			return { kind: 'enter-children', token: '>' }
		}
	}
	return { kind: 'none' }
}

// Only lang blocks and strings open levels mid-traversal. '<' deliberately
// does not: comparisons like `a<b` and '<' inside JSX text must stay verbatim.
// jsx levels are only ever created by findSplatTarget; nested JSX is consumed
// verbatim by the props/children phases, which is textually exact.
export const matchOpen = (text: string, i: number, parent: Level): Level | null => {
	if (parent.type === 'string_block') {
		return null
	}
	const char = text[i]
	if (isLangOpener(char)) {
		return createLangLevel(char, parent.numIndentsInSiblings)
	}
	if (isStringOpener(char)) {
		return createStringLevel(char, parent.numIndentsInSiblings)
	}
	return null
}

export const findStringEnd = (text: string, from: number, closeToken: string): number => {
	for (let j = from; j < text.length; j++) {
		if (text[j] !== closeToken) {
			continue
		}
		let backslashes = 0
		for (let k = j - 1; k >= 0 && text[k] === '\\'; k--) {
			backslashes++
		}
		if (backslashes % 2 === 0) {
			return j
		}
	}
	return -1
}

const nextNonWhitespace = (text: string, from: number): string | null => {
	for (let j = from; j < text.length; j++) {
		if (!isWhitespace(text[j])) {
			return text[j]
		}
	}
	return null
}

export const findSplatTarget = (text: string, numIndentsHere: number): { level: Level, index: number } | null => {
	let i = 0
	while (i < text.length) {
		const char = text[i]
		if (isStringOpener(char)) {
			const end = findStringEnd(text, i + 1, char)
			if (end === -1) {
				return null
			}
			i = end + 1
			continue
		}
		if (isLangOpener(char)) {
			if (nextNonWhitespace(text, i + 1) === langClosers[char]) {
				i++
				continue
			}
			return { level: createLangLevel(char, numIndentsHere), index: i }
		}
		if (char === '<') {
			// a fragment's opener already contains the '>', so it starts in the
			// children phase; fragments cannot have a prop list
			if (text[i + 1] === '>') {
				return { level: createJsxLevel('', numIndentsHere, 'children'), index: i }
			}
			const name = matchJsxNameAt(text, i + 1)
			if (name !== null) {
				return { level: createJsxLevel(name, numIndentsHere), index: i }
			}
		}
		i++
	}
	return null
}
