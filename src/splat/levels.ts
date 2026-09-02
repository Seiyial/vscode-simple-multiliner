export type TLangOpener = '{' | '[' | '('
export type TLangCloser = '}' | ']' | ')'
export type TStringOpener = "'" | '"' | '`'

export type Level =
	| { type: 'lang_block', openToken: TLangOpener, closeToken: TLangCloser, numIndentsInSiblings: number }
	| { type: 'string_block', openToken: TStringOpener, closeToken: TStringOpener, numIndentsInSiblings: number }
	| { type: 'jsx_tag', name: string, phase: 'props' | 'children', numIndentsInSiblings: number }
	| { type: 'call_object', openToken: string, closeToken: string, numIndentsInSiblings: number }

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
	if (level.type === 'lang_block' || level.type === 'call_object') {
		return level.openToken
	}
	if (level.type === 'string_block') {
		return level.openToken
	}
	return level.name === '' ? '<>' : `<${level.name}`
}

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
	if (level.type === 'call_object') {
		return text.startsWith(level.closeToken, i)
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
			if (char === '(') {
				const fused = matchCallObjectAt(text, i, numIndentsHere)
				if (fused !== null) {
					return { level: fused, index: i }
				}
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

export type TJsxChildrenClose = { start: number, end: number }

// Skips a `{...}` expression container starting at the opening brace;
// returns the index just past its matching `}`, or -1 if unbalanced. JSX
// inside the expression is skipped wholesale, so it can never affect the
// caller's depth counting.
const findBalancedBraceEnd = (text: string, from: number): number => {
	let depth = 1
	let i = from + 1
	while (i < text.length) {
		const char = text[i]
		if (isStringOpener(char)) {
			const end = findStringEnd(text, i + 1, char)
			if (end === -1) {
				return -1
			}
			i = end + 1
			continue
		}
		if (char === '{') {
			depth++
		} else 		if (char === '}') {
			depth--
			if (depth === 0) {
				return i + 1
			}
		}
		i++
	}
	return -1
}

// A call whose only top-level child is a single non-empty object literal
// (`fn({ ... })`) fuses the pair: `({` acts as the opener and `})` as the
// closer, so the object's entries are splatted as direct children of the
// call. The tokens keep the input's exact text, including any spacing
// between `(` and `{` or between `}` and `)`.
const matchCallObjectAt = (text: string, i: number, numIndentsHere: number): Level | null => {
	let j = i + 1
	while (isWhitespace(text[j])) {
		j++
	}
	if (text[j] !== '{') {
		return null
	}
	const braceEnd = findBalancedBraceEnd(text, j)
	if (braceEnd === -1) {
		return null
	}
	if (text.slice(j + 1, braceEnd - 1).trim() === '') {
		return null
	}
	let k = braceEnd
	while (isWhitespace(text[k])) {
		k++
	}
	if (text[k] !== ')') {
		return null
	}
	return {
		type: 'call_object',
		openToken: text.slice(i, j + 1),
		closeToken: text.slice(braceEnd - 1, k + 1),
		numIndentsInSiblings: numIndentsHere + 1,
	}
}

// Scans a nested tag's prop list (starting just after its name) for its
// ending `>`/`/>`; strings and expression containers are skipped so a `>`
// inside them cannot be misread as the tag's end
const findJsxOpenTagEnd = (text: string, from: number): { end: number, selfClosing: boolean } | null => {
	let i = from
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
		if (char === '{') {
			const end = findBalancedBraceEnd(text, i)
			if (end === -1) {
				return null
			}
			i = end
			continue
		}
		if (char === '/' && text[i + 1] === '>') {
			return { end: i + 2, selfClosing: true }
		}
		if (char === '>') {
			return { end: i + 1, selfClosing: false }
		}
		i++
	}
	return null
}

// Matches the close token `</name ...whitespace...>` (exactly `</>` for
// fragments) starting at i; returns its span or null
const matchJsxCloseAt = (text: string, i: number, name: string): TJsxChildrenClose | null => {
	if (name === '') {
		return text.startsWith('</>', i) ? { start: i, end: i + 3 } : null
	}
	if (matchJsxNameAt(text, i + 2) !== name) {
		return null
	}
	let j = i + 2 + name.length
	while (isWhitespace(text[j])) {
		j++
	}
	return text[j] === '>' ? { start: i, end: j + 1 } : null
}

// Finds the close token that ends the children of a jsx level whose
// children start at `start`. Nested same-name tags are depth-counted;
// nested tags of any name are skipped with string and expression
// awareness, so close tokens inside their props (e.g. `title="</div>"`)
// or inside expressions cannot be misread; `<` in text (e.g. `1 < 2`)
// stays verbatim.
export const findJsxChildrenClose = (text: string, start: number, name: string): TJsxChildrenClose | null => {
	let depth = 0
	let i = start
	while (i < text.length) {
		const char = text[i]
		if (char === '{') {
			const end = findBalancedBraceEnd(text, i)
			if (end === -1) {
				return null
			}
			i = end
			continue
		}
		if (char !== '<') {
			i++
			continue
		}
		if (text.startsWith('</', i)) {
			const closeName = name === '' ? '' : matchJsxNameAt(text, i + 2) ?? ''
			const close = matchJsxCloseAt(text, i, closeName)
			if (close === null) {
				i++
				continue
			}
			if (closeName === name) {
				if (depth === 0) {
					return close
				}
				depth--
			}
			i = close.end
			continue
		}
		if (text[i + 1] === '>') {
			// nested fragment open `<>`; it is already complete, and only
			// same-name (fragment) levels count toward the depth
			if (name === '') {
				depth++
			}
			i += 2
			continue
		}
		const openName = matchJsxNameAt(text, i + 1)
		if (openName === null) {
			// '<' in text (e.g. `1 < 2`); a name would have been a nested tag
			i++
			continue
		}
		const tag = findJsxOpenTagEnd(text, i + 1 + openName.length)
		if (tag === null) {
			return null
		}
		if (!tag.selfClosing && openName === name) {
			depth++
		}
		i = tag.end
	}
	return null
}
