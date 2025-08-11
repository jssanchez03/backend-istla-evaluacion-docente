const { dbEscritura, dbLectura } = require('../config/database');
const { formatearNombre } = require('../services/asignacionesService');


// Total de docentes evaluados - CORREGIDO para contar por cédula única
async function obtenerTotalDocentesEvaluados(periodo) {
    const cacheKey = `totalDocentes_${periodo}`;
    const cached = getDashboardCache(cacheKey);
    if (cached) return cached;
    // Primero obtener los distributivos únicos que tienen evaluaciones completadas
    const [distributivosEvaluados] = await dbEscritura.query(`
        SELECT DISTINCT er.id_distributivo
        FROM evaluaciones_realizadas er
        JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
        WHERE er.estado = 'completada' 
        AND e.id_periodo = ?
    `, [periodo]);

    if (distributivosEvaluados.length === 0) {
        return { total_docentes: 0 };
    }

    const distributivosIds = distributivosEvaluados.map(row => row.id_distributivo);

    // Luego contar docentes únicos por cédula
    const [rows] = await dbLectura.query(`
        SELECT COUNT(DISTINCT hd.CEDULA_DOCENTE) AS total_docentes
        FROM NOTAS_DISTRIBUTIVO nd
        JOIN HORARIOS_DOCENTE hd ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
        WHERE nd.ID_DISTRIBUTIVO IN (?)
        AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
        AND hd.DELETED_AT_DOCENTE IS NULL
        AND hd.CEDULA_DOCENTE IS NOT NULL
    `, [distributivosIds]);

    setDashboardCache(cacheKey, rows[0]);
    return rows[0];
}

// Total de evaluaciones completadas
async function obtenerTotalEvaluacionesCompletadas(periodo) {
    const cacheKey = `totalEvaluaciones_${periodo}`;
    const cached = getDashboardCache(cacheKey);
    if (cached) return cached;
    const [rows] = await dbEscritura.query(`
        SELECT COUNT(*) AS total_completadas 
        FROM evaluaciones_realizadas er
        JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
        WHERE er.estado = 'completada' AND e.id_periodo = ?
    `, [periodo]);
    setDashboardCache(cacheKey, rows[0]);
    return rows[0];
}

// Promedio general de respuestas escala - CORREGIDO para agrupar por cédula
async function obtenerPromedioGeneral(periodo) {
    const cacheKey = `promedioGeneral_${periodo}`;
    const cached = getDashboardCache(cacheKey);
    if (cached) return cached;
    const [rows] = await dbEscritura.query(`
        SELECT AVG(CAST(r.respuesta AS DECIMAL)) * 20 AS promedio_general
        FROM respuestas r
        INNER JOIN evaluaciones_realizadas er ON r.id_evaluacion = er.id_evaluacion
        INNER JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
        WHERE e.id_periodo = ?
            AND r.id_pregunta IN (
                SELECT id_pregunta FROM preguntas
            )
            AND r.id_distributivo IS NOT NULL
    `, [periodo]);
    setDashboardCache(cacheKey, rows[0]);
    return rows[0];
}

// Tasa de participación CORREGIDA - Calcula el porcentaje real de evaluaciones completadas
async function obtenerTasaParticipacion(periodo) {
    try {
        // 1. OBTENER EVALUACIONES COMPLETADAS (numerador)
        const [completadas] = await dbEscritura.query(`
            SELECT COUNT(*) AS total_completadas 
            FROM evaluaciones_realizadas er
            JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
            WHERE er.estado = 'completada' AND e.id_periodo = ?
        `, [periodo]);
        const totalCompletadas = completadas[0].total_completadas;
        // 2. CALCULAR TOTAL DE EVALUACIONES ESPERADAS (denominador)
        let totalEsperadas = 0;
        // 2.1 AUTOEVALUACIONES ESPERADAS
        // Una autoevaluación por cada docente que tenga distributivo en el período
        const [autoevaluacionesEsperadas] = await dbLectura.query(`
            SELECT COUNT(DISTINCT nd.ID_DOCENTE_DISTRIBUTIVO) AS total_docentes_activos
            FROM NOTAS_DISTRIBUTIVO nd
            WHERE nd.ID_PERIODO_DISTRIBUTIVO = ?
            AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
        `, [periodo]);
        // Verificar si existe evaluación de autoevaluación activa
        const [tieneAutoevaluacion] = await dbEscritura.query(`
            SELECT COUNT(*) as existe
            FROM evaluaciones e
            WHERE e.id_periodo = ? AND e.id_formulario = 1
        `, [periodo]);
        const autoevaluaciones = tieneAutoevaluacion[0].existe > 0
            ? autoevaluacionesEsperadas[0].total_docentes_activos
            : 0;
        totalEsperadas += autoevaluaciones;
        // 2.2 HETEROEVALUACIONES ESPERADAS
        // Una evaluación por cada relación estudiante-docente-asignatura
        const [heteroevaluacionesEsperadas] = await dbLectura.query(`
            SELECT COUNT(*) AS total_relaciones
            FROM MATRICULACION_MATRICULA mm
            JOIN MATRICULACION_ESTUDIANTES me ON me.ID_ESTUDIANTES = mm.ID_ESTUDIANTE_MATRICULA
            JOIN NOTAS_DISTRIBUTIVO nd ON mm.ID_FORMAR_CURSOS_MATRICULA = nd.ID_FORMAR_CURSOS_DISTRIBUTIVO
            WHERE nd.ID_PERIODO_DISTRIBUTIVO = ?
            AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
            AND me.DELETED_AT_ESTUDIANTES IS NULL
        `, [periodo]);
        // Verificar si existe evaluación de heteroevaluación activa
        const [tieneHeteroevaluacion] = await dbEscritura.query(`
            SELECT COUNT(*) as existe
            FROM evaluaciones e
            WHERE e.id_periodo = ? AND e.id_formulario = 2
        `, [periodo]);
        const heteroevaluaciones = tieneHeteroevaluacion[0].existe > 0
            ? heteroevaluacionesEsperadas[0].total_relaciones
            : 0;
        totalEsperadas += heteroevaluaciones;
        // 2.3 COEVALUACIONES ESPERADAS
        // Una evaluación por cada asignación de coevaluación
        const [coevaluacionesEsperadas] = await dbEscritura.query(`
            SELECT COUNT(*) AS total_asignaciones
            FROM asignaciones_coevaluacion ac
            WHERE ac.id_periodo = ?
        `, [periodo]);
        // Verificar si existe evaluación de coevaluación activa
        const [tieneCoevaluacion] = await dbEscritura.query(`
            SELECT COUNT(*) as existe
            FROM evaluaciones e
            WHERE e.id_periodo = ? AND e.id_formulario = 3
        `, [periodo]);
        const coevaluaciones = tieneCoevaluacion[0].existe > 0
            ? coevaluacionesEsperadas[0].total_asignaciones
            : 0;
        totalEsperadas += coevaluaciones;
        // 3. CALCULAR TASA DE PARTICIPACIÓN
        const tasaParticipacion = totalEsperadas > 0
            ? Math.round((totalCompletadas / totalEsperadas) * 100 * 100) / 100 // Redondear a 2 decimales
            : 0;
        return {
            tasa_participacion: tasaParticipacion,
            // Datos adicionales para debugging/reporting
            desglose: {
                completadas: totalCompletadas,
                esperadas: totalEsperadas,
                autoevaluaciones_esperadas: autoevaluaciones,
                heteroevaluaciones_esperadas: heteroevaluaciones,
                coevaluaciones_esperadas: coevaluaciones
            }
        };
    } catch (error) {
        console.error('[ERROR] Error al calcular tasa de participación:', error);
        throw error;
    }
}

// Función auxiliar para obtener detalles de participación por tipo - CORREGIDA y OPTIMIZADA
async function obtenerDetalleParticipacionPorTipo(periodo) {
    const cacheKey = `detalleParticipacion_${periodo}`;
    const cached = getDashboardCache(cacheKey);
    if (cached) return cached;
    try {
        const resultados = [];
        // Ejecutar consultas en paralelo para autoevaluación
        const [autoEsperadas, tieneAutoevaluacion] = await Promise.all([
            dbLectura.query(`
                SELECT COUNT(DISTINCT nd.ID_DOCENTE_DISTRIBUTIVO) as esperadas
                FROM NOTAS_DISTRIBUTIVO nd
                WHERE nd.ID_PERIODO_DISTRIBUTIVO = ?
                AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
            `, [periodo]),
            dbEscritura.query(`
                SELECT COUNT(*) as existe
                FROM evaluaciones e
                WHERE e.id_periodo = ? AND e.id_formulario = 1
            `, [periodo])
        ]);
        if (tieneAutoevaluacion[0][0].existe > 0 && autoEsperadas[0][0].esperadas > 0) {
            const [autoCompletadas] = await dbEscritura.query(`
                SELECT COUNT(*) as completadas
                FROM evaluaciones_realizadas er
                JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
                WHERE e.id_periodo = ? AND e.id_formulario = 1 AND er.estado = 'completada'
            `, [periodo]);
            resultados.push({
                tipo: 'Autoevaluación',
                esperadas: autoEsperadas[0][0].esperadas,
                completadas: autoCompletadas[0].completadas,
                porcentaje: Math.round((autoCompletadas[0].completadas / autoEsperadas[0][0].esperadas) * 100 * 100) / 100
            });
        }
        // Heteroevaluaciones en paralelo
        const [heteroEsperadas, tieneHeteroevaluacion] = await Promise.all([
            dbLectura.query(`
                SELECT COUNT(*) as esperadas
                FROM MATRICULACION_MATRICULA mm
                JOIN MATRICULACION_ESTUDIANTES me ON me.ID_ESTUDIANTES = mm.ID_ESTUDIANTE_MATRICULA
                JOIN NOTAS_DISTRIBUTIVO nd ON mm.ID_FORMAR_CURSOS_MATRICULA = nd.ID_FORMAR_CURSOS_DISTRIBUTIVO
                WHERE nd.ID_PERIODO_DISTRIBUTIVO = ?
                AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
                AND me.DELETED_AT_ESTUDIANTES IS NULL
            `, [periodo]),
            dbEscritura.query(`
                SELECT COUNT(*) as existe
                FROM evaluaciones e
                WHERE e.id_periodo = ? AND e.id_formulario = 2
            `, [periodo])
        ]);
        if (tieneHeteroevaluacion[0][0].existe > 0 && heteroEsperadas[0][0].esperadas > 0) {
            const [heteroCompletadas] = await dbEscritura.query(`
                SELECT COUNT(*) as completadas
                FROM evaluaciones_realizadas er
                JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
                WHERE e.id_periodo = ? AND e.id_formulario = 2 AND er.estado = 'completada'
            `, [periodo]);
            resultados.push({
                tipo: 'Heteroevaluación',
                esperadas: heteroEsperadas[0][0].esperadas,
                completadas: heteroCompletadas[0].completadas,
                porcentaje: Math.round((heteroCompletadas[0].completadas / heteroEsperadas[0][0].esperadas) * 100 * 100) / 100
            });
        }
        // Coevaluaciones en paralelo
        const [tieneCoevaluacion] = await dbEscritura.query(`
            SELECT COUNT(*) as existe
            FROM evaluaciones e
            WHERE e.id_periodo = ? AND e.id_formulario = 3
        `, [periodo]);
        if (tieneCoevaluacion[0].existe > 0) {
            const [coEsperadas, coCompletadas3] = await Promise.all([
                dbEscritura.query(`
                    SELECT COUNT(*) as esperadas
                    FROM asignaciones_coevaluacion ac
                    WHERE ac.id_periodo = ?
                `, [periodo]),
                dbEscritura.query(`
                    SELECT COUNT(*) as completadas
                    FROM evaluaciones_realizadas er
                    JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
                    WHERE e.id_periodo = ? 
                        AND e.id_formulario = 3 
                        AND er.estado = 'completada'
                `, [periodo])
            ]);
            if (coEsperadas[0][0].esperadas > 0) {
                let completadas = coCompletadas3[0][0].completadas;
                resultados.push({
                    tipo: 'Coevaluación',
                    esperadas: coEsperadas[0][0].esperadas,
                    completadas: completadas,
                    porcentaje: Math.round((completadas / coEsperadas[0][0].esperadas) * 100 * 100) / 100
                });
            }
        }
        setDashboardCache(cacheKey, resultados);
        return resultados;
    } catch (error) {
        console.error('[ERROR] Error al obtener detalle de participación:', error);
        throw error;
    }
}

// Obtener periodos ordenados
async function obtenerPeriodosOrdenados() {
    const cacheKey = `periodosOrdenados`;
    const cached = getDashboardCache(cacheKey);
    if (cached) return cached;
    const [rows] = await dbEscritura.query(`
        SELECT DISTINCT id_periodo 
        FROM evaluaciones 
        WHERE id_periodo IS NOT NULL
        ORDER BY id_periodo DESC
    `);
    setDashboardCache(cacheKey, rows);
    return rows;
}

// Promedio por tipo de evaluación - CORREGIDO para agrupar por cédula
async function obtenerPromedioPorTipoEvaluacion(periodo) {
    const cacheKey = `promedioTipoEvaluacion_${periodo}`;
    const cached = getDashboardCache(cacheKey);
    if (cached) return cached;
    const [rows] = await dbEscritura.query(`
        SELECT 
            f.nombre as tipo_evaluacion,
            AVG(CAST(r.respuesta AS DECIMAL)) * 20 AS promedio
        FROM respuestas r
        INNER JOIN evaluaciones_realizadas er ON r.id_evaluacion = er.id_evaluacion
        INNER JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
        INNER JOIN formularios f ON e.id_formulario = f.id_formulario
        WHERE e.id_periodo = ?
            AND r.id_pregunta IN (
                SELECT id_pregunta FROM preguntas
            )
            AND er.estado = 'completada'
            AND r.id_distributivo IS NOT NULL
        GROUP BY f.nombre, f.id_formulario
        ORDER BY promedio DESC
    `, [periodo]);

    setDashboardCache(cacheKey, rows);
    return rows;
}

// Promedio por carrera - VERSIÓN CORREGIDA para agrupar por cédula
async function obtenerPromedioPorCarrera(periodo) {
    const cacheKey = `promedioPorCarrera_${periodo}`;
    const cached = getDashboardCache(cacheKey);
    if (cached) return cached;
    // Primero obtener los distributivos con sus promedios
    const [distributivosConPromedios] = await dbEscritura.query(`
        SELECT 
            r.id_distributivo,
            AVG(CAST(r.respuesta AS DECIMAL)) * 20 AS promedio
        FROM respuestas r
        INNER JOIN evaluaciones_realizadas er ON r.id_evaluacion = er.id_evaluacion
        INNER JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
        WHERE e.id_periodo = ?
            AND r.id_pregunta IN (
                SELECT id_pregunta FROM preguntas
            )
            AND er.estado = 'completada'
            AND r.id_distributivo IS NOT NULL
        GROUP BY r.id_distributivo
    `, [periodo]);

    if (distributivosConPromedios.length === 0) {
        return [];
    }

    const distributivosIds = distributivosConPromedios.map(row => row.id_distributivo);

    // Luego obtener la información de carreras desde dbLectura
    const [rows] = await dbLectura.query(`
        SELECT 
            nd.ID_DISTRIBUTIVO,
            mc.NOMBRE_CARRERAS as carrera
        FROM NOTAS_DISTRIBUTIVO nd
        INNER JOIN MATRICULACION_FORMAR_CURSOS mfc ON nd.ID_FORMAR_CURSOS_DISTRIBUTIVO = mfc.ID_FORMAR_CURSOS
        INNER JOIN MATRICULACION_CARRERAS mc ON mfc.ID_CARRERA_FORMAR_CURSOS = mc.ID_CARRERAS
        WHERE nd.ID_DISTRIBUTIVO IN (?)
        AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
    `, [distributivosIds]);

    // Combinar los datos
    const carreras = {};
    rows.forEach(row => {
        const distributivo = distributivosConPromedios.find(d => d.id_distributivo === row.ID_DISTRIBUTIVO);
        if (distributivo) {
            const carrera = row.carrera || 'Sin carrera asignada';
            const promedio = parseFloat(distributivo.promedio);

            if (carreras[carrera]) {
                carreras[carrera].suma += promedio;
                carreras[carrera].cantidad += 1;
            } else {
                carreras[carrera] = {
                    suma: promedio,
                    cantidad: 1
                };
            }
        }
    });

    const resultado = Object.keys(carreras).map(nombre => ({
        carrera: nombre,
        promedio: parseFloat((carreras[nombre].suma / carreras[nombre].cantidad).toFixed(2))
    }));

    setDashboardCache(cacheKey, resultado);
    return resultado;
}

// Obtener carrera por distributivo - VERSIÓN MEJORADA
async function obtenerCarreraPorDistributivo(idDistributivo) {
    try {
        const [rows] = await dbLectura.query(`
            SELECT 
                MATRICULACION_CARRERAS.ID_CARRERAS,
                MATRICULACION_CARRERAS.NOMBRE_CARRERAS
            FROM NOTAS_DISTRIBUTIVO
            JOIN MATRICULACION_FORMAR_CURSOS ON NOTAS_DISTRIBUTIVO.ID_FORMAR_CURSOS_DISTRIBUTIVO = MATRICULACION_FORMAR_CURSOS.ID_FORMAR_CURSOS
            JOIN MATRICULACION_CARRERAS ON MATRICULACION_FORMAR_CURSOS.ID_CARRERA_FORMAR_CURSOS = MATRICULACION_CARRERAS.ID_CARRERAS
            WHERE NOTAS_DISTRIBUTIVO.ID_DISTRIBUTIVO = ?
                AND NOTAS_DISTRIBUTIVO.DELETED_AT_DISTRIBUTIVO IS NULL
            LIMIT 1
        `, [idDistributivo]);
        return rows[0] || null;
    } catch (error) {
        console.error(`[ERROR] Error en consulta de carrera para distributivo ${idDistributivo}:`, error);
        throw error;
    }
}

// Obtener nombre del período por ID
async function obtenerNombrePeriodo(idPeriodo) {
    const cacheKey = `nombrePeriodo_${idPeriodo}`;
    const cached = getDashboardCache(cacheKey);
    if (cached) return cached;
    try {
        const [rows] = await dbLectura.query(`
            SELECT NOMBRE_PERIODO AS nombre_periodo
            FROM MATRICULACION_PERIODO
            WHERE ID_PERIODO = ? AND DELETED_AT_PERIODO IS NULL
        `, [idPeriodo]);
        setDashboardCache(cacheKey, rows[0]?.nombre_periodo || `Período ${idPeriodo}`);
        return rows[0]?.nombre_periodo || `Período ${idPeriodo}`;
    } catch (error) {
        console.error(`[ERROR] Error al obtener nombre del período ${idPeriodo}:`, error);
        return `Período ${idPeriodo}`;
    }
}

// Datos para gráfico histórico - VERSIÓN ACTUALIZADA
async function obtenerDatosHistoricos(limite = 6) {
    const cacheKey = `datosHistoricos_${limite}`;
    const cached = getDashboardCache(cacheKey);
    if (cached) return cached;
    const periodos = await obtenerPeriodosOrdenados();
    const periodosLimitados = periodos.slice(0, limite).reverse();
    const periodosIds = periodosLimitados.map(p => p.id_periodo);
    if (periodosIds.length === 0) return [];
    // Traer todos los promedios de los periodos en una sola consulta
    const placeholders = periodosIds.map(() => '?').join(',');
    const [promedios] = await dbEscritura.query(`
        SELECT e.id_periodo, AVG(CAST(r.respuesta AS DECIMAL)) * 20 AS promedio_general
        FROM respuestas r
        INNER JOIN evaluaciones_realizadas er ON r.id_evaluacion = er.id_evaluacion
        INNER JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
        WHERE e.id_periodo IN (${placeholders})
            AND r.id_pregunta IN (
                SELECT id_pregunta FROM preguntas
            )
            AND r.id_distributivo IS NOT NULL
        GROUP BY e.id_periodo
    `, periodosIds);
    // Traer todos los nombres de periodo en una sola consulta
    const [nombresPeriodos] = await dbLectura.query(`
        SELECT ID_PERIODO, NOMBRE_PERIODO AS nombre_periodo
        FROM MATRICULACION_PERIODO
        WHERE ID_PERIODO IN (${placeholders}) AND DELETED_AT_PERIODO IS NULL
    `, periodosIds);
    const nombresMap = {};
    nombresPeriodos.forEach(p => { nombresMap[p.ID_PERIODO] = p.nombre_periodo; });
    // Unir datos
    const resultado = periodosLimitados.map(p => {
        const promedio = promedios.find(x => x.id_periodo === p.id_periodo);
        return {
            periodo: p.id_periodo,
            nombre_periodo: nombresMap[p.id_periodo] || `Período ${p.id_periodo}`,
            promedio: promedio ? promedio.promedio_general || 0 : 0
        };
    });
    setDashboardCache(cacheKey, resultado);
    return resultado;
}

// Obtener resultados detallados por docente - CORREGIDO para agrupar por cédula
async function obtenerResultadosDetallados(periodo) {
    try {
        // Primero obtener los distributivos únicos que tienen evaluaciones completadas
        const [distributivosEvaluados] = await dbEscritura.query(`
            SELECT DISTINCT er.id_distributivo
            FROM evaluaciones_realizadas er
            JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
            WHERE er.estado = 'completada' 
            AND e.id_periodo = ?
        `, [periodo]);

        if (distributivosEvaluados.length === 0) {
            return [];
        }

        const distributivosIds = distributivosEvaluados.map(row => row.id_distributivo);

        // Obtener todos los docentes únicos por cédula que tienen evaluaciones en el período
        const [docentesUnicos] = await dbLectura.query(`
            SELECT DISTINCT hd.CEDULA_DOCENTE, hd.ID_DOCENTE
            FROM NOTAS_DISTRIBUTIVO nd
            INNER JOIN HORARIOS_DOCENTE hd ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
            WHERE nd.ID_DISTRIBUTIVO IN (?)
            AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
            AND hd.DELETED_AT_DOCENTE IS NULL
            AND hd.CEDULA_DOCENTE IS NOT NULL
        `, [distributivosIds]);

        if (docentesUnicos.length === 0) {
            return [];
        }

        const resultados = [];

        for (const docente of docentesUnicos) {
            try {
                const cedulaDocente = docente.CEDULA_DOCENTE;
                const idDocente = docente.ID_DOCENTE;

                // Obtener información del docente
                const [infoDocente] = await dbLectura.query(`
                    SELECT 
                        CONCAT(
                            COALESCE(HD.NOMBRES_1_DOCENTE, ''), ' ',
                            COALESCE(HD.NOMBRES_2_DOCENTE, ''), ' ',
                            COALESCE(HD.APELLIDOS_1_DOCENTE, ''), ' ',
                            COALESCE(HD.APELLIDOS_2_DOCENTE, '')
                        ) AS NOMBRE_COMPLETO
                    FROM HORARIOS_DOCENTE HD
                    WHERE HD.CEDULA_DOCENTE = ?
                        AND HD.DELETED_AT_DOCENTE IS NULL
                    LIMIT 1
                `, [cedulaDocente]);

                if (!infoDocente[0]) {
                    continue;
                }

                const nombreCompleto = formatearNombre(infoDocente[0].NOMBRE_COMPLETO);

                // Obtener los distributivos de este docente desde dbLectura
                const [distributivosDocente] = await dbLectura.query(`
                    SELECT nd.ID_DISTRIBUTIVO
                    FROM NOTAS_DISTRIBUTIVO nd 
                    INNER JOIN HORARIOS_DOCENTE hd ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
                    WHERE hd.CEDULA_DOCENTE = ?
                    AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
                    AND hd.DELETED_AT_DOCENTE IS NULL
                `, [cedulaDocente]);

                if (distributivosDocente.length === 0) {
                    continue;
                }

                const distributivosIds = distributivosDocente.map(row => row.ID_DISTRIBUTIVO);

                // Obtener promedio de autoevaluación (formulario 1) - promediando todas las materias
                const [autoeval] = await dbEscritura.query(`
                    SELECT AVG(CAST(r.respuesta AS DECIMAL)) * 20 AS promedio
                    FROM respuestas r
                    INNER JOIN evaluaciones_realizadas er ON r.id_evaluacion = er.id_evaluacion
                    INNER JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
                    WHERE e.id_periodo = ?
                        AND e.id_formulario = 1
                        AND r.id_distributivo IN (?)
                        AND r.id_pregunta IN (
                            SELECT id_pregunta FROM preguntas
                        )
                        AND er.estado = 'completada'
                `, [periodo, distributivosIds]);

                // Obtener promedio de heteroevaluación (formulario 2) - promediando todas las materias
                const [heteroeval] = await dbEscritura.query(`
                    SELECT AVG(CAST(r.respuesta AS DECIMAL)) * 20 AS promedio
                    FROM respuestas r
                    INNER JOIN evaluaciones_realizadas er ON r.id_evaluacion = er.id_evaluacion
                    INNER JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
                    WHERE e.id_periodo = ?
                        AND e.id_formulario = 2
                        AND r.id_distributivo IN (?)
                        AND r.id_pregunta IN (
                            SELECT id_pregunta FROM preguntas
                        )
                        AND er.estado = 'completada'
                `, [periodo, distributivosIds]);

                // Obtener promedio de coevaluación (formulario 3) - promediando todas las materias
                const [coeval] = await dbEscritura.query(`
                    SELECT AVG(CAST(r.respuesta AS DECIMAL)) * 20 AS promedio
                    FROM respuestas r
                    INNER JOIN evaluaciones_realizadas er ON r.id_evaluacion = er.id_evaluacion
                    INNER JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
                    WHERE e.id_periodo = ?
                        AND e.id_formulario = 3
                        AND r.id_distributivo IN (?)
                        AND r.id_pregunta IN (
                            SELECT id_pregunta FROM preguntas
                        )
                        AND er.estado = 'completada'
                `, [periodo, distributivosIds]);

                // Obtener promedio de evaluación de autoridades - dbEscritura
                const [evalAutoridades] = await dbEscritura.query(`
                    SELECT AVG(ea.calificacion) AS promedio
                    FROM evaluaciones_autoridades ea
                    WHERE ea.id_periodo = ?
                        AND ea.id_docente_evaluado = ?
                        AND ea.estado = 'ACTIVO'
                `, [periodo, idDocente]);

                const autoevaluacion = autoeval[0]?.promedio || null;
                const heteroevaluacion = heteroeval[0]?.promedio || null;
                const coevaluacion = coeval[0]?.promedio || null;
                const evaluacionAutoridades = evalAutoridades[0]?.promedio || null;

                // Calcular promedio general con ponderación
                // Autoevaluación 10%, Heteroevaluación 40%, Coevaluación 30%, Autoridades 20%
                let promedioGeneral = null;
                let sumaPonderada = 0;
                let pesoTotal = 0;

                if (autoevaluacion !== null) {
                    sumaPonderada += parseFloat(autoevaluacion) * 0.10;
                    pesoTotal += 0.10;
                }
                if (heteroevaluacion !== null) {
                    sumaPonderada += parseFloat(heteroevaluacion) * 0.40;
                    pesoTotal += 0.40;
                }
                if (coevaluacion !== null) {
                    sumaPonderada += parseFloat(coevaluacion) * 0.30;
                    pesoTotal += 0.30;
                }
                if (evaluacionAutoridades !== null) {
                    sumaPonderada += parseFloat(evaluacionAutoridades) * 0.20;
                    pesoTotal += 0.20;
                }

                // Solo calcular promedio si hay al menos una evaluación
                if (pesoTotal > 0) {
                    // Ajustar la suma ponderada al peso total disponible
                    promedioGeneral = parseFloat((sumaPonderada / pesoTotal).toFixed(2));
                }

                resultados.push({
                    cedula_docente: cedulaDocente,
                    docente: nombreCompleto,
                    autoevaluacion: autoevaluacion ? parseFloat(autoevaluacion).toFixed(2) : null,
                    heteroevaluacion: heteroevaluacion ? parseFloat(heteroevaluacion).toFixed(2) : null,
                    coevaluacion: coevaluacion ? parseFloat(coevaluacion).toFixed(2) : null,
                    evaluacion_autoridades: evaluacionAutoridades ? parseFloat(evaluacionAutoridades).toFixed(2) : null,
                    promedio_general: promedioGeneral
                });
            } catch (error) {
                console.error(`[ERROR] Error procesando docente ${docente.CEDULA_DOCENTE}:`, error);
                continue;
            }
        }
        // Ordenar por promedio general descendente
        resultados.sort((a, b) => (b.promedio_general || 0) - (a.promedio_general || 0));
        return resultados;
    } catch (error) {
        console.error('[ERROR] Error al obtener resultados detallados:', error);
        throw error;
    }
}

// Obtener estadísticas por tipo de pregunta
async function obtenerEstadisticasTipoPregunta(idPeriodo) {
    const cacheKey = `estadisticasTipoPregunta_${idPeriodo}`;
    const cached = getDashboardCache(cacheKey);
    if (cached) return cached;
    try {
        // Primero obtener los distributivos únicos que tienen evaluaciones
        const [distributivosEvaluados] = await dbEscritura.query(`
            SELECT DISTINCT r.id_distributivo
            FROM respuestas r
            INNER JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
            WHERE e.id_periodo = ?
            AND r.id_distributivo IS NOT NULL
        `, [idPeriodo]);

        if (distributivosEvaluados.length === 0) {
            // Si no hay distributivos, devolver estadísticas vacías
            const [estadisticasVacias] = await dbEscritura.query(`
                SELECT 
                    p.tipo_pregunta,
                    0 as total_respuestas,
                    0 as docentes_evaluados,
                    0 as evaluadores_participantes,
                    COUNT(DISTINCT p.id_pregunta) as total_preguntas
                FROM preguntas p
                GROUP BY p.tipo_pregunta
                ORDER BY p.tipo_pregunta
            `);
            return estadisticasVacias;
        }

        const distributivosIds = distributivosEvaluados.map(row => row.id_distributivo);

        // Obtener las cédulas únicas de los docentes desde dbLectura
        const [docentesUnicos] = await dbLectura.query(`
            SELECT DISTINCT hd.CEDULA_DOCENTE
            FROM NOTAS_DISTRIBUTIVO nd
            INNER JOIN HORARIOS_DOCENTE hd ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
            WHERE nd.ID_DISTRIBUTIVO IN (?)
            AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
            AND hd.DELETED_AT_DOCENTE IS NULL
            AND hd.CEDULA_DOCENTE IS NOT NULL
        `, [distributivosIds]);

        const totalDocentesUnicos = docentesUnicos.length;

        // Ahora obtener las estadísticas básicas
        const [estadisticasBase] = await dbEscritura.query(`
            SELECT 
                p.tipo_pregunta,
                COUNT(r.id_respuesta) as total_respuestas,
                COUNT(DISTINCT r.evaluador_id) as evaluadores_participantes,
                COUNT(DISTINCT p.id_pregunta) as total_preguntas
            FROM preguntas p
            LEFT JOIN respuestas r ON r.id_pregunta = p.id_pregunta
            LEFT JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
            WHERE e.id_periodo = ? OR e.id_periodo IS NULL
            GROUP BY p.tipo_pregunta
            ORDER BY p.tipo_pregunta
        `, [idPeriodo]);

        // Agregar el conteo correcto de docentes únicos por cédula
        const estadisticasCorregidas = estadisticasBase.map(estadistica => ({
            ...estadistica,
            docentes_evaluados: totalDocentesUnicos
        }));

        setDashboardCache(cacheKey, estadisticasCorregidas);
        return estadisticasCorregidas;
    } catch (error) {
        console.error('[ERROR] Error en obtenerEstadisticasTipoPregunta:', error);
        throw error;
    }
}

// Cache temporal en memoria
const cacheDocentes = new Map();
const cacheEvaluadores = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// FUNCIÓN OPTIMIZADA CON CACHE: Obtener respuestas con información enriquecida
async function obtenerRespuestasEnriquecidas(idPeriodo) {
    try {
        // Obtener respuestas básicas
        const [respuestasBasicas] = await dbEscritura.query(`
            SELECT 
                r.id_respuesta,
                r.respuesta,
                r.evaluador_id,
                r.evaluado_id,
                r.id_distributivo,
                p.id_pregunta,
                p.texto as pregunta_texto,
                p.tipo_pregunta,
                f.nombre as formulario_nombre,
                e.id_evaluacion,
                e.id_formulario
            FROM respuestas r
            JOIN preguntas p ON p.id_pregunta = r.id_pregunta
            JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
            JOIN formularios f ON f.id_formulario = e.id_formulario
            WHERE e.id_periodo = ?
            ORDER BY p.tipo_pregunta, p.id_pregunta, r.id_respuesta
        `, [idPeriodo]);
        // Recopilar IDs únicos para consultas batch
        const distributivosUnicos = [...new Set(respuestasBasicas
            .filter(r => r.id_distributivo)
            .map(r => r.id_distributivo))];

        const docentesUnicos = [...new Set(respuestasBasicas
            .filter(r => r.evaluado_id && !r.id_distributivo)
            .map(r => r.evaluado_id))];

        const evaluadoresUnicos = [...new Set(respuestasBasicas.map(r => r.evaluador_id))];
        // Precargar información de docentes por distributivo (en lotes)
        const infoDistributivos = await precagarInfoDistributivosLote(distributivosUnicos);
        // Precargar información de docentes por ID (en lotes)
        const infoDocentes = await precargarInfoDocentesLote(docentesUnicos);
        // Precargar información de evaluadores (en lotes)
        const infoEvaluadores = await precargarInfoEvaluadoresLote(evaluadoresUnicos);
        // Enriquecer respuestas usando la información precargada
        const respuestasEnriquecidas = respuestasBasicas.map(respuesta => {
            let nombreDocente = 'Docente no identificado';
            let nombreAsignatura = 'Asignatura no identificada';
            let todasLasMaterias = 'Asignatura no identificada';
            let cedulaDocente = null;
            let nombreEvaluador = 'Evaluador no identificado';

            // Información del docente evaluado
            if (respuesta.id_distributivo && infoDistributivos[respuesta.id_distributivo]) {
                const info = infoDistributivos[respuesta.id_distributivo];
                nombreDocente = info.nombre_docente;
                nombreAsignatura = info.nombre_asignatura;
                todasLasMaterias = info.todas_las_materias;
                cedulaDocente = info.cedula_docente;
            } else if (respuesta.evaluado_id && infoDocentes[respuesta.evaluado_id]) {
                nombreDocente = infoDocentes[respuesta.evaluado_id].nombre_docente;
            }

            // Información del evaluador
            if (infoEvaluadores[respuesta.evaluador_id]) {
                nombreEvaluador = infoEvaluadores[respuesta.evaluador_id].nombre_evaluador;
            }

            return {
                ...respuesta,
                nombre_docente: nombreDocente,
                nombre_asignatura: nombreAsignatura,
                todas_las_materias: todasLasMaterias,
                cedula_docente: cedulaDocente,
                nombre_evaluador: nombreEvaluador
            };
        });
        return respuestasEnriquecidas;
    } catch (error) {
        console.error('[ERROR] Error en obtenerRespuestasEnriquecidas:', error);
        throw error;
    }
}

// Helpers optimizados para loteo
async function precagarInfoDistributivosLote(distributivos) {
    if (distributivos.length === 0) return {};
    const infoMap = {};
    for (let i = 0; i < distributivos.length; i += 500) {
        const lote = distributivos.slice(i, i + 500);
        const placeholders = lote.map(() => '?').join(',');
        const [resultados] = await dbLectura.query(`
            SELECT 
                nd.ID_DISTRIBUTIVO,
                CONCAT(
                    COALESCE(hd.NOMBRES_1_DOCENTE, ''), ' ',
                    COALESCE(hd.NOMBRES_2_DOCENTE, ''), ' ',
                    COALESCE(hd.APELLIDOS_1_DOCENTE, ''), ' ',
                    COALESCE(hd.APELLIDOS_2_DOCENTE, '')
                ) as nombre_docente,
                hd.CEDULA_DOCENTE,
                na.NOMBRE_ASIGNATURA as nombre_asignatura
            FROM NOTAS_DISTRIBUTIVO nd
            JOIN HORARIOS_DOCENTE hd ON hd.ID_DOCENTE = nd.ID_DOCENTE_DISTRIBUTIVO
            JOIN NOTAS_ASIGNATURA na ON na.ID_ASIGNATURA = nd.ID_ASIGNATURA_DISTRIBUTIVO
            WHERE nd.ID_DISTRIBUTIVO IN (${placeholders})
            AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
            AND hd.DELETED_AT_DOCENTE IS NULL
        `, lote);
        // Agrupar por cédula para obtener todas las materias de cada docente
        const docentesPorCedula = {};
        resultados.forEach(row => {
            const cedula = row.CEDULA_DOCENTE;
            if (!docentesPorCedula[cedula]) {
                docentesPorCedula[cedula] = {
                    nombre_docente: formatearNombre(row.nombre_docente),
                    cedula_docente: cedula,
                    materias: []
                };
            }
            docentesPorCedula[cedula].materias.push(row.nombre_asignatura);
        });
        resultados.forEach(row => {
            const cedula = row.CEDULA_DOCENTE;
            const docenteInfo = docentesPorCedula[cedula];
            infoMap[row.ID_DISTRIBUTIVO] = {
                nombre_docente: docenteInfo.nombre_docente,
                cedula_docente: cedula,
                nombre_asignatura: row.nombre_asignatura,
                todas_las_materias: docenteInfo.materias.join(', ')
            };
        });
    }
    return infoMap;
}

async function precargarInfoDocentesLote(docentes) {
    if (docentes.length === 0) return {};
    const infoMap = {};
    for (let i = 0; i < docentes.length; i += 500) {
        const lote = docentes.slice(i, i + 500);
        const placeholders = lote.map(() => '?').join(',');
        const [resultados] = await dbLectura.query(`
            SELECT 
                hd.ID_DOCENTE,
                CONCAT(
                    COALESCE(hd.NOMBRES_1_DOCENTE, ''), ' ',
                    COALESCE(hd.NOMBRES_2_DOCENTE, ''), ' ',
                    COALESCE(hd.APELLIDOS_1_DOCENTE, ''), ' ',
                    COALESCE(hd.APELLIDOS_2_DOCENTE, '')
                ) as nombre_docente
            FROM HORARIOS_DOCENTE hd
            WHERE hd.ID_DOCENTE IN (${placeholders})
            AND hd.DELETED_AT_DOCENTE IS NULL
        `, lote);
        resultados.forEach(row => {
            infoMap[row.ID_DOCENTE] = {
                nombre_docente: formatearNombre(row.nombre_docente)
            };
        });
    }
    return infoMap;
}

async function precargarInfoEvaluadoresLote(evaluadores) {
    if (evaluadores.length === 0) return {};
    const infoMap = {};
    for (let i = 0; i < evaluadores.length; i += 500) {
        const lote = evaluadores.slice(i, i + 500);
        const placeholders = lote.map(() => '?').join(',');
        // Docentes directos
        const [docentesDirectos] = await dbLectura.query(`
            SELECT 
                hd.ID_DOCENTE as id_evaluador,
                CONCAT(
                    COALESCE(hd.NOMBRES_1_DOCENTE, ''), ' ',
                    COALESCE(hd.NOMBRES_2_DOCENTE, ''), ' ',
                    COALESCE(hd.APELLIDOS_1_DOCENTE, ''), ' ',
                    COALESCE(hd.APELLIDOS_2_DOCENTE, '')
                ) as nombre_evaluador,
                'docente' as tipo
            FROM HORARIOS_DOCENTE hd
            WHERE hd.ID_DOCENTE IN (${placeholders})
            AND hd.DELETED_AT_DOCENTE IS NULL
        `, lote);
        // Docentes por usuario
        const [docentesPorUsuario] = await dbLectura.query(`
            SELECT 
                su.ID_USUARIOS as id_evaluador,
                CONCAT(
                    COALESCE(hd.NOMBRES_1_DOCENTE, ''), ' ',
                    COALESCE(hd.NOMBRES_2_DOCENTE, ''), ' ',
                    COALESCE(hd.APELLIDOS_1_DOCENTE, ''), ' ',
                    COALESCE(hd.APELLIDOS_2_DOCENTE, '')
                ) as nombre_evaluador,
                'docente' as tipo
            FROM SEGURIDAD_USUARIOS su
            JOIN HORARIOS_DOCENTE hd ON hd.CEDULA_DOCENTE = su.DOCUMENTO_USUARIOS
            WHERE su.ID_USUARIOS IN (${placeholders})
            AND hd.DELETED_AT_DOCENTE IS NULL
        `, lote);
        // Buscar como estudiantes los que no se encontraron como docentes
        const docentesEncontrados = [...docentesDirectos, ...docentesPorUsuario].map(d => d.id_evaluador);
        const evaluadoresRestantes = lote.filter(id => !docentesEncontrados.includes(id));
        let estudiantesEvaluadores = [];
        if (evaluadoresRestantes.length > 0) {
            const placeholdersRestantes = evaluadoresRestantes.map(() => '?').join(',');
            const [estudiantes] = await dbLectura.query(`
                SELECT 
                    su.ID_USUARIOS as id_evaluador,
                    CONCAT(
                        COALESCE(me.NOMBRE_1_ESTUDIANTES, ''), ' ',
                        COALESCE(me.NOMBRE_2_ESTUDIANTES, ''), ' ',
                        COALESCE(me.APELLIDOS_1_ESTUDIANTES, ''), ' ',
                        COALESCE(me.APELLIDOS_2_ESTUDIANTES, '')
                    ) as nombre_evaluador,
                    'estudiante' as tipo
                FROM SEGURIDAD_USUARIOS su
                JOIN MATRICULACION_ESTUDIANTES me ON me.DOCUMENTO_ESTUDIANTES = su.DOCUMENTO_USUARIOS
                WHERE su.ID_USUARIOS IN (${placeholdersRestantes})
                AND me.DELETED_AT_ESTUDIANTES IS NULL
            `, evaluadoresRestantes);
            estudiantesEvaluadores = estudiantes;
        }
        [...docentesDirectos, ...docentesPorUsuario, ...estudiantesEvaluadores].forEach(row => {
            infoMap[row.id_evaluador] = {
                nombre_evaluador: formatearNombre(row.nombre_evaluador),
                tipo: row.tipo
            };
        });
    }
    return infoMap;
}

// Funciones originales mantenidas para compatibilidad
async function obtenerDocentePorDistributivo(idDistributivo) {
    const cacheKey = `dist_${idDistributivo}`;
    const cached = cacheDocentes.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }

    try {
        const [docenteInfo] = await dbLectura.query(`
            SELECT 
                CONCAT(hd.NOMBRES_1_DOCENTE, ' ', hd.APELLIDOS_1_DOCENTE) as nombre_docente,
                na.NOMBRE_ASIGNATURA as nombre_asignatura
            FROM NOTAS_DISTRIBUTIVO nd
            JOIN HORARIOS_DOCENTE hd ON hd.ID_DOCENTE = nd.ID_DOCENTE_DISTRIBUTIVO
            JOIN NOTAS_ASIGNATURA na ON na.ID_ASIGNATURA = nd.ID_ASIGNATURA_DISTRIBUTIVO
            WHERE nd.ID_DISTRIBUTIVO = ?
            AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
            AND hd.DELETED_AT_DOCENTE IS NULL
            LIMIT 1
        `, [idDistributivo]);
        cacheDocentes.set(cacheKey, {
            data: docenteInfo,
            timestamp: Date.now()
        });
        return docenteInfo;
    } catch (error) {
        console.error(`[ERROR] Error obteniendo docente por distributivo ${idDistributivo}:`, error);
        return [];
    }
}

async function obtenerDocentePorId(idDocente) {
    const cacheKey = `doc_${idDocente}`;
    const cached = cacheDocentes.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }
    try {
        const [docenteInfo] = await dbLectura.query(`
            SELECT CONCAT(hd.NOMBRES_1_DOCENTE, ' ', hd.APELLIDOS_1_DOCENTE) as nombre_docente
            FROM HORARIOS_DOCENTE hd
            WHERE hd.ID_DOCENTE = ?
            AND hd.DELETED_AT_DOCENTE IS NULL
            LIMIT 1
        `, [idDocente]);
        cacheDocentes.set(cacheKey, {
            data: docenteInfo,
            timestamp: Date.now()
        });
        return docenteInfo;
    } catch (error) {
        console.error(`[ERROR] Error obteniendo docente por ID ${idDocente}:`, error);
        return [];
    }
}

async function obtenerEvaluadorDocente(evaluadorId) {
    const cacheKey = `eval_doc_${evaluadorId}`;
    const cached = cacheEvaluadores.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }
    try {
        const [evaluadorDocente] = await dbLectura.query(`
            SELECT CONCAT(hd.NOMBRES_1_DOCENTE, ' ', hd.APELLIDOS_1_DOCENTE) as nombre_evaluador
            FROM HORARIOS_DOCENTE hd
            WHERE hd.ID_DOCENTE = ?
            AND hd.DELETED_AT_DOCENTE IS NULL
            LIMIT 1
        `, [evaluadorId]);
        cacheEvaluadores.set(cacheKey, {
            data: evaluadorDocente,
            timestamp: Date.now()
        });
        return evaluadorDocente;
    } catch (error) {
        console.error(`[ERROR] Error obteniendo evaluador docente ${evaluadorId}:`, error);
        return [];
    }
}

async function obtenerEvaluadorEstudiante(evaluadorId) {
    const cacheKey = `eval_est_${evaluadorId}`;
    const cached = cacheEvaluadores.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }

    try {
        const [evaluadorEstudiante] = await dbLectura.query(`
            SELECT CONCAT(
                COALESCE(me.NOMBRE_1_ESTUDIANTES, ''), ' ',
                COALESCE(me.NOMBRE_2_ESTUDIANTES, ''), ' ',
                COALESCE(me.APELLIDOS_1_ESTUDIANTES, ''), ' ',
                COALESCE(me.APELLIDOS_2_ESTUDIANTES, '')
            ) as nombre_evaluador
            FROM MATRICULACION_ESTUDIANTES me
            JOIN SEGURIDAD_USUARIOS su ON su.DOCUMENTO_USUARIOS = me.DOCUMENTO_ESTUDIANTES
            WHERE su.ID_USUARIOS = ?
            AND me.DELETED_AT_ESTUDIANTES IS NULL
            LIMIT 1
        `, [evaluadorId]);
        
        // Aplicar formateo de nombres si hay resultados
        if (evaluadorEstudiante[0]) {
            evaluadorEstudiante[0].nombre_evaluador = formatearNombre(evaluadorEstudiante[0].nombre_evaluador);
        }
        
        cacheEvaluadores.set(cacheKey, {
            data: evaluadorEstudiante,
            timestamp: Date.now()
        });
        return evaluadorEstudiante;
    } catch (error) {
        console.error(`[ERROR] Error obteniendo evaluador estudiante ${evaluadorId}:`, error);
        return [];
    }
}

// Función para obtener datos del mapa de calor por secciones
async function obtenerDatosMapaCalor(idPeriodo) {
    try {
        // Consulta principal para promedios por sección
        const [resultados] = await dbEscritura.query(`
            SELECT 
                p.tipo_pregunta,
                f.nombre as tipo_evaluacion,
                e.id_formulario,
                AVG(CAST(r.respuesta AS DECIMAL(3,2))) as promedio_seccion,
                COUNT(r.id_respuesta) as total_respuestas_seccion
            FROM respuestas r
            JOIN preguntas p ON p.id_pregunta = r.id_pregunta
            JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
            JOIN formularios f ON f.id_formulario = e.id_formulario
            WHERE e.id_periodo = ?
            AND r.respuesta IS NOT NULL
            AND r.respuesta != ''
            GROUP BY p.tipo_pregunta, e.id_formulario, f.nombre
            ORDER BY p.tipo_pregunta, e.id_formulario
        `, [idPeriodo]);
        // Consulta separada para obtener estadísticas generales del período
        const [estadisticasGenerales] = await dbEscritura.query(`
            SELECT 
                p.tipo_pregunta,
                e.id_formulario,
                COUNT(DISTINCT r.evaluado_id) as docentes_evaluados,
                COUNT(DISTINCT r.evaluador_id) as evaluadores_participantes,
                COUNT(r.id_respuesta) as total_respuestas
            FROM respuestas r
            JOIN preguntas p ON p.id_pregunta = r.id_pregunta
            JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
            WHERE e.id_periodo = ?
            AND r.respuesta IS NOT NULL
            AND r.respuesta != ''
            GROUP BY p.tipo_pregunta, e.id_formulario
        `, [idPeriodo]);
        // Consulta para obtener el total global de docentes evaluados en el período
        const [totalGlobal] = await dbEscritura.query(`
            SELECT 
                COUNT(DISTINCT r.evaluado_id) as total_docentes_evaluados,
                COUNT(DISTINCT r.evaluador_id) as total_evaluadores
            FROM respuestas r
            JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
            WHERE e.id_periodo = ?
            AND r.respuesta IS NOT NULL
            AND r.respuesta != ''
        `, [idPeriodo]);
        return {
            resultados,
            estadisticasGenerales,
            totalGlobal: totalGlobal[0] || { total_docentes_evaluados: 0, total_evaluadores: 0 }
        };
    } catch (error) {
        console.error('Error al obtener datos del mapa de calor:', error);
        throw error;
    }
}

// Obtener promedio por ítem del formulario por tipo de evaluación
async function obtenerPromedioItemsPorTipo(idPeriodo, tipoEvaluacion) {
    try {
        const [resultados] = await dbEscritura.query(`
            SELECT 
                p.id_pregunta,
                p.texto,
                p.tipo_pregunta,
                AVG(CAST(r.respuesta AS DECIMAL(3,2))) as promedio_item,
                COUNT(r.id_respuesta) as total_respuestas,
                STDDEV(CAST(r.respuesta AS DECIMAL(3,2))) as desviacion_estandar
            FROM respuestas r
            JOIN preguntas p ON p.id_pregunta = r.id_pregunta
            JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
            WHERE e.id_periodo = ?
            AND e.id_formulario = ?
            AND r.respuesta IS NOT NULL
            AND r.respuesta != ''
            AND r.respuesta REGEXP '^[0-9]+(\\\.[0-9]+)?$'
            GROUP BY p.id_pregunta, p.texto, p.tipo_pregunta
            ORDER BY p.tipo_pregunta, p.id_pregunta ASC
        `, [idPeriodo, tipoEvaluacion]);
        return resultados;
    } catch (error) {
        console.error('Error en repositorio obtenerPromedioItemsPorTipo:', error);
        throw error;
    }
}

// Obtener preguntas con mejor y peor puntuación por tipo
async function obtenerPreguntasExtremas(idPeriodo, tipoEvaluacion) {
    try {
        const [resultados] = await dbEscritura.query(`
            SELECT 
                p.id_pregunta,
                p.texto as texto_pregunta,  -- Cambié el alias aquí
                p.tipo_pregunta,
                AVG(CAST(r.respuesta AS DECIMAL(3,2))) as promedio_item,
                COUNT(r.id_respuesta) as total_respuestas,
                STDDEV(CAST(r.respuesta AS DECIMAL(3,2))) as desviacion_estandar
            FROM respuestas r
            JOIN preguntas p ON p.id_pregunta = r.id_pregunta
            JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
            WHERE e.id_periodo = ?
            AND e.id_formulario = ?
            AND r.respuesta IS NOT NULL
            AND r.respuesta != ''
            AND r.respuesta REGEXP '^[0-9]+(\.[0-9]+)?$' 
            GROUP BY p.id_pregunta, p.texto, p.tipo_pregunta
            HAVING COUNT(r.id_respuesta) >= 1
            ORDER BY p.tipo_pregunta, promedio_item DESC
        `, [idPeriodo, tipoEvaluacion]);

        return resultados;
    } catch (error) {
        console.error('Error en repositorio obtenerPreguntasExtremas:', error);
        throw error;
    }
}

// Obtener promedios por carrera filtrado por tipo de evaluación (CORREGIDO - funciona para todos los casos)
async function obtenerPromediosPorCarrera(idPeriodo, tipoEvaluacion) {
    try {
        // Paso 1: Consulta unificada con JOIN optimizado
        const [datosCompletos] = await Promise.all([
            dbLectura.query(`
                SELECT DISTINCT 
                    nd.ID_DISTRIBUTIVO,
                    nd.ID_DOCENTE_DISTRIBUTIVO,
                    hd.ID_DOCENTE,
                    hd.CEDULA_DOCENTE,
                    mc.NOMBRE_CARRERAS as nombre_carrera,
                    su.ID_USUARIOS,
                    su.DOCUMENTO_USUARIOS as cedula_usuario
                FROM NOTAS_DISTRIBUTIVO nd
                JOIN HORARIOS_DOCENTE hd ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
                JOIN MATRICULACION_FORMAR_CURSOS mfc ON nd.ID_FORMAR_CURSOS_DISTRIBUTIVO = mfc.ID_FORMAR_CURSOS
                JOIN MATRICULACION_CARRERAS mc ON mfc.ID_CARRERA_FORMAR_CURSOS = mc.ID_CARRERAS
                LEFT JOIN SEGURIDAD_USUARIOS su ON hd.CEDULA_DOCENTE = su.DOCUMENTO_USUARIOS
                WHERE nd.ID_PERIODO_DISTRIBUTIVO = ?
                AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
                AND hd.DELETED_AT_DOCENTE IS NULL
                AND hd.CEDULA_DOCENTE IS NOT NULL
                AND su.DOCUMENTO_USUARIOS IS NOT NULL
                AND su.DOCUMENTO_USUARIOS != ''
            `, [idPeriodo])
        ]);

        // Paso 2: Crear mapeos optimizados con Map() para mejor rendimiento
        const mapeosPorCedula = new Map();
        const mapeosPorId = {
            porIdDocente: new Map(),
            porIdUsuario: new Map(),
            porIdDocenteDistributivo: new Map(),
            porIdDistributivo: new Map()
        };

        // Procesar datos en una sola pasada
        datosCompletos[0].forEach(item => {
            if (!item.CEDULA_DOCENTE) return;

            const cedula = item.CEDULA_DOCENTE;
            const infoDocente = {
                cedula: cedula,
                nombre_carrera: item.nombre_carrera,
                id_docente: item.ID_DOCENTE,
                id_docente_distributivo: item.ID_DOCENTE_DISTRIBUTIVO,
                id_distributivo: item.ID_DISTRIBUTIVO,
                id_usuario: item.ID_USUARIOS
            };

            // Mapear por cédula
            mapeosPorCedula.set(cedula, infoDocente);

            // Crear mapeos por IDs
            if (item.ID_DOCENTE) {
                mapeosPorId.porIdDocente.set(item.ID_DOCENTE, infoDocente);
            }
            if (item.ID_DOCENTE_DISTRIBUTIVO) {
                mapeosPorId.porIdDocenteDistributivo.set(item.ID_DOCENTE_DISTRIBUTIVO, infoDocente);
            }
            if (item.ID_DISTRIBUTIVO) {
                mapeosPorId.porIdDistributivo.set(item.ID_DISTRIBUTIVO, infoDocente);
            }
            if (item.ID_USUARIOS) {
                mapeosPorId.porIdUsuario.set(item.ID_USUARIOS, infoDocente);
            }
        });

        // Paso 3: Función optimizada para encontrar información
        function encontrarInfoPorEvaluadoId(evaluadoId) {
            // Usar Map.get() que es O(1) vs object lookup
            return mapeosPorCedula.get(evaluadoId) ||
                mapeosPorId.porIdDistributivo.get(evaluadoId) ||
                mapeosPorId.porIdDocenteDistributivo.get(evaluadoId) ||
                mapeosPorId.porIdDocente.get(evaluadoId) ||
                mapeosPorId.porIdUsuario.get(evaluadoId) ||
                null;
        }

        // Paso 4: Consulta optimizada de promedios con índices apropiados
        const [resultados] = await dbEscritura.query(`
            SELECT 
                r.evaluado_id,
                p.tipo_pregunta,
                AVG(CAST(r.respuesta AS DECIMAL(10,2))) as promedio_seccion,
                COUNT(r.id_respuesta) as respuestas_seccion
            FROM respuestas r
            INNER JOIN preguntas p ON p.id_pregunta = r.id_pregunta
            INNER JOIN evaluaciones e ON e.id_evaluacion = r.id_evaluacion
            WHERE e.id_periodo = ?
            AND e.id_formulario = ?
            AND r.respuesta REGEXP '^[0-9]+\.?[0-9]*$'
            AND CAST(r.respuesta AS DECIMAL(10,2)) > 0
            GROUP BY r.evaluado_id, p.tipo_pregunta
            HAVING promedio_seccion IS NOT NULL AND promedio_seccion > 0
            ORDER BY r.evaluado_id, p.tipo_pregunta
        `, [idPeriodo, tipoEvaluacion]);

        // Paso 5: Procesamiento optimizado con Map para carrerasData
        const carrerasData = new Map();
        let contadores = {
            encontrados: 0,
            noEncontrados: 0,
            sinCarrera: 0
        };

        resultados.forEach(item => {
            // Validación rápida
            const promedio = parseFloat(item.promedio_seccion);
            if (isNaN(promedio) || promedio <= 0) return;

            // Buscar información del evaluado
            const infoEvaluado = encontrarInfoPorEvaluadoId(item.evaluado_id);
            let nombreCarrera = 'Sin carrera asignada';
            let cedula = null;

            if (infoEvaluado) {
                cedula = infoEvaluado.cedula;
                nombreCarrera = infoEvaluado.nombre_carrera || 'Sin carrera asignada';

                if (nombreCarrera === 'Sin carrera asignada') {
                    contadores.sinCarrera++;
                } else {
                    contadores.encontrados++;
                }
            } else {
                contadores.noEncontrados++;
            }

            // Obtener o crear carrera
            let carrera = carrerasData.get(nombreCarrera);
            if (!carrera) {
                carrera = {
                    nombre_carrera: nombreCarrera,
                    secciones: new Map(),
                    docentes: new Set(),
                    total_respuestas: 0
                };
                carrerasData.set(nombreCarrera, carrera);
            }

            // Agregar docente único
            carrera.docentes.add(cedula || item.evaluado_id);
            carrera.total_respuestas += item.respuestas_seccion;

            // Obtener o crear sección
            let seccion = carrera.secciones.get(item.tipo_pregunta);
            if (!seccion) {
                seccion = {
                    suma_promedios: 0,
                    count_docentes: 0,
                    total_respuestas: 0
                };
                carrera.secciones.set(item.tipo_pregunta, seccion);
            }

            seccion.suma_promedios += promedio;
            seccion.count_docentes++;
            seccion.total_respuestas += item.respuestas_seccion;
        });

        // Paso 6: Generar resultados finales de forma optimizada
        const resultadosFinales = [];

        for (const [nombreCarrera, carrera] of carrerasData) {
            for (const [tipoSeccion, seccion] of carrera.secciones) {
                if (seccion.count_docentes === 0) continue;

                const promedioSeccion = seccion.suma_promedios / seccion.count_docentes;

                if (isNaN(promedioSeccion) || promedioSeccion <= 0) continue;

                resultadosFinales.push({
                    nombre_carrera: nombreCarrera,
                    tipo_pregunta: tipoSeccion,
                    promedio_seccion: Math.round(promedioSeccion * 100) / 100, // Más rápido que toFixed
                    respuestas_seccion: seccion.total_respuestas,
                    total_docentes: carrera.docentes.size,
                    total_respuestas: carrera.total_respuestas
                });
            }
        }

        return resultadosFinales;

    } catch (error) {
        console.error('❌ Error en obtenerPromediosPorCarrera:', error);
        throw error;
    }
}

// Obtener información del periodo
async function obtenerPeriodo(idPeriodo) {
    try {
        const [resultados] = await dbLectura.query(`
            SELECT *
            FROM MATRICULACION_PERIODO
            WHERE ID_PERIODO = ?
            AND DELETED_AT_PERIODO IS NULL
        `, [idPeriodo]);
        return resultados[0];
    } catch (error) {
        console.error('Error en repositorio obtenerPeriodo:', error);
        throw error;
    }
}

// Cache en memoria para dashboard (20 segundos)
const dashboardCache = new Map();
const DASHBOARD_CACHE_TTL = 20 * 1000;
function getDashboardCache(key) {
    const entry = dashboardCache.get(key);
    if (entry && (Date.now() - entry.timestamp < DASHBOARD_CACHE_TTL)) {
        return entry.data;
    }
    return null;
}
function setDashboardCache(key, data) {
    dashboardCache.set(key, { data, timestamp: Date.now() });
}

module.exports = {
    obtenerTotalDocentesEvaluados,
    obtenerTotalEvaluacionesCompletadas,
    obtenerPromedioGeneral,
    obtenerTasaParticipacion,
    obtenerPeriodosOrdenados,
    obtenerPromedioPorTipoEvaluacion,
    obtenerPromedioPorCarrera,
    obtenerDatosHistoricos,
    obtenerNombrePeriodo,
    obtenerDetalleParticipacionPorTipo,
    obtenerResultadosDetallados,
    obtenerDocentePorDistributivo,
    obtenerDocentePorId,
    obtenerEvaluadorDocente,
    obtenerEvaluadorEstudiante,
    obtenerEstadisticasTipoPregunta,
    obtenerCarreraPorDistributivo,
    obtenerRespuestasEnriquecidas,
    obtenerDatosMapaCalor,
    obtenerPromedioItemsPorTipo,
    obtenerPreguntasExtremas,
    obtenerPromediosPorCarrera,
    obtenerPeriodo
};