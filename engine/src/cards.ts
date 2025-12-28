export enum Suit {
    Clubs = "CLUBS",
    Diamonds = "DIAMONDS",
    Spades = "SPADES",
    Hearts = "HEARTS"
}

export enum Rank {
    Six = 6,
    Seven,
    Eight,
    Nine,
    Ten,
    Jack,
    Queen,
    King,
    Ace
}

export type Card = {
    suit: Suit
    rank: Rank
}

export const ALL_SUITS: Suit[] = [
    Suit.Clubs,
    Suit.Diamonds,
    Suit.Hearts,
    Suit.Spades
]

export const ALL_RANKS: Rank[] = [
    Rank.Six,
    Rank.Seven,
    Rank.Eight,
    Rank.Nine,
    Rank.Ten,
    Rank.Jack,
    Rank.Queen,
    Rank.King,
    Rank.Ace
]