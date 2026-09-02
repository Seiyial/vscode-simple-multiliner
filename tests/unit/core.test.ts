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
		expect(expanded('foo(a, {b: 2})')).toEqual({ changed: true, text: 'foo(\n    a,\n    {b: 2}\n)' })
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

describe('splat call-object fusion', () => {
	test('fuses a lone object argument into the call', () => {
		expect(expanded('fn({ a, b })')).toEqual({ changed: true, text: 'fn({\n    a,\n    b\n})' })
	})

	test('fuses on a member call with a long prefix', () => {
		const input = 'return api.constructibles.createNewEmptyFlowchart.mutate({ name: nameInput, roleName: userRoleInput })'
		expect(expanded(input)).toEqual({
			changed: true,
			text: 'return api.constructibles.createNewEmptyFlowchart.mutate({\n    name: nameInput,\n    roleName: userRoleInput\n})',
		})
	})

	test('keeps a trailing comma on its entry line', () => {
		expect(expanded('fn({ a: 1, b: 2, })')).toEqual({ changed: true, text: 'fn({\n    a: 1,\n    b: 2,\n})' })
	})

	test('strings containing the closer do not break the fusion', () => {
		expect(expanded('fn({ s: "}" })')).toEqual({ changed: true, text: 'fn({\n    s: "}"\n})' })
	})

	test('nested blocks and calls stay verbatim inside the fused object', () => {
		expect(expanded('fn({ a: { b: 1 }, c: g({ d }) })')).toEqual({
			changed: true,
			text: 'fn({\n    a: { b: 1 },\n    c: g({ d })\n})',
		})
	})

	test('trailing chained calls stay on the closer line', () => {
		expect(expanded('fn({ a }).then(g)')).toEqual({ changed: true, text: 'fn({\n    a\n}).then(g)' })
	})

	test('multiple arguments fall back to splitting the call', () => {
		expect(expanded('fn({ a }, b)')).toEqual({ changed: true, text: 'fn(\n    { a },\n    b\n)' })
	})

	test('arrow function arguments are not fused', () => {
		expect(expanded('fn(() => { x() })')).toEqual({ changed: true, text: 'fn(\n    () => { x() }\n)' })
	})

	test('empty object arguments are not fused', () => {
		expect(expanded('fn({})')).toEqual({ changed: true, text: 'fn(\n    {}\n)' })
	})

	test('unbalanced fused calls stay unbalanced', () => {
		expect(expanded('fn({ a }')).toEqual({ changed: false, reason: 'unbalanced' })
	})

	test('preserves the leading indent of the line', () => {
		expect(expanded('    fn({ a })')).toEqual({ changed: true, text: '    fn({\n        a\n    })' })
	})

	test('fuses with tabs', () => {
		expect(splat('fn({ a })', { type: 'tab' })).toEqual({ changed: true, text: 'fn({\n\ta\n})' })
	})
})

describe('splat jsx', () => {
	test('splits props and indents children, close tag at base indent', () => {
		expect(expanded('<div className="x">y</div>')).toEqual({ changed: true, text: '<div\n    className="x"\n>\n    y\n</div>' })
	})

	test('puts the self-closing slash on its own line at the opener indent', () => {
		expect(expanded('<div a b />')).toEqual({ changed: true, text: '<div\n    a\n    b\n/>' })
	})

	test('puts the self-closing slash on its own line even without a preceding space', () => {
		expect(expanded('<div a/>')).toEqual({ changed: true, text: '<div\n    a\n/>' })
	})

	test('indents children of propless tags', () => {
		expect(expanded('<div>x</div>')).toEqual({ changed: true, text: '<div>\n    x\n</div>' })
	})

	test('indents children with tabs', () => {
		expect(splat('<div>x</div>', { type: 'tab' })).toEqual({ changed: true, text: '<div>\n\tx\n</div>' })
	})

	test('preserves the leading indent for children', () => {
		expect(expanded('    <div>x</div>')).toEqual({ changed: true, text: '    <div>\n        x\n    </div>' })
	})

	test('propless self-closing tags are a no-op', () => {
		expect(expanded('<div />')).toEqual({ changed: false, reason: 'nothing-to-expand' })
	})

	test('empty children stay glued', () => {
		expect(expanded('<div></div>')).toEqual({ changed: false, reason: 'nothing-to-expand' })
	})

	test('text children keep their interior spaces on the children line', () => {
		expect(expanded('<p>Hello world</p>')).toEqual({ changed: true, text: '<p>\n    Hello world\n</p>' })
	})

	test('apostrophes in text children do not open phantom strings', () => {
		expect(expanded("<p>don't do it</p>")).toEqual({ changed: true, text: "<p>\n    don't do it\n</p>" })
	})

	test('nested tags are not recursively indented', () => {
		expect(expanded('<div><p>a</p><p>b</p></div>')).toEqual({ changed: true, text: '<div>\n    <p>a</p><p>b</p>\n</div>' })
	})

	test('puts the ending opener on its own line regardless of preceding spaces', () => {
		expect(expanded('<div a >x</div>')).toEqual({ changed: true, text: '<div\n    a\n>\n    x\n</div>' })
	})

	test('supports member and hyphenated tag names', () => {
		expect(expanded('<Foo.Bar a="1" />')).toEqual({ changed: true, text: '<Foo.Bar\n    a="1"\n/>' })
		expect(expanded('<foo-bar a />')).toEqual({ changed: true, text: '<foo-bar\n    a\n/>' })
	})

	test('fragments indent their children', () => {
		expect(expanded('<>x</>')).toEqual({ changed: true, text: '<>\n    x\n</>' })
	})

	test('jsx elements inside arrays stay inline', () => {
		expect(expanded('[<div/>, <p/>]')).toEqual({ changed: true, text: '[\n    <div/>,\n    <p/>\n]' })
	})

	test('expression containers in children are not split', () => {
		expect(expanded('<div>{a, b}</div>')).toEqual({ changed: true, text: '<div>\n    {a, b}\n</div>' })
	})

	test('less-than in text children stays verbatim', () => {
		expect(expanded('<p>1 < 2</p>')).toEqual({ changed: true, text: '<p>\n    1 < 2\n</p>' })
	})

	test('nested same-name tags keep exact text', () => {
		const input = '<div a><div>b</div></div>'
		expect(expanded(input)).toEqual({ changed: true, text: '<div\n    a\n>\n    <div>b</div>\n</div>' })
	})

	test('close tokens inside nested prop strings are not misread', () => {
		const input = '<div><p title="</div>">x</p></div>'
		expect(expanded(input)).toEqual({ changed: true, text: '<div>\n    <p title="</div>">x</p>\n</div>' })
	})

	test('jsx inside expression containers does not affect the close search', () => {
		const input = '<div>{a ? <div>b</div> : c}</div>'
		expect(expanded(input)).toEqual({ changed: true, text: '<div>\n    {a ? <div>b</div> : c}\n</div>' })
	})

	test('nested self-closing same-name tags do not affect the close search', () => {
		expect(expanded('<div><div/></div>')).toEqual({ changed: true, text: '<div>\n    <div/>\n</div>' })
	})

	test('preserves the leading indent of the line', () => {
		expect(expanded('    <div a b />')).toEqual({ changed: true, text: '    <div\n        a\n        b\n    />' })
	})

	test('splats a lone opener line whose children continue below', () => {
		const input = "<Modal title='New Flowchart' isOpen={showNewFlowchartModal} onClose={() => setShowNewFlowchartModal(false)}>"
		expect(expanded(input)).toEqual({
			changed: true,
			text: "<Modal\n    title='New Flowchart'\n    isOpen={showNewFlowchartModal}\n    onClose={() => setShowNewFlowchartModal(false)}\n>",
		})
	})

	test('a lone opener line with a single prop still ends with the closer on its own line', () => {
		expect(expanded('<Modal a >')).toEqual({ changed: true, text: '<Modal\n    a\n>' })
	})

	test('a lone propless opener line is a no-op', () => {
		expect(expanded('<Modal>')).toEqual({ changed: false, reason: 'nothing-to-expand' })
	})

	test('a lone fragment opener line is a no-op', () => {
		expect(expanded('<>')).toEqual({ changed: false, reason: 'nothing-to-expand' })
	})

	test('a truncated prop list stays unbalanced', () => {
		expect(expanded('<Modal a')).toEqual({ changed: false, reason: 'unbalanced' })
	})

	test('a truncated children region stays unbalanced', () => {
		expect(expanded('<Modal a>x')).toEqual({ changed: false, reason: 'unbalanced' })
	})

	test('a truncated prop expression stays unbalanced', () => {
		expect(expanded('<Modal onClose={() => setShow(false)')).toEqual({ changed: false, reason: 'unbalanced' })
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
