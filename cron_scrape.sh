#!/bin/bash
cd /var/www/html/lotto
node src/index.js >> /var/www/html/lotto/logs/scraper.log 2>&1