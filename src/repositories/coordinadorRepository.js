const { dbLectura, dbEscritura } = require('../config/database');

// Obtener todos los coordinadores disponibles (desde BD del instituto)
async function obtenerCoordinadoresRepository() {
    try {
        const [rows] = await dbLectura.query(`
            SELECT 
                DOCUMENTO_USUARIOS as cedula, 
                APELLIDOS_USUARIOS as apellidos, 
                NOMBRES_USUARIOS as nombres, 
                CORREO_USUARIOS as correo 
            FROM SEGURIDAD_USUARIOS 
            WHERE ID_PERFILES_USUARIOS = 17
        `);
        return rows;
    } catch (error) {
        console.error('Error en obtenerCoordinadoresRepository:', error);
        throw error;
    }
}

// Obtener todas las carreras activas (desde BD del instituto)
async function obtenerCarrerasRepository() {
    try {
        const [rows] = await dbLectura.query(`
            SELECT 
                ID_CARRERAS as id_carrera, 
                NOMBRE_CARRERAS as nombre_carrera 
            FROM MATRICULACION_CARRERAS 
            WHERE STATUS_CARRERAS = "ACTIVO"
        `);
        return rows;
    } catch (error) {
        console.error('Error en obtenerCarrerasRepository:', error);
        throw error;
    }
}

// Crear nueva asignación de coordinador a carrera (en BD local)
async function crearCoordinadorCarreraRepository(coordinadorData) {
    try {
        const { cedula, nombres, apellidos, correo, id_carrera } = coordinadorData;
        
        const query = `
            INSERT INTO coordinadores_carreras 
            (cedula_coordinador, nombres_coordinador, apellidos_coordinador, correo_coordinador, id_carrera, estado, fecha_asignacion) 
            VALUES (?, ?, ?, ?, ?, 'ACTIVO', NOW())
        `;
        
        const [result] = await dbEscritura.query(query, [cedula, nombres, apellidos, correo, id_carrera]);
        return result;
    } catch (error) {
        console.error('Error en crearCoordinadorCarreraRepository:', error);
        throw error;
    }
}

// CORREGIDO: Obtener todas las asignaciones de coordinadores
async function obtenerAsignacionesCoordinadoresRepository() {
    try {
        // Primero obtenemos las asignaciones de la BD local
        const [asignaciones] = await dbEscritura.query(`
            SELECT 
                id_coordinador_carrera,
                cedula_coordinador,
                nombres_coordinador,
                apellidos_coordinador,
                correo_coordinador,
                id_carrera,
                estado,
                fecha_asignacion
            FROM coordinadores_carreras
            WHERE estado = 'ACTIVO'
            ORDER BY fecha_asignacion DESC
        `);

        // Si no hay asignaciones, retornamos array vacío
        if (!asignaciones || asignaciones.length === 0) {
            return [];
        }

        // Luego obtenemos los nombres de las carreras desde la BD del instituto
        const carreraIds = asignaciones.map(a => a.id_carrera);
        const placeholders = carreraIds.map(() => '?').join(',');
        
        const [carreras] = await dbLectura.query(`
            SELECT 
                ID_CARRERAS as id_carrera,
                NOMBRE_CARRERAS as nombre_carrera
            FROM MATRICULACION_CARRERAS 
            WHERE ID_CARRERAS IN (${placeholders})
        `, carreraIds);

        // Combinamos los datos
        const result = asignaciones.map(asignacion => {
            const carrera = carreras.find(c => c.id_carrera === asignacion.id_carrera);
            return {
                ...asignacion,
                nombre_carrera: carrera ? carrera.nombre_carrera : 'Carrera no encontrada'
            };
        });

        return result;
    } catch (error) {
        console.error('Error en obtenerAsignacionesCoordinadoresRepository:', error);
        throw error;
    }
}

// Obtener coordinador por ID (corregido)
async function obtenerCoordinadorPorIdRepository(id) {
    try {
        const [rows] = await dbEscritura.query(`
            SELECT 
                id_coordinador_carrera,
                cedula_coordinador,
                nombres_coordinador,
                apellidos_coordinador,
                correo_coordinador,
                id_carrera,
                estado,
                fecha_asignacion
            FROM coordinadores_carreras
            WHERE id_coordinador_carrera = ?
        `, [id]);

        if (!rows || rows.length === 0) {
            return null;
        }

        const asignacion = rows[0];

        // Obtener el nombre de la carrera desde la BD del instituto
        const [carreras] = await dbLectura.query(`
            SELECT NOMBRE_CARRERAS as nombre_carrera
            FROM MATRICULACION_CARRERAS 
            WHERE ID_CARRERAS = ?
        `, [asignacion.id_carrera]);

        return {
            ...asignacion,
            nombre_carrera: carreras[0]?.nombre_carrera || 'Carrera no encontrada'
        };
    } catch (error) {
        console.error('Error en obtenerCoordinadorPorIdRepository:', error);
        throw error;
    }
}

// Actualizar asignación de coordinador
async function actualizarCoordinadorCarreraRepository(id, coordinadorData) {
    try {
        const { cedula, nombres, apellidos, correo, id_carrera } = coordinadorData;
        
        const query = `
            UPDATE coordinadores_carreras 
            SET cedula_coordinador = ?, nombres_coordinador = ?, apellidos_coordinador = ?, 
                correo_coordinador = ?, id_carrera = ?, fecha_actualizacion = NOW()
            WHERE id_coordinador_carrera = ?
        `;
        
        const [result] = await dbEscritura.query(query, [cedula, nombres, apellidos, correo, id_carrera, id]);
        return result;
    } catch (error) {
        console.error('Error en actualizarCoordinadorCarreraRepository:', error);
        throw error;
    }
}

// Eliminar (desactivar) asignación de coordinador
async function eliminarCoordinadorCarreraRepository(id) {
    try {
        const query = `
            UPDATE coordinadores_carreras 
            SET estado = 'INACTIVO', fecha_actualizacion = NOW()
            WHERE id_coordinador_carrera = ?
        `;
        
        const [result] = await dbEscritura.query(query, [id]);
        return result;
    } catch (error) {
        console.error('Error en eliminarCoordinadorCarreraRepository:', error);
        throw error;
    }
}

// Verificar si ya existe una asignación activa para la carrera
async function verificarCoordinadorExistenteRepository(id_carrera, excludeId = null) {
    try {
        let query = `
            SELECT COUNT(*) as count 
            FROM coordinadores_carreras 
            WHERE id_carrera = ? AND estado = 'ACTIVO'
        `;
        let params = [id_carrera];
        
        if (excludeId) {
            query += ' AND id_coordinador_carrera != ?';
            params.push(excludeId);
        }
        
        const [rows] = await dbEscritura.query(query, params);
        return rows[0].count > 0;
    } catch (error) {
        console.error('Error en verificarCoordinadorExistenteRepository:', error);
        throw error;
    }
}

// Función de depuración para verificar datos
async function debugAsignaciones() {
    try {
        console.log('=== DEBUG: Verificando asignaciones ===');
        
        // Verificar datos en BD local
        const [localData] = await dbEscritura.query(`
            SELECT * FROM coordinadores_carreras WHERE estado = 'ACTIVO'
        `);
        console.log('Datos en BD local:', localData);

        // Verificar carreras en BD instituto
        const [institutoCareers] = await dbLectura.query(`
            SELECT ID_CARRERAS, NOMBRE_CARRERAS FROM MATRICULACION_CARRERAS WHERE STATUS_CARRERAS = 'ACTIVO'
        `);
        console.log('Carreras en BD instituto:', institutoCareers);

        return { localData, institutoCareers };
    } catch (error) {
        console.error('Error en debug:', error);
        throw error;
    }
}

module.exports = {
    obtenerCoordinadoresRepository,
    obtenerCarrerasRepository,
    crearCoordinadorCarreraRepository,
    obtenerAsignacionesCoordinadoresRepository,
    obtenerCoordinadorPorIdRepository,
    actualizarCoordinadorCarreraRepository,
    eliminarCoordinadorCarreraRepository,
    verificarCoordinadorExistenteRepository,
    debugAsignaciones
};