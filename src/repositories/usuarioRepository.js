const { dbLectura, dbEscritura } = require('../config/database');

async function buscarPorCorreoYCedula(correo, cedula) {
  const [rows] = await dbLectura.query(
    `SELECT 
      ID_USUARIOS AS id, 
      CORREO_USUARIOS AS correo, 
      DOCUMENTO_USUARIOS AS cedula, 
      ID_PERFILES_USUARIOS AS rol 
    FROM SEGURIDAD_USUARIOS 
    WHERE CORREO_USUARIOS = ? AND DOCUMENTO_USUARIOS = ?`,
    [correo, cedula]
  );
  return rows[0];
}

// Obtener el último período (más reciente) donde el docente tiene distributivo activo
async function obtenerUltimoPeriodoDocente(idUsuario) {
  const [rows] = await dbLectura.query(`
    SELECT nd.ID_PERIODO_DISTRIBUTIVO AS id_periodo
    FROM SEGURIDAD_USUARIOS su
    INNER JOIN HORARIOS_DOCENTE hd ON hd.CEDULA_DOCENTE = su.DOCUMENTO_USUARIOS
    INNER JOIN NOTAS_DISTRIBUTIVO nd ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
    WHERE su.ID_USUARIOS = ? AND nd.DELETED_AT_DISTRIBUTIVO IS NULL AND nd.ID_PERIODO_DISTRIBUTIVO IS NOT NULL
    ORDER BY nd.ID_PERIODO_DISTRIBUTIVO DESC
    LIMIT 1
  `, [idUsuario]);
  if (rows && rows.length > 0) return rows[0].id_periodo;
  return null;
}

// Devuelve TODAS las carreras distintas asociadas a un docente (por su usuario)
async function obtenerCarrerasDocentePorUsuarioId(idUsuario, idPeriodo = null) {
  // Construir SQL con filtro opcional por período
  const sqlBase = `
    SELECT DISTINCT 
      mc.ID_CARRERAS AS id_carrera,
      mc.NOMBRE_CARRERAS AS nombre_carrera
    FROM SEGURIDAD_USUARIOS su
    INNER JOIN HORARIOS_DOCENTE hd 
      ON hd.CEDULA_DOCENTE = su.DOCUMENTO_USUARIOS
    LEFT JOIN NOTAS_DISTRIBUTIVO nd 
      ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
    LEFT JOIN NOTAS_ASIGNATURA na
      ON na.ID_ASIGNATURA = nd.ID_ASIGNATURA_DISTRIBUTIVO
    LEFT JOIN MATRICULACION_FORMAR_CURSOS mfc 
      ON mfc.ID_FORMAR_CURSOS = COALESCE(nd.ID_FORMAR_CURSOS_DISTRIBUTIVO, na.ID_FORMAR_CURSOS_ASIGNATURA)
    INNER JOIN MATRICULACION_CARRERAS mc 
      ON mc.ID_CARRERAS = mfc.ID_CARRERA_FORMAR_CURSOS
    WHERE su.ID_USUARIOS = ?
      AND COALESCE(nd.ID_FORMAR_CURSOS_DISTRIBUTIVO, na.ID_FORMAR_CURSOS_ASIGNATURA) IS NOT NULL
      AND (nd.ID_DOCENTE_DISTRIBUTIVO IS NULL OR nd.DELETED_AT_DISTRIBUTIVO IS NULL)`;

  const params = [idUsuario];
  const sql = idPeriodo ? `${sqlBase} AND nd.ID_PERIODO_DISTRIBUTIVO = ?` : sqlBase;
  if (idPeriodo) params.push(idPeriodo);

  const [rows] = await dbLectura.query(sql, params);

  if (!rows || rows.length === 0) return [];
  return rows.map(r => ({ id_carrera: r.id_carrera, nombre_carrera: r.nombre_carrera }));
}

async function obtenerNombreYPerfilPorId(id) {
  const [rows] = await dbLectura.query(
    `SELECT 
      CONCAT(NOMBRES_USUARIOS, ' ', APELLIDOS_USUARIOS) AS nombre,
      ID_PERFILES_USUARIOS AS perfil_id,
      IMAGEN_USUARIOS AS imagen,
      GENERO_USUARIOS AS genero
    FROM SEGURIDAD_USUARIOS
    WHERE ID_USUARIOS = ?`,
    [id]
  );
  return rows[0];
}

async function obtenerEvaluacionPorId(idEvaluacion) {
  try {
    // Primero obtenemos los datos básicos de la evaluación
    const [rows] = await dbEscritura.query(`
            SELECT 
                e.id_evaluacion,
                e.id_formulario,
                e.id_periodo,
                e.fecha_inicio,
                e.fecha_fin,
                e.fecha_notificacion,
                e.estado,
                f.nombre AS nombre_formulario
            FROM evaluaciones e
            LEFT JOIN formularios f ON e.id_formulario = f.id_formulario
            WHERE e.id_evaluacion = ?
        `, [idEvaluacion]);

    if (rows.length === 0) {
      return null;
    }

    const evaluacion = rows[0];
    // Si tiene periodo, obtener el nombre del periodo desde dbLectura
    if (evaluacion.id_periodo) {
      try {
        const [periodoRows] = await dbLectura.query(`
                    SELECT NOMBRE_PERIODO 
                    FROM MATRICULACION_PERIODO 
                    WHERE ID_PERIODO = ? AND DELETED_AT_PERIODO IS NULL
                `, [evaluacion.id_periodo]);

        evaluacion.nombre_periodo = periodoRows[0]?.NOMBRE_PERIODO || `Periodo ${evaluacion.id_periodo}`;
      } catch (error) {
        console.error('Error obteniendo nombre del periodo:', error);
        evaluacion.nombre_periodo = `Periodo ${evaluacion.id_periodo}`;
      }
    } else {
      evaluacion.nombre_periodo = 'Sin periodo';
    }

    return evaluacion;
  } catch (error) {
    console.error('Error obteniendo evaluación por ID:', error);
    throw error;
  }
}

async function obtenerCorreosEstudiantesPorPeriodo(idPeriodo) {
  const [rows] = await dbLectura.query(`
        SELECT DISTINCT CORREO_USUARIOS, DOCUMENTO_USUARIOS, NOMBRES_USUARIOS, APELLIDOS_USUARIOS
        FROM SEGURIDAD_USUARIOS
        INNER JOIN MATRICULACION_ESTUDIANTES 
           ON DOCUMENTO_USUARIOS = DOCUMENTO_ESTUDIANTES
        INNER JOIN MATRICULACION_MATRICULA 
           ON MATRICULACION_ESTUDIANTES.ID_ESTUDIANTES = MATRICULACION_MATRICULA.ID_ESTUDIANTE_MATRICULA
        WHERE ID_PERFILES_USUARIOS = 14
          AND MATRICULACION_MATRICULA.ID_PERIODO_MATRICULA = ?
          AND SEGURIDAD_USUARIOS.DELETED_AT IS NULL
          AND CORREO_USUARIOS IS NOT NULL
          AND CORREO_USUARIOS != ''
    `, [idPeriodo]);

  return rows.map(row => ({
    correo: row.CORREO_USUARIOS,
    nombre: `${row.NOMBRES_USUARIOS} ${row.APELLIDOS_USUARIOS}`.trim()
  }));

}

async function obtenerCorreosDocentesPorPeriodo(idPeriodo) {
  const [rows] = await dbLectura.query(`
        SELECT DISTINCT su.CORREO_USUARIOS, su.DOCUMENTO_USUARIOS, NOMBRES_USUARIOS, APELLIDOS_USUARIOS
        FROM NOTAS_DISTRIBUTIVO nd
        JOIN HORARIOS_DOCENTE hd 
           ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
        JOIN SEGURIDAD_USUARIOS su 
           ON hd.CEDULA_DOCENTE = su.DOCUMENTO_USUARIOS
        WHERE nd.ID_PERIODO_DISTRIBUTIVO = ?
          AND su.ID_PERFILES_USUARIOS = 15
          AND su.DELETED_AT IS NULL
          AND su.CORREO_USUARIOS IS NOT NULL
          AND su.CORREO_USUARIOS != ''
    `, [idPeriodo]);

  return rows.map(row => ({
    correo: row.CORREO_USUARIOS,
    nombre: `${row.NOMBRES_USUARIOS} ${row.APELLIDOS_USUARIOS}`.trim()
  }));

}

// Obtener correos de docentes que han sido ASIGNADOS para coevaluación en un período
async function obtenerCorreosDocentesAsignadosCoevaluacion(idPeriodo) {
  // 1) Traer IDs de docentes (evaluadores y evaluados) desde BD LOCAL (asignaciones)
  const [idsRows] = await dbEscritura.query(`
        SELECT DISTINCT id_docente_evaluador AS id_docente
        FROM asignaciones_coevaluacion
        WHERE id_periodo = ?
        UNION
        SELECT DISTINCT id_docente_evaluado AS id_docente
        FROM asignaciones_coevaluacion
        WHERE id_periodo = ?
    `, [idPeriodo, idPeriodo]);

  if (!idsRows || idsRows.length === 0) return [];

  const docenteIds = idsRows.map(r => r.id_docente).filter(Boolean);
  if (docenteIds.length === 0) return [];

  // 2) Mapear IDs de docente a correos usando BD INSTITUTO (HORARIOS_DOCENTE -> SEGURIDAD_USUARIOS)
  const placeholders = docenteIds.map(() => '?').join(',');
  const [rows] = await dbLectura.query(`
        SELECT DISTINCT su.CORREO_USUARIOS, su.NOMBRES_USUARIOS, su.APELLIDOS_USUARIOS
        FROM HORARIOS_DOCENTE hd
        JOIN SEGURIDAD_USUARIOS su 
           ON hd.CEDULA_DOCENTE = su.DOCUMENTO_USUARIOS
        WHERE hd.ID_DOCENTE IN (${placeholders})
          AND su.ID_PERFILES_USUARIOS = 15
          AND su.DELETED_AT IS NULL
          AND su.CORREO_USUARIOS IS NOT NULL
          AND su.CORREO_USUARIOS != ''
    `, docenteIds);

  return rows.map(row => ({
    correo: row.CORREO_USUARIOS,
    nombre: `${row.NOMBRES_USUARIOS} ${row.APELLIDOS_USUARIOS}`.trim()
  }));
}

async function obtenerCorreoCoordinador() {
  const [rows] = await dbLectura.query(`
        SELECT CORREO_USUARIOS, DOCUMENTO_USUARIOS, NOMBRES_USUARIOS, APELLIDOS_USUARIOS
        FROM SEGURIDAD_USUARIOS
        WHERE ID_PERFILES_USUARIOS IN (17)
          AND DELETED_AT IS NULL
          AND CORREO_USUARIOS IS NOT NULL
          AND CORREO_USUARIOS != '';
    `);

  return rows.map(row => ({
    correo: row.CORREO_USUARIOS,
    nombre: `${row.NOMBRES_USUARIOS} ${row.APELLIDOS_USUARIOS}`.trim()
  }));
}

// Obtener carreras asignadas a un coordinador por su ID de usuario
async function obtenerCarrerasCoordinadorPorUsuarioId(idUsuario) {
  try {
    // Obtener la cédula del usuario
    const [usuarioRows] = await dbLectura.query(`
      SELECT DOCUMENTO_USUARIOS as cedula
      FROM SEGURIDAD_USUARIOS 
      WHERE ID_USUARIOS = ?
    `, [idUsuario]);

    if (!usuarioRows || usuarioRows.length === 0) {
      return [];
    }

    const cedula = usuarioRows[0].cedula;

    // Obtener las carreras asignadas al coordinador desde la BD local
    const [asignacionesRows] = await dbEscritura.query(`
      SELECT DISTINCT id_carrera
      FROM coordinadores_carreras 
      WHERE cedula_coordinador = ? AND estado = 'ACTIVO'
    `, [cedula]);

    if (!asignacionesRows || asignacionesRows.length === 0) {
      return [];
    }

    // Obtener los nombres de las carreras desde la BD del instituto
    const carreraIds = asignacionesRows.map(row => row.id_carrera);
    const placeholders = carreraIds.map(() => '?').join(',');
    
    const [carrerasRows] = await dbLectura.query(`
      SELECT 
        ID_CARRERAS as id_carrera,
        NOMBRE_CARRERAS as nombre_carrera
      FROM MATRICULACION_CARRERAS 
      WHERE ID_CARRERAS IN (${placeholders}) AND STATUS_CARRERAS = 'ACTIVO'
      ORDER BY NOMBRE_CARRERAS
    `, carreraIds);

    return carrerasRows;
  } catch (error) {
    console.error('Error en obtenerCarrerasCoordinadorPorUsuarioId:', error);
    throw error;
  }
}

// 1. Modificar la función obtenerCarreraPorUsuarioId para que devuelva TODAS las carreras
async function obtenerCarreraPorUsuarioId(idUsuario, idPeriodo = null) {
  // 1) Intentar como ESTUDIANTE
  const [rowsEst] = await dbLectura.query(`
    SELECT DISTINCT 
      mc.ID_CARRERAS AS id_carrera,
      mc.NOMBRE_CARRERAS AS nombre_carrera
    FROM SEGURIDAD_USUARIOS su
    INNER JOIN MATRICULACION_ESTUDIANTES me 
      ON me.DOCUMENTO_ESTUDIANTES = su.DOCUMENTO_USUARIOS
    INNER JOIN MATRICULACION_MATRICULA mm 
      ON mm.ID_ESTUDIANTE_MATRICULA = me.ID_ESTUDIANTES
    INNER JOIN MATRICULACION_FORMAR_CURSOS mfc 
      ON mfc.ID_FORMAR_CURSOS = mm.ID_FORMAR_CURSOS_MATRICULA
    INNER JOIN MATRICULACION_CARRERAS mc 
      ON mc.ID_CARRERAS = mfc.ID_CARRERA_FORMAR_CURSOS
    WHERE su.ID_USUARIOS = ?
  `, [idUsuario]);

  if (rowsEst && rowsEst.length > 0) {
    // Para estudiantes, devolver todas las carreras encontradas
    if (rowsEst.length === 1) {
      return { id_carrera: rowsEst[0].id_carrera, nombre_carrera: rowsEst[0].nombre_carrera };
    } else {
      return { 
        carreras: rowsEst.map(row => ({ id_carrera: row.id_carrera, nombre_carrera: row.nombre_carrera })),
        carrera: rowsEst[0] // Mantener compatibilidad con código existente
      };
    }
  }

  // 2) Intentar como DOCENTE
  const sqlDocBase = `
    SELECT DISTINCT 
      mc.ID_CARRERAS AS id_carrera,
      mc.NOMBRE_CARRERAS AS nombre_carrera
    FROM SEGURIDAD_USUARIOS su
    INNER JOIN HORARIOS_DOCENTE hd 
      ON hd.CEDULA_DOCENTE = su.DOCUMENTO_USUARIOS
    LEFT JOIN NOTAS_DISTRIBUTIVO nd 
      ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
    LEFT JOIN NOTAS_ASIGNATURA na
      ON na.ID_ASIGNATURA = nd.ID_ASIGNATURA_DISTRIBUTIVO
    LEFT JOIN MATRICULACION_FORMAR_CURSOS mfc 
      ON mfc.ID_FORMAR_CURSOS = COALESCE(nd.ID_FORMAR_CURSOS_DISTRIBUTIVO, na.ID_FORMAR_CURSOS_ASIGNATURA)
    INNER JOIN MATRICULACION_CARRERAS mc 
      ON mc.ID_CARRERAS = mfc.ID_CARRERA_FORMAR_CURSOS
    WHERE su.ID_USUARIOS = ?
      AND COALESCE(nd.ID_FORMAR_CURSOS_DISTRIBUTIVO, na.ID_FORMAR_CURSOS_ASIGNATURA) IS NOT NULL
      AND (nd.ID_DOCENTE_DISTRIBUTIVO IS NULL OR nd.DELETED_AT_DISTRIBUTIVO IS NULL)`;

  const paramsDoc = [idUsuario];
  const sqlDoc = idPeriodo ? `${sqlDocBase} AND nd.ID_PERIODO_DISTRIBUTIVO = ?` : sqlDocBase;
  if (idPeriodo) paramsDoc.push(idPeriodo);

  const [rowsDoc] = await dbLectura.query(sqlDoc, paramsDoc);

  if (!rowsDoc || rowsDoc.length === 0) return null;

  // Para docentes, devolver estructura que maneje múltiples carreras
  if (rowsDoc.length === 1) {
    return { id_carrera: rowsDoc[0].id_carrera, nombre_carrera: rowsDoc[0].nombre_carrera };
  } else {
    return {
      carreras: rowsDoc.map(row => ({ id_carrera: row.id_carrera, nombre_carrera: row.nombre_carrera })),
      carrera: rowsDoc[0] // Mantener compatibilidad
    };
  }
}

// 2. Crear una nueva función específica para obtener TODAS las carreras de un docente
async function obtenerTodasLasCarrerasDocente(idUsuario) {
  // Esta función siempre devuelve TODAS las carreras sin filtro de período
  const [rowsDoc] = await dbLectura.query(`
    SELECT DISTINCT 
      mc.ID_CARRERAS AS id_carrera,
      mc.NOMBRE_CARRERAS AS nombre_carrera
    FROM SEGURIDAD_USUARIOS su
    INNER JOIN HORARIOS_DOCENTE hd 
      ON hd.CEDULA_DOCENTE = su.DOCUMENTO_USUARIOS
    LEFT JOIN NOTAS_DISTRIBUTIVO nd 
      ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
    LEFT JOIN NOTAS_ASIGNATURA na
      ON na.ID_ASIGNATURA = nd.ID_ASIGNATURA_DISTRIBUTIVO  
    LEFT JOIN MATRICULACION_FORMAR_CURSOS mfc 
      ON mfc.ID_FORMAR_CURSOS = COALESCE(nd.ID_FORMAR_CURSOS_DISTRIBUTIVO, na.ID_FORMAR_CURSOS_ASIGNATURA)
    INNER JOIN MATRICULACION_CARRERAS mc 
      ON mc.ID_CARRERAS = mfc.ID_CARRERA_FORMAR_CURSOS
    WHERE su.ID_USUARIOS = ?
      AND COALESCE(nd.ID_FORMAR_CURSOS_DISTRIBUTIVO, na.ID_FORMAR_CURSOS_ASIGNATURA) IS NOT NULL
      AND (nd.ID_DOCENTE_DISTRIBUTIVO IS NULL OR nd.DELETED_AT_DISTRIBUTIVO IS NULL)
    ORDER BY mc.NOMBRE_CARRERAS`, [idUsuario]);

  return rowsDoc.map(row => ({ id_carrera: row.id_carrera, nombre_carrera: row.nombre_carrera }));
}

// 3. Modificar la función obtenerCarrerasDocentePorUsuarioId para asegurar que devuelva TODAS
// (Esta función ya está bien implementada, pero añadir ORDER BY para consistencia)
async function obtenerCarrerasDocentePorUsuarioIdMejorada(idUsuario, idPeriodo = null) {
  const sqlBase = `
    SELECT DISTINCT 
      mc.ID_CARRERAS AS id_carrera,
      mc.NOMBRE_CARRERAS AS nombre_carrera
    FROM SEGURIDAD_USUARIOS su
    INNER JOIN HORARIOS_DOCENTE hd 
      ON hd.CEDULA_DOCENTE = su.DOCUMENTO_USUARIOS
    LEFT JOIN NOTAS_DISTRIBUTIVO nd 
      ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
    LEFT JOIN NOTAS_ASIGNATURA na
      ON na.ID_ASIGNATURA = nd.ID_ASIGNATURA_DISTRIBUTIVO
    LEFT JOIN MATRICULACION_FORMAR_CURSOS mfc 
      ON mfc.ID_FORMAR_CURSOS = COALESCE(nd.ID_FORMAR_CURSOS_DISTRIBUTIVO, na.ID_FORMAR_CURSOS_ASIGNATURA)
    INNER JOIN MATRICULACION_CARRERAS mc 
      ON mc.ID_CARRERAS = mfc.ID_CARRERA_FORMAR_CURSOS
    WHERE su.ID_USUARIOS = ?
      AND COALESCE(nd.ID_FORMAR_CURSOS_DISTRIBUTIVO, na.ID_FORMAR_CURSOS_ASIGNATURA) IS NOT NULL
      AND (nd.ID_DOCENTE_DISTRIBUTIVO IS NULL OR nd.DELETED_AT_DISTRIBUTIVO IS NULL)`;

  const params = [idUsuario];
  const sql = idPeriodo ? `${sqlBase} AND nd.ID_PERIODO_DISTRIBUTIVO = ? ORDER BY mc.NOMBRE_CARRERAS` : `${sqlBase} ORDER BY mc.NOMBRE_CARRERAS`;
  if (idPeriodo) params.push(idPeriodo);

  const [rows] = await dbLectura.query(sql, params);

  if (!rows || rows.length === 0) return [];
  return rows.map(r => ({ id_carrera: r.id_carrera, nombre_carrera: r.nombre_carrera }));
}

// Exportar las nuevas funciones
module.exports = {
  buscarPorCorreoYCedula,
  obtenerNombreYPerfilPorId,
  obtenerCorreosEstudiantesPorPeriodo,
  obtenerCorreosDocentesPorPeriodo,
  obtenerCorreosDocentesAsignadosCoevaluacion,
  obtenerCorreoCoordinador,
  obtenerEvaluacionPorId,
  obtenerCarreraPorUsuarioId, // Función modificada
  obtenerCarrerasDocentePorUsuarioId: obtenerCarrerasDocentePorUsuarioIdMejorada, // Usar la versión mejorada
  obtenerTodasLasCarrerasDocente, // Nueva función
  obtenerCarrerasCoordinadorPorUsuarioId, // Nueva función para coordinadores
  obtenerUltimoPeriodoDocente
};