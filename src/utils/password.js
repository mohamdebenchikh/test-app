/**
 * @fileoverview Utility functions for hashing and comparing passwords.
 * @module utils/password
 */

const bcrypt = require('bcryptjs');

/**
 * Hashes a password using bcrypt.
 * @function hashPassword
 * @param {string} password - The password to hash.
 * @returns {Promise<string>} The hashed password.
 */
const hashPassword = async (password) => {
  return bcrypt.hash(password, 8);
};

/**
 * Compares a plain text password with a hashed password.
 * @function comparePassword
 * @param {string} password - The plain text password.
 * @param {string} hashedPassword - The hashed password.
 * @returns {Promise<boolean>} A promise that resolves to true if the passwords match, and false otherwise.
 */
const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

module.exports = {
  hashPassword,
  comparePassword,
};
