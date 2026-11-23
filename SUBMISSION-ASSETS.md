# Onchain Wire — Submission Assets (Pi Next Hackathon 2026)

Drafts for the Developer Portal checklist. All copy is in English, as required.
Status: DRAFT — final values are entered in the Developer Web Console at
submission time.

## App name (English, as it will appear in the portal)

**Onchain Wire**

App URL slug (the portal derives the URL from the name): `onchainwire`
→ PiNet address pattern: `onchainwire.pinet.com` *(verify exact subdomain in the portal at registration).*

## Short description (one line — portal/store listing)

Verified crypto and world news for Pioneers — every story checked against at
least two trusted outlets before it reaches you.

## Long description (portal "About" field)

> **Onchain Wire** is a news reader built for the Pi community. It delivers
> crypto and world news that has been verified before publication: every story
> is checked against at least two trusted international outlets (Reuters, AP,
> BBC, CoinDesk, The Block and others), written in clear English, and published
> with its sources credited on the story itself.
>
> **Why it exists.** Crypto moves on headlines, and Pioneers are flooded with
> rumours, recycled screenshots and unverified claims. Onchain Wire applies a
> newsroom rule — two independent trusted sources or the story does not run —
> so readers can trust what they read and act on it.
>
> **What you get**
> - Five fresh editions every day (morning, midday, afternoon, evening, night),
>   covering crypto markets, major world events and the economy.
> - Category filters (Crypto, War, International, Economy) and a clean,
>   mobile-first reading view designed for Pi Browser.
> - Source credits on every story, so you can check our work.
> - Pi Sign-in: sign in with your Pi account to personalise the experience.
> - Support the newsroom: readers who value independent, verified news can
>   support Onchain Wire with a small Pi payment, processed with Pi payments.
>
> Onchain Wire is free to read. No account is needed to read the news.
>
> Follow the newsroom on X: @xdropseeker (Onchain Wire).

## Logo — PLACEHOLDER NOTES

- Current in-app placeholder: amber rounded square with "OW" wordmark
  (rendered in CSS in `index.html`; not a final asset).
- TODO before submission: export a final logo PNG (portal-required size —
  check the portal checklist at registration; prepare 512×512 and 1024×1024).
- Trademark rule (Mainnet Listing Requirements): the logo must NOT use the
  Pi logo, the π symbol as the dominant element, or anything implying Pi
  endorsement. The amber "OW" newsroom mark complies by design; keep it.

## Preview images — PLACEHOLDER NOTES

The portal requires preview images that show the actual interface.
Capture these from the real app running in Pi Browser (or sandbox) at phone
resolution; do not use mock-ups of features that do not exist.

Shots to capture (in order):
1. Headline list — top of the feed with several verified stories and
   category badges visible.
2. Article view — one full story open, showing headline, body and the
   "Sources:" credit footer.
3. Signed-in state — header showing the "@username" chip after Pi Sign-in.
4. Support surface — the "Support Onchain Wire" card with the Pi payment
   button (test build label visible is fine for hackathon review; remove
   test wording for any later Mainnet listing pass).
5. Category filter — Crypto filter active, showing filtered headlines.

Format notes: PNG, portrait phone aspect (capture on the same class of
device Pi Browser runs on); check the portal for exact pixel requirements
at submission time and re-export to match.

## Other portal fields (prepared values)

- **Privacy policy URL:** `<PUBLIC_HOSTING_URL>/privacy.html` — the
  `privacy.html` in this folder, served by `server.mjs`. Must be a public
  HTTPS URL at submission.
- **App hosting / frontend URL:** the public HTTPS URL where `server.mjs`
  (or its static output) is deployed — see BUILD-NOTES.md hosting section.
- **Category:** News / Media (choose the closest portal category available).
- **Team members:** list @findpump (imam) — every team member must also
  register individually under the Hackathon tab to be prize-eligible.
