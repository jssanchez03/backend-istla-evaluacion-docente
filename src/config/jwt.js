require('dotenv').config();

module.exports = {
  secret: process.env.JWT_SECRET || 'clave_super_secreta',
  expiresIn: '1d'
};
