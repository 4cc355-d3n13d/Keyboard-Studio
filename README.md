# ORBIT Music Studio + MCP

36 instruments, keyboard/pads, sequencer, Piano Roll, effects and browser audio. The hosted Worker also exposes 15 MCP tools at `/mcp` and an authenticated browser command bridge.

## Build and test

Requires Node.js 22.13+ (Node 24 recommended). No npm dependencies are needed.

```sh
node scripts/build-mcp.mjs
node scripts/validate-mcp-artifact.mjs
node --test tests/mcp.test.mjs
```

`web/` contains the original HTML and bundled Tone.js 14.8.49 (MIT). `mcp/protocol.js` defines the tools and validation, `mcp/browser.js` executes explicit commands in the studio, and `worker/server.js` authenticates, queues and acknowledges commands. The build embeds the HTML, Tone.js and MCP code into `dist/server/index.js`. `build/music-keyboard-studio.html` is the self-contained offline version. Database migrations are in `drizzle/`.

## Hosting and connection

The existing Sites project and audience are retained in `.openai/hosting.json`. It declares the MCP capability and D1 binding `DB`. Sites provisions storage, applies migrations and creates the Site's private MCP plugin when the owner publishes. Connect using that plugin in ChatGPT or Codex. The studio must be open at its hosted URL for live control, and the user must click **Start Audio** once before playback.

Production identity comes from Sites' authenticated `oai-authenticated-user-id` header. Session and command queries are scoped by that identity. Hosting with another provider requires replacing `orbitUser` with that provider's verified identity mechanism.

## MCP behavior

Read tools list instruments, sessions, current state and the current project. Write tools configure the studio, control transport, audition short notes/pads, edit patterns/Piano Roll, generate progressions, undo/redo, load projects and start browser exports. Multiple connected tabs require an explicit `session_id`.

Browser commands are stored in D1, delivered serially, and acknowledged after application. A short timeout returns `command_id` and `status: pending`; check `orbit_command_status` before retrying. Browser-side result caching prevents an acknowledgement retry from playing a note twice. Expired audio commands are not delivered later. The MCP connection button disconnects a browser session and expires its pending commands.

Project snapshots omit sample audio bytes. Samples remain in the browser; JSON export includes them. The server's session cache is not a project backup. MIDI and WAV are downloaded by the browser. WAV uses the real client audio engine and effects, rendering one pattern cycle plus tails. Sequencer playback uses Tone.Transport for musical timing.

## Offline HTML

The standalone HTML works without a network connection and includes a local `window.OrbitControl` API. Its MCP button opens the hosted studio. Remote MCP targets connected web sessions; it does not operate an unrelated `file://` tab.

The original 36 instrument IDs and project version are preserved. Favorites use a separate browser preference key. StringSynth shares the Tone context and implements cached fractional-delay Karplus–Strong strings; the MCP voice is independent of held keyboard notes.
