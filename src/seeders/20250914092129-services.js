'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const services = [
      { id: uuidv4(), color: 'blue', status: 'active', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), color: 'red', status: 'active', createdAt: new Date(), updatedAt: new Date() },
    ];

    const translations = [
      { id: uuidv4(), service_id: services[0].id, language: 'en', title: 'Plumbing', description: 'Fixing pipes and faucets', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), service_id: services[0].id, language: 'ar', title: 'سباكة', description: 'إصلاح الأنابيب والصنابير', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), service_id: services[0].id, language: 'fr', title: 'Plomberie', description: 'Réparation de tuyaux et de robinets', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), service_id: services[1].id, language: 'en', title: 'Electricity', description: 'Fixing electrical issues', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), service_id: services[1].id, language: 'ar', title: 'كهرباء', description: 'إصلاح المشاكل الكهربائية', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), service_id: services[1].id, language: 'fr', title: 'Électricité', description: 'Réparation des problèmes électriques', createdAt: new Date(), updatedAt: new Date() },
    ];

    await queryInterface.bulkInsert('services', services, {});
    await queryInterface.bulkInsert('service_translations', translations, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('service_translations', null, {});
    await queryInterface.bulkDelete('services', null, {});
  }
};