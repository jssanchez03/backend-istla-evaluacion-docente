const filtrosService = require('../services/filtrosService');

async function getPeriodos(req, res) {
  try {
    const periodos = await filtrosService.listarPeriodos();
    res.json(periodos);
  } catch (error) {
    console.error("Error al obtener periodos:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
}

async function getDocentesPorPeriodo(req, res) {
  try {
    const { idPeriodo } = req.params;
    const docentes = await filtrosService.listarDocentesPorPeriodo(idPeriodo);
    res.json(docentes);
  } catch (error) {
    console.error("Error al obtener docentes:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
}

// controlador (se usa para obtener los distributivos de un docente por periodo para la autoevaluación)
async function getDistributivosDocente(req, res) {
  try {
    const { idPeriodo } = req.params;
    const usuario = req.usuario;
    const cedulaDocente = usuario?.cedula;
    if (!cedulaDocente) {
      return res.status(400).json({ error: "Cédula del docente no disponible en el token" });
    }
    const distributivos = await filtrosService.listarDistributivosDocentePorPeriodo(idPeriodo, cedulaDocente);
    res.json(distributivos);
  } catch (error) {
    console.error("Error al obtener distributivos del docente:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
}

async function obtenerDocentesParaEstudiante(req, res) {
    try {
        const idPeriodo = req.params.idPeriodo;
        const cedulaEstudiante = req.usuario.cedula; // ✅ usamos la cédula del token
        const docentes = await filtrosService.listarDocentesParaEstudiante(idPeriodo, cedulaEstudiante);
        res.json(docentes);
    } catch (error) {
        console.error('Error al obtener docentes para estudiante:', error);
        res.status(500).json({ error: 'Error al obtener docentes' });
    }
}

module.exports = {
  getPeriodos,
  getDocentesPorPeriodo,
  getDistributivosDocente,
  obtenerDocentesParaEstudiante
};