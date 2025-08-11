const { dbLectura, dbEscritura } = require('../config/database');
const { formatearNombre } = require('../services/asignacionesService');

class ReporteCoevaluacionRepository {
    // 🆕 NUEVO: Obtener carrera del coordinador (BD LOCAL - minúsculas)
    async obtenerCarreraCoordinador(cedulaCoordinador) {
        const [rows] = await dbEscritura.query(`
            SELECT 
                cc.id_carrera,
                cc.cedula_coordinador,
                cc.nombres_coordinador,
                cc.apellidos_coordinador,
                cc.correo_coordinador
            FROM coordinadores_carreras cc
            WHERE cc.cedula_coordinador = ? 
            AND cc.estado = 'ACTIVO'
        `, [cedulaCoordinador]);
        return rows[0] || null;
    }

    // 🔄 MODIFICADO: Función auxiliar para obtener el orden numérico de los semestres
    obtenerOrdenSemestre(nombreSemestre) {
        const nombreLower = nombreSemestre.toLowerCase();
        if (nombreLower.includes('primer')) return 1;
        if (nombreLower.includes('segundo')) return 2;
        if (nombreLower.includes('tercer')) return 3;
        if (nombreLower.includes('cuarto')) return 4;
        if (nombreLower.includes('quinto')) return 5;
        if (nombreLower.includes('sexto')) return 6;
        if (nombreLower.includes('septimo') || nombreLower.includes('séptimo')) return 7;
        if (nombreLower.includes('octavo')) return 8;
        if (nombreLower.includes('noveno')) return 9;
        if (nombreLower.includes('decimo') || nombreLower.includes('décimo')) return 10;
        return 999; // Para casos no esperados, los pone al final
    }

    // 🔄 MODIFICADO: Obtener asignaciones filtradas por carrera del coordinador
    async obtenerAsignacionesParaReporte(idPeriodo, idCarrera = null) {
        // Consulta base en BD LOCAL (minúsculas)
        let query = `
            SELECT 
                ac.*,
                ev.id_evaluacion,
                ev.estado as estado_evaluacion_general
            FROM asignaciones_coevaluacion ac
            LEFT JOIN evaluaciones ev ON ev.id_periodo = ac.id_periodo AND ev.id_formulario = 3
            WHERE ac.id_periodo = ?
        `;

        let params = [idPeriodo];

        // Si se proporciona idCarrera, filtrar por carrera usando BD INSTITUTO (mayúsculas)
        if (idCarrera) {
            // Primero obtenemos las asignaturas de la carrera desde BD INSTITUTO
            const [asignaturasCarrera] = await dbLectura.query(`
                SELECT DISTINCT na.ID_ASIGNATURA
                FROM NOTAS_ASIGNATURA na
                JOIN NOTAS_DISTRIBUTIVO nd ON na.ID_ASIGNATURA = nd.ID_ASIGNATURA_DISTRIBUTIVO
                JOIN MATRICULACION_FORMAR_CURSOS mfc ON nd.ID_FORMAR_CURSOS_DISTRIBUTIVO = mfc.ID_FORMAR_CURSOS
                WHERE mfc.ID_CARRERA_FORMAR_CURSOS = ?
                AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
            `, [idCarrera]);

            if (asignaturasCarrera.length === 0) {
                return [];
            }

            const asignaturaIds = asignaturasCarrera.map(a => a.ID_ASIGNATURA);
            query += ` AND ac.id_asignatura IN (${asignaturaIds.map(() => '?').join(',')})`;
            params.push(...asignaturaIds);
        }

        query += ` ORDER BY ac.id_asignacion DESC`;

        // Ejecutar consulta en BD LOCAL
        const [asignaciones] = await dbEscritura.query(query, params);

        if (asignaciones.length === 0) {
            return [];
        }

        // Extraer IDs únicos para consultas en paralelo
        const docenteIds = [...new Set([
            ...asignaciones.map(a => a.id_docente_evaluador),
            ...asignaciones.map(a => a.id_docente_evaluado)
        ])].filter(Boolean);

        const asignaturaIds = [...new Set(asignaciones.map(a => a.id_asignatura))].filter(Boolean);

        // Ejecutar consultas en paralelo
        const [
            docentes,
            asignaturas,
            usuarios,
            distributivos,
            evaluacionesRealizadas,
            nivelesData
        ] = await Promise.all([
            // Consulta de docentes en BD INSTITUTO (mayúsculas)
            docenteIds.length > 0 ?
                dbLectura.query(`
                    SELECT 
                        ID_DOCENTE as id_docente,
                        CONCAT(
                            COALESCE(NOMBRES_1_DOCENTE, ''), ' ',
                            COALESCE(NOMBRES_2_DOCENTE, ''), ' ',
                            COALESCE(APELLIDOS_1_DOCENTE, ''), ' ',
                            COALESCE(APELLIDOS_2_DOCENTE, '')
                        ) as nombre,
                        CEDULA_DOCENTE as cedula
                    FROM HORARIOS_DOCENTE
                    WHERE ID_DOCENTE IN (${docenteIds.map(() => '?').join(',')})
                `, docenteIds).then(result => result[0]) : Promise.resolve([]),

            // Consulta de asignaturas en BD INSTITUTO (mayúsculas)
            asignaturaIds.length > 0 ?
                dbLectura.query(`
                    SELECT ID_ASIGNATURA as id_asignatura, NOMBRE_ASIGNATURA as nombre_asignatura
                    FROM NOTAS_ASIGNATURA
                    WHERE ID_ASIGNATURA IN (${asignaturaIds.map(() => '?').join(',')})
                `, asignaturaIds).then(result => result[0]) : Promise.resolve([]),

            // Consulta de usuarios por cédulas de docentes (para obtener id_usuario del evaluador)
            docenteIds.length > 0 ?
                dbLectura.query(`
                    SELECT 
                        su.ID_USUARIOS as id_usuario,
                        su.DOCUMENTO_USUARIOS as cedula,
                        hd.ID_DOCENTE as id_docente
                    FROM SEGURIDAD_USUARIOS su
                    INNER JOIN HORARIOS_DOCENTE hd ON hd.CEDULA_DOCENTE = su.DOCUMENTO_USUARIOS
                    WHERE hd.ID_DOCENTE IN (${docenteIds.map(() => '?').join(',')})
                `, docenteIds).then(result => result[0]) : Promise.resolve([]),

            // Consulta de distributivos usando docente evaluado, período y asignatura
            docenteIds.length > 0 && asignaturaIds.length > 0 ?
                dbLectura.query(`
                    SELECT 
                        ID_DISTRIBUTIVO,
                        ID_DOCENTE_DISTRIBUTIVO as id_docente,
                        ID_PERIODO_DISTRIBUTIVO as id_periodo,
                        ID_ASIGNATURA_DISTRIBUTIVO as id_asignatura
                    FROM NOTAS_DISTRIBUTIVO
                    WHERE ID_DOCENTE_DISTRIBUTIVO IN (${docenteIds.map(() => '?').join(',')})
                    AND ID_PERIODO_DISTRIBUTIVO = ?
                    AND ID_ASIGNATURA_DISTRIBUTIVO IN (${asignaturaIds.map(() => '?').join(',')})
                `, [...docenteIds, idPeriodo, ...asignaturaIds]).then(result => result[0]) : Promise.resolve([]),

            // Consulta de evaluaciones realizadas en BD LOCAL (minúsculas)
            asignaciones.some(a => a.id_evaluacion) ?
                dbEscritura.query(`
                    SELECT 
                        er.id_evaluacion,
                        er.evaluador_id,
                        er.id_distributivo,
                        er.estado,
                        er.fecha_fin
                    FROM evaluaciones_realizadas er
                    WHERE er.id_evaluacion IN (${[...new Set(asignaciones.map(a => a.id_evaluacion))].filter(Boolean).map(() => '?').join(',')})
                `, [...new Set(asignaciones.map(a => a.id_evaluacion))].filter(Boolean)).then(result => result[0]) : Promise.resolve([]),

            // 🆕 NUEVO: Obtener niveles para ordenamiento correcto
            asignaturaIds.length > 0 ?
                dbLectura.query(`
                    SELECT DISTINCT
                        NOTAS_ASIGNATURA.ID_ASIGNATURA,
                        MATRICULACION_CURSOS.ID_CURSOS,
                        MATRICULACION_CURSOS.NOMBRE_CURSOS AS NIVEL
                    FROM NOTAS_ASIGNATURA
                    JOIN NOTAS_DISTRIBUTIVO ON NOTAS_ASIGNATURA.ID_ASIGNATURA = NOTAS_DISTRIBUTIVO.ID_ASIGNATURA_DISTRIBUTIVO
                    JOIN MATRICULACION_FORMAR_CURSOS ON NOTAS_DISTRIBUTIVO.ID_FORMAR_CURSOS_DISTRIBUTIVO = MATRICULACION_FORMAR_CURSOS.ID_FORMAR_CURSOS
                    JOIN MATRICULACION_CURSOS ON MATRICULACION_FORMAR_CURSOS.ID_CURSOS_FORMAR_CURSOS = MATRICULACION_CURSOS.ID_CURSOS
                    WHERE NOTAS_ASIGNATURA.ID_ASIGNATURA IN (${asignaturaIds.map(() => '?').join(',')})
                        AND NOTAS_DISTRIBUTIVO.DELETED_AT_DISTRIBUTIVO IS NULL     
                `, asignaturaIds).then(result => result[0]) : Promise.resolve([])
        ]);

        // Crear mapas para búsqueda rápida
        const docentesMap = new Map(docentes.map(d => [d.id_docente, d]));
        const asignaturasMap = new Map(asignaturas.map(a => [a.id_asignatura, a]));
        const usuariosMap = new Map(usuarios.map(u => [u.id_docente, u]));
        const distributivosMap = new Map();
        distributivos.forEach(d => {
            const key = `${d.id_docente}-${d.id_periodo}-${d.id_asignatura}`;
            distributivosMap.set(key, d.ID_DISTRIBUTIVO);
        });
        const nivelesMap = new Map(nivelesData.map(n => [n.ID_ASIGNATURA, {
            id: n.ID_CURSOS,
            nombre: n.NIVEL,
            orden: this.obtenerOrdenSemestre(n.NIVEL)
        }]));

        // Mapa de evaluaciones realizadas
        const evaluacionesMap = new Map();
        evaluacionesRealizadas.forEach(er => {
            const key = `${er.id_evaluacion}-${er.evaluador_id}-${er.id_distributivo}`;
            evaluacionesMap.set(key, er);
        });

        // Procesar resultados
        const resultado = asignaciones.map((asig) => {
            const evaluador = docentesMap.get(asig.id_docente_evaluador);
            const evaluado = docentesMap.get(asig.id_docente_evaluado);
            const asignatura = asignaturasMap.get(asig.id_asignatura);
            const nivel = nivelesMap.get(asig.id_asignatura);

            // Determinar estado de evaluación
            let estado_evaluacion = 'sin_evaluacion';
            let fecha_completada = null;

            if (asig.id_evaluacion && evaluador && asig.id_asignatura) {
                const usuario = usuariosMap.get(asig.id_docente_evaluador);
                // Buscar el distributivo usando docente evaluado, período y asignatura
                const idDistributivo = distributivosMap.get(`${asig.id_docente_evaluado}-${asig.id_periodo}-${asig.id_asignatura}`);

                if (usuario && idDistributivo) {
                    const key = `${asig.id_evaluacion}-${usuario.id_usuario}-${idDistributivo}`;
                    const evaluacionRealizada = evaluacionesMap.get(key);
                    if (evaluacionRealizada) {
                        estado_evaluacion = evaluacionRealizada.estado || 'pendiente';
                        fecha_completada = evaluacionRealizada.fecha_fin;
                    } else {
                        estado_evaluacion = 'pendiente';
                    }
                } else if (usuario) {
                    estado_evaluacion = 'pendiente';
                }
            }

            return {
                ...asig,
                nombre_evaluador: evaluador ? formatearNombre(evaluador.nombre) : 'Docente no encontrado',
                nombre_evaluado: evaluado ? formatearNombre(evaluado.nombre) : 'Docente no encontrado',
                nombre_asignatura: asignatura ? asignatura.nombre_asignatura : null,
                nivel_info: nivel || { nombre: 'Sin nivel', orden: 999 },
                estado_evaluacion,
                fecha_completada
            };
        });

        // 🔄 MODIFICADO: Ordenar por nivel (orden numérico) y luego por nombre de asignatura
        resultado.sort((a, b) => {
            // Primero ordenar por nivel
            if (a.nivel_info.orden !== b.nivel_info.orden) {
                return a.nivel_info.orden - b.nivel_info.orden;
            }
            // Si es el mismo nivel, ordenar por nombre de asignatura
            const nombreA = a.nombre_asignatura || '';
            const nombreB = b.nombre_asignatura || '';
            return nombreA.localeCompare(nombreB);
        });

        return resultado;
    }

    // 🔄 MODIFICADO: Obtener carreras y niveles filtradas por carrera específica (BD INSTITUTO - mayúsculas)
    async obtenerCarrerasYNivelesPorAsignaturas(asignaturaIds, idCarrera = null) {
        if (asignaturaIds.length === 0) return { carreras: new Map(), niveles: new Map() };

        let carrerasQuery = `
            SELECT DISTINCT
                NOTAS_ASIGNATURA.ID_ASIGNATURA,
                MATRICULACION_CARRERAS.ID_CARRERAS,
                MATRICULACION_CARRERAS.NOMBRE_CARRERAS
            FROM NOTAS_ASIGNATURA
            JOIN NOTAS_DISTRIBUTIVO ON NOTAS_ASIGNATURA.ID_ASIGNATURA = NOTAS_DISTRIBUTIVO.ID_ASIGNATURA_DISTRIBUTIVO
            JOIN MATRICULACION_FORMAR_CURSOS ON NOTAS_DISTRIBUTIVO.ID_FORMAR_CURSOS_DISTRIBUTIVO = MATRICULACION_FORMAR_CURSOS.ID_FORMAR_CURSOS
            JOIN MATRICULACION_CARRERAS ON MATRICULACION_FORMAR_CURSOS.ID_CARRERA_FORMAR_CURSOS = MATRICULACION_CARRERAS.ID_CARRERAS
            WHERE NOTAS_ASIGNATURA.ID_ASIGNATURA IN (${asignaturaIds.map(() => '?').join(',')})
                AND NOTAS_DISTRIBUTIVO.DELETED_AT_DISTRIBUTIVO IS NULL
        `;

        let nivelesQuery = `
            SELECT DISTINCT
                NOTAS_ASIGNATURA.ID_ASIGNATURA,
                MATRICULACION_CURSOS.ID_CURSOS,
                MATRICULACION_CURSOS.NOMBRE_CURSOS AS NIVEL
            FROM NOTAS_ASIGNATURA
            JOIN NOTAS_DISTRIBUTIVO ON NOTAS_ASIGNATURA.ID_ASIGNATURA = NOTAS_DISTRIBUTIVO.ID_ASIGNATURA_DISTRIBUTIVO
            JOIN MATRICULACION_FORMAR_CURSOS ON NOTAS_DISTRIBUTIVO.ID_FORMAR_CURSOS_DISTRIBUTIVO = MATRICULACION_FORMAR_CURSOS.ID_FORMAR_CURSOS
            JOIN MATRICULACION_CURSOS ON MATRICULACION_FORMAR_CURSOS.ID_CURSOS_FORMAR_CURSOS = MATRICULACION_CURSOS.ID_CURSOS
            WHERE NOTAS_ASIGNATURA.ID_ASIGNATURA IN (${asignaturaIds.map(() => '?').join(',')})
                AND NOTAS_DISTRIBUTIVO.DELETED_AT_DISTRIBUTIVO IS NULL     
        `;

        let carrerasParams = [...asignaturaIds];
        let nivelesParams = [...asignaturaIds];

        // Si se proporciona idCarrera, filtrar por carrera específica
        if (idCarrera) {
            carrerasQuery += ` AND MATRICULACION_CARRERAS.ID_CARRERAS = ?`;
            nivelesQuery += ` AND MATRICULACION_FORMAR_CURSOS.ID_CARRERA_FORMAR_CURSOS = ?`;
            carrerasParams.push(idCarrera);
            nivelesParams.push(idCarrera);
        }

        // Ejecutar consultas en BD INSTITUTO (mayúsculas)
        const [carreras, niveles] = await Promise.all([
            dbLectura.query(carrerasQuery, carrerasParams).then(result => result[0]),
            dbLectura.query(nivelesQuery, nivelesParams).then(result => result[0])
        ]);

        // Crear mapas
        const carrerasMap = new Map();
        const nivelesMap = new Map();

        carreras.forEach(c => {
            carrerasMap.set(c.ID_ASIGNATURA, {
                id: c.ID_CARRERAS,
                nombre: c.NOMBRE_CARRERAS
            });
        });

        niveles.forEach(n => {
            nivelesMap.set(n.ID_ASIGNATURA, {
                id: n.ID_CURSOS,
                nombre: n.NIVEL,
                orden: this.obtenerOrdenSemestre(n.NIVEL) // 🆕 NUEVO: Agregar orden numérico
            });
        });

        return { carreras: carrerasMap, niveles: nivelesMap };
    }

    // Obtener información del período (BD INSTITUTO - mayúsculas)
    async obtenerPeriodo(idPeriodo) {
        const [rows] = await dbLectura.query(`
            SELECT 
                ID_PERIODO as id_periodo,
                NOMBRE_PERIODO as descripcion_periodo
            FROM MATRICULACION_PERIODO
            WHERE ID_PERIODO = ?
        `, [idPeriodo]);
        return rows[0] || null;
    }

    // Obtener carrera por asignatura (BD INSTITUTO - mayúsculas)
    async obtenerCarreraPorAsignatura(idAsignatura) {
        const [rows] = await dbLectura.query(`
            SELECT 
                MATRICULACION_CARRERAS.ID_CARRERAS,
                MATRICULACION_CARRERAS.NOMBRE_CARRERAS
            FROM NOTAS_ASIGNATURA
            JOIN NOTAS_DISTRIBUTIVO ON NOTAS_ASIGNATURA.ID_ASIGNATURA = NOTAS_DISTRIBUTIVO.ID_ASIGNATURA_DISTRIBUTIVO
            JOIN MATRICULACION_FORMAR_CURSOS ON NOTAS_DISTRIBUTIVO.ID_FORMAR_CURSOS_DISTRIBUTIVO = MATRICULACION_FORMAR_CURSOS.ID_FORMAR_CURSOS
            JOIN MATRICULACION_CARRERAS ON MATRICULACION_FORMAR_CURSOS.ID_CARRERA_FORMAR_CURSOS = MATRICULACION_CARRERAS.ID_CARRERAS
            WHERE NOTAS_ASIGNATURA.ID_ASIGNATURA = ?
                AND NOTAS_DISTRIBUTIVO.DELETED_AT_DISTRIBUTIVO IS NULL
        `, [idAsignatura]);
        return rows[0] || null;
    }

    // Obtener nivel por asignatura (BD INSTITUTO - mayúsculas)
    async obtenerNivelPorAsignatura(idAsignatura) {
        const [rows] = await dbLectura.query(`
            SELECT 
                MATRICULACION_CURSOS.ID_CURSOS,
                MATRICULACION_CURSOS.NOMBRE_CURSOS AS NIVEL
            FROM NOTAS_ASIGNATURA
            JOIN NOTAS_DISTRIBUTIVO ON NOTAS_ASIGNATURA.ID_ASIGNATURA = NOTAS_DISTRIBUTIVO.ID_ASIGNATURA_DISTRIBUTIVO
            JOIN MATRICULACION_FORMAR_CURSOS ON NOTAS_DISTRIBUTIVO.ID_FORMAR_CURSOS_DISTRIBUTIVO = MATRICULACION_FORMAR_CURSOS.ID_FORMAR_CURSOS
            JOIN MATRICULACION_CURSOS ON MATRICULACION_FORMAR_CURSOS.ID_CURSOS_FORMAR_CURSOS = MATRICULACION_CURSOS.ID_CURSOS
            WHERE NOTAS_ASIGNATURA.ID_ASIGNATURA = ?
                AND NOTAS_DISTRIBUTIVO.DELETED_AT_DISTRIBUTIVO IS NULL
        `, [idAsignatura]);
        return rows[0] || null;
    }

    // 🆕 NUEVO: Obtener todas las carreras activas (para dropdown de administrador)
    async obtenerTodasLasCarreras() {
        try {
            const [rows] = await dbLectura.query(`
                SELECT 
                    ID_CARRERAS as id_carrera,
                    NOMBRE_CARRERAS as nombre_carrera
                FROM MATRICULACION_CARRERAS 
                WHERE STATUS_CARRERAS = "ACTIVO"
                ORDER BY NOMBRE_CARRERAS
            `);
            return rows;
        } catch (error) {
            console.error('Error en obtenerTodasLasCarreras:', error);
            throw error;
        }
    }

    // 🆕 NUEVO: Obtener información detallada de una carrera específica
    async obtenerInformacionCarrera(idCarrera) {
        try {
            const [rows] = await dbLectura.query(`
                SELECT 
                    ID_CARRERAS as id_carrera,
                    NOMBRE_CARRERAS as nombre_carrera,
                    STATUS_CARRERAS as estado
                FROM MATRICULACION_CARRERAS
                WHERE ID_CARRERAS = ?
            `, [idCarrera]);
            return rows[0] || null;
        } catch (error) {
            console.error('Error en obtenerInformacionCarrera:', error);
            throw error;
        }
    }

    // 🆕 NUEVO: Verificar si una carrera existe y está activa
    async verificarCarreraActiva(idCarrera) {
        try {
            const [rows] = await dbLectura.query(`
                SELECT COUNT(*) as existe
                FROM MATRICULACION_CARRERAS
                WHERE ID_CARRERAS = ? AND STATUS_CARRERAS = "ACTIVO"
            `, [idCarrera]);
            return rows[0].existe > 0;
        } catch (error) {
            console.error('Error en verificarCarreraActiva:', error);
            throw error;
        }
    }

    // 🆕 NUEVO: Obtener estadísticas de asignaciones por carrera
    async obtenerEstadisticasAsignacionesPorCarrera(idPeriodo, idCarrera) {
        try {
            // 1. Obtener las asignaturas de la carrera desde la BD del instituto (mayúsculas)
            const [asignaturasCarrera] = await dbLectura.query(`
            SELECT DISTINCT na.ID_ASIGNATURA
            FROM NOTAS_ASIGNATURA na
            JOIN NOTAS_DISTRIBUTIVO nd ON na.ID_ASIGNATURA = nd.ID_ASIGNATURA_DISTRIBUTIVO
            JOIN MATRICULACION_FORMAR_CURSOS mfc ON nd.ID_FORMAR_CURSOS_DISTRIBUTIVO = mfc.ID_FORMAR_CURSOS
            WHERE mfc.ID_CARRERA_FORMAR_CURSOS = ?
            AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
        `, [idCarrera]);

            if (asignaturasCarrera.length === 0) {
                return { total_asignaciones: 0, total_evaluadores: 0, total_evaluados: 0 };
            }

            const asignaturaIds = asignaturasCarrera.map(a => a.ID_ASIGNATURA);

            // 2. Hacer la consulta en la BD local (minúsculas)
            const [rows] = await dbEscritura.query(`
            SELECT 
                COUNT(*) as total_asignaciones,
                COUNT(DISTINCT ac.id_docente_evaluador) as total_evaluadores,
                COUNT(DISTINCT ac.id_docente_evaluado) as total_evaluados
            FROM asignaciones_coevaluacion ac
            WHERE ac.id_periodo = ?
            AND ac.id_asignatura IN (${asignaturaIds.map(() => '?').join(',')})
        `, [idPeriodo, ...asignaturaIds]);

            return rows[0] || { total_asignaciones: 0, total_evaluadores: 0, total_evaluados: 0 };
        } catch (error) {
            console.error('Error en obtenerEstadisticasAsignacionesPorCarrera:', error);
            throw error;
        }
    }

}

module.exports = new ReporteCoevaluacionRepository();