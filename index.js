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
const http = require('http');
const { Server } = require('socket.io');


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // TODO: Restrict in production
    methods: ["GET", "POST"]
  }
});

// Initialize socket service
require('./src/services/socket.service')(io);

// Initialize maintenance scheduler
const scheduler = require('./src/utils/scheduler');
if (process.env.NODE_ENV !== "test") {
  scheduler.start();
}

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

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Health check route
app.get('/', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

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
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  });

  // Graceful shutdown handling
  const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    
    // Stop the maintenance scheduler
    scheduler.stop();
    
    // Close the server
    server.close(() => {
      console.log('HTTP server closed.');
      
      // Close database connection
      sequelize.close().then(() => {
        console.log('Database connection closed.');
        process.exit(0);
      });
    });
  };

  // Listen for termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

/**
 * The Express application instance.
 * @exports index
 * @type {object}
 */
module.exports = app; // ✅ Export app for testing
