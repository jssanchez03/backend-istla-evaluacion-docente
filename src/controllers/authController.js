const authService = require('../services/authService');

async function login(req, res) {
  const { correo, cedula } = req.body;

  try {
    const result = await authService.login(correo, cedula);
    res.json(result);
  } catch (err) {
    console.error("Error en login:", err);
    res.status(401).json({ error: err.message || 'Error desconocido' });
  }
}

module.exports = {
  login
};
