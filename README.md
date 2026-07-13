# Malaysia Lottery Scraper

Headless web scraper for Malaysian lottery results using **Puppeteer** and **PostgreSQL**.

## Supported Operators

| Operator | Website |
|----------|---------|
| Sports Toto | https://www.sportstoto.com.my |
| Magnum 4D | https://www.magnum4d.my |
| Da Ma Cai | https://www.damacai.com.my |

## Requirements

- Node.js 18+
- PostgreSQL

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
