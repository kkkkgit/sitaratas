# sitaratas
Multiplayer trick-taking card game.

## Rules Implemented

- 36-card deck from 6 to ace.
- 3-6 players.
- Bidding starts after the dealer and dealer bids last.
- Total bids cannot equal the number of tricks in the round.
- Players must follow the lead suit if possible; otherwise they must play trump if possible.
- Scoring is 1 point per trick plus 5 points for matching the bid exactly.
- The UI shows the exact trump card, current lead card, current trick, and last completed trick.

## Local Development

Install dependencies:

```bash
npm install
```

Run the WebSocket server:

```bash
npm run dev -w server
```

Run the web app in another terminal:

```bash
npm run dev -w web
```

Open the Vite URL, usually `http://localhost:5173`.

## Checks

```bash
npm test
npm run build
```

## Production

The production server serves both the built web app and the WebSocket API.

Build:

```bash
npm run build
```

Start:

```bash
npm start
```

Health check:

```text
/health
```

## Railway

Use these commands in Railway if it does not auto-detect them:

Build command:

```bash
npm run build
```

Start command:

```bash
npm start
```

The app uses Railway's `PORT` environment variable automatically.
