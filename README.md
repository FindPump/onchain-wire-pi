# Onchain Wire — Pi App

A Pi-native news reader for the Pi Browser, built for the Pi Next Hackathon 2026. It republishes the Onchain Wire news pipeline (originally the @xdropseeker wire on X) as a web app that runs inside Pi Browser with Pi sign-in and Pi payments wired in.

```
app(
  name     = Onchain Wire,
  platform = Pi Browser (PiNet-ready),
  format   = English-language news editions, verified against at least two trusted wires before publication
)

architecture(
  frontend = static (index.html, app.js, style.css) rendering editions from feed.json,
  backend  = dependency-free Node server (server.mjs, no packages to install),
  port     = process.env.PORT (default 3141)
)

endpoints(
  GET  /healthz            = liveness probe,
  POST /auth/verify        = verifies the Pi access token from Pi sign-in,
  POST /payments/approve   = server-side approval step of a Pi payment,
  POST /payments/complete  = server-side completion step of a Pi payment
)

run(
  command = node server.mjs,
  env     = PI_API_KEY (the app's Pi API key, set on the host; never committed)
)

compliance(
  assets = SUBMISSION-ASSETS.md (name, description, preview images, demo video),
  policy = privacy.html (privacy policy page served with the app)
)
```
