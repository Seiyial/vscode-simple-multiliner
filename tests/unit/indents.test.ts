import { describe, expect, test } from 'bun:test'
import { indents } from '../../src/utils/indents'

describe('indents', () => {
	test('counts indents only at the start of the first line', () => {
		const spec = { type: 'space', numSpaces: 4 } as const
		expect(indents.getNumIndentsInText(spec, 'foo\n    bar')).toBe(0)
		expect(indents.getNumIndentsInText(spec, '        x')).toBe(2)
	})

	test('editor options map to a base indent spec', () => {
		expect(indents.getBaseIndent({ insertSpaces: true, tabSize: 3 })).toEqual({ type: 'space', numSpaces: 3 })
		expect(indents.getBaseIndent({ insertSpaces: false, tabSize: 4 })).toEqual({ type: 'tab' })
		expect(indents.getBaseIndent({ type: 'tab' })).toEqual({ type: 'tab' })
	})

	test('composeIndents clamps negative counts', () => {
		expect(indents.composeIndents({ type: 'space', numSpaces: 2 }, -1)).toBe('')
	})
})
