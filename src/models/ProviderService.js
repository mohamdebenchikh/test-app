module.exports = (sequelize, DataTypes) => {
  const ProviderService = sequelize.define(
    'ProviderService',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
    },
    {
      timestamps: true,
      tableName: 'provider_services',
    }
  );

  return ProviderService;
};
