export enum Suit {
    Clubs = "CLUBS",
    Diamonds = "DIAMONDS",
    Spades = "SPADES",
    Hearts = "HEARTS"
}

export enum Rank {
    Two = 2,
    Three,
    Four,
    Five,
    Six,
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
    Rank.Two,
    Rank.Three,
    Rank.Four,
    Rank.Five,
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
