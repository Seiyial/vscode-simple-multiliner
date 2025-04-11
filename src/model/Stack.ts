import { trv } from '../utils/trv'

export class LevelStack {
	constructor(private items: trv.Level[] = []) {}

	public wasUsed: boolean = false

	public addToTop (item: trv.Level) {
		this.items.push(item)
	}

	public get top (): trv.Level | undefined {
		return this.items[this.items.length - 1]
	}

	public get topIsLast (): boolean {
		return this.items.length === 1
	}

	public size (): number {
		return this.items.length
	}

	public removeTop (): trv.Level | undefined {
		return this.items.pop()
	}
}