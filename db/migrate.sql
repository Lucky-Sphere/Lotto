CREATE TABLE IF NOT EXISTS operators (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    website_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS draws (
    id SERIAL PRIMARY KEY,
    operator_id INTEGER NOT NULL REFERENCES operators(id),
    draw_date DATE NOT NULL,
    draw_label VARCHAR(50) NOT NULL,
    scraped_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(operator_id, draw_label)
);

CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    operator_id INTEGER NOT NULL REFERENCES operators(id),
    name VARCHAR(100) NOT NULL,
    UNIQUE(operator_id, name)
);

CREATE TABLE IF NOT EXISTS draw_results (
    id SERIAL PRIMARY KEY,
    draw_id INTEGER NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
    game_id INTEGER NOT NULL REFERENCES games(id),
    prize_tier VARCHAR(100) NOT NULL,
    numbers TEXT[] NOT NULL DEFAULT '{}',
    prize_amount DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO operators (name, website_url) VALUES
    ('Sports Toto', 'https://www.sportstoto.com.my'),
    ('Magnum 4D', 'https://www.magnum4d.my'),
    ('Da Ma Cai', 'https://www.damacai.com.my')
ON CONFLICT (name) DO NOTHING;
