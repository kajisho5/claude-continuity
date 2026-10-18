# Claude Continuity

Local-first desktop prototype for importing Claude conversation exports and continuing conversations through the Anthropic API.

## Current features
- Electron + React + TypeScript desktop shell
- Anthropic Messages API requests from the Electron main process
- API key encrypted with Electron `safeStorage`
- Import picker for Claude export JSON and ZIP archives
- Best-effort parser for common `conversations.json` structures and message fields
- Local chat persistence in the Electron user-data directory
- Conversation search by title and message content
- Persistent local token usage ledger and cumulative usage panel
- Context window bounded to a recent 120,000-character suffix, with adjacent roles normalized before sending
- Token usage shown for the most recent response
- GitHub Actions build check

## Known limitations
- Export formats vary. The parser is intentionally best-effort and should be validated against a real export before relying on it.
- Rich attachments, images, artifacts, tool-use blocks, and all Claude-specific metadata are not reconstructed yet.
- Imported conversations are converted to plain-text user/assistant messages; continuing a conversation sends the selected message history to the Anthropic API.
- Very long conversations are currently truncated to the most recent 60 messages for API requests; summarization/token budgeting is not implemented.
- API credit balance and expiration are not queried automatically.
- GitHub Actions has been configured, but runs are currently failing before any steps are reported. This is an environment/repository Actions issue until job logs or step-level errors become available; local build success has not yet been verified.
- No signed Windows/macOS installers yet.

## Requirements
- Node.js 20+
- Anthropic Console API key with API access and available credits

## Development
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm start
```

## Security and billing
- Never commit API keys or conversation export files.
- The API key is entered in the app and stored through Electron `safeStorage`.
- Chat history is stored locally in the Electron user-data directory as `chats.json`; protect your OS account and device.
- Prompts and selected conversation context are transmitted to Anthropic when sent to the API.
- The app does not purchase credits or enable auto-reload.
- Verify credit eligibility, expiration, organization, and billing terms in Anthropic Console.
