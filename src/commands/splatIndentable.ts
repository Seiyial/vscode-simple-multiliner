import * as vscode from 'vscode'
import { LevelStack } from '../model/Stack'
import { indents } from '../utils/indents'
import { selector } from '../utils/selector'
import { trv } from '../utils/trv'

export const splatIndentableCommand = () => {
	const editor = vscode.window.activeTextEditor

	if (!editor) {
		return
	}

	const { fullSelection, text } = selector.fullySelectAllLines(editor)

	const indentInfo = indents.extractCurrentAndPlusOne(text, editor.options)
	let inText = text.slice(indentInfo.currPayload.length)
	let outText = ''

	const firstLevel = trv.createFirstLevelSpec(inText, indentInfo.currNum)
	if (!firstLevel) {
		console.log('no first level found')
		return null
	}
	const stack = new LevelStack([firstLevel.firstLevelSpec])
	
	console.log({ indentInfo, inText, outText, firstLevelSkip: firstLevel.skip })

	let i = firstLevel.skip
	console.log('i starts at', i, text[i])
	outText += text.slice(0, i)
	outText += '\n'
	outText += indents.composeIndents(indentInfo.spec, stack.top!.numIndentsInSiblings)

	// remove first space
	if (inText[i] === ' ') {
		i++
	}

	console.log('outText starts as', outText)

	while (i < inText.length) {
		
		if (!stack.top) {
			outText += trv.restOfText(i, inText)
			break
		}

		const char = inText[i]

		const operateSiblings = stack.topIsLast
		const indentNextStacks = stack.size() === 0
		console.log(`[${char}]`, 'operateIndents?', operateSiblings, stack.top.type, stack.size())
		
		const isCloseToken = trv.didReachCloseToken(char, inText[i + 1], inText[i - 1], stack.top)
		if (isCloseToken) {
			if (operateSiblings) {
				console.log('newline <- close token')
				// remove the last indent after the last sibling
				const previousIndent = indents.composeIndents(indentInfo.spec, stack.top.numIndentsInSiblings)
				if (outText.endsWith(previousIndent)) {
					outText = outText.slice(0, -previousIndent.length)
				} else {
					outText += '\n'
				}
				outText += indents.composeIndents(indentInfo.spec, stack.top.numIndentsInSiblings - 1)
			}
			const closeToken = trv.closeTokenOf(stack.top, char)
			outText += closeToken
			i += closeToken.length

			if (isCloseToken === 'jsx_into_children') {
				(stack.top as trv.Level & { type: 'jsx_tag_proplist_then_childlist' }).isInProplist = false
			} else {
				stack.removeTop()
			}

			if (operateSiblings && isCloseToken === 'jsx_into_children') {
				// we need to handle jsx into children
				console.log('newline <- jsx into children')
				outText += '\n'
				outText += indents.composeIndents(indentInfo.spec, stack.top.numIndentsInSiblings)
			}
			continue
		}

		if (!operateSiblings) {
			// we don't want to newline for nestings, for now, because e.g. JSX props <Tag prop1={value} /> we need to Not detect ={ as an open token, and there are other cases,
			// and we need to eval when and how to indent
			// we don't use this for these detailed stuff that much, we can just go to the place we want to double-indent and exec the command again
			outText += char
			i++
			continue
		}

		const didReachOpenClose = trv.didReachOpenCloseTokens(char, inText[i + 1])
		if (didReachOpenClose) {
			outText += char
			outText += inText[i + 1]
			i += 2
			continue
		}

		// we need to handle open token
		const didReachOpenToken = trv.didReachOpenTokenHalp(char, stack.top, inText[i + 1], inText[i + 2])
		if (didReachOpenToken) {
			const nextLevel = trv.constructNextOpenToken(char, stack.top, inText.slice(i + 2))
			if (!nextLevel) {
				console.error('Errored constructing next open level. Oops!')
				outText += char
				i++
				continue
			}
			const openToken = trv.openTokenOf(nextLevel)
			stack.addToTop(nextLevel)

			outText += openToken
			if (stack.top.type !== 'string_block') {
				if (indentNextStacks) {
					console.log('newline <- open token', openToken)
					outText += '\n'
					outText += indents.composeIndents(indentInfo.spec, stack.top.numIndentsInSiblings + 1)
				}
			}
			i += openToken.length

			// skip spaces
			while (i < inText.length && inText[i] === ' ') i++

			continue
		}

		// we need to handle sibling token
		const isSiblingToken = trv.didReachSiblingSeparator(char, stack.top)
		if (isSiblingToken) {
			console.log('exec 1 sibling newline')
			outText += char
			outText += '\n'
			outText += indents.composeIndents(indentInfo.spec, stack.top.numIndentsInSiblings)
			i++

			// skip spaces
			while (i < inText.length && inText[i] === ' ') { console.log('skip 1 space'); i++ }
			
			continue
		}

		// otherwise we do nothing special
		outText += char
		i++
		continue
	}

	// replace the full selection with outText
	editor.edit(editBuilder => {
		editBuilder.replace(fullSelection, outText)
	})
	console.log('outText', outText)
	console.log('fullSelection', fullSelection)

}