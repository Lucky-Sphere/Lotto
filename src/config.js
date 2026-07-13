module.exports = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'lottery',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 },
  },
  sites: {
    sportstoto: {
      url: 'https://www.sportstoto.com.my',
      enabled: true,
    },
    magnum4d: {
      url: 'https://www.magnum4d.my',
      enabled: true,
    },
    damacai: {
      url: 'https://www.damacai.com.my/home',
      enabled: true,
    },
  },
};
