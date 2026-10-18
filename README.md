# Claude Continuity

A local-first Electron desktop app for importing Claude conversation exports and continuing selected conversations through the Anthropic Messages API.

## Implemented in the repository

- Electron + React + TypeScript desktop application
- Import Claude conversation exports in JSON or ZIP format (best-effort parser for common export layouts)
- Continue imported conversations through the Anthropic API
- Choose between configured Claude models in the composer
- Store conversation history and API usage records locally
- Search conversations by title and message text
- Export an individual conversation to JSON and delete conversations
- Store the Anthropic API key using Electron `safeStorage`
- Windows NSIS, macOS DMG, and Linux AppImage packaging configuration
- GitHub Actions build and manual Windows packaging workflows

## Important billing distinction

**Claude Pro/Max subscription usage is not the same as Anthropic API credits.** This application calls the Anthropic API with an API key, so requests are billed under the API organization's billing and credit terms. It does not consume unused Claude Max subscription usage, and it does not read or spend a Claude app/Max allowance. Check the current Anthropic Console and Claude plan terms before using it.

## Data and privacy

- Conversation history and the local token ledger are stored under Electron's user-data directory.
- The API key is encrypted with Electron `safeStorage` where supported.
- When continuing a conversation, the selected recent message context is sent to Anthropic's API.
- Exported conversations may contain private information; keep export files secure.
- API usage shown in the app is a local record of successful requests, not a real-time credit balance or exact cost estimate.

## Known limitations

- The export parser is best-effort; Claude export formats and attachment types vary.
- Images, files, artifacts, tool calls, and other rich message content are not faithfully reconstructed.
- Long context is truncated to a recent character-bounded suffix; automatic summarization and model-specific token budgeting are not implemented.
- API credit balance and expiration are not queried.
- Windows/macOS installers have packaging configuration but are not release-verified.
- The repository has not been validated by a successful build in this environment. Do not treat the application as tested until CI succeeds and a real export is exercised.

## Requirements

- Node.js 20+
- An Anthropic Console API key with API access and available API credits

## Development

```bash
npm install
npm run dev
```

## Type-check and production build

```bash
npm run build
npm start
```

## Package locally

```bash
npm run dist:win
npm run dist:mac
npm run dist:linux
```
