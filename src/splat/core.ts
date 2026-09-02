import { LevelStack } from '../model/Stack'
import { indents } from '../utils/indents'
import {
	findJsxChildrenClose,
	findSplatTarget,
	findStringEnd,
	isWhitespace,
	matchClose,
	matchOpen,
	openTokenOf,
} from './levels'

export type TSplatFailureReason = 'no-block-found' | 'nothing-to-expand' | 'unbalanced'

export type TSplatResult =
	| { changed: true, text: string }
	| { changed: false, reason: TSplatFailureReason }

// One-degree splat: direct children of the first block in the selection each
// get their own line; everything deeper is copied through verbatim. JSX prop
// lists are splatted, with the closing `>`/`/>` on an own line at the
// opener's indent; JSX children go on their own line at sibling indent with
// the closing tag at base indent, never recursively indented.
export const splat = (rawText: string, indentSource: indents.TIndentSource): TSplatResult => {
	const spec = indents.getBaseIndent(indentSource)
	const text = rawText.trimEnd()
	const numIndents = indents.getNumIndentsInText(spec, text)
	const leadingIndent = indents.composeIndents(spec, numIndents)
	const inText = text.slice(leadingIndent.length)

	const target = findSplatTarget(inText, numIndents)
	if (target === null) {
		return { changed: false, reason: 'no-block-found' }
	}

	const openToken = openTokenOf(target.level)
	const siblingIndent = indents.composeIndents(spec, target.level.numIndentsInSiblings)
	const closeIndent = indents.composeIndents(spec, target.level.numIndentsInSiblings - 1)

	const stack = new LevelStack([target.level])
	let outText = inText.slice(0, target.index) + openToken
	// everything emitted after the opener; a newline in this region means the
	// prop list was splatted onto multiple lines
	const propsStart = outText.length
	let i = target.index + openToken.length
	// lazily emitted newline+indent, flushed just before the next verbatim
	// content so whitespace runs after separators/openers never double up
	let pendingBreak: string | null = '\n' + siblingIndent
	let pendingFromSeparator = false

	const flush = (chunk: string) => {
		if (pendingBreak !== null) {
			outText += pendingBreak
			pendingBreak = null
			pendingFromSeparator = false
		}
		outText += chunk
	}

	const trimTrailingWhitespace = () => {
		outText = outText.replace(/[ \t]+$/, '')
	}

	while (i < inText.length) {
		const top = stack.top
		if (top === undefined) {
			flush(inText.slice(i))
			break
		}

		if (top.type === 'string_block') {
			const end = findStringEnd(inText, i, top.closeToken)
			if (end === -1) {
				return { changed: false, reason: 'unbalanced' }
			}
			flush(inText.slice(i, end + 1))
			stack.removeTop()
			i = end + 1
			continue
		}

		if (top.type === 'jsx_tag' && top.phase === 'children') {
			const close = findJsxChildrenClose(inText, i, top.name)
			if (close === null) {
				return { changed: false, reason: 'unbalanced' }
			}
			const content = inText.slice(i, close.start)
			const closeToken = inText.slice(close.start, close.end)
			if (content.trim() === '') {
				// empty children stay glued to the opener (e.g. `<div></div>`)
				pendingBreak = null
				pendingFromSeparator = false
				outText += content + closeToken
			} else {
				// one verbatim chunk at sibling indent, never split further
				flush(content.trim())
				outText += '\n' + closeIndent + closeToken
			}
			stack.removeTop()
			i = close.end
			continue
		}

		const char = inText[i]

		const close = matchClose(top, inText, i)
		if (close.kind !== 'none') {
			if (top.type === 'jsx_tag') {
				// a splatted prop list ends with its close on an own line at
				// the opener's indent; an empty prop list keeps the close
				// glued (re-attaching the separator's space, e.g. `<div />`)
				const propsAreMultiline = outText.slice(propsStart).includes('\n')
				const hadSeparatorSpace = pendingFromSeparator
				pendingBreak = null
				pendingFromSeparator = false
				if (propsAreMultiline) {
					outText += '\n' + closeIndent + close.token
				} else {
					if (hadSeparatorSpace) {
						outText += ' '
					}
					outText += close.token
				}
				if (close.kind === 'enter-children') {
					// children start on their own line at sibling indent
					pendingBreak = '\n' + siblingIndent
					top.phase = 'children'
				} else {
					stack.removeTop()
				}
			} else if (stack.isAtRoot) {
				trimTrailingWhitespace()
				pendingBreak = null
				pendingFromSeparator = false
				outText += '\n' + closeIndent + close.token
				stack.removeTop()
			} else {
				flush(close.token)
				stack.removeTop()
			}
			i += close.token.length
			continue
		}

		if (isWhitespace(char)) {
			if (stack.isAtRoot && top.type === 'jsx_tag') {
				pendingBreak = '\n' + siblingIndent
				pendingFromSeparator = true
				while (i < inText.length && isWhitespace(inText[i])) {
					i++
				}
			} else if (pendingBreak !== null) {
				i++
			} else {
				flush(char)
				i++
			}
			continue
		}

		if (stack.isAtRoot && top.type === 'lang_block' && char === ',') {
			trimTrailingWhitespace()
			flush(',')
			pendingBreak = '\n' + siblingIndent
			pendingFromSeparator = true
			i++
			continue
		}

		const opened = matchOpen(inText, i, top)
		if (opened !== null) {
			const token = openTokenOf(opened)
			flush(token)
			stack.addToTop(opened)
			i += token.length
			continue
		}

		flush(char)
		i++
	}

	if (stack.size > 0) {
		return { changed: false, reason: 'unbalanced' }
	}
	if (outText === inText) {
		return { changed: false, reason: 'nothing-to-expand' }
	}
	return { changed: true, text: leadingIndent + outText }
}
