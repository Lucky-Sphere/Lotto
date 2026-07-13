# Malaysia Lottery Scraper

Headless web scraper for Malaysian lottery results using **Puppeteer** and **PostgreSQL**. Includes a responsive SPA viewer built with Bootstrap 5.

Tested on **Ubuntu 22.04 / 24.04 LTS** (WSL2 and bare-metal).

## Supported Operators

| Operator | Website |
|----------|---------|
| Magnum 4D | https://www.magnum4d.my |
| Sports Toto | https://www.sportstoto.com.my |
| Da Ma Cai | https://www.damacai.com.my |

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

A single-page app is served on port 3000:

```bash
npm run web
# Open http://localhost:3000
```

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

- **operators** — name, website_url
- **draws** — operator_id, draw_date (unique per operator), draw_label, scraped_at
- **games** — operator_id, name (unique per operator)
- **draw_results** — draw_id, game_id, prize_tier, numbers[], prize_amount

Re-runs are idempotent — draws are upserted on `(operator_id, draw_date)`.

## License

MIT
