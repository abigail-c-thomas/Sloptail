# Sloptail

AI cocktail ordering for a work happy hour. Guests order from their phones at
the deployed URL, a model invents a drink, two bartenders work from the bar
screen. Design notes in `Sloptail/Design.md`; open work in `TODO.md`.

## Layout

```
packages/shared   types, zod schemas, ingredient catalog, classics, recipe validation
packages/state    pure order state machine + selectors (no I/O)
packages/llm      prompts, propose/edit loop, OpenRouter client, evals
packages/ui       React components + stylesheet
packages/printer  Epson ePOS-Print XML: document builder, 1-bit images, rate-limited client
packages/ticket   the drink ticket layout, shared by paper and the web UI
apps/print-bridge Node process next to the printer: prints unprinted orders
apps/server       Cloudflare Worker (Hono) + one Durable Object holding bar state
apps/web          Vite + React SPA: `/` guests, `/bar`, `/screen`, `/admin`, `/tickets`
scripts/load.ts   load test against a running server
```

## Commands

```bash
npm install
npm test            # node --test, no network
npm run typecheck   # tsc -b
npm run dev         # wrangler dev :8787 + vite :5173 (vite proxies /api)
npm run deploy      # build SPA, deploy worker + assets to Cloudflare
npm run eval -- --model <openrouter id> --reps 2   # real model calls, costs money
```

## Deploying

`npm run deploy` from the repo root. Wrangler is logged in machine-wide via
OAuth (`npx wrangler login` from `apps/server` if `npx wrangler whoami` says
otherwise). Production secrets live in Cloudflare, not in the repo:

```bash
cd apps/server
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put BAR_TOKEN
```

Non-secret config (model ids, reasoning effort) is in `apps/server/wrangler.jsonc`.
Local dev reads `apps/server/.dev.vars` (gitignored; copy from `.dev.vars.example`).
Secret values and the live URLs are in `CLAUDE.local.md` (gitignored). Never put
them in this file, the README, or anything committed: the repo is public.

## Receipt printer

Epson TM-T88VI, 80mm paper, Ethernet only (no wifi dongle). It's driven over
HTTP with ePOS-Print XML (`POST /cgi-bin/epos/service.cgi?devid=local_printer`),
so whatever runs the bridge must be on the same network as the printer. The
Worker can't reach it, and the https site can't call its plain-http endpoint.

Getting an address. The printer is set to DHCP and prints its IP on a status
sheet a few seconds after power-on. If the sheet doesn't come out, press the
small recessed button next to the Ethernet port briefly (holding it for ~10s
resets the network settings).

- **On a router with DHCP** (home): plug it into the router, it gets an address
  like any other device.
- **Cable straight into the Mac** (what we use at the venue, where there's only
  guest wifi: guest networks have sign-in pages and stop devices seeing each
  other). The Mac needs a USB-C Ethernet adapter. Either:
  - *Internet Sharing* (preferred, no manual addresses): System Settings →
    General → Sharing → Internet Sharing, share Wi-Fi to the adapter, then
    power-cycle the printer. It prints a 192.168.2.x address.
  - *No DHCP at all*: after a while the printer falls back to Epson's default,
    `192.168.192.168`. Give the Mac an address on that network, on the adapter
    only (needs the user's password; gone on unplug/restart):

    ```bash
    sudo ifconfig en5 alias 192.168.192.10 255.255.255.0    # en5: check with ifconfig
    sudo ifconfig en5 -alias 192.168.192.10                 # undo
    ```

Checks, in order: the port's link light is on; `ifconfig` shows the adapter
`status: active`; `ping <ip>` answers; `curl 'http://<ip>/cgi-bin/epos/service.cgi?devid=local_printer'`
returns 200. Then:

```bash
npm run print -- --printer <ip> --test     # one sample ticket
npm run print -- --token <BAR_TOKEN>       # the bridge; address from /admin unless --printer
```

What we know prints well: the thin underlined-space rule (not `<hline>`, which
the printer ignores outside page mode); bold text. Reverse (white on black)
text came out smudgy, so we don't use it. Text is reduced to ASCII ("1½" →
"1 1/2"). The full 512-dot width clips on the left, so every job sets a
24-dot left margin and a 480-dot print area (40 font A characters a line).
Images are 1-bit at 180 dpi; Atkinson dithering makes greys look good, and
drawings print 288 dots wide with their own blank rows trimmed.

## Conventions

- **Minimal dependencies.** Runtime: react, react-dom, hono, zod. Tooling:
  typescript, vite, wrangler. Node's own test runner and type stripping; no
  router, no CSS framework, no React plugin. Check `npm ls --all` impact before
  adding anything and prefer a platform built-in.
- Relative imports use explicit `.ts` / `.tsx` extensions so Node can run the
  packages directly. No TypeScript parameter properties (type stripping).
- **Background anything slow** (evals, servers, load tests) and keep talking.
  Propose eval sweeps before running them; they cost money.
- Server owns all model calls. The browser never sees the API key.
- Everything is built in the glass: no shake/stir, highball or rocks only.
  Full strength is a standard cocktail (≤22 ml pure alcohol, 10% tolerance).
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
