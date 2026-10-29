# Eversimmer FM

A pot of music that never stops simmering. It plays in your browser, from a broth that is kept warm on a server and seasoned by whatever is around it: a room full of people talking, or the weather somewhere far north.

What goes in, and how it turns into sound, is for you to find out.

## Run

```bash
npm install
npm run dev
```

Then open the address Vite prints. With `ANTHROPIC_API_KEY` in a `.env` at the root, the room is read by Claude and a resident live coder cooks a new course when asked; `LIVE_CODER=on` lets it cook on its own, which costs money. Without a key it still plays.

`npm run check` typechecks and runs the tests. `deploy/` has what it takes to keep a pot on a Raspberry Pi.

## Licence

GNU AGPL 3.0 or later. Whoever listens can have the source of what plays: every pot points at the exact version it plays from `/source`.
