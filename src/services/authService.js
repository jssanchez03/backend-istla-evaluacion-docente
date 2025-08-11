const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const usuarioRepo = require('../repositories/usuarioRepository');

async function login(correo, cedula) {
  const usuario = await usuarioRepo.buscarPorCorreoYCedula(correo, cedula);

  if (!usuario) {
    throw new Error('Credenciales incorrectas');
  }

  const token = jwt.sign(
    {
      id: usuario.id,
      correo: usuario.correo,
      cedula: usuario.cedula,
      rol: usuario.rol
    },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn }
  );

  return { token };
}

module.exports = {
  login
};