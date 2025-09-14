const { sequelize, City, Service, ServiceTranslation } = require('../models');

beforeAll(async () => {
  await sequelize.sync({ force: true });

  await City.bulkCreate([
    { name_en: 'New York' },
    { name_en: 'London' },
    { name_en: 'Paris' },
    { name_en: 'Tokyo' },
    { name_en: 'Sydney' },
  ]);

  const services = [
    { id: 'e4d2b2d4-7b8b-4b8a-9c2c-2b2d8e7b8b2d', name: 'Plumbing' },
    { id: 'f5d2b2d4-7b8b-4b8a-9c2c-2b2d8e7b8b2d', name: 'Electricity' },
  ];
  await Service.bulkCreate(services);

  const serviceTranslations = [
    { service_id: 'e4d2b2d4-7b8b-4b8a-9c2c-2b2d8e7b8b2d', language: 'ar', name: 'السباكة' },
    { service_id: 'e4d2b2d4-7b8b-4b8a-9c2c-2b2d8e7b8b2d', language: 'fr', name: 'Plomberie' },
    { service_id: 'f5d2b2d4-7b8b-4b8a-9c2c-2b2d8e7b8b2d', language: 'ar', name: 'الكهرباء' },
    { service_id: 'f5d2b2d4-7b8b-4b8a-9c2c-2b2d8e7b8b2d', language: 'fr', name: 'Électricité' },
  ];
  await ServiceTranslation.bulkCreate(serviceTranslations);
});

afterAll(async () => {
  await sequelize.close();
});
