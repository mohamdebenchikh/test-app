'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('cities', [
      { id: uuidv4(), name_en: 'Agadir', name_ar: 'أكادير', name_fr: 'Agadir', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Beni Mellal', name_ar: 'بني ملال', name_fr: 'Béni Mellal', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Casablanca', name_ar: 'الدار البيضاء', name_fr: 'Casablanca', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Chefchaouen', name_ar: 'شفشاون', name_fr: 'Chefchaouen', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'El Jadida', name_ar: 'الجديدة', name_fr: 'El Jadida', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Essaouira', name_ar: 'الصويرة', name_fr: 'Essaouira', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Fes', name_ar: 'فاس', name_fr: 'Fès', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Kenitra', name_ar: 'القنيطرة', name_fr: 'Kénitra', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Khouribga', name_ar: 'خريبكة', name_fr: 'Khouribga', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Ksar el-Kebir', name_ar: 'القصر الكبير', name_fr: 'Ksar El Kébir', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Larache', name_ar: 'العرائش', name_fr: 'Larache', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Marrakech', name_ar: 'مراكش', name_fr: 'Marrakech', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Meknes', name_ar: 'مكناس', name_fr: 'Meknès', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Mohammedia', name_ar: 'المحمدية', name_fr: 'Mohammédia', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Nador', name_ar: 'الناظور', name_fr: 'Nador', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Ouarzazate', name_ar: 'ورزازات', name_fr: 'Ouarzazate', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Oujda', name_ar: 'وجدة', name_fr: 'Oujda', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Rabat', name_ar: 'الرباط', name_fr: 'Rabat', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Safi', name_ar: 'آسفي', name_fr: 'Safi', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Salé', name_ar: 'سلا', name_fr: 'Salé', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Settat', name_ar: 'سطات', name_fr: 'Settat', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Tangier', name_ar: 'طنجة', name_fr: 'Tanger', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Taza', name_ar: 'تازة', name_fr: 'Taza', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name_en: 'Tetouan', name_ar: 'تطوان', name_fr: 'Tétouan', createdAt: new Date(), updatedAt: new Date() },
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('cities', null, {});
  }
};