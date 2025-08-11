const usuarioRepo = require('../repositories/usuarioRepository');

async function obtenerPerfil(req, res) {
  const { id } = req.params;
  const idPeriodo = req.query?.idPeriodo ? Number(req.query.idPeriodo) : null;

  try {
    const datos = await usuarioRepo.obtenerNombreYPerfilPorId(id);
    if (!datos) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    let carrera = null;
    let carreras = [];
    let carrerasCompletas = []; // Para el modal

    try {
      // ESTRATEGIA: Siempre obtener carreras históricas primero, luego filtrar por período si es necesario

      // 1. Obtener TODAS las carreras históricas del docente (para el modal)
      try {
        carrerasCompletas = await usuarioRepo.obtenerCarrerasDocentePorUsuarioId(id); // Sin período
      } catch (e) {
        console.warn('No se pudieron obtener carreras históricas:', e?.message);
        carrerasCompletas = [];
      }

      // 2. Si se especifica período, filtrar las carreras del período actual
      if (idPeriodo && carrerasCompletas.length > 0) {
        try {
          const carrerasPeriodo = await usuarioRepo.obtenerCarrerasDocentePorUsuarioId(id, idPeriodo);
          
          if (carrerasPeriodo && carrerasPeriodo.length > 0) {
            // Usar carreras del período actual como principales
            carreras = carrerasPeriodo;
            carrera = carrerasPeriodo[0];
          } else {
            // Si no hay carreras en el período actual, usar las más recientes (máximo 2)
            carreras = carrerasCompletas.slice(0, 2);
            carrera = carrerasCompletas[0];
          }
        } catch (e) {
          console.warn(`Error al obtener carreras del período ${idPeriodo}:`, e?.message);
          // Fallback a carreras históricas
          carreras = carrerasCompletas.slice(0, 2);
          carrera = carrerasCompletas[0];
        }
      } else {
        // Sin período especificado, intentar detectar el último período activo del docente
        let periodoDetectado = null;
        try {
          periodoDetectado = await usuarioRepo.obtenerUltimoPeriodoDocente(id);
          if (periodoDetectado) {
            const carrerasPeriodo = await usuarioRepo.obtenerCarrerasDocentePorUsuarioId(id, periodoDetectado);
            if (carrerasPeriodo && carrerasPeriodo.length > 0) {
              carreras = carrerasPeriodo;
              carrera = carrerasPeriodo[0];
            } else {
              // Si no hay por período detectado, caer a históricas
              carreras = carrerasCompletas.slice(0, 2);
              carrera = carrerasCompletas[0];
            }
          } else {
            // No se detectó período, usar históricas para no romper UI
            carreras = carrerasCompletas.slice(0, 2);
            carrera = carrerasCompletas[0];
          }
        } catch (e) {
          console.warn('No se pudo detectar período activo del docente:', e?.message);
          carreras = carrerasCompletas.slice(0, 2);
          carrera = carrerasCompletas[0];
        }
      }

      // 3. Fallback para coordinadores
      if (!carrera && (!carreras || carreras.length === 0)) {
        try {
          const carrerasCoordinador = await usuarioRepo.obtenerCarrerasCoordinadorPorUsuarioId(id);
          if (carrerasCoordinador && carrerasCoordinador.length > 0) {
            carreras = carrerasCoordinador;
            carrera = carrerasCoordinador[0];
            carrerasCompletas = carrerasCoordinador;
          }
        } catch (e) {
          console.warn('Error al obtener carreras de coordinador:', e?.message);
        }
      }

      // 4. Fallback para estudiantes u otros casos
      if (!carrera && (!carreras || carreras.length === 0)) {
        try {
          const resultado = await usuarioRepo.obtenerCarreraPorUsuarioId(id, idPeriodo);
          if (resultado) {
            if (resultado.carreras && Array.isArray(resultado.carreras)) {
              carreras = resultado.carreras;
              carrera = resultado.carrera || resultado.carreras[0];
              carrerasCompletas = resultado.carreras;
            } else {
              carrera = resultado;
              carreras = [resultado];
              carrerasCompletas = [resultado];
            }
          }
        } catch (e) {
          console.warn('Fallback de carrera falló:', e?.message);
        }
      }

    } catch (e) {
      console.warn('Error general al obtener carreras para usuario', id, e?.message || e);
    }

    // Preparar respuesta
    const respuesta = {
      ...datos,
      carrera,
      carreras: carreras || [],
      carrerasCompletas: carrerasCompletas || [], // Para el modal
      debug: {
        idPeriodo,
        totalCarreras: carrerasCompletas?.length || 0,
        carrerasPeriodo: carreras?.length || 0
      }
    };

    // Logs de depuración específicos eliminados

    res.json(respuesta);

  } catch (err) {
    console.error("Error al obtener perfil:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
}

module.exports = {
  obtenerPerfil,
};