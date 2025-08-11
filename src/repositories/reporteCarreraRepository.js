// repositories/reporteCarreraRepository.js
const { dbLectura, dbEscritura } = require('../config/database');

class ReporteCarreraRepository {

    // Obtener todas las carreras activas del distributivo para un periodo (o todas si no se pasa periodo)
    async obtenerCarrerasActivas(idPeriodo = null) {
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
                    ORDER BY NOMBRE_CARRERAS
                `);
                return rows;
            }
        } catch (error) {
            console.error('Error en obtenerCarrerasActivas:', error);
            throw error;
        }
    }

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

    // Obtener docentes por carrera y periodo
    async obtenerDocentesPorCarreraPeriodo(idCarrera, idPeriodo) {
        try {
            const [rows] = await dbLectura.query(`
            SELECT DISTINCT
                nd.ID_DOCENTE_DISTRIBUTIVO AS id_docente_distributivo,
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
                ) AS nombre_completo,
                mc.NOMBRE_CARRERAS AS nombre_carrera,
                -- Seleccionar el primer ID_DISTRIBUTIVO para cada docente
                MIN(nd.ID_DISTRIBUTIVO) AS id_distributivo
            FROM NOTAS_DISTRIBUTIVO nd
            INNER JOIN HORARIOS_DOCENTE hd ON nd.ID_DOCENTE_DISTRIBUTIVO = hd.ID_DOCENTE
            INNER JOIN NOTAS_ASIGNATURA na ON nd.ID_ASIGNATURA_DISTRIBUTIVO = na.ID_ASIGNATURA
            INNER JOIN MATRICULACION_FORMAR_CURSOS mfc ON na.ID_FORMAR_CURSOS_ASIGNATURA = mfc.ID_FORMAR_CURSOS
            INNER JOIN MATRICULACION_CARRERAS mc ON mfc.ID_CARRERA_FORMAR_CURSOS = mc.ID_CARRERAS
            WHERE nd.DELETED_AT_DISTRIBUTIVO IS NULL
                AND hd.DELETED_AT_DOCENTE IS NULL
                AND nd.ID_PERIODO_DISTRIBUTIVO = ?
                AND mc.ID_CARRERAS = ?
            GROUP BY nd.ID_DOCENTE_DISTRIBUTIVO, hd.APELLIDOS_1_DOCENTE, hd.APELLIDOS_2_DOCENTE, 
                     hd.NOMBRES_1_DOCENTE, hd.NOMBRES_2_DOCENTE, mc.NOMBRE_CARRERAS
            ORDER BY nombre_completo ASC
        `, [idPeriodo, idCarrera]);
            return rows;
        } catch (error) {
            console.error('Error en obtenerDocentesPorCarreraPeriodo:', error);
            throw error;
        }
    }

    // Obtener evaluaciones de un docente específico
    async obtenerEvaluacionesDocente(idDistributivo, idDocenteDistributivo, idPeriodo) {
        try {
            // Obtener promedio de autoevaluación (formulario 1)
            const [autoeval] = await dbEscritura.query(`
            SELECT AVG(CAST(r.respuesta AS DECIMAL)) * 20 AS promedio
            FROM respuestas r
            INNER JOIN evaluaciones_realizadas er ON r.id_evaluacion = er.id_evaluacion
            INNER JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
            WHERE e.id_periodo = ?
                AND e.id_formulario = 1
                AND r.id_distributivo = ?
                AND r.id_pregunta IN (
                    SELECT id_pregunta FROM preguntas
                )
                AND er.estado = 'completada'
        `, [idPeriodo, idDistributivo]);

            // Obtener promedio de heteroevaluación (formulario 2)
            const [heteroeval] = await dbEscritura.query(`
            SELECT AVG(CAST(r.respuesta AS DECIMAL)) * 20 AS promedio
            FROM respuestas r
            INNER JOIN evaluaciones_realizadas er ON r.id_evaluacion = er.id_evaluacion
            INNER JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
            WHERE e.id_periodo = ?
                AND e.id_formulario = 2
                AND r.id_distributivo = ?
                AND r.id_pregunta IN (
                    SELECT id_pregunta FROM preguntas
                )
                AND er.estado = 'completada'
        `, [idPeriodo, idDistributivo]);

            // Obtener promedio de coevaluación (formulario 3)
            const [coeval] = await dbEscritura.query(`
            SELECT AVG(CAST(r.respuesta AS DECIMAL)) * 20 AS promedio
            FROM respuestas r
            INNER JOIN evaluaciones_realizadas er ON r.id_evaluacion = er.id_evaluacion
            INNER JOIN evaluaciones e ON er.id_evaluacion = e.id_evaluacion
            WHERE e.id_periodo = ?
                AND e.id_formulario = 3
                AND r.id_distributivo = ?
                AND r.id_pregunta IN (
                    SELECT id_pregunta FROM preguntas
                )
                AND er.estado = 'completada'
        `, [idPeriodo, idDistributivo]);

            // Obtener promedio de evaluación de autoridades
            const [evalAutoridades] = await dbEscritura.query(`
            SELECT AVG(ea.calificacion) AS promedio
            FROM evaluaciones_autoridades ea
            WHERE ea.id_periodo = ?
                AND ea.id_docente_evaluado = ?
                AND ea.estado = 'ACTIVO'
        `, [idPeriodo, idDocenteDistributivo]);

            return {
                autoevaluacion: autoeval[0]?.promedio || null,
                heteroevaluacion: heteroeval[0]?.promedio || null,
                coevaluacion: coeval[0]?.promedio || null,
                evaluacion_autoridades: evalAutoridades[0]?.promedio || null
            };
        } catch (error) {
            console.error('Error en obtenerEvaluacionesDocente:', error);
            throw error;
        }
    }

    // Obtener información del periodo
    async obtenerInformacionPeriodo(idPeriodo) {
        try {
            const [rows] = await dbLectura.query(`
                SELECT 
                    ID_PERIODO AS id_periodo,
                    NOMBRE_PERIODO AS descripcion
                FROM MATRICULACION_PERIODO
                WHERE ID_PERIODO = ?
                    AND DELETED_AT_PERIODO IS NULL
            `, [idPeriodo]);
            return rows[0] || null;
        } catch (error) {
            console.error('Error en obtenerInformacionPeriodo:', error);
            throw error;
        }
    }

    // Obtener información de la carrera
    async obtenerInformacionCarrera(idCarrera) {
        try {
            const [rows] = await dbLectura.query(`
                SELECT 
                    ID_CARRERAS as id_carrera,
                    NOMBRE_CARRERAS as nombre_carrera
                FROM MATRICULACION_CARRERAS
                WHERE ID_CARRERAS = ?
                    AND STATUS_CARRERAS = "ACTIVO"
            `, [idCarrera]);
            return rows[0] || null;
        } catch (error) {
            console.error('Error en obtenerInformacionCarrera:', error);
            throw error;
        }
    }
}

module.exports = new ReporteCarreraRepository();