import { Level } from '../splat/levels'

export class LevelStack {
	constructor(private items: Level[] = []) {}

	public addToTop (item: Level) {
		this.items.push(item)
	}

	public get top (): Level | undefined {
		return this.items[this.items.length - 1]
	}

	public get isAtRoot (): boolean {
		return this.items.length === 1
	}

	public get size (): number {
		return this.items.length
	}

	public removeTop (): Level | undefined {
		return this.items.pop()
	}
}
