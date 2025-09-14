module.exports = (sequelize, DataTypes) => {
  const ServiceTranslation = sequelize.define(
    'ServiceTranslation',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      language: {
        type: DataTypes.ENUM('en', 'ar', 'fr'),
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      timestamps: true,
      tableName: 'service_translations',
    }
  );

  return ServiceTranslation;
};
