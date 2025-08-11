const filtrosRepo = require('../repositories/filtrosRepository');

async function listarPeriodos() {
  return await filtrosRepo.obtenerPeriodos();
}

async function listarDocentesPorPeriodo(idPeriodo) {
  return await filtrosRepo.obtenerDocentesPorPeriodo(idPeriodo);
}

// servicio (se usa para obtener los distributivos de un docente por periodo para la autoevaluación)
async function listarDistributivosDocentePorPeriodo(idPeriodo, cedulaDocente) {
  return await filtrosRepo.obtenerDistributivosDocentePorPeriodo(idPeriodo, cedulaDocente);
}

async function listarDocentesParaEstudiante(idPeriodo, cedulaEstudiante) {
    return await filtrosRepo.obtenerDocentesParaEstudiante(idPeriodo, cedulaEstudiante);
}

module.exports = {
  listarPeriodos,
  listarDocentesPorPeriodo,
  listarDistributivosDocentePorPeriodo,
  listarDocentesParaEstudiante
};