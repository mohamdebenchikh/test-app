// OAuth module main index
// This file serves as the main entry point for the OAuth module

const providers = require('./providers');
const config = require('./config');
const services = require('./services');
const controllers = require('./controllers');
const routes = require('./routes');
const middlewares = require('./middlewares');
const utils = require('./utils');

module.exports = {
  providers,
  config,
  services,
  controllers,
  routes,
  middlewares,
  utils,
};