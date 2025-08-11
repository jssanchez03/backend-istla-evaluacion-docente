const { dbLectura, dbEscritura } = require('../config/database');

// Crear una nueva evaluación
async function crearEvaluacion(data) {
    try {
        const campos = [];
        const valores = [];
        if (data.id_formulario !== undefined) {
            campos.push('id_formulario');
            valores.push(data.id_formulario);
        }
        if (data.id_periodo !== undefined) {
            campos.push('id_periodo');
            valores.push(data.id_periodo);
        }
        if (data.fecha_inicio !== undefined) {
            campos.push('fecha_inicio');
            valores.push(data.fecha_inicio);
        }
        if (data.fecha_fin !== undefined) {
            campos.push('fecha_fin');
            valores.push(data.fecha_fin);
        }
        if (data.estado !== undefined) {
            campos.push('estado');
            valores.push(data.estado);
        }
        if (data.fecha_notificacion !== undefined) {
            campos.push('fecha_notificacion');
            valores.push(data.fecha_notificacion);
        }
        const placeholders = campos.map(() => '?').join(', ');
        const query = `INSERT INTO evaluaciones (${campos.join(', ')}) VALUES (${placeholders})`;
        const [result] = await dbEscritura.query(query, valores);
        return {
            id: result.insertId,
            ...data
        };
    } catch (error) {
        console.error('Error en crearEvaluacion:', error);
        throw error;
    }
}

// Actualizar fecha de notificación
async function actualizarFechaNotificacion(idEvaluacion, fechaNotificacion) {
    try {
        const [result] = await dbEscritura.query(
            'UPDATE evaluaciones SET fecha_notificacion = ? WHERE id_evaluacion = ?',
            [fechaNotificacion, idEvaluacion]
        );
        if (result.affectedRows === 0) {
            throw new Error('No se pudo actualizar la fecha de notificación');
        }
        return result;
    } catch (error) {
        console.error('Error actualizando fecha de notificación:', error);
        throw error;
    }
}

// Verificar si existe una evaluación del mismo FORMULARIO para el mismo período
async function existeEvaluacionPorFormularioYPeriodo(id_formulario, id_periodo) {
    try {
        const query = `
            SELECT 
                e.id_evaluacion,
                f.nombre as tipo_evaluacion,
                f.id_formulario,
                e.id_periodo
            FROM evaluaciones e 
            INNER JOIN formularios f ON e.id_formulario = f.id_formulario 
            WHERE e.id_formulario = ? AND e.id_periodo = ?
            LIMIT 1
        `;
        const [rows] = await dbEscritura.query(query, [id_formulario, id_periodo]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('Error en existeEvaluacionPorFormularioYPeriodo:', error);
        throw error;
    }
}

// Verificar si existe una evaluación del mismo FORMULARIO para el mismo período (excluyendo una evaluación específica)
async function existeEvaluacionPorFormularioYPeriodoExcluyendo(id_formulario, id_periodo, id_evaluacion_excluir) {
    try {
        const query = `
            SELECT 
                e.id_evaluacion,
                f.nombre as tipo_evaluacion,
                f.id_formulario,
                e.id_periodo
            FROM evaluaciones e 
            INNER JOIN formularios f ON e.id_formulario = f.id_formulario 
            WHERE e.id_formulario = ? AND e.id_periodo = ? AND e.id_evaluacion != ?
            LIMIT 1
        `;
        const [rows] = await dbEscritura.query(query, [id_formulario, id_periodo, id_evaluacion_excluir]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('Error en existeEvaluacionPorFormularioYPeriodoExcluyendo:', error);
        throw error;
    }
}

// Obtener información completa del formulario
async function obtenerFormularioPorId(id_formulario) {
    try {
        const query = `
            SELECT id_formulario, nombre 
            FROM formularios 
            WHERE id_formulario = ?
        `;
        const [rows] = await dbEscritura.query(query, [id_formulario]);
        return rows[0] || null;
    } catch (error) {
        console.error('Error en obtenerFormularioPorId:', error);
        throw error;
    }
}

// Obtener período por ID desde la BD del instituto
async function obtenerPeriodoPorId(id_periodo) {
    try {
        const query = `
            SELECT 
                ID_PERIODO as id_periodo, 
                NOMBRE_PERIODO as descripcion, 
                STATUS_PERIODO as status 
            FROM MATRICULACION_PERIODO 
            WHERE ID_PERIODO = ? AND DELETED_AT_PERIODO IS NULL
        `;
        const [rows] = await dbLectura.query(query, [id_periodo]);
        return rows[0] || null;
    } catch (error) {
        console.error('Error en obtenerPeriodoPorId:', error);
        throw error;
    }
}

// Guardar respuesta individual
async function guardarRespuesta(idEvaluacion, respuesta, evaluadorId) {
    await dbEscritura.query(
        'INSERT INTO respuestas (id_evaluacion, id_pregunta, respuesta, evaluador_id, evaluado_id, id_distributivo) VALUES (?, ?, ?, ?, ?, ?)',
        [idEvaluacion, respuesta.id_pregunta, respuesta.respuesta, evaluadorId, respuesta.evaluado_id, respuesta.id_distributivo]
    );
}

// Registrar evaluación como realizada
async function registrarEvaluacionRealizada({ idEvaluacion, evaluadorId, evaluadoId, idDistributivo }) {
    await dbEscritura.query(`
        INSERT INTO evaluaciones_realizadas (id_evaluacion, evaluador_id, evaluado_id, id_distributivo, estado, fecha_inicio, fecha_fin)
        VALUES (?, ?, ?, ?, 'completada', NOW(), NOW())
        ON DUPLICATE KEY UPDATE estado = 'completada', fecha_fin = NOW()
    `, [idEvaluacion, evaluadorId, evaluadoId, idDistributivo]);
}

// Marcar evaluación como completada
async function finalizarEvaluacion(idEvaluacion) {
    await dbEscritura.query(
        'UPDATE evaluaciones SET estado = "completada", fecha_fin = NOW() WHERE id_evaluacion = ?',
        [idEvaluacion]
    );
}

// Obtener evaluación por ID (se ocupa para cargar el formualrio de evaluación en el frontend)
const obtenerEvaluacionPorId = async (idEvaluacion, idDistributivo = null) => {
    // Consulta base para obtener la evaluación
    const [rows] = await dbEscritura.query(
        `SELECT id_evaluacion, id_formulario, estado, fecha_inicio, fecha_fin
        FROM evaluaciones
        WHERE id_evaluacion = ?`,
        [idEvaluacion]
    );
    if (!rows.length) return null;
    const evaluacion = rows[0];
    // Si es heteroevaluación (id_formulario = 2) o coevaluación (id_formulario = 3) y se proporciona id_distributivo
    if ((evaluacion.id_formulario === 2 || evaluacion.id_formulario === 3) && idDistributivo) {
        try {
            // Obtener información del docente evaluado
            const [docenteData] = await dbLectura.query(`
                SELECT 
                    nd.ID_DISTRIBUTIVO as id_distributivo,
                    CONCAT(hd.NOMBRES_1_DOCENTE, ' ',
                            COALESCE(hd.NOMBRES_2_DOCENTE, ''), ' ',
                            hd.APELLIDOS_1_DOCENTE, ' ',
                            COALESCE(hd.APELLIDOS_2_DOCENTE, '')) as nombre,
                    na.NOMBRE_ASIGNATURA as asignatura,
                    mc.NOMBRE_CARRERAS as carrera
                FROM NOTAS_DISTRIBUTIVO nd
                INNER JOIN HORARIOS_DOCENTE hd ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
                INNER JOIN NOTAS_ASIGNATURA na ON nd.ID_ASIGNATURA_DISTRIBUTIVO = na.ID_ASIGNATURA
                INNER JOIN MATRICULACION_FORMAR_CURSOS mfc ON nd.ID_FORMAR_CURSOS_DISTRIBUTIVO = mfc.ID_FORMAR_CURSOS
                INNER JOIN MATRICULACION_CARRERAS mc ON mfc.ID_CARRERA_FORMAR_CURSOS = mc.ID_CARRERAS
                WHERE nd.ID_DISTRIBUTIVO = ?
                LIMIT 1
            `, [idDistributivo]);
            if (docenteData.length > 0) {
                // Limpiar espacios extra del nombre
                const nombre = docenteData[0].nombre.replace(/\s+/g, ' ').trim();
                evaluacion.docente_evaluado = {
                    id_distributivo: parseInt(docenteData[0].id_distributivo),
                    nombre: nombre,
                    asignatura: docenteData[0].asignatura,
                    carrera: docenteData[0].carrera
                };
            }
        } catch (error) {
            console.error('❌ Error al obtener información del docente evaluado:', error);
        }
    }
    return evaluacion;
};

// Verificar si existe una evaluación duplicada
async function existeEvaluacionDuplicada({ evaluador_id, evaluado_id, id_formulario, id_periodo, id_distributivo }) {
    const query = `
        SELECT 1 FROM respuestas r
        INNER JOIN evaluaciones e ON r.id_evaluacion = e.id_evaluacion
        WHERE r.evaluador_id = ? 
        AND r.evaluado_id = ? 
        AND r.id_distributivo = ?
        AND e.id_formulario = ?
        AND e.id_periodo = ?
        LIMIT 1
    `;
    const [rows] = await dbEscritura.query(query, [evaluador_id, evaluado_id, id_distributivo, id_formulario, id_periodo]);
    return rows.length > 0;
}

// Obtener resúmenes de evaluaciones por periodo (se ocupa en la tabla de resumen, CORREGIDO PARA AMBOS PERFILES)
async function obtenerResúmenesPorPeriodo(idUsuario, idPeriodo) {
    try {
        // Verificar el perfil del usuario
        const [perfilUsuario] = await dbLectura.query(`
            SELECT ID_PERFILES_USUARIOS FROM SEGURIDAD_USUARIOS WHERE ID_USUARIOS = ?
        `, [idUsuario]);
        // ID 14 = estudiante, ID 13 y 15 = docentes
        const esEstudiante = perfilUsuario[0]?.ID_PERFILES_USUARIOS === 14;
        if (esEstudiante) {
            // LÓGICA PARA ESTUDIANTES (evaluaciones que deben hacer)
            return await obtenerEvaluacionesParaEstudiantes(idUsuario, idPeriodo);
        } else {
            // LÓGICA PARA DOCENTES (evaluaciones que reciben)
            return await obtenerEvaluacionesParaDocentes(idUsuario, idPeriodo);
        }
    } catch (error) {
        console.error('Error en obtenerResúmenesPorPeriodo:', error);
        throw error;
    }
}

// Función para estudiantes (se ocupa en la tabla de resumen, evalúan a docentes)
async function obtenerEvaluacionesParaEstudiantes(idEstudiante, idPeriodo) {
    const cacheKey = `${idEstudiante}_${idPeriodo}`;
    const cached = getCache(cacheEvaluacionesParaEstudiantes, cacheKey);
    if (cached) return cached;
    // Obtener evaluaciones activas tipo heteroevaluación
    const [evaluaciones] = await dbEscritura.query(`
        SELECT 
            e.id_evaluacion,
            e.id_formulario,
            e.estado,
            e.fecha_inicio,
            e.fecha_fin,
            f.nombre AS nombre_formulario
        FROM evaluaciones e
        JOIN formularios f ON f.id_formulario = e.id_formulario
        WHERE e.id_periodo = ? AND e.id_formulario = 2
    `, [idPeriodo]);
    if (!evaluaciones.length) return [];
    // Obtener docentes relacionados con el estudiante
    const [docentesRelacionados] = await dbLectura.query(`
        SELECT DISTINCT 
            nd.ID_DISTRIBUTIVO AS id_distributivo,
            CONCAT(hd.NOMBRES_1_DOCENTE, ' ', hd.APELLIDOS_1_DOCENTE) AS nombres_docente,
            na.NOMBRE_ASIGNATURA AS nombre_asignatura
        FROM MATRICULACION_MATRICULA mm
        JOIN MATRICULACION_ESTUDIANTES me ON me.ID_ESTUDIANTES = mm.ID_ESTUDIANTE_MATRICULA
        JOIN NOTAS_DISTRIBUTIVO nd ON mm.ID_FORMAR_CURSOS_MATRICULA = nd.ID_FORMAR_CURSOS_DISTRIBUTIVO
        JOIN HORARIOS_DOCENTE hd ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
        JOIN NOTAS_ASIGNATURA na ON nd.ID_ASIGNATURA_DISTRIBUTIVO = na.ID_ASIGNATURA
        WHERE me.DOCUMENTO_ESTUDIANTES = (
            SELECT DOCUMENTO_USUARIOS FROM SEGURIDAD_USUARIOS WHERE ID_USUARIOS = ?
        )
        AND nd.ID_PERIODO_DISTRIBUTIVO = ?
        AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
    `, [idEstudiante, idPeriodo]);
    // Construir todas las combinaciones evaluación-docente
    const combinaciones = [];
    for (const evaluacion of evaluaciones) {
        for (const docente of docentesRelacionados) {
            combinaciones.push({
                id_evaluacion: evaluacion.id_evaluacion,
                id_distributivo: docente.id_distributivo,
                fecha_inicio: evaluacion.fecha_inicio,
                fecha_fin: evaluacion.fecha_fin,
                nombres_docente: docente.nombres_docente,
                nombre_asignatura: docente.nombre_asignatura
            });
        }
    }
    // Obtener todas las respuestas y calificaciones en una sola consulta por lote
    const resúmenes = [];
    for (let i = 0; i < combinaciones.length; i += 500) {
        const lote = combinaciones.slice(i, i + 500);
        const condiciones = lote.map(() => '(id_evaluacion = ? AND evaluador_id = ? AND id_distributivo = ?)').join(' OR ');
        const params = lote.flatMap(c => [c.id_evaluacion, idEstudiante, c.id_distributivo]);
        let respuestas = [];
        let calificaciones = [];
        if (lote.length > 0) {
            [respuestas] = await dbEscritura.query(`
                SELECT id_evaluacion, id_distributivo, COUNT(*) AS ya_respondido
                FROM respuestas
                WHERE ${condiciones}
                GROUP BY id_evaluacion, id_distributivo
            `, params);
            [calificaciones] = await dbEscritura.query(`
                SELECT id_evaluacion, id_distributivo, SUM(CAST(respuesta AS UNSIGNED)) AS calificacion
                FROM respuestas
                WHERE ${condiciones}
                GROUP BY id_evaluacion, id_distributivo
            `, params);
        }
        const respuestasMap = new Map(respuestas.map(r => [`${r.id_evaluacion}_${r.id_distributivo}`, r.ya_respondido]));
        const calificacionesMap = new Map(calificaciones.map(r => [`${r.id_evaluacion}_${r.id_distributivo}`, r.calificacion]));
        for (const c of lote) {
            const key = `${c.id_evaluacion}_${c.id_distributivo}`;
            resúmenes.push({
                id_evaluacion: c.id_evaluacion,
                id_distributivo: c.id_distributivo,
                id_periodo: idPeriodo,
                fecha_inicio: c.fecha_inicio,
                fecha_fin: c.fecha_fin,
                nombres_docente: c.nombres_docente,
                nombre_asignatura: c.nombre_asignatura,
                calificacion: respuestasMap.get(key) > 0 ? (calificacionesMap.get(key) || null) : null
            });
        }
    }
    setCache(cacheEvaluacionesParaEstudiantes, cacheKey, resúmenes.map(r => ({
        ...r,
        fecha_inicio: r.fecha_inicio,
        nombre_formulario: r.nombre_formulario
    })));
    return resúmenes.map(r => ({
        ...r,
        fecha_inicio: r.fecha_inicio,
        nombre_formulario: r.nombre_formulario
    }));
}

// Función corregida para docentes - Evaluaciones que DEBE REALIZAR (maneja duplicados, se usa para los resumenes de docentes)
async function obtenerEvaluacionesParaDocentes(idDocente, idPeriodo) {
    const cacheKey = `${idDocente}_${idPeriodo}`;
    const cached = getCache(cacheEvaluacionesParaDocentes, cacheKey);
    if (cached) return cached;
    try {
        // 1. Obtener cédula del docente desde BD del instituto
        const [cedulaData] = await dbLectura.query(`
            SELECT DOCUMENTO_USUARIOS as cedula 
            FROM SEGURIDAD_USUARIOS 
            WHERE ID_USUARIOS = ?
        `, [idDocente]);

        if (!cedulaData.length) return [];
        const cedula = cedulaData[0].cedula;

        // 2. Obtener TODOS los datos del docente con sus distributivos en una consulta (BD Instituto)
        const [datosCompletos] = await dbLectura.query(`
            SELECT DISTINCT
                hd.ID_DOCENTE,
                CONCAT(hd.NOMBRES_1_DOCENTE, ' ', hd.APELLIDOS_1_DOCENTE) AS nombres_docente,
                nd.ID_DISTRIBUTIVO,
                nd.ID_DOCENTE_DISTRIBUTIVO,
                na.NOMBRE_ASIGNATURA,
                na.ID_ASIGNATURA
            FROM HORARIOS_DOCENTE hd
            LEFT JOIN NOTAS_DISTRIBUTIVO nd ON hd.ID_DOCENTE = nd.ID_DOCENTE_DISTRIBUTIVO 
                AND nd.ID_PERIODO_DISTRIBUTIVO = ? 
                AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
            LEFT JOIN NOTAS_ASIGNATURA na ON nd.ID_ASIGNATURA_DISTRIBUTIVO = na.ID_ASIGNATURA
            WHERE hd.CEDULA_DOCENTE = ?
        `, [idPeriodo, cedula]);

        if (!datosCompletos.length) return [];

        const idsDocenteInterno = [...new Set(datosCompletos.map(d => d.ID_DOCENTE))];

        // 3. Obtener evaluaciones activas (BD Local)
        const [evaluaciones] = await dbEscritura.query(`
            SELECT 
                e.id_evaluacion,
                e.id_formulario,
                e.fecha_inicio,
                e.fecha_fin,
                f.nombre AS nombre_formulario
            FROM evaluaciones e
            JOIN formularios f ON f.id_formulario = e.id_formulario
            WHERE e.id_periodo = ? AND e.id_formulario IN (1, 3)
        `, [idPeriodo]);

        if (!evaluaciones.length) return [];

        // 4. Obtener asignaciones de coevaluación (BD Local) - SIN id_distributivo
        const placeholdersEvaluador = idsDocenteInterno.map(() => '?').join(',');
        const [asignacionesCoevaluacion] = await dbEscritura.query(`
            SELECT 
                ac.id_docente_evaluado,
                ac.id_asignatura
            FROM asignaciones_coevaluacion ac
            WHERE ac.id_docente_evaluador IN (${placeholdersEvaluador}) 
            AND ac.id_periodo = ?
        `, [...idsDocenteInterno, idPeriodo]);

        // 5. Si hay coevaluaciones, obtener datos de los docentes evaluados (BD Instituto)
        let datosDocentesEvaluados = [];
        if (asignacionesCoevaluacion.length > 0) {
            const idsEvaluados = [...new Set(asignacionesCoevaluacion.map(a => a.id_docente_evaluado))];
            const placeholdersEvaluados = idsEvaluados.map(() => '?').join(',');
            [datosDocentesEvaluados] = await dbLectura.query(`
                SELECT 
                    hd.ID_DOCENTE,
                    CONCAT(hd.NOMBRES_1_DOCENTE, ' ', hd.APELLIDOS_1_DOCENTE) AS nombres_docente,
                    nd.ID_DISTRIBUTIVO,
                    nd.ID_ASIGNATURA_DISTRIBUTIVO,
                    na.NOMBRE_ASIGNATURA
                FROM HORARIOS_DOCENTE hd
                LEFT JOIN NOTAS_DISTRIBUTIVO nd ON hd.ID_DOCENTE = nd.ID_DOCENTE_DISTRIBUTIVO 
                    AND nd.ID_PERIODO_DISTRIBUTIVO = ? 
                    AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
                LEFT JOIN NOTAS_ASIGNATURA na ON nd.ID_ASIGNATURA_DISTRIBUTIVO = na.ID_ASIGNATURA
                WHERE hd.ID_DOCENTE IN (${placeholdersEvaluados})
            `, [idPeriodo, ...idsEvaluados]);
        }

        // 6. Obtener todas las respuestas existentes (BD Local) en lote
        const evaluacionIds = evaluaciones.map(e => e.id_evaluacion);
        const distributivosAuto = datosCompletos.map(d => d.ID_DISTRIBUTIVO).filter(Boolean);
        const distributivosCoe = datosDocentesEvaluados.map(d => d.ID_DISTRIBUTIVO).filter(Boolean);
        const allDistributivos = [...new Set([...distributivosAuto, ...distributivosCoe])];
        const allEvalDistributivo = [];
        // Autoevaluación
        for (const e of evaluaciones.filter(ev => ev.id_formulario === 1)) {
            for (const d of distributivosAuto) {
                allEvalDistributivo.push({ id_evaluacion: e.id_evaluacion, id_distributivo: d });
            }
        }
        // Coevaluación
        for (const e of evaluaciones.filter(ev => ev.id_formulario === 3)) {
            for (const d of distributivosCoe) {
                allEvalDistributivo.push({ id_evaluacion: e.id_evaluacion, id_distributivo: d });
            }
        }
        // Consultar todas las respuestas en lotes
        const mapaRespuestas = new Map();
        for (let i = 0; i < allEvalDistributivo.length; i += 500) {
            const lote = allEvalDistributivo.slice(i, i + 500);
            const condiciones = lote.map(() => '(id_evaluacion = ? AND evaluador_id = ? AND id_distributivo = ?)').join(' OR ');
            const params = lote.flatMap(c => [c.id_evaluacion, idDocente, c.id_distributivo]);
            if (lote.length > 0) {
                const [respuestas] = await dbEscritura.query(`
                    SELECT id_evaluacion, id_distributivo, COUNT(*) AS ya_respondido, SUM(CAST(respuesta AS UNSIGNED)) AS calificacion_total
                    FROM respuestas
                    WHERE ${condiciones}
                    GROUP BY id_evaluacion, id_distributivo
                `, params);
                respuestas.forEach(resp => {
                    const key = `${resp.id_evaluacion}_${resp.id_distributivo}`;
                    mapaRespuestas.set(key, {
                        yaRespondido: resp.ya_respondido > 0,
                        calificacion: Math.round(resp.calificacion_total || 0)
                    });
                });
            }
        }
        // 8. Crear mapa para datos de docentes evaluados
        const mapaDocentesEvaluados = new Map();
        datosDocentesEvaluados.forEach(docente => {
            const key = `${docente.ID_DOCENTE}_${docente.ID_ASIGNATURA_DISTRIBUTIVO}`;
            mapaDocentesEvaluados.set(key, docente);
        });
        const resúmenes = [];
        // 9. Procesar evaluaciones
        for (const evaluacion of evaluaciones) {
            if (evaluacion.id_formulario === 1) {
                // AUTOEVALUACIÓN
                const primerDistributivo = datosCompletos.find(d => d.ID_DISTRIBUTIVO);
                if (primerDistributivo) {
                    const key = `${evaluacion.id_evaluacion}_${primerDistributivo.ID_DISTRIBUTIVO}`;
                    const respuesta = mapaRespuestas.get(key) || { yaRespondido: false, calificacion: null };
                    resúmenes.push({
                        id_evaluacion: evaluacion.id_evaluacion,
                        id_distributivo: primerDistributivo.ID_DISTRIBUTIVO,
                        id_periodo: idPeriodo,
                        fecha_inicio: evaluacion.fecha_inicio,
                        fecha_fin: evaluacion.fecha_fin,
                        nombres_docente: primerDistributivo.nombres_docente,
                        nombre_asignatura: 'Autoevaluación General',
                        tipo_evaluacion: 'Autoevaluación',
                        calificacion: respuesta.calificacion
                    });
                }
            } else if (evaluacion.id_formulario === 3) {
                // COEVALUACIÓN - Buscar distributivo basado en docente evaluado y asignatura
                for (const asignacion of asignacionesCoevaluacion) {
                    // Buscar distributivo usando docente evaluado y asignatura
                    const keyDocente = `${asignacion.id_docente_evaluado}_${asignacion.id_asignatura}`;
                    const docenteData = mapaDocentesEvaluados.get(keyDocente);
                    const distributivo = docenteData?.ID_DISTRIBUTIVO;
                    if (distributivo) {
                        // Buscar datos del docente evaluado
                        const docenteEvaluado = datosDocentesEvaluados.find(d =>
                            d.ID_DOCENTE === asignacion.id_docente_evaluado &&
                            d.ID_ASIGNATURA_DISTRIBUTIVO === asignacion.id_asignatura
                        );
                        if (docenteEvaluado) {
                            const key = `${evaluacion.id_evaluacion}_${distributivo}`;
                            const respuesta = mapaRespuestas.get(key) || { yaRespondido: false, calificacion: null };
                            resúmenes.push({
                                id_evaluacion: evaluacion.id_evaluacion,
                                id_distributivo: distributivo,
                                id_periodo: idPeriodo,
                                fecha_inicio: evaluacion.fecha_inicio,
                                fecha_fin: evaluacion.fecha_fin,
                                nombres_docente: docenteEvaluado.nombres_docente,
                                nombre_asignatura: docenteEvaluado.NOMBRE_ASIGNATURA,
                                tipo_evaluacion: 'Coevaluación',
                                calificacion: respuesta.calificacion
                            });
                        }
                    }
                }
            }
        }
        setCache(cacheEvaluacionesParaDocentes, cacheKey, resúmenes);
        return resúmenes;
    } catch (error) {
        console.error('Error en obtenerEvaluacionesParaDocentes:', error);
        return [];
    }
}

// Función actualizada para obtener el período activo sin depender de tablas inexistentes
async function obtenerPeriodoActual() {
    try {
        const [resultado] = await dbLectura.query(`
            SELECT 
                ID_PERIODO
            FROM 
                MATRICULACION_PERIODO
            WHERE 
                STATUS_PERIODO = 'ACTIVO'
            ORDER BY 
                CREATED_AT_PERIODO DESC
            LIMIT 1
        `);
        if (resultado && resultado.length > 0) {
            return resultado[0].ID_PERIODO;
        }
        return null;
    } catch (error) {
        console.error('Error al obtener período actual:', error);
        throw error;
    }
}

// Función actualizada para obtener evaluaciones por período (si se usa)
async function obtenerEvaluacionesPorPeriodo(idEstudiante, idPeriodo) {
    const cacheKey = `${idEstudiante}_${idPeriodo}`;
    const cached = getCache(cacheEvaluacionesPorPeriodo, cacheKey);
    if (cached) return cached;
    try {
        // Obtener el nombre del periodo solo una vez
        const [periodoResult] = await dbLectura.query(`
            SELECT NOMBRE_PERIODO FROM MATRICULACION_PERIODO WHERE ID_PERIODO = ?
        `, [idPeriodo]);
        const nombrePeriodo = periodoResult[0]?.NOMBRE_PERIODO || null;
        // Primero, obtenemos todas las evaluaciones para este período
        const [evaluaciones] = await dbEscritura.query(`
            SELECT 
                e.id_evaluacion,
                e.id_formulario,
                e.estado,
                e.fecha_inicio,
                e.fecha_fin,
                f.nombre AS nombre_formulario
            FROM 
                evaluaciones e
            JOIN
                formularios f ON e.id_formulario = f.id_formulario
            WHERE 
                e.id_periodo = ?
            ORDER BY 
                e.fecha_inicio DESC
        `, [idPeriodo]);
        if (!evaluaciones.length) return [];
        // Obtener todas las respuestas del estudiante para estas evaluaciones
        const evalIds = evaluaciones.map(e => e.id_evaluacion);
        const placeholders = evalIds.map(() => '?').join(',');
        let respuestas = [];
        if (evalIds.length > 0) {
            [respuestas] = await dbEscritura.query(`
                SELECT id_evaluacion, COUNT(*) as tiene_respuestas, MAX(evaluado_id) as evaluado_id, MAX(id_distributivo) as id_distributivo
                FROM respuestas
                WHERE id_evaluacion IN (${placeholders}) AND evaluador_id = ?
                GROUP BY id_evaluacion
            `, [...evalIds, idEstudiante]);
        }
        const respuestasMap = new Map(respuestas.map(r => [r.id_evaluacion, r]));
        // Obtener datos de docentes y asignaturas para todos los distributivos encontrados
        const distributivos = respuestas.map(r => r.id_distributivo).filter(Boolean);
        let datosInstitutoMap = {};
        if (distributivos.length > 0) {
            const placeholdersDist = distributivos.map(() => '?').join(',');
            const [datosInstituto] = await dbLectura.query(`
                SELECT nd.ID_DISTRIBUTIVO, CONCAT(hd.NOMBRES_1_DOCENTE, ' ', hd.APELLIDOS_1_DOCENTE) AS nombres_docente, na.NOMBRE_ASIGNATURA AS nombre_asignatura
                FROM NOTAS_DISTRIBUTIVO nd 
                JOIN HORARIOS_DOCENTE hd ON hd.ID_DOCENTE = nd.ID_DOCENTE_DISTRIBUTIVO
                JOIN NOTAS_ASIGNATURA na ON na.ID_ASIGNATURA = nd.ID_ASIGNATURA_DISTRIBUTIVO
                WHERE nd.ID_DISTRIBUTIVO IN (${placeholdersDist})
            `, distributivos);
            datosInstitutoMap = Object.fromEntries(datosInstituto.map(d => [d.ID_DISTRIBUTIVO, d]));
        }
        // Armar resultado
        const result = evaluaciones.map(eval => {
            const resp = respuestasMap.get(eval.id_evaluacion) || {};
            const datos = resp.id_distributivo ? datosInstitutoMap[resp.id_distributivo] || {} : {};
            const tieneRespuestas = resp.tiene_respuestas > 0;
            return {
                ...eval,
                evaluado_id: resp.evaluado_id || null,
                id_distributivo: resp.id_distributivo || null,
                nombres_docente: datos.nombres_docente || null,
                nombre_asignatura: datos.nombre_asignatura || null,
                periodo: nombrePeriodo,
                estado_estudiante: tieneRespuestas ? "completada" : "pendiente"
            };
        });
        setCache(cacheEvaluacionesPorPeriodo, cacheKey, result);
        return result;
    } catch (error) {
        console.error('Error al obtener evaluaciones por período:', error);
        throw error;
    }
}

// Función para obtener todas las evaluaciones del usuario (se usa en el perfil admin para la tabla de evaluaciones)
async function obtenerTodasEvaluacionesDelUsuario(idEstudiante) {
    const [evaluaciones] = await dbEscritura.query(`
    SELECT 
        e.id_evaluacion,
        e.id_formulario,
        e.estado,
        e.fecha_inicio,
        e.fecha_fin,
        e.fecha_notificacion,
        e.id_periodo,
        f.nombre AS nombre_formulario,
        (
            SELECT COUNT(*) FROM respuestas r 
            WHERE r.id_evaluacion = e.id_evaluacion AND r.evaluador_id = ?
        ) as tiene_respuestas
    FROM 
        evaluaciones e
    JOIN formularios f ON e.id_formulario = f.id_formulario
    ORDER BY e.fecha_inicio DESC
    `, [idEstudiante]);
    if (!evaluaciones.length) return [];
    // Obtener todos los periodos y distributivos de las respuestas
    const evalIds = evaluaciones.map(e => e.id_evaluacion);
    const placeholders = evalIds.map(() => '?').join(',');
    let respuestasData = [];
    if (evalIds.length > 0) {
        [respuestasData] = await dbEscritura.query(`
            SELECT id_evaluacion, evaluado_id, id_distributivo 
            FROM respuestas 
            WHERE id_evaluacion IN (${placeholders}) AND evaluador_id = ?
        `, [...evalIds, idEstudiante]);
    }
    const respuestasMap = new Map(respuestasData.map(r => [r.id_evaluacion, r]));
    // Obtener todos los periodos únicos
    const periodos = [...new Set(evaluaciones.map(e => e.id_periodo).filter(Boolean))];
    let periodosMap = {};
    if (periodos.length > 0) {
        const placeholdersPer = periodos.map(() => '?').join(',');
        const [periodosData] = await dbLectura.query(`
            SELECT ID_PERIODO, NOMBRE_PERIODO FROM MATRICULACION_PERIODO WHERE ID_PERIODO IN (${placeholdersPer})
        `, periodos);
        periodosMap = Object.fromEntries(periodosData.map(p => [p.ID_PERIODO, p.NOMBRE_PERIODO]));
    }
    // Obtener datos de docentes y asignaturas para todos los distributivos encontrados
    const distributivos = respuestasData.map(r => r.id_distributivo).filter(Boolean);
    let datosInstitutoMap = {};
    if (distributivos.length > 0) {
        const placeholdersDist = distributivos.map(() => '?').join(',');
        const [datosInstituto] = await dbLectura.query(`
            SELECT nd.ID_DISTRIBUTIVO, CONCAT(hd.NOMBRES_1_DOCENTE, ' ', hd.APELLIDOS_1_DOCENTE) AS nombres_docente, na.NOMBRE_ASIGNATURA AS nombre_asignatura
            FROM NOTAS_DISTRIBUTIVO nd 
            JOIN HORARIOS_DOCENTE hd ON hd.ID_DOCENTE = nd.ID_DOCENTE_DISTRIBUTIVO
            JOIN NOTAS_ASIGNATURA na ON na.ID_ASIGNATURA = nd.ID_ASIGNATURA_DISTRIBUTIVO
            WHERE nd.ID_DISTRIBUTIVO IN (${placeholdersDist})
        `, distributivos);
        datosInstitutoMap = Object.fromEntries(datosInstituto.map(d => [d.ID_DISTRIBUTIVO, d]));
    }
    // Armar resultado
    const result = evaluaciones.map(eval => {
        const resp = respuestasMap.get(eval.id_evaluacion) || {};
        const datos = resp.id_distributivo ? datosInstitutoMap[resp.id_distributivo] || {} : {};
        return {
            ...eval,
            evaluado_id: resp.evaluado_id || null,
            id_distributivo: resp.id_distributivo || null,
            nombres_docente: datos.nombres_docente || null,
            nombre_asignatura: datos.nombre_asignatura || null,
            periodo: periodosMap[eval.id_periodo] || null,
            estado_estudiante: eval.tiene_respuestas > 0 ? "completada" : "pendiente"
        };
    });
    return result;
}

// Función para obtener evaluaciones de estudiante (solo heteroevaluaciones)
async function obtenerEvaluacionesEstudiantePorId(idEstudiante) {
    const cacheKey = `${idEstudiante}`;
    const cached = getCache(cacheEvaluacionesEstudiante, cacheKey);
    if (cached) return cached;
    try {
        const idPeriodo = await obtenerPeriodoActual();
        if (!idPeriodo) return [];
        // Obtener nombre del período
        const [periodoResult] = await dbLectura.query(`
            SELECT NOMBRE_PERIODO FROM MATRICULACION_PERIODO WHERE ID_PERIODO = ?
        `, [idPeriodo]);
        const nombrePeriodo = periodoResult[0]?.NOMBRE_PERIODO || null;
        // Obtener evaluaciones activas tipo heteroevaluación
        const [evaluaciones] = await dbEscritura.query(`
            SELECT 
                e.id_evaluacion,
                e.id_formulario,
                e.estado,
                e.fecha_inicio,
                e.fecha_fin,
                f.nombre AS nombre_formulario
            FROM evaluaciones e
            JOIN formularios f ON f.id_formulario = e.id_formulario
            WHERE e.id_periodo = ? AND e.id_formulario = 2
        `, [idPeriodo]);
        if (!evaluaciones.length) return [];
        const [docentesRelacionados] = await dbLectura.query(`
            SELECT DISTINCT 
                nd.ID_DISTRIBUTIVO AS id_distributivo,
                CONCAT(hd.NOMBRES_1_DOCENTE, ' ', hd.APELLIDOS_1_DOCENTE) AS nombres_docente,
                na.NOMBRE_ASIGNATURA AS nombre_asignatura
            FROM MATRICULACION_MATRICULA mm
            JOIN MATRICULACION_ESTUDIANTES me ON me.ID_ESTUDIANTES = mm.ID_ESTUDIANTE_MATRICULA
            JOIN NOTAS_DISTRIBUTIVO nd ON mm.ID_FORMAR_CURSOS_MATRICULA = nd.ID_FORMAR_CURSOS_DISTRIBUTIVO
            JOIN HORARIOS_DOCENTE hd ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
            JOIN NOTAS_ASIGNATURA na ON nd.ID_ASIGNATURA_DISTRIBUTIVO = na.ID_ASIGNATURA
            WHERE me.DOCUMENTO_ESTUDIANTES = (
                SELECT DOCUMENTO_USUARIOS FROM SEGURIDAD_USUARIOS WHERE ID_USUARIOS = ?
            )
            AND nd.ID_PERIODO_DISTRIBUTIVO = ?
            AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
        `, [idEstudiante, idPeriodo]);
        // Asociar cada docente con cada evaluación activa
        const combinaciones = [];
        for (const evaluacion of evaluaciones) {
            for (const docente of docentesRelacionados) {
                combinaciones.push({
                    id_evaluacion: evaluacion.id_evaluacion,
                    id_distributivo: docente.id_distributivo,
                    fecha_inicio: evaluacion.fecha_inicio,
                    fecha_fin: evaluacion.fecha_fin,
                    nombres_docente: docente.nombres_docente,
                    nombre_asignatura: docente.nombre_asignatura,
                    nombre_formulario: evaluacion.nombre_formulario
                });
            }
        }
        // Consultar todas las respuestas en lotes
        const evaluacionesExpandida = [];
        for (let i = 0; i < combinaciones.length; i += 500) {
            const lote = combinaciones.slice(i, i + 500);
            const condiciones = lote.map(() => '(id_evaluacion = ? AND evaluador_id = ? AND id_distributivo = ?)').join(' OR ');
            const params = lote.flatMap(c => [c.id_evaluacion, idEstudiante, c.id_distributivo]);
            let respuestas = [];
            if (lote.length > 0) {
                [respuestas] = await dbEscritura.query(`
                    SELECT id_evaluacion, id_distributivo, COUNT(*) AS ya_respondido
                    FROM respuestas
                    WHERE ${condiciones}
                    GROUP BY id_evaluacion, id_distributivo
                `, params);
            }
            const respuestasMap = new Map(respuestas.map(r => [`${r.id_evaluacion}_${r.id_distributivo}`, r.ya_respondido]));
            for (const c of lote) {
                const key = `${c.id_evaluacion}_${c.id_distributivo}`;
                evaluacionesExpandida.push({
                    id_evaluacion: c.id_evaluacion,
                    periodo: nombrePeriodo,
                    nombres_docente: c.nombres_docente,
                    nombre_asignatura: c.nombre_asignatura,
                    id_distributivo: c.id_distributivo,
                    evaluado_id: c.id_distributivo,
                    estado_estudiante: respuestasMap.get(key) > 0 ? "completada" : "pendiente",
                    fecha_inicio: c.fecha_inicio,
                    fecha_fin: c.fecha_fin || null,
                    nombre_formulario: c.nombre_formulario
                });
            }
        }
        setCache(cacheEvaluacionesEstudiante, cacheKey, evaluacionesExpandida);
        return evaluacionesExpandida;
    } catch (error) {
        console.error('Error al obtener evaluaciones de estudiante:', error);
        throw error;
    }
}

// Función para obtener evaluaciones de docente (auto y coevaluación)
async function obtenerEvaluacionesDocentePorId(idDocente, idUsuario) {
    const cacheKey = `${idDocente}_${idUsuario}`;
    const cached = getCache(cacheEvaluacionesDocente, cacheKey);
    if (cached) return cached;
    const idPeriodo = await obtenerPeriodoActual();
    if (!idPeriodo) return [];
    const [[{ NOMBRE_PERIODO: nombrePeriodo } = {}]] = await dbLectura.query(`
        SELECT NOMBRE_PERIODO FROM MATRICULACION_PERIODO WHERE ID_PERIODO = ?
    `, [idPeriodo]);
    const [[{ cedula } = {}]] = await dbLectura.query(`
        SELECT CEDULA_DOCENTE AS cedula FROM HORARIOS_DOCENTE WHERE ID_DOCENTE = ? LIMIT 1
    `, [idDocente]);
    if (!cedula) return [];
    const [docentes] = await dbLectura.query(`
        SELECT ID_DOCENTE FROM HORARIOS_DOCENTE WHERE CEDULA_DOCENTE = ?
    `, [cedula]);
    const idsDocente = docentes.map(d => d.ID_DOCENTE);
    const [[{ total: tieneDistributivo } = {}]] = await dbLectura.query(`
        SELECT COUNT(*) AS total
        FROM NOTAS_DISTRIBUTIVO nd
        JOIN HORARIOS_DOCENTE hd ON hd.ID_DOCENTE = nd.ID_DOCENTE_DISTRIBUTIVO
        WHERE nd.ID_DOCENTE_DISTRIBUTIVO IN (?) 
        AND nd.ID_PERIODO_DISTRIBUTIVO = ?
        AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
        AND hd.DELETED_AT_DOCENTE IS NULL
    `, [idsDocente, idPeriodo]);
    const evaluaciones = [];
    // Autoevaluación
    if (tieneDistributivo > 0) {
        const [autoevals] = await dbEscritura.query(`
            SELECT 
                e.id_evaluacion, e.id_formulario, e.fecha_inicio, e.fecha_fin,
                f.nombre AS nombre_formulario
            FROM evaluaciones e
            JOIN formularios f ON f.id_formulario = e.id_formulario
            WHERE e.id_periodo = ? AND e.id_formulario = 1
        `, [idPeriodo]);
        // Consultar todas las respuestas y evaluaciones_realizadas en lote
        const autoevalIds = autoevals.map(a => a.id_evaluacion);
        let respuestasMap = new Map();
        let realizadasMap = new Map();
        if (autoevalIds.length > 0) {
            const placeholders = autoevalIds.map(() => '?').join(',');
            const [respuestasExistentes] = await dbEscritura.query(`
                SELECT id_evaluacion, COUNT(*) AS total
                FROM respuestas
                WHERE id_evaluacion IN (${placeholders}) AND evaluador_id = ? AND evaluado_id = ?
                GROUP BY id_evaluacion
            `, [...autoevalIds, idUsuario, idUsuario]);
            respuestasMap = new Map(respuestasExistentes.map(r => [r.id_evaluacion, r.total]));
            const [evaluacionesRealizadas] = await dbEscritura.query(`
                SELECT id_evaluacion, estado, fecha_fin
                FROM evaluaciones_realizadas
                WHERE id_evaluacion IN (${placeholders}) AND evaluador_id = ? AND evaluado_id = ?
            `, [...autoevalIds, idUsuario, idUsuario]);
            realizadasMap = new Map(evaluacionesRealizadas.filter(er => er.estado === 'completada').map(er => [er.id_evaluacion, er.fecha_fin]));
        }
        for (const eval of autoevals) {
            const yaRespondido = respuestasMap.get(eval.id_evaluacion) > 0 || realizadasMap.has(eval.id_evaluacion);
            evaluaciones.push({
                ...eval,
                evaluado_id: idDocente,
                id_distributivo: null,
                nombres_docente: null,
                nombre_asignatura: null,
                estado_estudiante: yaRespondido ? 'completada' : 'pendiente',
                fecha_fin: realizadasMap.get(eval.id_evaluacion) || null,
                periodo: nombrePeriodo
            });
        }
    }
    // 🔧 COEVALUACIÓN CORREGIDA - Solo asignaturas específicamente asignadas
    const [coevaluaciones] = await dbEscritura.query(`
        SELECT 
            e.id_evaluacion, e.id_formulario, e.fecha_inicio, e.fecha_fin,
            f.nombre AS nombre_formulario
        FROM evaluaciones e
        JOIN formularios f ON f.id_formulario = e.id_formulario
        WHERE e.id_periodo = ? AND e.id_formulario = 3
    `, [idPeriodo]);
    if (coevaluaciones.length > 0) {
        const evaluacionCo = coevaluaciones[0];
        // 🚨 CAMBIO PRINCIPAL: Buscar solo las asignaciones específicas del docente evaluador
        const placeholdersIds = idsDocente.map(() => '?').join(',');
        const [asignacionesEspecificas] = await dbEscritura.query(`
            SELECT 
                ac.id_docente_evaluado,
                ac.id_asignatura
            FROM asignaciones_coevaluacion ac
            WHERE ac.id_docente_evaluador IN (${placeholdersIds}) 
            AND ac.id_periodo = ?
        `, [...idsDocente, idPeriodo]);
        if (asignacionesEspecificas.length > 0) {
            // Buscar distributivos y datos de docentes/asignaturas en lote
            const keys = asignacionesEspecificas.map(a => [a.id_docente_evaluado, a.id_asignatura]);
            let distributivos = [];
            if (keys.length > 0) {
                const lotes = [];
                for (let i = 0; i < keys.length; i += 100) {
                    lotes.push(keys.slice(i, i + 100));
                }
                const distResults = await Promise.all(lotes.map(async (lote) => {
                    const condiciones = lote.map(() => '(nd.ID_DOCENTE_DISTRIBUTIVO = ? AND nd.ID_PERIODO_DISTRIBUTIVO = ? AND nd.ID_ASIGNATURA_DISTRIBUTIVO = ?)').join(' OR ');
                    const params = lote.flatMap(k => [k[0], idPeriodo, k[1]]);
                    const [dist] = await dbLectura.query(`
                        SELECT nd.ID_DISTRIBUTIVO, nd.ID_DOCENTE_DISTRIBUTIVO, nd.ID_ASIGNATURA_DISTRIBUTIVO,
                            CONCAT(hd.NOMBRES_1_DOCENTE, ' ', hd.APELLIDOS_1_DOCENTE) AS nombres_docente,
                            na.NOMBRE_ASIGNATURA
                        FROM NOTAS_DISTRIBUTIVO nd
                        JOIN HORARIOS_DOCENTE hd ON hd.ID_DOCENTE = nd.ID_DOCENTE_DISTRIBUTIVO
                        JOIN NOTAS_ASIGNATURA na ON na.ID_ASIGNATURA = nd.ID_ASIGNATURA_DISTRIBUTIVO
                        WHERE ${condiciones} AND nd.DELETED_AT_DISTRIBUTIVO IS NULL AND hd.DELETED_AT_DOCENTE IS NULL
                    `, params);
                    return dist;
                }));
                distributivos = distResults.flat();
            }
            const mapaDistributivos = new Map(distributivos.map(d => [`${d.ID_DOCENTE_DISTRIBUTIVO}_${d.ID_ASIGNATURA_DISTRIBUTIVO}`, d]));
            // Consultar todas las respuestas y evaluaciones_realizadas en lote
            const coevalIds = [evaluacionCo.id_evaluacion];
            const allDistributivoIds = distributivos.map(d => d.ID_DISTRIBUTIVO);
            let respuestasMap = new Map();
            let realizadasMap = new Map();
            if (allDistributivoIds.length > 0) {
                const lotes = [];
                for (let i = 0; i < allDistributivoIds.length; i += 100) {
                    lotes.push(allDistributivoIds.slice(i, i + 100));
                }
                await Promise.all(lotes.map(async (lote) => {
                    const placeholdersDist = lote.map(() => '?').join(',');
                    const [respuestasExistentes] = await dbEscritura.query(`
                        SELECT id_evaluacion, id_distributivo, COUNT(*) AS total
                        FROM respuestas
                        WHERE id_evaluacion = ? AND evaluador_id = ? AND id_distributivo IN (${placeholdersDist})
                        GROUP BY id_evaluacion, id_distributivo
                    `, [evaluacionCo.id_evaluacion, idUsuario, ...lote]);
                    respuestasExistentes.forEach(r => {
                        respuestasMap.set(`${r.id_evaluacion}_${r.id_distributivo}`, r.total);
                    });
                    const [evaluacionesRealizadas] = await dbEscritura.query(`
                        SELECT id_evaluacion, id_distributivo, estado, fecha_fin
                        FROM evaluaciones_realizadas
                        WHERE id_evaluacion = ? AND evaluador_id = ? AND id_distributivo IN (${placeholdersDist})
                    `, [evaluacionCo.id_evaluacion, idUsuario, ...lote]);
                    evaluacionesRealizadas.filter(er => er.estado === 'completada').forEach(er => {
                        realizadasMap.set(`${er.id_evaluacion}_${er.id_distributivo}`, er.fecha_fin);
                    });
                }));
            }
            for (const asignacion of asignacionesEspecificas) {
                const d = mapaDistributivos.get(`${asignacion.id_docente_evaluado}_${asignacion.id_asignatura}`);
                if (d && d.ID_DISTRIBUTIVO) {
                    const key = `${evaluacionCo.id_evaluacion}_${d.ID_DISTRIBUTIVO}`;
                    const yaRespondido = respuestasMap.get(key) > 0 || realizadasMap.has(key);
                    evaluaciones.push({
                        ...evaluacionCo,
                        evaluado_id: d.ID_DOCENTE_DISTRIBUTIVO,
                        id_distributivo: d.ID_DISTRIBUTIVO,
                        nombres_docente: d.nombres_docente,
                        nombre_asignatura: d.NOMBRE_ASIGNATURA,
                        estado_estudiante: yaRespondido ? 'completada' : 'pendiente',
                        fecha_fin: realizadasMap.get(key) || null,
                        periodo: nombrePeriodo
                    });
                }
            }
        }
    }
    setCache(cacheEvaluacionesDocente, cacheKey, evaluaciones);
    return evaluaciones;
}

// Eliminar evaluación y dependencias
async function eliminarEvaluacionPorId(idEvaluacion) {
    const conn = dbEscritura;
    try {
        // Eliminar respuestas
        await conn.query('DELETE FROM respuestas WHERE id_evaluacion = ?', [idEvaluacion]);
        // Eliminar evaluaciones_realizadas
        await conn.query('DELETE FROM evaluaciones_realizadas WHERE id_evaluacion = ?', [idEvaluacion]);
        // Eliminar evaluación
        const [result] = await conn.query('DELETE FROM evaluaciones WHERE id_evaluacion = ?', [idEvaluacion]);
        return result.affectedRows > 0;
    } catch (error) {
        console.error('Error al eliminar evaluación:', error);
        throw error;
    }
}

// Actualizar evaluación por ID
async function actualizarEvaluacionPorId(idEvaluacion, data) {
    const campos = [];
    const valores = [];
    if (data.id_formulario !== undefined) {
        campos.push('id_formulario = ?');
        valores.push(data.id_formulario);
    }
    if (data.id_periodo !== undefined) {
        campos.push('id_periodo = ?');
        valores.push(data.id_periodo);
    }
    if (data.fecha_inicio !== undefined) {
        campos.push('fecha_inicio = ?');
        valores.push(data.fecha_inicio);
    }
    if (data.fecha_fin !== undefined) {
        campos.push('fecha_fin = ?');
        valores.push(data.fecha_fin);
    }
    if (data.fecha_notificacion !== undefined) {
        campos.push('fecha_notificacion = ?');
        valores.push(data.fecha_notificacion);
    }
    if (data.estado !== undefined) {
        campos.push('estado = ?');
        valores.push(data.estado);
    }
    if (campos.length === 0) return false;
    valores.push(idEvaluacion);
    const query = `UPDATE evaluaciones SET ${campos.join(', ')} WHERE id_evaluacion = ?`;
    const [result] = await dbEscritura.query(query, valores);
    return result.affectedRows > 0;
}

// Cache en memoria para resultados por usuario y periodo
const cacheEvaluacionesDocente = new Map();
const cacheEvaluacionesParaDocentes = new Map();
const cacheEvaluacionesEstudiante = new Map();
const cacheEvaluacionesParaEstudiantes = new Map();
const cacheEvaluacionesPorPeriodo = new Map();
const cacheTodasEvaluacionesUsuario = new Map();
const CACHE_TTL = 20 * 1000; // 30 segundos

// Helper para cache
function getCache(cache, key) {
    const entry = cache.get(key);
    if (entry && (Date.now() - entry.timestamp < CACHE_TTL)) {
        return entry.data;
    }
    return null;
}
function setCache(cache, key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

module.exports = {
    crearEvaluacion,
    guardarRespuesta,
    registrarEvaluacionRealizada,
    finalizarEvaluacion,
    obtenerEvaluacionPorId,
    existeEvaluacionDuplicada,
    obtenerResúmenesPorPeriodo,
    obtenerEvaluacionesPorPeriodo,
    obtenerPeriodoActual,
    obtenerTodasEvaluacionesDelUsuario,
    obtenerEvaluacionesEstudiantePorId,
    obtenerMisEvaluacionesPorPeriodo: obtenerEvaluacionesPorPeriodo,
    obtenerEvaluacionesDocentePorId,
    actualizarFechaNotificacion,
    obtenerFormularioPorId,
    obtenerPeriodoPorId,
    existeEvaluacionPorFormularioYPeriodo,
    existeEvaluacionPorFormularioYPeriodoExcluyendo,
    eliminarEvaluacionPorId,
    actualizarEvaluacionPorId,
};