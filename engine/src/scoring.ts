import { PlayerId, RoundPhase, RoundState } from "./roundState.js"

export type ScoreState = Record<PlayerId, number>

export function initScores(playerOrder: PlayerId[]): ScoreState {
  return Object.fromEntries(playerOrder.map((pid) => [pid, 0]))
}

export function scoreRound(
  round: RoundState,
  scores: ScoreState
): { round: RoundState; scores: ScoreState } {
  if (round.phase !== RoundPhase.Scoring) {
    throw new Error("Round is not ready for scoring")
  }

  const bidMap: Record<PlayerId, number> = Object.fromEntries(
    round.bids.map((b) => [b.playerId, b.tricks])
  )

  const newScores: ScoreState = { ...scores }

  for (const pid of round.playerOrder) {
    const tricks = round.tricksWon[pid] ?? 0
    const bid = bidMap[pid]
    if (bid === undefined) throw new Error(`Missing bid for player ${pid}`)

    const bonus = bid === tricks ? 5 : 0
    newScores[pid] = (newScores[pid] ?? 0) + tricks + bonus
  }

  return {
    round: { ...round, phase: RoundPhase.Done },
    scores: newScores,
  }
}
