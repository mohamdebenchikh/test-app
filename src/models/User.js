module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      avatar: {
          type: DataTypes.STRING,
          allowNull: true,
      },
      bio: {
          type: DataTypes.TEXT,
          allowNull: true,
      },
      phone_number: {
          type: DataTypes.STRING,
          allowNull: true,
      },
      role: {
          type: DataTypes.ENUM('client', 'provider'),
          allowNull: false,
      },
      gender: {
          type: DataTypes.ENUM('male', 'female', 'other'),
          allowNull: true,
      },
      birthdate: {
          type: DataTypes.DATE,
          allowNull: true,
      },
      verify: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
      },
      last_seen: {
          type: DataTypes.DATE,
          allowNull: true,
      },
      available_days: {
          type: DataTypes.JSON,
          allowNull: true,
      },
      language: {
          type: DataTypes.ENUM('en', 'ar', 'fr'),
          defaultValue: 'en',
      },
      active_status: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
      },
      city_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      tableName: "users",
    }
  );

  return User;
};
