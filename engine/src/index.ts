export type Suit = "C" | "S" | "H" | "D";
export type Rank = "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";
export type Card = `${Rank}${Suit}`;

// start small, expand later
export function makeDeck36(): Card[] {
  const suits: Suit[] = ["C", "S", "H", "D"];
  const ranks: Rank[] = ["6", "7", "8", "9", "T", "J", "Q", "K", "A"];
  const deck: Card[] = [];
  for (const s of suits) for (const r of ranks) deck.push(`${r}${s}`);
  return deck;
}
