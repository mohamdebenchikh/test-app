/**
 * @fileoverview Defines the Token model for Sequelize.
 * @module models/Token
 */

/**
 * Defines the Token model.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The Token model.
 */
module.exports = (sequelize, DataTypes) => {
    /**
     * @class Token
     * @classdesc The Token model.
     * @property {string} id - The UUID of the token.
     * @property {string} token - The token string.
     * @property {string} user_id - The ID of the user associated with the token.
     * @property {string} type - The type of the token.
     * @property {Date} expires - The expiration date of the token.
     * @property {boolean} blacklisted - Whether the token is blacklisted.
     */
    const Token = sequelize.define(
        'Token',
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            token: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            user_id: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            type: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            expires: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            blacklisted: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
        },
        {
            timestamps: true,
            tableName: 'tokens',
        }
    );

    return Token;
};
