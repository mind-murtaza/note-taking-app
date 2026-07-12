-- Runs once on first container init. The dev database (notes_dev) is created by
-- POSTGRES_DB; this adds the separate test database required by SDS §7.
CREATE DATABASE notes_test;
