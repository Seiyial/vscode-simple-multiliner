import { describe, expect, test } from 'bun:test'
import {
	findSplatTarget,
	findStringEnd,
	matchClose,
	matchJsxNameAt,
	openTokenOf,
} from '../../src/splat/levels'

describe('matchJsxNameAt', () => {
	test('matches plain tag names', () => {
		expect(matchJsxNameAt('<div x', 1)).toBe('div')
	})

	test('matches hyphenated names', () => {
		expect(matchJsxNameAt('<foo-bar x', 1)).toBe('foo-bar')
	})

	test('matches member expressions', () => {
		expect(matchJsxNameAt('<Foo.Bar x', 1)).toBe('Foo.Bar')
	})

	test('matches names containing digits', () => {
		expect(matchJsxNameAt('<h1 x', 1)).toBe('h1')
	})

	test('rejects non-letter starts', () => {
		expect(matchJsxNameAt('<3 x', 1)).toBeNull()
		expect(matchJsxNameAt('</div>', 1)).toBeNull()
	})
})

describe('findSplatTarget', () => {
	test('finds the first non-empty lang block', () => {
		const target = findSplatTarget('foo(a)', 0)
		expect(target?.level.type).toBe('lang_block')
		expect(target?.index).toBe(3)
		expect(target?.level.numIndentsInSiblings).toBe(1)
	})

	test('fuses a call with a single object argument', () => {
		const target = findSplatTarget('foo({a: 1})', 0)
		expect(target?.level.type).toBe('call_object')
		expect(target?.index).toBe(3)
		expect(target?.level.numIndentsInSiblings).toBe(1)
		expect(openTokenOf(target!.level)).toBe('({')
	})

	test('does not fuse calls with several arguments', () => {
		expect(findSplatTarget('foo({a}, b)', 0)?.level.type).toBe('lang_block')
	})

	test('does not fuse calls with empty object arguments', () => {
		expect(findSplatTarget('foo({})', 0)?.level.type).toBe('lang_block')
	})

	test('skips empty pairs', () => {
		expect(findSplatTarget('x = {}', 0)).toBeNull()
		expect(findSplatTarget('{ }', 0)).toBeNull()
		expect(findSplatTarget('f(  )', 0)).toBeNull()
	})

	test('does not hang on spaces after an opener', () => {
		expect(findSplatTarget('{ a: 1 }', 0)).toEqual({
			level: { type: 'lang_block', openToken: '{', closeToken: '}', numIndentsInSiblings: 1 },
			index: 0,
		})
	})

	test('finds a jsx tag', () => {
		const target = findSplatTarget('<div a />', 0)
		expect(target?.level.type).toBe('jsx_tag')
		expect(target?.index).toBe(0)
		expect(openTokenOf(target!.level)).toBe('<div')
	})

	test('finds a jsx fragment', () => {
		const target = findSplatTarget('hello <>x</>', 0)
		expect(target?.level.type).toBe('jsx_tag')
		expect(openTokenOf(target!.level)).toBe('<>')
	})

	test('ignores closing tags', () => {
		expect(findSplatTarget('</div>({a})', 0)?.index).toBe(6)
	})

	test('does not find blocks inside strings', () => {
		expect(findSplatTarget('"a { b } c"', 0)).toBeNull()
	})

	test('finds nothing in plain code', () => {
		expect(findSplatTarget('let x = 5', 0)).toBeNull()
	})
})

describe('findStringEnd', () => {
	test('finds an unescaped closer', () => {
		expect(findStringEnd('ab"c', 0, '"')).toBe(2)
	})

	test('skips an escaped closer', () => {
		expect(findStringEnd('ab\\"cd"', 0, '"')).toBe(6)
	})

	test('treats an escaped backslash before the closer as a real closer', () => {
		expect(findStringEnd('ab\\\\"c"', 0, '"')).toBe(4)
	})

	test('returns -1 when unterminated', () => {
		expect(findStringEnd('abc', 0, '"')).toBe(-1)
	})
})

describe('matchClose', () => {
	test('lang block closers', () => {
		const level = findSplatTarget('{a}', 0)!.level
		expect(matchClose(level, '}', 0)).toEqual({ kind: 'pop', token: '}' })
		expect(matchClose(level, 'a', 0).kind).toBe('none')
	})

	test('jsx props self-close and enter-children', () => {
		const level = findSplatTarget('<div a>', 0)!.level
		expect(matchClose(level, 'a /> b', 2)).toEqual({ kind: 'pop', token: '/>' })
		expect(matchClose(level, '>', 0)).toEqual({ kind: 'enter-children', token: '>' })
		expect(matchClose(level, 'a', 0).kind).toBe('none')
	})

	test('call object closers', () => {
		const level = findSplatTarget('f({a})', 0)!.level
		expect(matchClose(level, '})', 0)).toEqual({ kind: 'pop', token: '})' })
		expect(matchClose(level, '}', 0).kind).toBe('none')
	})
})
