# Malaysia Lottery Scraper

Headless web scraper for Malaysian **4D lottery** results using **Puppeteer** and **PostgreSQL**. Includes a responsive SPA viewer built with Bootstrap 5.

Extracts **4D Classic** (Magnum), **Toto 4D** (Sports Toto), and **1+3D / 3D** (Da Ma Cai) results along with jackpot amounts. (5D, 6D, and other non-4D games are not currently extracted.)

Tested on **Ubuntu 22.04 / 24.04 LTS** (WSL2 and bare-metal).

## Scraped Data

| Operator | Game | Fields |
|----------|------|--------|
| Magnum 4D | 4D Classic | Draw date, draw no, 1st/2nd/3rd prize, Special (10), Consolation (10), Jackpot 1 & 2 amounts |
| Sports Toto | Toto 4D | Draw date, draw no, 1st/2nd/3rd prize, Special (10), Consolation (10), Jackpot 1 & 2 amounts |
| Da Ma Cai | 1+3D, 3D | Draw date, Starter/Consolation prizes, Jackpot amounts |

All operators share the same database tables, distinguished by `operator_id`.

## Requirements

- Node.js 18+
- PostgreSQL 14+

## Setup

```bash
# Install dependencies
npm install

# Create the database
createdb lottery

# Run migration (creates tables + seeds operators)
npm run migrate

# Start scraping
npm start
```

## Web Viewer

A single-page app (Bootstrap 5) is served on port 3000:

```bash
npm run web
# Open http://localhost:3000
```

Draw cards show date, draw no, and a quick-glance row with the top 3 prize numbers. Click to expand full results.

## Configuration

Environment variables (with defaults):

| Variable | Default |
|----------|---------|
| `DB_HOST` | localhost |
| `DB_PORT` | 5432 |
| `DB_NAME` | lottery |
| `DB_USER` | postgres |
| `DB_PASSWORD` | postgres |

## Database Schema

All operators share these tables:

- **operators** — name, website_url
- **draws** — operator_id, draw_date (unique per operator), draw_label, scraped_at
- **games** — operator_id, name (unique per operator)
- **draw_results** — draw_id, game_id, prize_tier, numbers[], prize_amount

Re-runs are idempotent — draws are upserted on `(operator_id, draw_date)`.

## Project Structure

```
├── db/migrate.sql          # Schema + seed operators
├── src/
│   ├── index.js            # Scraper runner (separate browser per site)
│   ├── server.js           # Express API server
│   ├── config.js           # DB + Puppeteer configuration
│   ├── db.js               # PostgreSQL query helpers
│   ├── storage.js          # Save scraped results to DB
│   └── scrapers/
│       ├── magnum4d.js     # Magnum 4D Classic + Jackpot
│       ├── sportstoto.js   # Sports Toto 4D + Jackpot
│       └── damacai.js      # Da Ma Cai 1+3D / 3D + Jackpot
├── public/index.html       # SPA viewer (Bootstrap 5)
└── package.json
```

## License

MIT
