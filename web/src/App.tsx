import { FormEvent, useEffect, useMemo, useRef, useState } from "react"

type Suit = "CLUBS" | "DIAMONDS" | "SPADES" | "HEARTS"

type Card = {
  suit: Suit
  rank: number
}

type Player = {
  id: string
  name: string
  connected: boolean
}

type Bid = {
  playerId: string
  tricks: number
}

type PlayedCard = {
  playerId: string
  card: Card
}

type RoundPhase = "BIDDING" | "PLAYING" | "SCORING" | "DONE"

type SafeGame = {
  playerOrder: string[]
  dealerIndex: number
  maxCardsPerPlayer: number
  schedule: number[]
  roundIndex: number
  scores: Record<string, number>
  round: {
    phase: RoundPhase
    playerOrder: string[]
    dealerIndex: number
    cardsPerPlayer: number
    trumpCard: Card
    trumpSuit: Suit
    bids: Bid[]
    currentTrick: {
      leaderId: string
      plays: PlayedCard[]
      leadSuit?: Suit
      winnerId?: string
    }
    lastTrick?: {
      leaderId: string
      plays: PlayedCard[]
      leadSuit?: Suit
      winnerId?: string
    }
    tricksWon: Record<string, number>
    yourHand: Card[]
    handCounts: Record<string, number>
  }
}

type RoomState = {
  code: string
  hostId: string
  youId: string
  players: Player[]
  game?: SafeGame
}

type ServerMessage =
  | { type: "ROOM_STATE"; room: RoomState }
  | { type: "ERROR"; message: string }

function wsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${window.location.host}/ws`
}

function cardLabel(card: Card): string {
  const ranks: Record<number, string> = {
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    10: "10",
    11: "J",
    12: "Q",
    13: "K",
    14: "A",
  }
  const suits: Record<Suit, string> = {
    CLUBS: "♣",
    DIAMONDS: "♦",
    SPADES: "♠",
    HEARTS: "♥",
  }
  return `${ranks[card.rank]}${suits[card.suit]}`
}

function suitLabel(suit: Suit): string {
  return {
    CLUBS: "Clubs",
    DIAMONDS: "Diamonds",
    SPADES: "Spades",
    HEARTS: "Hearts",
  }[suit]
}

function playerName(room: RoomState, playerId: string): string {
  return room.players.find((player) => player.id === playerId)?.name ?? "Unknown"
}

function nextBidder(game: SafeGame): string | undefined {
  const { round } = game
  const n = round.playerOrder.length
  const leaderIndex = round.playerOrder.indexOf(round.currentTrick.leaderId)
  return round.playerOrder[(leaderIndex + round.bids.length) % n]
}

function nextPlayer(game: SafeGame): string | undefined {
  const { round } = game
  const n = round.playerOrder.length
  const leaderIndex = round.playerOrder.indexOf(round.currentTrick.leaderId)
  return round.playerOrder[(leaderIndex + round.currentTrick.plays.length) % n]
}

function forbiddenDealerBid(game: SafeGame): number | undefined {
  const { round } = game
  const dealerId = round.playerOrder[round.dealerIndex]
  if (nextBidder(game) !== dealerId) return undefined

  const sumSoFar = round.bids.reduce((sum, currentBid) => sum + currentBid.tricks, 0)
  const forbidden = round.cardsPerPlayer - sumSoFar
  return forbidden >= 0 && forbidden <= round.cardsPerPlayer ? forbidden : undefined
}

export function App() {
  const socketRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [room, setRoom] = useState<RoomState | null>(null)
  const [name, setName] = useState("")
  const [roomCode, setRoomCode] = useState(() => new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const socket = new WebSocket(wsUrl())
    socketRef.current = socket

    socket.addEventListener("open", () => setConnected(true))
    socket.addEventListener("close", () => setConnected(false))
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data) as ServerMessage
      if (message.type === "ROOM_STATE") {
        setRoom(message.room)
        setError(null)
        window.history.replaceState(null, "", `/?room=${message.room.code}`)
      }
      if (message.type === "ERROR") setError(message.message)
    })

    return () => socket.close()
  }, [])

  function send(message: unknown) {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setError("Not connected to the server")
      return
    }
    socketRef.current.send(JSON.stringify(message))
  }

  function createRoom(event: FormEvent) {
    event.preventDefault()
    send({ type: "CREATE_ROOM", name })
  }

  function joinRoom(event: FormEvent) {
    event.preventDefault()
    send({ type: "JOIN_ROOM", roomCode, name })
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Private card rooms</p>
          <h1>Sitaratas</h1>
          <p className="subtitle">Create a room, share the code, bid tricks, and play with friends.</p>
        </div>
        <div className={connected ? "status online" : "status"}>{connected ? "Online" : "Connecting"}</div>
      </section>

      {error && <div className="error">{error}</div>}

      {!room ? (
        <section className="panel grid two">
          <form onSubmit={createRoom} className="stack">
            <h2>Create Room</h2>
            <label>
              Your name
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} required />
            </label>
            <button type="submit" disabled={!connected}>Create private room</button>
          </form>

          <form onSubmit={joinRoom} className="stack">
            <h2>Join Room</h2>
            {roomCode && <p className="hint">Invite code loaded: {roomCode}</p>}
            <label>
              Your name
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} required />
            </label>
            <label>
              Room code
              <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} maxLength={4} required />
            </label>
            <button type="submit" disabled={!connected}>Join room</button>
          </form>
        </section>
      ) : (
        <RoomView room={room} send={send} />
      )}
    </main>
  )
}

function RoomView({ room, send }: { room: RoomState; send: (message: unknown) => void }) {
  const isHost = room.youId === room.hostId
  const inviteUrl = `${window.location.origin}/?room=${room.code}`

  if (!room.game) {
    return (
      <section className="panel stack">
        <div className="roomHeader">
          <div>
            <p className="eyebrow">Room code</p>
            <h2>{room.code}</h2>
          </div>
          <button type="button" onClick={() => navigator.clipboard?.writeText(inviteUrl)}>Copy invite</button>
        </div>

        <div className="players">
          {room.players.map((player) => (
            <div className="player" key={player.id}>
              <span>{player.name}{player.id === room.hostId ? " · Host" : ""}</span>
              <span className={player.connected ? "pill" : "pill muted"}>{player.connected ? "connected" : "offline"}</span>
            </div>
          ))}
        </div>

        <p className="hint">Need 3-6 players to start.</p>
        {isHost && (
          <button type="button" disabled={room.players.length < 3 || room.players.length > 6} onClick={() => send({ type: "START_GAME" })}>
            Start game
          </button>
        )}
      </section>
    )
  }

  return <GameView room={room} send={send} />
}

function GameView({ room, send }: { room: RoomState; send: (message: unknown) => void }) {
  const game = room.game!
  const [bid, setBid] = useState(0)
  const isHost = room.youId === room.hostId
  const bidder = game.round.phase === "BIDDING" ? nextBidder(game) : undefined
  const playerToAct = game.round.phase === "PLAYING" ? nextPlayer(game) : undefined
  const forbiddenBid = game.round.phase === "BIDDING" ? forbiddenDealerBid(game) : undefined
  const yourTurnToBid = bidder === room.youId
  const yourTurnToPlay = playerToAct === room.youId
  const bidOptions = useMemo(
    () => Array.from({ length: game.round.cardsPerPlayer + 1 }, (_, value) => value),
    [game.round.cardsPerPlayer]
  )

  useEffect(() => {
    if (bid !== forbiddenBid) return
    const nextAllowedBid = bidOptions.find((option) => option !== forbiddenBid)
    if (nextAllowedBid !== undefined) setBid(nextAllowedBid)
  }, [bid, bidOptions, forbiddenBid])

  return (
    <section className="gameLayout">
      <div className="panel stack">
        <div className="roomHeader">
          <div>
            <p className="eyebrow">Room {room.code}</p>
            <h2>Round {game.roundIndex + 1} / {game.schedule.length}</h2>
          </div>
          <div className="status online">{game.round.phase}</div>
        </div>

        <div className="facts">
          <span>Cards: {game.round.cardsPerPlayer}</span>
          <span>Trump: {cardLabel(game.round.trumpCard)} ({suitLabel(game.round.trumpSuit)})</span>
          <span>Dealer: {playerName(room, game.round.playerOrder[game.round.dealerIndex])}</span>
        </div>

        {game.round.phase === "BIDDING" && (
          <div className="actionBox">
            <h3>Bidding</h3>
            <p>{yourTurnToBid ? "Your bid." : `${playerName(room, bidder ?? "")} is bidding.`}</p>
            {forbiddenBid !== undefined && (
              <p className="hint">Dealer cannot bid {forbiddenBid}, because total bids cannot equal {game.round.cardsPerPlayer}.</p>
            )}
            <div className="inline">
              <select value={bid} onChange={(event) => setBid(Number(event.target.value))} disabled={!yourTurnToBid}>
                {bidOptions.map((option) => (
                  <option key={option} value={option} disabled={option === forbiddenBid}>
                    {option}{option === forbiddenBid ? " (not allowed)" : ""}
                  </option>
                ))}
              </select>
              <button type="button" disabled={!yourTurnToBid || bid === forbiddenBid} onClick={() => send({ type: "PLACE_BID", tricks: bid })}>Place bid</button>
            </div>
          </div>
        )}

        {game.round.phase === "PLAYING" && (
          <div className="actionBox">
            <h3>Play</h3>
            <p>{yourTurnToPlay ? "Choose a card from your hand." : `${playerName(room, playerToAct ?? "")} is playing.`}</p>
          </div>
        )}

        {game.round.phase === "SCORING" && (
          <div className="actionBox">
            <h3>Round complete</h3>
            <p>{isHost ? "Advance when everyone has seen the result." : "Waiting for host to advance."}</p>
            {isHost && <button type="button" onClick={() => send({ type: "NEXT_ROUND" })}>Score and next round</button>}
          </div>
        )}

        {game.round.phase === "DONE" && <div className="actionBox"><h3>Game finished</h3></div>}

        <div className="gameground">
          <div className="trumpSpot">
            <span>Trump card</span>
            <strong className={game.round.trumpCard.suit.toLowerCase()}>{cardLabel(game.round.trumpCard)}</strong>
          </div>

          <TrickView
            title="Current Trick"
            room={room}
            plays={game.round.currentTrick.plays}
            leadSuit={game.round.currentTrick.leadSuit}
            winnerId={game.round.currentTrick.winnerId}
            emptyText="No cards played yet. The first card becomes the lead card."
          />

          <TrickView
            title="Last Trick"
            room={room}
            plays={game.round.lastTrick?.plays ?? []}
            leadSuit={game.round.lastTrick?.leadSuit}
            winnerId={game.round.lastTrick?.winnerId}
            emptyText="No completed trick yet."
          />
        </div>

        <div>
          <h3>Your Hand</h3>
          <div className="hand">
            {game.round.yourHand.map((card) => (
              <button className={`card ${card.suit.toLowerCase()}`} type="button" key={`${card.suit}-${card.rank}`} disabled={!yourTurnToPlay} onClick={() => send({ type: "PLAY_CARD", card })}>
                {cardLabel(card)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <aside className="panel stack">
        <h2>Players</h2>
        {room.players.map((player) => (
          <div className="score" key={player.id}>
            <div>
              <strong>{player.name}</strong>
              <p>{game.round.handCounts[player.id] ?? 0} cards · {game.round.tricksWon[player.id] ?? 0} tricks</p>
            </div>
            <span>{game.scores[player.id] ?? 0}</span>
          </div>
        ))}

        <h2>Bids</h2>
        {game.round.bids.length === 0 ? <p className="hint">No bids yet.</p> : game.round.bids.map((bid) => (
          <div className="player" key={bid.playerId}>
            <span>{playerName(room, bid.playerId)}</span>
            <span>{bid.tricks}</span>
          </div>
        ))}
      </aside>
    </section>
  )
}

function TrickView({
  title,
  room,
  plays,
  leadSuit,
  winnerId,
  emptyText,
}: {
  title: string
  room: RoomState
  plays: PlayedCard[]
  leadSuit?: Suit
  winnerId?: string
  emptyText: string
}) {
  const leadCard = plays[0]?.card

  return (
    <div className="trick">
      <div className="trickHeader">
        <h3>{title}</h3>
        {winnerId && <span className="pill">Winner: {playerName(room, winnerId)}</span>}
      </div>
      {leadCard && (
        <p className="leadHint">
          Lead card: <strong>{cardLabel(leadCard)}</strong>. Follow {suitLabel(leadSuit ?? leadCard.suit)} if you can, otherwise play trump.
        </p>
      )}
      <div className="cardsRow">
        {plays.length === 0 ? <span className="hint">{emptyText}</span> : plays.map((play, index) => (
          <div className={`played ${index === 0 ? "lead" : ""}`} key={`${play.playerId}-${play.card.suit}-${play.card.rank}`}>
            <strong>{cardLabel(play.card)}</strong>
            <span>{playerName(room, play.playerId)}</span>
            {index === 0 && <em>lead</em>}
          </div>
        ))}
      </div>
    </div>
  )
}
