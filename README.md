# Claude Continuity

A local-first Electron desktop app for importing Claude conversation exports and continuing selected conversations through the Anthropic Messages API.

## Implemented in the repository

## GUI preview

![Claude Continuity GUI preview](docs/gui-preview.svg)

> This is a conceptual preview based on the current UI source, not a screenshot of a successfully built or running application. The app has not yet been build-verified.


- Electron + React + TypeScript desktop application
- Import Claude conversation exports in JSON or ZIP format (best-effort parser for common export layouts)
- Continue imported conversations through the Anthropic API
- Choose between configured Claude models in the composer, plus the thinking depth (`effort`) each model supports
- Streamed replies with Markdown rendering (tables, highlighted code with copy buttons), a summarized-thinking panel, and a stop button
- Attachments (images, PDFs, text/code; spreadsheets via code execution) by button, drag and drop, or paste
- Projects with custom instructions and knowledge files, response styles, and optional memory (`memory_20250818`, stored locally)
- Tools per conversation: web search and URL fetch with numbered sources, Skills (Excel/Word/PowerPoint/PDF creation with download), and data analysis via code execution
- Regenerate (with version switching), edit-and-resend, automatic titles, sandboxed HTML/SVG artifact preview, and automatic prompt caching
- Monthly API credit tracker for Max/Team plans: first-run setup (plan → grant day → API key with connection test), estimated remaining credit, expiry countdown, daily budget, and pace warnings; optional calibration from the Console balance
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

## Tests

```bash
npm test
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
