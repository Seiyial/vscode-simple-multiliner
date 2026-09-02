import { LevelStack } from '../model/Stack'
import { indents } from '../utils/indents'
import {
	findSplatTarget,
	findStringEnd,
	isWhitespace,
	matchClose,
	matchOpen,
	openTokenOf,
	jsxCloseTokenOf,
} from './levels'

export type TSplatFailureReason = 'no-block-found' | 'nothing-to-expand' | 'unbalanced'

export type TSplatResult =
	| { changed: true, text: string }
	| { changed: false, reason: TSplatFailureReason }

// One-degree splat: direct children of the first block in the selection each
// get their own line; everything deeper is copied through verbatim. JSX prop
// lists are splatted, JSX children stay inline on the last prop line.
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
	let i = target.index + openToken.length
	// lazily emitted newline+indent, flushed just before the next verbatim
	// content so whitespace runs after separators/openers never double up
	// a fragment starts in the children phase, whose content is inline
	// verbatim, so no break is pending after its opener
	const isFragment = target.level.type === 'jsx_tag' && target.level.phase === 'children'
	let pendingBreak: string | null = isFragment ? null : '\n' + siblingIndent
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
			const closeToken = jsxCloseTokenOf(top.name)
			const end = inText.indexOf(closeToken, i)
			if (end === -1) {
				return { changed: false, reason: 'unbalanced' }
			}
			flush(inText.slice(i, end + closeToken.length))
			stack.removeTop()
			i = end + closeToken.length
			continue
		}

		const char = inText[i]

		const close = matchClose(top, inText, i)
		if (close.kind !== 'none') {
			if (top.type === 'jsx_tag') {
				// jsx closes glue to the current line; when the pending break
				// came from a prop separator, its space is re-attached
				if (pendingFromSeparator) {
					outText += ' '
				}
				pendingBreak = null
				pendingFromSeparator = false
				outText += close.token
				if (close.kind === 'enter-children') {
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
