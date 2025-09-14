/**
 * @fileoverview The main entry point of the application.
 * @module index
 */

require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");
const {sequelize} = require("./src/models");
const routes = require("./src/routes/index");
const errorHandler = require("./src/middlewares/errorHandler");
const ApiError = require("./src/utils/ApiError");
const logger = require("./src/utils/logger");
const i18next = require('./src/config/i18n');
const i18nextMiddleware = require('i18next-http-middleware');


const app = express();

// i18n middleware
app.use(i18nextMiddleware.handle(i18next));

// Middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production'
}));

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("tiny", {
    stream: { write: (message) => logger.http(message.trim()) }
  }));
}

// API routes
app.use("/api", routes);

// Handle 404 Not Found errors
app.use((req, res, next) => {
  next(new ApiError(404, "errors.routeNotFound"));
});

// Global error handler
app.use(errorHandler);

// Start server only if not in test mode
if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 3000;
  sequelize.sync().then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  });
}

/**
 * The Express application instance.
 * @exports index
 * @type {object}
 */
module.exports = app; // ✅ Export app for testing
