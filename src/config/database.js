/**
 * @fileoverview Database configuration for different environments.
 * @module config/database
 */

require("dotenv").config();

/**
 * @exports config/database
 * @type {object}
 * @property {object} development - Configuration for the development environment.
 * @property {string} development.username - The database username.
 * @property {string} development.password - The database password.
 * @property {string} development.database - The database name.
 * @property {string} development.host - The database host.
 * @property {number} development.port - The database port.
 * @property {string} development.dialect - The database dialect (e.g., 'postgres').
 * @property {boolean} development.logging - Whether to log database queries.
 * @property {object} test - Configuration for the test environment.
 * @property {string} test.username - The database username.
 * @property {string} test.password - The database password.
 * @property {string} test.database - The database name for tests.
 * @property {string} test.host - The database host.
 * @property {number} test.port - The database port.
 * @property {string} test.dialect - The database dialect.
 * @property {boolean} test.logging - Whether to log database queries.
 * @property {object} production - Configuration for the production environment.
 * @property {string} production.username - The database username.
 * @property {string} production.password - The database password.
 * @property {string} production.database - The database name.
 * @property {string} production.host - The database host.
 * @property {number} production.port - The database port.
 * @property {string} production.dialect - The database dialect.
 * @property {boolean} production.logging - Whether to log database queries.
 */
module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    logging: false,
  },
  test: {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    logging: false,
  },
};
