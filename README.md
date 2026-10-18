# Claude Continuity

Local-first desktop prototype for importing Claude conversation exports and continuing them through the Anthropic API.

## Status

Early prototype. The UI and API request path are in place; the full export parser and persistent conversation database are not implemented yet.

### Included
- Electron + React + TypeScript desktop shell
- Anthropic Messages API request from Electron main process
- API key saved with Electron `safeStorage`
- Conversation workspace UI and export-file picker placeholder
- Git ignore rules for secrets, databases, and exported conversations

### Not yet implemented
- Parse Claude export JSON/ZIP into individual conversations
- Persist chat history locally
- Long-context summarization and token budgeting
- Read actual promotional credit balance/expiry from Console
- Signed Windows/macOS installers and automated tests

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
- The API key is entered in the app and stored through Electron `safeStorage`; do not put real keys in source files.
- The app does not purchase credits or enable auto-reload.
- Prompts and selected conversation context are transmitted to Anthropic when sent to the API.
- Verify credit eligibility, expiration, organization, and billing terms in Anthropic Console.
