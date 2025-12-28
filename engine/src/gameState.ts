import { createRound, PlayerId, RoundState } from "./roundState.js"
import { initScores, ScoreState, scoreRound } from "./scoring.js"

export type GameState = {
  playerOrder: PlayerId[]
  dealerIndex: number

  maxCardsPerPlayer: number
  schedule: number[] // e.g. [1,2,3,...,9,8,...,1]

  roundIndex: number
  round: RoundState

  scores: ScoreState
}

function buildSchedule(max: number): number[] {
  const up: number[] = []
  for (let i = 1; i <= max; i++) up.push(i)
  const down: number[] = []
  for (let i = max - 1; i >= 1; i--) down.push(i)
  return [...up, ...down]
}

function nextDealerIndex(current: number, n: number): number {
  return (current + 1) % n
}

export function computeMaxCardsPerPlayer(nPlayers: number): number {
  // Your stated rules:
  // 3 players -> 12
  // 4 players -> 9
  // Otherwise: floor(36 / nPlayers)
  if (nPlayers === 3) return 12
  if (nPlayers === 4) return 9
  return Math.floor(36 / nPlayers)
}

export function createGame(args: {
  playerOrder: PlayerId[]
  dealerIndex?: number
  rng?: () => number
}): GameState {
  const { playerOrder, rng } = args
  if (playerOrder.length < 3) throw new Error("Need at least 3 players")

  const dealerIndex = args.dealerIndex ?? 0
  const maxCardsPerPlayer = computeMaxCardsPerPlayer(playerOrder.length)
  const schedule = buildSchedule(maxCardsPerPlayer)

  const roundIndex = 0
  const round = createRound({
    roundIndex,
    playerOrder,
    dealerIndex,
    cardsPerPlayer: schedule[0],
    rng,
  })

  return {
    playerOrder,
    dealerIndex,
    maxCardsPerPlayer,
    schedule,
    roundIndex,
    round,
    scores: initScores(playerOrder),
  }
}

export function finishRoundAndStartNext(game: GameState, rng?: () => number): GameState {
  // score current round
  const scored = scoreRound(game.round, game.scores)

  const nextRoundIndex = game.roundIndex + 1
  const nextDealer = nextDealerIndex(game.dealerIndex, game.playerOrder.length)

  // If schedule ended, game ends (for now we just stop advancing)
  if (nextRoundIndex >= game.schedule.length) {
    return {
      ...game,
      roundIndex: nextRoundIndex,
      dealerIndex: nextDealer,
      round: scored.round, // Done
      scores: scored.scores,
    }
  }

  const nextRound = createRound({
    roundIndex: nextRoundIndex,
    playerOrder: game.playerOrder,
    dealerIndex: nextDealer,
    cardsPerPlayer: game.schedule[nextRoundIndex],
    rng,
  })

  return {
    ...game,
    roundIndex: nextRoundIndex,
    dealerIndex: nextDealer,
    round: nextRound,
    scores: scored.scores,
  }
}
