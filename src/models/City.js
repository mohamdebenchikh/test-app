module.exports = (sequelize, DataTypes) => {
  const City = sequelize.define(
    'City',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name_en: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name_ar: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name_fr: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lng: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      lat: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      tableName: 'cities',
    }
  );

  return City;
};