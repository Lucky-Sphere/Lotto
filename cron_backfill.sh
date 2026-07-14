#!/bin/bash
cd /var/www/html/lotto
node src/backfill.js >> /var/www/html/lotto/logs/backfill.log 2>&1