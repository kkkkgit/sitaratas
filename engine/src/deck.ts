import { Card, Rank, Suit, ALL_RANKS, ALL_SUITS } from "./cards.js";

export class Deck {
    private cards: Card[]

    constructor() {
        this.cards = []
        for (const suit of ALL_SUITS) {
            for (const rank of ALL_RANKS) {
                this.cards.push({ suit, rank })
            }
        }
    }

    shuffle(rng: () => number = Math.random) {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]]
        }
    }

    draw(): Card | undefined {
        return this.cards.shift()
    }

    size(): number {
        return this.cards.length
    }
}