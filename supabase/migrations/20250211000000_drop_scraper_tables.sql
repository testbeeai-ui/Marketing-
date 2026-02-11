-- Drop scraper tables (agentic-scraper was removed from the project).
-- Safe to run: only drops if tables exist.
DROP TABLE IF EXISTS scrape_results;
DROP TABLE IF EXISTS scraper_accounts;
