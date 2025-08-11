const { dbEscritura, dbLectura } = require('../config/database');

// Crear una nueva asignación - FUNCIÓN ACTUALIZADA
async function crearAsignacion(data) {
    const {
        id_periodo,
        id_docente_evaluador,
        id_docente_evaluado,
        fecha,
        hora_inicio,
        hora_fin,
        dia,
        id_asignatura
    } = data;

    const [result] = await dbEscritura.query(`
        INSERT INTO asignaciones_coevaluacion (
            id_periodo,
            id_docente_evaluador,
            id_docente_evaluado,
            fecha,
            hora_inicio,
            hora_fin,
            dia,
            id_asignatura
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        id_periodo,
        id_docente_evaluador,
        id_docente_evaluado,
        fecha || null,
        hora_inicio || null,
        hora_fin || null,
        dia || null,
        id_asignatura || null
    ]);

    return result.insertId;
}

// Detalle de asignaciones listo para notificación a evaluadores
// Acepta filtro opcional por IDs específicos de asignaciones
async function obtenerAsignacionesDetalleParaNotificacion(id_periodo, opciones = {}) {
    const { idsAsignacion = null } = opciones;

    // 1) Traer asignaciones del período desde BD LOCAL (escritura)
    let query = `
        SELECT 
            id_asignacion,
            id_periodo,
            id_docente_evaluador,
            id_docente_evaluado,
            id_asignatura,
            fecha,
            dia,
            hora_inicio,
            hora_fin
        FROM asignaciones_coevaluacion
        WHERE id_periodo = ?`;
    
    const params = [id_periodo];
    
    // Si se especifican IDs de asignaciones, filtrar solo por esas
    if (Array.isArray(idsAsignacion) && idsAsignacion.length > 0) {
        query += ` AND id_asignacion IN (${idsAsignacion.map(() => '?').join(',')})`;
        params.push(...idsAsignacion);
    }
    
    query += ` ORDER BY id_asignacion DESC`;
    
    const [asignaciones] = await dbEscritura.query(query, params);

    if (!asignaciones || asignaciones.length === 0) return [];

    // 2) Recolectar IDs únicos
    const idsEvaluadores = [...new Set(asignaciones.map(a => a.id_docente_evaluador))].filter(Boolean);
    const idsEvaluados = [...new Set(asignaciones.map(a => a.id_docente_evaluado))].filter(Boolean);
    const idsAsignaturas = [...new Set(asignaciones.map(a => a.id_asignatura))].filter(Boolean);

    // 3) Consultas en BD INSTITUTO (lectura)
    const [docentesEvaluadores, docentesEvaluados, usuariosEvaluadores, asignaturasRows] = await Promise.all([
        idsEvaluadores.length > 0 ? dbLectura.query(`
            SELECT 
    ID_DOCENTE AS id_docente,
    CEDULA_DOCENTE AS cedula,
    CONCAT(
        COALESCE(NOMBRES_1_DOCENTE, ''), ' ',
        COALESCE(NOMBRES_2_DOCENTE, ''), ' ',
        COALESCE(APELLIDOS_1_DOCENTE, ''), ' ',
        COALESCE(APELLIDOS_2_DOCENTE, '')
    ) AS nombre
FROM HORARIOS_DOCENTE
WHERE ID_DOCENTE IN (${idsEvaluadores.map(() => '?').join(',')})
        `, idsEvaluadores).then(r => r[0]) : Promise.resolve([]),

        idsEvaluados.length > 0 ? dbLectura.query(`
           SELECT 
        ID_DOCENTE AS id_docente,
        CEDULA_DOCENTE AS cedula,
        CONCAT(
            COALESCE(NOMBRES_1_DOCENTE, ''), ' ',
            COALESCE(NOMBRES_2_DOCENTE, ''), ' ',
            COALESCE(APELLIDOS_1_DOCENTE, ''), ' ',
            COALESCE(APELLIDOS_2_DOCENTE, '')
        ) AS nombre
    FROM HORARIOS_DOCENTE
    WHERE ID_DOCENTE IN (${idsEvaluados.map(() => '?').join(',')})
        `, idsEvaluados).then(r => r[0]) : Promise.resolve([]),

        idsEvaluadores.length > 0 ? dbLectura.query(`
            SELECT DISTINCT 
                su.CORREO_USUARIOS as correo,
                su.NOMBRES_USUARIOS as nombres,
                su.APELLIDOS_USUARIOS as apellidos,
                hd.ID_DOCENTE as id_docente
            FROM SEGURIDAD_USUARIOS su
            INNER JOIN HORARIOS_DOCENTE hd ON hd.CEDULA_DOCENTE = su.DOCUMENTO_USUARIOS
            WHERE hd.ID_DOCENTE IN (${idsEvaluadores.map(() => '?').join(',')})
              AND su.ID_PERFILES_USUARIOS = 15
              AND su.DELETED_AT IS NULL
              AND su.CORREO_USUARIOS IS NOT NULL
              AND su.CORREO_USUARIOS != ''
        `, idsEvaluadores).then(r => r[0]) : Promise.resolve([]),

        idsAsignaturas.length > 0 ? dbLectura.query(`
            SELECT 
                ID_ASIGNATURA as id_asignatura,
                NOMBRE_ASIGNATURA as nombre_asignatura
            FROM NOTAS_ASIGNATURA
            WHERE ID_ASIGNATURA IN (${idsAsignaturas.map(() => '?').join(',')})
        `, idsAsignaturas).then(r => r[0]) : Promise.resolve([])
    ]);

    // 4) Mapas rápidos
    const mapEval = new Map(docentesEvaluadores.map(d => [d.id_docente, d]));
    const mapEvalUsuarios = new Map(usuariosEvaluadores.map(u => [u.id_docente, u]));
    const mapEvdo = new Map(docentesEvaluados.map(d => [d.id_docente, d]));
    const mapAsignaturas = new Map(asignaturasRows.map(a => [a.id_asignatura, a]));

    // 5) Armar detalle
    return asignaciones.map(a => {
        const evl = mapEval.get(a.id_docente_evaluador);
        const evlUser = mapEvalUsuarios.get(a.id_docente_evaluador);
        const evd = mapEvdo.get(a.id_docente_evaluado);
        const asig = mapAsignaturas.get(a.id_asignatura);
        return {
            id_asignacion: a.id_asignacion,
            id_periodo: a.id_periodo,
            evaluador: {
                id: a.id_docente_evaluador,
                nombre: evl ? evl.nombre : 'Docente evaluador',
                correo: evlUser ? evlUser.correo : null
            },
            evaluado: {
                id: a.id_docente_evaluado,
                nombre: evd ? evd.nombre : 'Docente evaluado'
            },
            asignatura: {
                id: a.id_asignatura,
                nombre: asig ? asig.nombre_asignatura : null
            },
            fecha: a.fecha,
            dia: a.dia,
            hora_inicio: a.hora_inicio,
            hora_fin: a.hora_fin
        };
    });
}

async function obtenerAsignacionesPorPeriodo(id_periodo) {
    const [rows] = await dbEscritura.query(`
        SELECT * FROM asignaciones_coevaluacion
        WHERE id_periodo = ?
        ORDER BY id_asignacion DESC
    `, [id_periodo]);
    return rows;
}

async function eliminarAsignacion(id_asignacion) {
    await dbEscritura.query(`
        DELETE FROM asignaciones_coevaluacion
        WHERE id_asignacion = ?
    `, [id_asignacion]);
}

// Editar una asignación existente
async function editarAsignacion(id_asignacion, data) {
    const {
        id_periodo,
        id_docente_evaluador,
        id_docente_evaluado,
        fecha,
        hora_inicio,
        hora_fin,
        dia,
        id_asignatura
    } = data;
    await dbEscritura.query(`
        UPDATE asignaciones_coevaluacion SET
            id_periodo = ?,
            id_docente_evaluador = ?,
            id_docente_evaluado = ?,
            fecha = ?,
            hora_inicio = ?,
            hora_fin = ?,
            dia = ?,
            id_asignatura = ?
        WHERE id_asignacion = ?
    `, [
        id_periodo,
        id_docente_evaluador,
        id_docente_evaluado,
        fecha || null,
        hora_inicio || null,
        hora_fin || null,
        dia || null,
        id_asignatura || null,
        id_asignacion
    ]);
}

// Obtener docentes con sus materias por periodo
async function obtenerDocentesConMateriasPorPeriodo(idPeriodo) {
    const [rows] = await dbLectura.query(`
        SELECT DISTINCT
            hd.ID_DOCENTE as id_docente,
            CONCAT(
                COALESCE(hd.NOMBRES_1_DOCENTE, ''), ' ',
                COALESCE(hd.NOMBRES_2_DOCENTE, ''), ' ',
                COALESCE(hd.APELLIDOS_1_DOCENTE, ''), ' ',
                COALESCE(hd.APELLIDOS_2_DOCENTE, '')
            ) AS nombre,
            nd.ID_DISTRIBUTIVO as id_distributivo,
            na.ID_ASIGNATURA as id_asignatura,
            na.NOMBRE_ASIGNATURA as nombre_asignatura
        FROM HORARIOS_DOCENTE hd
        INNER JOIN NOTAS_DISTRIBUTIVO nd ON hd.ID_DOCENTE = nd.ID_DOCENTE_DISTRIBUTIVO
        LEFT JOIN NOTAS_ASIGNATURA na ON nd.ID_ASIGNATURA_DISTRIBUTIVO = na.ID_ASIGNATURA
        WHERE nd.ID_PERIODO_DISTRIBUTIVO = ?
            AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
            AND hd.NOMBRES_1_DOCENTE IS NOT NULL 
            AND hd.APELLIDOS_1_DOCENTE IS NOT NULL
            AND TRIM(CONCAT(COALESCE(hd.NOMBRES_1_DOCENTE, ''), ' ', COALESCE(hd.APELLIDOS_1_DOCENTE, ''))) <> ''
            AND CONCAT(COALESCE(hd.NOMBRES_1_DOCENTE, ''), ' ', COALESCE(hd.APELLIDOS_1_DOCENTE, '')) NOT LIKE '%@%'
        ORDER BY nombre ASC, nombre_asignatura ASC
    `, [idPeriodo]);
    return rows;
}

// Obtener lista de docentes evaluadores (sin materias específicas)
async function obtenerDocentesEvaluadores(idPeriodo) {
    const [rows] = await dbLectura.query(`
        SELECT DISTINCT
            hd.ID_DOCENTE as id_docente,
            CONCAT(
                COALESCE(hd.NOMBRES_1_DOCENTE, ''), ' ',
                COALESCE(hd.NOMBRES_2_DOCENTE, ''), ' ',
                COALESCE(hd.APELLIDOS_1_DOCENTE, ''), ' ',
                COALESCE(hd.APELLIDOS_2_DOCENTE, '')
            ) AS nombre
        FROM HORARIOS_DOCENTE hd
        INNER JOIN NOTAS_DISTRIBUTIVO nd ON hd.ID_DOCENTE = nd.ID_DOCENTE_DISTRIBUTIVO
        WHERE nd.ID_PERIODO_DISTRIBUTIVO = ?
            AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
            AND hd.NOMBRES_1_DOCENTE IS NOT NULL 
            AND hd.APELLIDOS_1_DOCENTE IS NOT NULL
            AND TRIM(CONCAT(COALESCE(hd.NOMBRES_1_DOCENTE, ''), ' ', COALESCE(hd.APELLIDOS_1_DOCENTE, ''))) <> ''
            AND CONCAT(COALESCE(hd.NOMBRES_1_DOCENTE, ''), ' ', COALESCE(hd.APELLIDOS_1_DOCENTE, '')) NOT LIKE '%@%'
        ORDER BY nombre ASC
    `, [idPeriodo]);
    return rows;
}

// Función obtenerAsignacionesCompletas también necesita actualización
async function obtenerAsignacionesCompletas() {
    try {
        // 1. Consulta principal - SIN las columnas eliminadas
        const [asignaciones] = await dbEscritura.query(`
            SELECT 
                ac.*,
                ev.id_evaluacion,
                ev.estado as estado_evaluacion_general
            FROM asignaciones_coevaluacion ac
            LEFT JOIN evaluaciones ev ON ev.id_periodo = ac.id_periodo AND ev.id_formulario = 3
            ORDER BY ac.id_asignacion DESC
        `);

        if (asignaciones.length === 0) {
            return [];
        }

        // 2. Extraer IDs únicos para consultas en paralelo
        const docenteIds = [...new Set([
            ...asignaciones.map(a => a.id_docente_evaluador),
            ...asignaciones.map(a => a.id_docente_evaluado)
        ])].filter(Boolean);

        const periodoIds = [...new Set(asignaciones.map(a => a.id_periodo))].filter(Boolean);
        const asignaturaIds = [...new Set(asignaciones.map(a => a.id_asignatura))].filter(Boolean);

        // 3. Ejecutar todas las consultas en PARALELO
        const [
            docentes,
            periodos,
            asignaturas,
            usuarios,
            distributivos,
            evaluacionesRealizadas
        ] = await Promise.all([
            // Consulta de docentes
            docenteIds.length > 0 ?
                dbLectura.query(`
                    SELECT 
                        ID_DOCENTE as id_docente,
                        CONCAT(COALESCE(NOMBRES_1_DOCENTE, ''), ' ', COALESCE(APELLIDOS_1_DOCENTE, '')) as nombre,
                        CEDULA_DOCENTE as cedula
                    FROM HORARIOS_DOCENTE
                    WHERE ID_DOCENTE IN (${docenteIds.map(() => '?').join(',')})
                `, docenteIds).then(result => result[0]) : Promise.resolve([]),

            // Consulta de períodos
            periodoIds.length > 0 ?
                dbLectura.query(`
                    SELECT 
                        ID_PERIODO as id_periodo,
                        NOMBRE_PERIODO as descripcion_periodo
                    FROM MATRICULACION_PERIODO
                    WHERE ID_PERIODO IN (${periodoIds.map(() => '?').join(',')})
                `, periodoIds).then(result => result[0]) : Promise.resolve([]),

            // Consulta de asignaturas
            asignaturaIds.length > 0 ?
                dbLectura.query(`
                    SELECT ID_ASIGNATURA as id_asignatura, NOMBRE_ASIGNATURA as nombre_asignatura
                    FROM NOTAS_ASIGNATURA
                    WHERE ID_ASIGNATURA IN (${asignaturaIds.map(() => '?').join(',')})
                `, asignaturaIds).then(result => result[0]) : Promise.resolve([]),

            // Consulta de usuarios por cédulas de docentes
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

            // Consulta de distributivos - usando docente evaluado, período y asignatura
            docenteIds.length > 0 && periodoIds.length > 0 && asignaturaIds.length > 0 ?
                dbLectura.query(`
                    SELECT 
                        ID_DISTRIBUTIVO,
                        ID_DOCENTE_DISTRIBUTIVO as id_docente,
                        ID_PERIODO_DISTRIBUTIVO as id_periodo,
                        ID_ASIGNATURA_DISTRIBUTIVO as id_asignatura
                    FROM NOTAS_DISTRIBUTIVO
                    WHERE ID_DOCENTE_DISTRIBUTIVO IN (${docenteIds.map(() => '?').join(',')})
                    AND ID_PERIODO_DISTRIBUTIVO IN (${periodoIds.map(() => '?').join(',')})
                    AND ID_ASIGNATURA_DISTRIBUTIVO IN (${asignaturaIds.map(() => '?').join(',')})
                `, [...docenteIds, ...periodoIds, ...asignaturaIds]).then(result => result[0]) : Promise.resolve([]),

            // Consulta de evaluaciones realizadas
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
                `, [...new Set(asignaciones.map(a => a.id_evaluacion))].filter(Boolean)).then(result => result[0]) : Promise.resolve([])
        ]);

        // 4. Crear mapas para búsqueda rápida
        const docentesMap = new Map(docentes.map(d => [d.id_docente, d]));
        const periodosMap = new Map(periodos.map(p => [p.id_periodo, p]));
        const asignaturasMap = new Map(asignaturas.map(a => [a.id_asignatura, a]));
        const usuariosMap = new Map(usuarios.map(u => [u.id_docente, u]));

        // Mapa de distributivos por docente, período y asignatura
        const distributivosMap = new Map();
        distributivos.forEach(d => {
            const key = `${d.id_docente}-${d.id_periodo}-${d.id_asignatura}`;
            distributivosMap.set(key, d.ID_DISTRIBUTIVO);
        });

        // Mapa de evaluaciones realizadas
        const evaluacionesMap = new Map();
        evaluacionesRealizadas.forEach(er => {
            const key = `${er.id_evaluacion}-${er.evaluador_id}-${er.id_distributivo}`;
            evaluacionesMap.set(key, er);
        });

        // 5. Procesar resultados
        const resultado = asignaciones.map((asig) => {
            const evaluador = docentesMap.get(asig.id_docente_evaluador);
            const evaluado = docentesMap.get(asig.id_docente_evaluado);
            const periodo = periodosMap.get(asig.id_periodo);
            const asignatura = asignaturasMap.get(asig.id_asignatura);

            // Determinar estado de evaluación
            let estado_evaluacion = 'sin_evaluacion';
            let fecha_completada = null;

            if (asig.id_evaluacion && evaluador) {
                const usuario = usuariosMap.get(asig.id_docente_evaluador);
                if (usuario && asig.id_asignatura) {
                    // Buscar el distributivo usando docente evaluado, período y asignatura
                    const idDistributivo = distributivosMap.get(`${asig.id_docente_evaluado}-${asig.id_periodo}-${asig.id_asignatura}`);

                    if (idDistributivo) {
                        const key = `${asig.id_evaluacion}-${usuario.id_usuario}-${idDistributivo}`;
                        const evaluacionRealizada = evaluacionesMap.get(key);

                        if (evaluacionRealizada) {
                            estado_evaluacion = evaluacionRealizada.estado || 'pendiente';
                            fecha_completada = evaluacionRealizada.fecha_fin;
                        } else {
                            estado_evaluacion = 'pendiente';
                        }
                    } else {
                        // No se encontró distributivo, pero hay evaluación general
                        estado_evaluacion = 'pendiente';
                    }
                }
            }

            return {
                ...asig,
                nombre_evaluador: evaluador ? evaluador.nombre : 'Docente no encontrado',
                nombre_evaluado: evaluado ? evaluado.nombre : 'Docente no encontrado',
                descripcion_periodo: periodo ? periodo.descripcion_periodo : 'Período no encontrado',
                nombre_asignatura: asignatura ? asignatura.nombre_asignatura : null,
                // Eliminamos las propiedades que ya no existen
                estado_evaluacion,
                fecha_completada
            };
        });

        return resultado;
    } catch (error) {
        console.error('Error en obtenerAsignacionesCompletas:', error);
        throw error;
    }
}

// Función auxiliar para verificar si existe un docente
async function verificarDocente(idDocente) {
    const [rows] = await dbLectura.query(`
        SELECT ID_DOCENTE 
        FROM HORARIOS_DOCENTE 
        WHERE ID_DOCENTE = ?
    `, [idDocente]);
    return rows.length > 0;
}

// Función auxiliar para verificar si existe un período
async function verificarPeriodo(idPeriodo) {
    const [rows] = await dbLectura.query(`
        SELECT ID_PERIODO 
        FROM MATRICULACION_PERIODO 
        WHERE ID_PERIODO = ?
    `, [idPeriodo]);
    return rows.length > 0;
}

// Obtener asignaturas por periodo
async function obtenerAsignaturasPorPeriodo(idPeriodo) {
    const [rows] = await dbLectura.query(`
        SELECT DISTINCT
            na.ID_ASIGNATURA as id_asignatura,
            na.NOMBRE_ASIGNATURA as nombre_asignatura
        FROM NOTAS_ASIGNATURA na
        INNER JOIN NOTAS_DISTRIBUTIVO nd ON na.ID_ASIGNATURA = nd.ID_ASIGNATURA_DISTRIBUTIVO
        WHERE nd.ID_PERIODO_DISTRIBUTIVO = ?
            AND nd.DELETED_AT_DISTRIBUTIVO IS NULL
            AND na.NOMBRE_ASIGNATURA IS NOT NULL
        ORDER BY na.NOMBRE_ASIGNATURA ASC
    `, [idPeriodo]);
    return rows;
}

// Función de verificación también actualizada
async function verificarAsignacionExistente(id_periodo, id_docente_evaluador, id_docente_evaluado, id_asignatura = null) {
    let query = `
        SELECT COUNT(*) as total 
        FROM asignaciones_coevaluacion 
        WHERE id_periodo = ? 
        AND id_docente_evaluador = ? 
        AND id_docente_evaluado = ?
    `;
    let params = [id_periodo, id_docente_evaluador, id_docente_evaluado];

    // Si se especifica una asignatura, validar que no exista esa combinación específica
    if (id_asignatura) {
        query += ` AND id_asignatura = ?`;
        params.push(id_asignatura);
    } else {
        // Si no se especifica asignatura, validar que no exista ninguna asignación sin asignatura específica
        query += ` AND id_asignatura IS NULL`;
    }

    const [rows] = await dbEscritura.query(query, params);
    return rows[0].total > 0;
}


module.exports = {
    crearAsignacion,
    obtenerAsignacionesPorPeriodo,
    eliminarAsignacion,
    editarAsignacion,
    obtenerDocentesConMateriasPorPeriodo,
    obtenerDocentesEvaluadores,
    obtenerAsignacionesCompletas,
    obtenerAsignacionesDetalleParaNotificacion,
    verificarDocente,
    verificarPeriodo,
    obtenerAsignaturasPorPeriodo,
    verificarAsignacionExistente
};