const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'No se proporcionó token' });
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  jwt.verify(token, jwtConfig.secret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.usuario = decoded;
    next();
  });
}

// 🛡️ Middleware adicional para verificar roles
function verificarRol(rolesPermitidos = []) {
  return (req, res, next) => {
    const { rol } = req.usuario;
    if (!rolesPermitidos.includes(rol)) {
      return res.status(403).json({ error: 'Acceso denegado, rol no autorizado' });
    }
    next();
  };
}

module.exports = {
  verificarToken,
  verificarRol
};
