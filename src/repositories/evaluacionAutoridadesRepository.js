const { dbLectura, dbEscritura } = require('../config/database');

class AutoridadesRepository {
    // Obtener todos los periodos
    async obtenerPeriodos() {
        try {
            const [rows] = await dbLectura.query(`
                SELECT 
                    ID_PERIODO AS id_periodo,
                    NOMBRE_PERIODO AS descripcion
                FROM MATRICULACION_PERIODO
                WHERE DELETED_AT_PERIODO IS NULL
                ORDER BY ID_PERIODO DESC
            `);
            return rows;
        } catch (error) {
            console.error('Error en obtenerPeriodos:', error);
            throw error;
        }
    }

    // Obtener todas las carreras activas (o solo las activas del distributivo para un periodo)
    async obtenerCarreras(idPeriodo = null) {
        try {
            if (idPeriodo) {
                const [rows] = await dbLectura.query(`
                    SELECT DISTINCT
                        MATRICULACION_CARRERAS.ID_CARRERAS as id_carrera,
                        MATRICULACION_CARRERAS.NOMBRE_CARRERAS as nombre_carrera
                    FROM NOTAS_DISTRIBUTIVO
                    LEFT JOIN MATRICULACION_FORMAR_CURSOS 
                      ON NOTAS_DISTRIBUTIVO.ID_FORMAR_CURSOS_DISTRIBUTIVO = MATRICULACION_FORMAR_CURSOS.ID_FORMAR_CURSOS
                    LEFT JOIN MATRICULACION_CARRERAS 
                      ON MATRICULACION_FORMAR_CURSOS.ID_CARRERA_FORMAR_CURSOS = MATRICULACION_CARRERAS.ID_CARRERAS
                    WHERE NOTAS_DISTRIBUTIVO.DELETED_AT_DISTRIBUTIVO IS NULL
                      AND NOTAS_DISTRIBUTIVO.ID_PERIODO_DISTRIBUTIVO = ?
                    ORDER BY MATRICULACION_CARRERAS.NOMBRE_CARRERAS
                `, [idPeriodo]);
                return rows;
            } else {
                const [rows] = await dbLectura.query(`
                    SELECT 
                        ID_CARRERAS as id_carrera,
                        NOMBRE_CARRERAS as nombre_carrera
                    FROM MATRICULACION_CARRERAS
                    WHERE STATUS_CARRERAS = "ACTIVO"
                    ORDER BY NOMBRE_CARRERAS ASC
                `);
                return rows;
            }
        } catch (error) {
            console.error('Error en obtenerCarreras:', error);
            throw error;
        }
    }

    // Obtener docentes por período y carrera (ahora con materias)
    async obtenerDocentesPorPeriodoYCarrera(idPeriodo, idCarrera) {
        try {
            const [rows] = await dbLectura.query(`
            SELECT DISTINCT
                hd.ID_DOCENTE as id_docente,
                hd.CEDULA_DOCENTE as cedula_docente,
                CONCAT(
                    TRIM(COALESCE(hd.APELLIDOS_1_DOCENTE, '')), 
                    CASE WHEN hd.APELLIDOS_2_DOCENTE IS NOT NULL AND hd.APELLIDOS_2_DOCENTE != '' 
                         THEN CONCAT(' ', TRIM(hd.APELLIDOS_2_DOCENTE)) 
                         ELSE '' END,
                    ' ', 
                    TRIM(COALESCE(hd.NOMBRES_1_DOCENTE, '')),
                    CASE WHEN hd.NOMBRES_2_DOCENTE IS NOT NULL AND hd.NOMBRES_2_DOCENTE != '' 
                         THEN CONCAT(' ', TRIM(hd.NOMBRES_2_DOCENTE)) 
                         ELSE '' END
                ) AS nombres_completos,
                mc.NOMBRE_CARRERAS as nombre_carrera,
                hd.ID_DOCENTE,
                (
                    SELECT GROUP_CONCAT(DISTINCT na.NOMBRE_ASIGNATURA ORDER BY na.NOMBRE_ASIGNATURA SEPARATOR ', ')
                    FROM NOTAS_DISTRIBUTIVO nd2
                    JOIN NOTAS_ASIGNATURA na ON nd2.ID_ASIGNATURA_DISTRIBUTIVO = na.ID_ASIGNATURA
                    JOIN MATRICULACION_FORMAR_CURSOS mfc2 ON na.ID_FORMAR_CURSOS_ASIGNATURA = mfc2.ID_FORMAR_CURSOS
                    WHERE nd2.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
                        AND nd2.ID_PERIODO_DISTRIBUTIVO = ?
                        AND mfc2.ID_CARRERA_FORMAR_CURSOS = ?
                        AND nd2.DELETED_AT_DISTRIBUTIVO IS NULL
                ) AS materias
            FROM NOTAS_DISTRIBUTIVO nd
            JOIN HORARIOS_DOCENTE hd ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
            JOIN NOTAS_ASIGNATURA na ON nd.ID_ASIGNATURA_DISTRIBUTIVO = na.ID_ASIGNATURA
            JOIN MATRICULACION_FORMAR_CURSOS mfc ON na.ID_FORMAR_CURSOS_ASIGNATURA = mfc.ID_FORMAR_CURSOS
            JOIN MATRICULACION_CARRERAS mc ON mfc.ID_CARRERA_FORMAR_CURSOS = mc.ID_CARRERAS
            WHERE nd.DELETED_AT_DISTRIBUTIVO IS NULL
                AND hd.DELETED_AT_DOCENTE IS NULL
                AND nd.ID_PERIODO_DISTRIBUTIVO = ?
                AND mc.ID_CARRERAS = ?
            ORDER BY nombres_completos ASC
        `, [idPeriodo, idCarrera, idPeriodo, idCarrera]);
            return rows;
        } catch (error) {
            console.error('Error en obtenerDocentesPorPeriodoYCarrera:', error);
            throw error;
        }
    }

    // Crear o actualizar evaluación de autoridad
    async crearEvaluacionAutoridad(evaluacion) {
        try {
            const {
                id_periodo,
                id_docente_evaluado,
                id_carrera,
                calificacion,
                evaluador_cedula,
                evaluador_nombres,
                evaluador_apellidos,
                observaciones
            } = evaluacion;

            // Verificar si ya existe una evaluación para este docente en este período por esta autoridad
            const [existente] = await dbEscritura.query(`
                SELECT id_evaluacion_autoridad 
                FROM evaluaciones_autoridades 
                WHERE id_periodo = ? 
                AND id_docente_evaluado = ? 
                AND evaluador_cedula = ?
            `, [id_periodo, id_docente_evaluado, evaluador_cedula]);

            if (existente.length > 0) {
                // Actualizar evaluación existente
                await dbEscritura.query(`
                    UPDATE evaluaciones_autoridades 
                    SET calificacion = ?,
                        observaciones = ?,
                        fecha_actualizacion = CURRENT_TIMESTAMP
                    WHERE id_evaluacion_autoridad = ?
                `, [calificacion, observaciones, existente[0].id_evaluacion_autoridad]);

                return {
                    id_evaluacion_autoridad: existente[0].id_evaluacion_autoridad,
                    accion: 'actualizada'
                };
            } else {
                // Crear nueva evaluación
                const [result] = await dbEscritura.query(`
                    INSERT INTO evaluaciones_autoridades (
                        id_periodo, id_docente_evaluado, id_carrera, calificacion,
                        evaluador_cedula, evaluador_nombres, evaluador_apellidos, observaciones
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    id_periodo, id_docente_evaluado, id_carrera, calificacion,
                    evaluador_cedula, evaluador_nombres, evaluador_apellidos, observaciones
                ]);

                return {
                    id_evaluacion_autoridad: result.insertId,
                    accion: 'creada'
                };
            }
        } catch (error) {
            console.error('Error en crearEvaluacionAutoridad:', error);
            throw error;
        }
    }

    // Actualizar evaluación existente
    async actualizarEvaluacion(idEvaluacion, datosActualizacion) {
        try {
            const { calificacion, observaciones } = datosActualizacion;

            // Construir la consulta dinámicamente según los campos a actualizar
            let campos = [];
            let valores = [];

            if (calificacion !== undefined) {
                campos.push('calificacion = ?');
                valores.push(calificacion);
            }

            if (observaciones !== undefined) {
                campos.push('observaciones = ?');
                valores.push(observaciones);
            }

            // Siempre actualizar la fecha
            campos.push('fecha_actualizacion = CURRENT_TIMESTAMP');
            valores.push(idEvaluacion);

            if (campos.length === 1) { // Solo la fecha
                return {
                    success: false,
                    message: 'No se proporcionaron campos para actualizar'
                };
            }

            const consulta = `
            UPDATE evaluaciones_autoridades 
            SET ${campos.join(', ')}
            WHERE id_evaluacion_autoridad = ? AND estado = 'ACTIVO'
        `;

            const [result] = await dbEscritura.query(consulta, valores);

            if (result.affectedRows === 0) {
                return {
                    success: false,
                    message: 'No se encontró la evaluación o ya está inactiva'
                };
            }

            return {
                id_evaluacion_autoridad: idEvaluacion,
                campos_actualizados: campos.length - 1 // Excluir la fecha
            };
        } catch (error) {
            console.error('Error en actualizarEvaluacion:', error);
            throw error;
        }
    }

    // Obtener evaluaciones de autoridad por período
    async obtenerEvaluacionesPorPeriodo(idPeriodo) {
        try {
            // Primero obtenemos las evaluaciones básicas de la BD local
            const [evaluaciones] = await dbEscritura.query(`
                SELECT 
                    id_evaluacion_autoridad,
                    id_periodo,
                    id_docente_evaluado,
                    id_carrera,
                    calificacion,
                    evaluador_cedula,
                    evaluador_nombres,
                    evaluador_apellidos,
                    observaciones,
                    fecha_evaluacion,
                    fecha_actualizacion
                FROM evaluaciones_autoridades 
                WHERE id_periodo = ?
                    AND estado = 'ACTIVO'
                ORDER BY fecha_evaluacion DESC
            `, [idPeriodo]);

            // Si no hay evaluaciones, retornamos array vacío
            if (evaluaciones.length === 0) {
                return [];
            }

            // Obtenemos los datos complementarios de la BD del instituto
            const [periodosData] = await dbLectura.query(`
                SELECT ID_PERIODO, NOMBRE_PERIODO 
                FROM MATRICULACION_PERIODO 
                WHERE ID_PERIODO = ? AND DELETED_AT_PERIODO IS NULL
            `, [idPeriodo]);

            const [carrerasData] = await dbLectura.query(`
                SELECT ID_CARRERAS, NOMBRE_CARRERAS 
                FROM MATRICULACION_CARRERAS 
                WHERE ID_CARRERAS IN (${evaluaciones.map(() => '?').join(',')})
            `, evaluaciones.map(ev => ev.id_carrera));

            const [docentesData] = await dbLectura.query(`
                SELECT 
                    ID_DOCENTE,
                    CEDULA_DOCENTE,
                    CONCAT(
                        TRIM(COALESCE(APELLIDOS_1_DOCENTE, '')), 
                        CASE WHEN APELLIDOS_2_DOCENTE IS NOT NULL AND APELLIDOS_2_DOCENTE != '' 
                             THEN CONCAT(' ', TRIM(APELLIDOS_2_DOCENTE)) 
                             ELSE '' END,
                        ' ', 
                        TRIM(COALESCE(NOMBRES_1_DOCENTE, '')),
                        CASE WHEN NOMBRES_2_DOCENTE IS NOT NULL AND NOMBRES_2_DOCENTE != '' 
                             THEN CONCAT(' ', TRIM(NOMBRES_2_DOCENTE)) 
                             ELSE '' END
                    ) AS nombres_completos
                FROM HORARIOS_DOCENTE 
                WHERE ID_DOCENTE IN (${evaluaciones.map(() => '?').join(',')})
                    AND DELETED_AT_DOCENTE IS NULL
            `, evaluaciones.map(ev => ev.id_docente_evaluado));

            // Crear mapas para búsqueda rápida
            const periodosMap = new Map(periodosData.map(p => [p.ID_PERIODO, p.NOMBRE_PERIODO]));
            const carrerasMap = new Map(carrerasData.map(c => [c.ID_CARRERAS, c.NOMBRE_CARRERAS]));
            const docentesMap = new Map(docentesData.map(d => [d.ID_DOCENTE, {
                cedula: d.CEDULA_DOCENTE,
                nombres: d.nombres_completos
            }]));

            // Combinar los datos
            const resultado = evaluaciones.map(ev => {
                const docente = docentesMap.get(ev.id_docente_evaluado) || {};

                return {
                    ...ev,
                    nombre_periodo: periodosMap.get(parseInt(ev.id_periodo)) || 'Período no encontrado',
                    nombre_carrera: carrerasMap.get(ev.id_carrera) || 'Carrera no encontrada',
                    nombres_docente: docente.nombres || 'Docente no encontrado',
                    cedula_docente: docente.cedula || 'N/A'
                };
            });

            // Ordenar por nombre de docente
            resultado.sort((a, b) => a.nombres_docente.localeCompare(b.nombres_docente));

            return resultado;
        } catch (error) {
            console.error('Error en obtenerEvaluacionesPorPeriodo:', error);
            throw error;
        }
    }

    // Obtener evaluación específica de un docente
    async obtenerEvaluacionDocente(idPeriodo, idDocente, evaluadorCedula) {
        try {
            // Obtener la evaluación de la BD local
            const [evaluaciones] = await dbEscritura.query(`
                SELECT *
                FROM evaluaciones_autoridades 
                WHERE id_periodo = ?
                    AND id_docente_evaluado = ?
                    AND evaluador_cedula = ?
                    AND estado = 'ACTIVO'
                LIMIT 1
            `, [idPeriodo, idDocente, evaluadorCedula]);

            if (evaluaciones.length === 0) {
                return null;
            }

            const evaluacion = evaluaciones[0];

            // Obtener datos complementarios de la BD del instituto
            const [periodosData] = await dbLectura.query(`
                SELECT NOMBRE_PERIODO 
                FROM MATRICULACION_PERIODO 
                WHERE ID_PERIODO = ? AND DELETED_AT_PERIODO IS NULL
            `, [idPeriodo]);

            const [carrerasData] = await dbLectura.query(`
                SELECT NOMBRE_CARRERAS 
                FROM MATRICULACION_CARRERAS 
                WHERE ID_CARRERAS = ?
            `, [evaluacion.id_carrera]);

            const [docentesData] = await dbLectura.query(`
                SELECT 
                    CONCAT(
                        TRIM(COALESCE(APELLIDOS_1_DOCENTE, '')), 
                        CASE WHEN APELLIDOS_2_DOCENTE IS NOT NULL AND APELLIDOS_2_DOCENTE != '' 
                             THEN CONCAT(' ', TRIM(APELLIDOS_2_DOCENTE)) 
                             ELSE '' END,
                        ' ', 
                        TRIM(COALESCE(NOMBRES_1_DOCENTE, '')),
                        CASE WHEN NOMBRES_2_DOCENTE IS NOT NULL AND NOMBRES_2_DOCENTE != '' 
                             THEN CONCAT(' ', TRIM(NOMBRES_2_DOCENTE)) 
                             ELSE '' END
                    ) AS nombres_completos
                FROM HORARIOS_DOCENTE 
                WHERE ID_DOCENTE = ? AND DELETED_AT_DOCENTE IS NULL
            `, [idDocente]);

            // Combinar los datos
            return {
                ...evaluacion,
                nombre_periodo: periodosData[0]?.NOMBRE_PERIODO || 'Período no encontrado',
                nombre_carrera: carrerasData[0]?.NOMBRE_CARRERAS || 'Carrera no encontrada',
                nombres_docente: docentesData[0]?.nombres_completos || 'Docente no encontrado'
            };
        } catch (error) {
            console.error('Error en obtenerEvaluacionDocente:', error);
            throw error;
        }
    }

    // Eliminar evaluación (soft delete)
    async eliminarEvaluacion(idEvaluacion) {
        try {
            await dbEscritura.query(`
                UPDATE evaluaciones_autoridades 
                SET estado = 'INACTIVO',
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id_evaluacion_autoridad = ?
            `, [idEvaluacion]);

            return { success: true };
        } catch (error) {
            console.error('Error en eliminarEvaluacion:', error);
            throw error;
        }
    }
}

module.exports = new AutoridadesRepository();