import { describe, expect, test } from 'bun:test'
import { splat } from '../../src/splat/core'

const spaces4 = { type: 'space', numSpaces: 4 } as const
const expanded = (input: string) => splat(input, spaces4)

describe('splat lang blocks', () => {
	test('splits object entries', () => {
		expect(expanded('{a: 1, b: 2}')).toEqual({ changed: true, text: '{\n    a: 1,\n    b: 2\n}' })
	})

	test('tolerates spaces after the opener (previously an infinite loop)', () => {
		expect(expanded('{ a: 1 }')).toEqual({ changed: true, text: '{\n    a: 1\n}' })
	})

	test('preserves the leading indent of the line', () => {
		expect(expanded('    {a: 1}')).toEqual({ changed: true, text: '    {\n        a: 1\n    }' })
	})

	test('keeps nested blocks inline on their sibling line', () => {
		expect(expanded('[a, b(x), c]')).toEqual({ changed: true, text: '[\n    a,\n    b(x),\n    c\n]' })
	})

	test('does not misalign when a string contains the parent closer', () => {
		expect(expanded('[{a: "}", b: 2}, c]')).toEqual({ changed: true, text: '[\n    {a: "}", b: 2},\n    c\n]' })
	})

	test('keeps separators inside strings verbatim', () => {
		expect(expanded('["a, b", "c"]')).toEqual({ changed: true, text: '[\n    "a, b",\n    "c"\n]' })
	})

	test('keeps a trailing separator on its own line', () => {
		expect(expanded('[a, b,]')).toEqual({ changed: true, text: '[\n    a,\n    b,\n]' })
	})

	test('splits call arguments and keeps the prefix', () => {
		expect(expanded('foo({a: 1, b: 2})')).toEqual({ changed: true, text: 'foo(\n    {a: 1, b: 2}\n)' })
	})

	test('does not treat comparisons as JSX', () => {
		expect(expanded('[a<b, c]')).toEqual({ changed: true, text: '[\n    a<b,\n    c\n]' })
	})

	test('trims whitespace before separators and closers', () => {
		expect(expanded('{a: 1 ,b: 2 }')).toEqual({ changed: true, text: '{\n    a: 1,\n    b: 2\n}' })
	})

	test('escaped quotes inside strings', () => {
		expect(expanded(`['it\\'s', "b"]`)).toEqual({ changed: true, text: `[\n    'it\\'s',\n    "b"\n]` })
	})

	test('template literals with interpolations stay inline', () => {
		expect(expanded('[`x ${a} y`, "z"]')).toEqual({ changed: true, text: '[\n    `x ${a} y`,\n    "z"\n]' })
	})
})

describe('splat jsx', () => {
	test('splits props and keeps children inline', () => {
		expect(expanded('<div className="x">y</div>')).toEqual({ changed: true, text: '<div\n    className="x">y</div>' })
	})

	test('re-attaches the self-closing slash to the last prop', () => {
		expect(expanded('<div a b />')).toEqual({ changed: true, text: '<div\n    a\n    b />' })
	})

	test('propless tags with children are a no-op', () => {
		expect(expanded('<div>x</div>')).toEqual({ changed: false, reason: 'nothing-to-expand' })
	})

	test('propless self-closing tags are a no-op', () => {
		expect(expanded('<div />')).toEqual({ changed: false, reason: 'nothing-to-expand' })
	})

	test('text children with spaces stay inline', () => {
		expect(expanded('<p>Hello world</p>')).toEqual({ changed: false, reason: 'nothing-to-expand' })
	})

	test('apostrophes in text children do not open phantom strings', () => {
		expect(expanded("<p>don't do it</p>")).toEqual({ changed: false, reason: 'nothing-to-expand' })
	})

	test('nested tags stay inline', () => {
		expect(expanded('<div><p>a</p><p>b</p></div>')).toEqual({ changed: false, reason: 'nothing-to-expand' })
	})

	test('preserves a space before the closing bracket', () => {
		expect(expanded('<div a >x</div>')).toEqual({ changed: true, text: '<div\n    a >x</div>' })
	})

	test('supports member and hyphenated tag names', () => {
		expect(expanded('<Foo.Bar a="1" />')).toEqual({ changed: true, text: '<Foo.Bar\n    a="1" />' })
		expect(expanded('<foo-bar a />')).toEqual({ changed: true, text: '<foo-bar\n    a />' })
	})

	test('fragments without props are a no-op', () => {
		expect(expanded('<>x</>')).toEqual({ changed: false, reason: 'nothing-to-expand' })
	})

	test('jsx elements inside arrays stay inline', () => {
		expect(expanded('[<div/>, <p/>]')).toEqual({ changed: true, text: '[\n    <div/>,\n    <p/>\n]' })
	})

	test('expression containers in children are untouched', () => {
		expect(expanded('<div>{a, b}</div>')).toEqual({ changed: false, reason: 'nothing-to-expand' })
	})

	test('less-than in text children is untouched', () => {
		expect(expanded('<p>1 < 2</p>')).toEqual({ changed: false, reason: 'nothing-to-expand' })
	})

	test('nested same-name tags keep exact text', () => {
		const input = '<div a><div>b</div></div>'
		expect(expanded(input)).toEqual({ changed: true, text: '<div\n    a><div>b</div></div>' })
	})

	test('preserves the leading indent of the line', () => {
		expect(expanded('    <div a b />')).toEqual({ changed: true, text: '    <div\n        a\n        b />' })
	})
})

describe('splat refusals', () => {
	test('no expandable block', () => {
		expect(expanded('let x = 5')).toEqual({ changed: false, reason: 'no-block-found' })
	})

	test('empty pairs are not expandable', () => {
		expect(expanded('x = {}')).toEqual({ changed: false, reason: 'no-block-found' })
	})

	test('blocks inside strings are not expandable', () => {
		expect(expanded('"a { b } c"')).toEqual({ changed: false, reason: 'no-block-found' })
	})

	test('unbalanced lang block', () => {
		expect(expanded('{a: 1')).toEqual({ changed: false, reason: 'unbalanced' })
	})

	test('unbalanced string', () => {
		expect(expanded('["a')).toEqual({ changed: false, reason: 'unbalanced' })
	})

	test('unterminated jsx children', () => {
		expect(expanded('<div a>x')).toEqual({ changed: false, reason: 'unbalanced' })
	})

	test('dangling open bracket at end of text does not throw', () => {
		expect(expanded('foo <')).toEqual({ changed: false, reason: 'no-block-found' })
	})
})

describe('splat indent specs', () => {
	test('tabs', () => {
		expect(splat('{a: 1}', { type: 'tab' })).toEqual({ changed: true, text: '{\n\ta: 1\n}' })
	})

	test('editor options', () => {
		expect(splat('{a: 1}', { insertSpaces: true, tabSize: 2 })).toEqual({ changed: true, text: '{\n  a: 1\n}' })
	})
})
