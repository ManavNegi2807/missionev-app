# Browser tests

These drive the real app in a real browser (Chrome or Edge, already installed; nothing is downloaded) with
[playwright-core](https://playwright.dev). They are the evidence behind the "the full flow works" claims in the README, so anyone can
re-run them.

```bash
npm run dev            # in one terminal: the app on http://localhost:3000
npm run e2e:landing    # in another: the landing page (58 checks, about 4 minutes)
npm run e2e:wallet     # Connect MetaMask sign-in with a scriptable wallet (35 checks, about 3 minutes)
npm run e2e:demo       # demo account, nine journey modes, EV, petrol and cab trips, rewards, analytics (45 checks, about 6 minutes)
npm run e2e            # all three
```

| Script | What it proves |
|---|---|
| `landing.mjs` | The public page: content and links, every mouse effect (cursor spotlight, tilting card, parallax, canvas network, magnetic button, glowing cards), the calculator against the real engine, the live "Ask the chain" panel in every state (and the real `/api/chain` once), reduced motion, touch phones, light and dark, no horizontal scroll from 360 to 1920 px |
| `wallet-login.mjs` | Sign-in with a wallet: no wallet installed, rejected, wrong network, adding Portal V3, switching and locking the account, reloading, signing out, upgrading a demo account, a phone with no extension |
| `demo-flow.mjs` | The whole product with a labelled demo account, in the browser, end to end |

**Options.** `BASE=https://missionev-app.vercel.app npm run e2e:landing` tests the live site instead. `BROWSER_PATH=/path/to/chrome` picks a
browser, and `HEADED=1` shows it. Screenshots are written to `e2e/.artifacts/` (git-ignored).

**About the wallet.** `wallet-login.mjs` installs a small fake EIP-1193 wallet in the page, not the MetaMask extension, so it can reject,
lock and switch networks on command. It tests how the app *behaves* with a wallet; it does not prove the real extension works.

The receipt-scan, screen-size, map and local-chain scripts used during development are not included here yet.
