
/** traversals */
export namespace trv {

	const respectiveLangBlockCloser = {
		'{': '}',
		'[': ']',
		'(': ')'
	} as const
	const langBlockOpeners = new Set<string>(Object.keys(respectiveLangBlockCloser))
	export type TLangBlockOpener = keyof typeof respectiveLangBlockCloser
	export type TLangBlockCloser = typeof respectiveLangBlockCloser[TLangBlockOpener]

	const respStringBlockPairs = {
		'`': '`',
		'\'': '\'',
		'"': '"',
		'\\"': '\\"',
		'\\\'': '\\\'',
		'\\`': '\\`',
	} as const
	const stringBlockOpeners = new Set<string>(Object.keys(respStringBlockPairs))
	export type TStringBlockOpener = keyof typeof respStringBlockPairs
	export type TStringBlockCloser = typeof respStringBlockPairs[TStringBlockOpener]

	
	export type Level = {
		type: 'jsx_tag_proplist_then_childlist',
		siblingSeparator: ' ',
		openPayload: string,
		numIndentsInSiblings: number,
		isInProplist: boolean,
		expandedClosePayload: string
	} | {
		type: 'lang_block',
		openToken: TLangBlockOpener,
		closeToken: TLangBlockCloser,
		siblingSeparator: ',' | ';',
		numIndentsInSiblings: number,
	} | {
		type: 'string_block',
		openToken: TStringBlockOpener,
		closeToken: TStringBlockCloser,
		numIndentsInSiblings: number,
		// we won't do sibling separator in strings right now
		// the objective is to traverse until the same token is reached then we can dismount the stack
	}

	export const indexOfFirstNonStringRelevantStartBlock = (text: string) => {
		let i = 0
		const nextNonSpaceAfter = (i: number): string | null => {
			let j = i + 1
			while (j < text.length) {
				if (text[j] !== ' ') {
					return text[j]
				}
				continue
			}
			return null
		}
		while (i < text.length) {
			const char = text[i]
			if (char === '{' && nextNonSpaceAfter(i) !== '}') return i
			if (char === '[' && nextNonSpaceAfter(i) !== ']') return i
			if (char === '(' && nextNonSpaceAfter(i) !== ')') return i
			const next = text[i + 1]
			if (char === '<' && next.match(/[A-z>]/)) return i
			i++
		}
		return null
	}

	export const createFirstLevelSpec = (text: string, numIndents: number) => {
		const idx = indexOfFirstNonStringRelevantStartBlock(text)
		if (idx === null) { return null }

		let input = text.slice(idx)
		const firstLevelSpec = createLevelSpec(input, numIndents)
		if (!firstLevelSpec) { return null }

		return {
			firstLevelSpec,
			skip: idx + (
				firstLevelSpec.type === 'lang_block' ? 1
				: firstLevelSpec.type === 'string_block' ? firstLevelSpec.openToken.length
				: firstLevelSpec.type === 'jsx_tag_proplist_then_childlist' ? firstLevelSpec.openPayload.length
				: 0 // not possible for first level spec to be jsx tag childlist
			)
		}
	}

	const startsWithJSXTagStart = (input: string) => /^<([A-z]+)(\s+)?/.test(input)
	const startsWithJSXFragStart = (input: string) => input.startsWith('<>')

	export const createLevelSpec = (inputWithoutLeadingSpaces: string, numIndentsHere: number): Level | null => {

		const nextToken = inputWithoutLeadingSpaces[0]
		if (langBlockOpeners.has(nextToken)) {
			const openToken = nextToken as TLangBlockOpener
			const closeToken = respectiveLangBlockCloser[openToken]

			return {
				type: 'lang_block',
				openToken,
				closeToken,
				siblingSeparator: ',',
				numIndentsInSiblings: numIndentsHere + 1,
			}

		} else if (stringBlockOpeners.has(nextToken)) {
			return {
				type: 'string_block',
				openToken: nextToken as TStringBlockOpener,
				closeToken: nextToken as TStringBlockCloser,
				numIndentsInSiblings: numIndentsHere + 1,
			}
		} else if (startsWithJSXTagStart(inputWithoutLeadingSpaces)) {
			const openToken = inputWithoutLeadingSpaces.match(/<([A-z]+)(\s+)?/)?.[0] ?? ''
			return {
				type: 'jsx_tag_proplist_then_childlist',
				siblingSeparator: ' ',
				openPayload: openToken,
				numIndentsInSiblings: numIndentsHere + 1,
				isInProplist: true,
				expandedClosePayload: `</${openToken.slice(1)}>`,
			}
		} else if (startsWithJSXFragStart(inputWithoutLeadingSpaces)) {
			return {
				type: 'jsx_tag_proplist_then_childlist',
				siblingSeparator: ' ',
				openPayload: '<>',
				numIndentsInSiblings: numIndentsHere + 1,
				isInProplist: false,
				expandedClosePayload: '</>',
			}
		}

		return null
	}

	export const didReachCloseToken = (char: string, nextChar: string, lastChar: string, stackTop: Level): boolean | 'jsx_into_children' => {
		if (stackTop.type === 'lang_block') {
			return char === stackTop.closeToken
		} else if (stackTop.type === 'string_block') {
			return char === stackTop.closeToken && lastChar !== '\\'
		} else if (stackTop.type === 'jsx_tag_proplist_then_childlist') {
			if (char === '/' && nextChar === '>') return true
			if (char === '>') return 'jsx_into_children'
			if (char === '<' && nextChar === '/') return true
		}
		return false
	}

	export const restOfText = (idx: number, text: string) => {
		return text.slice(idx)
	}

	export const closeTokenOf = (stackTop: Level, char: string): string => {
		if (stackTop.type === 'lang_block') {
			return stackTop.closeToken
		} else if (stackTop.type === 'string_block') {
			return stackTop.closeToken
		} else if (stackTop.type === 'jsx_tag_proplist_then_childlist') {
			if (stackTop.isInProplist) {
				return char === '/' ? '/>' : '>'
			} else {
				return stackTop.openPayload
			}
		}
		console.error('closeTokenOf called on non-block type', { stackTop, char })
		return ''
	}

	export const didReachSiblingSeparator = (char: string, stackTop: Level) => {
		if (stackTop.type === 'lang_block') {
			return char === stackTop.siblingSeparator
		} else if (stackTop.type === 'string_block') {
			return false
		} else if (stackTop.type === 'jsx_tag_proplist_then_childlist') {
			return char === stackTop.siblingSeparator
		}
		console.error('didReachSiblingSeparator called on non-block type', { char, stackTop })
		return false
	}

	export const anyStringOrOtherStartBlockExceptJSX = new RegExp(/([({\[]|(`|'|"))/)
	const jsxChar = new RegExp(/[A-z]/)
	export const didReachOpenTokenHalp = (char: string, level: Level, next: string, next2: string) => {
		// is not within a string
		if (level.type === 'string_block') {
			return false
		}

		// don't need to test if it is a close token because already tested
		return Boolean((anyStringOrOtherStartBlockExceptJSX.test(char)) || char === '<' && (next.match(jsxChar) || next === '>'))
	}

	export const constructNextOpenToken = (char: string, existingLevel: Level, nextAll: string): Level | null => {
		if (char === '{' || char === '[' || char === '(') {
			return {
				type: 'lang_block',
				openToken: char as TLangBlockOpener,
				closeToken: respectiveLangBlockCloser[char as TLangBlockOpener],
				siblingSeparator: ',',
				numIndentsInSiblings: existingLevel.numIndentsInSiblings + 1,
			}
		} else if (char === '\'' || char === '"' || char === '`') {
			return {
				type: 'string_block',
				openToken: char as TStringBlockOpener,
				closeToken: char as TStringBlockCloser,
				numIndentsInSiblings: existingLevel.numIndentsInSiblings + 1,
			}
		} else if (startsWithJSXTagStart(nextAll)) {
			const openToken = char.match(/<([A-z]+)(\s+)?/)?.[0] ?? ''
			return {
				type: 'jsx_tag_proplist_then_childlist',
				siblingSeparator: ' ',
				openPayload: openToken,
				numIndentsInSiblings: existingLevel.numIndentsInSiblings + 1,
				isInProplist: true,
				expandedClosePayload: `</${openToken.slice(1)}>`,
			}
		} else if (startsWithJSXFragStart(nextAll)) {
			return {
				type: 'jsx_tag_proplist_then_childlist',
				siblingSeparator: ' ',
				openPayload: '<>',
				numIndentsInSiblings: existingLevel.numIndentsInSiblings + 1,
				isInProplist: false,
				expandedClosePayload: '</>',
			}
		}
		console.error('constructNextOpenToken called on non-block type', { char, existingLevel, nextAll })
		return null
	}

	export const openTokenOf = (level: Level): string => {
		if (level.type === 'lang_block') {
			return level.openToken
		} else if (level.type === 'string_block') {
			return level.openToken
		} else if (level.type === 'jsx_tag_proplist_then_childlist') {
			return level.openPayload
		}
		console.error('openTokenOf called on non-block type', { level })
		return ''
	}

	export const didReachOpenCloseTokens = (char: string, nextChar: string) => {
		if (char === '{' && nextChar === '}') return true
		if (char === '[' && nextChar === ']') return true
		if (char === '(' && nextChar === ')') return true
		return false
	}
}
