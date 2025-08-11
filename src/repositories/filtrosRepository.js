const { dbLectura } = require('../config/database');

// Obtener todos los periodos
async function obtenerPeriodos() {
  const [rows] = await dbLectura.query(`
    SELECT 
    ID_PERIODO AS id_periodo, 
    NOMBRE_PERIODO AS descripcion
  FROM MATRICULACION_PERIODO
  WHERE DELETED_AT_PERIODO IS NULL
  ORDER BY ID_PERIODO DESC
  `);
  return rows;
}

// Obtener docentes/asignaturas por periodo
async function obtenerDocentesPorPeriodo(idPeriodo) {
  const [rows] = await dbLectura.query(`
    SELECT
    nd.ID_DISTRIBUTIVO AS id_distributivo,
    CONCAT(hd.APELLIDOS_1_DOCENTE, ' ', hd.APELLIDOS_2_DOCENTE, ' ', hd.NOMBRES_1_DOCENTE, ' ', hd.NOMBRES_2_DOCENTE) AS docente,
    na.NOMBRE_ASIGNATURA AS asignatura
  FROM NOTAS_DISTRIBUTIVO nd
  LEFT JOIN NOTAS_ASIGNATURA na ON nd.ID_ASIGNATURA_DISTRIBUTIVO = na.ID_ASIGNATURA
  LEFT JOIN HORARIOS_DOCENTE hd ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
  WHERE nd.DELETED_AT_DISTRIBUTIVO IS NULL
    AND nd.ID_PERIODO_DISTRIBUTIVO = ?
  ORDER BY docente ASC
  `, [idPeriodo]);
  return rows;
}

// repositorio (se usa para obtener los distributivos de un docente por periodo para la autoevaluación)
async function obtenerDistributivosDocentePorPeriodo(idPeriodo, cedulaDocente) {
  const [rows] = await dbLectura.query(`
    SELECT
      nd.ID_DISTRIBUTIVO AS id_distributivo,
      na.NOMBRE_ASIGNATURA AS asignatura
    FROM NOTAS_DISTRIBUTIVO nd
    LEFT JOIN NOTAS_ASIGNATURA na ON nd.ID_ASIGNATURA_DISTRIBUTIVO = na.ID_ASIGNATURA
    WHERE nd.DELETED_AT_DISTRIBUTIVO IS NULL
      AND nd.ID_PERIODO_DISTRIBUTIVO = ?
      AND nd.ID_DOCENTE_DISTRIBUTIVO IN (
        SELECT ID_DOCENTE FROM HORARIOS_DOCENTE WHERE CEDULA_DOCENTE = ?
      )
  `, [idPeriodo, cedulaDocente]);
  return rows;
}

async function obtenerDocentesParaEstudiante(idPeriodo, cedulaEstudiante) {
  const [rows] = await dbLectura.query(`
        SELECT DISTINCT
            nd.ID_DISTRIBUTIVO AS id_distributivo,
            CONCAT(hd.NOMBRES_1_DOCENTE, ' ', hd.APELLIDOS_1_DOCENTE) AS docente,
            na.NOMBRE_ASIGNATURA AS asignatura
        FROM MATRICULACION_MATRICULA mm
        JOIN MATRICULACION_ESTUDIANTES me ON mm.ID_ESTUDIANTE_MATRICULA = me.ID_ESTUDIANTES
        JOIN NOTAS_DISTRIBUTIVO nd ON mm.ID_FORMAR_CURSOS_MATRICULA = nd.ID_FORMAR_CURSOS_DISTRIBUTIVO
        JOIN HORARIOS_DOCENTE hd ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
        JOIN NOTAS_ASIGNATURA na ON nd.ID_ASIGNATURA_DISTRIBUTIVO = na.ID_ASIGNATURA
        WHERE me.DOCUMENTO_ESTUDIANTES = ? AND nd.ID_PERIODO_DISTRIBUTIVO = ?
    `, [cedulaEstudiante, idPeriodo]);

  return rows;
}

module.exports = {
  obtenerPeriodos,
  obtenerDocentesPorPeriodo,
  obtenerDistributivosDocentePorPeriodo,
  obtenerDocentesParaEstudiante
};