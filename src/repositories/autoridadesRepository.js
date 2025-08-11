const { dbEscritura } = require('../config/database');

class AutoridadesRepository {

    // Obtener todas las autoridades activas ordenadas por orden_firma para un usuario
    async obtenerTodasLasAutoridades(usuarioId) {
        const [rows] = await dbEscritura.query(`
            SELECT 
                id_autoridad,
                nombre_autoridad,
                cargo_autoridad,
                orden_firma,
                estado,
                created_at,
                updated_at
            FROM autoridades_reportes
            WHERE estado = 'ACTIVO' AND ID_USUARIO = ?
            ORDER BY orden_firma ASC
        `, [usuarioId]);
        return rows;
    }

    // Obtener autoridad por ID, validando pertenencia al usuario
    async obtenerAutoridadPorId(idAutoridad, usuarioId) {
        const [rows] = await dbEscritura.query(`
            SELECT 
                id_autoridad,
                nombre_autoridad,
                cargo_autoridad,
                orden_firma,
                estado,
                created_at,
                updated_at
            FROM autoridades_reportes
            WHERE id_autoridad = ? AND ID_USUARIO = ?
        `, [idAutoridad, usuarioId]);
        return rows[0] || null;
    }

    // Crear nueva autoridad para un usuario
    async crearAutoridad(datosAutoridad, usuarioId) {
        const { nombre_autoridad, cargo_autoridad, orden_firma } = datosAutoridad;

        const [result] = await dbEscritura.query(`
            INSERT INTO autoridades_reportes (
                ID_USUARIO,
                nombre_autoridad, 
                cargo_autoridad, 
                orden_firma, 
                estado
            ) VALUES (?, ?, ?, ?, 'ACTIVO')
        `, [usuarioId, nombre_autoridad, cargo_autoridad, orden_firma]);

        return result.insertId;
    }

    // Actualizar autoridad del usuario
    async actualizarAutoridad(idAutoridad, datosActualizados, usuarioId) {
        const { nombre_autoridad, cargo_autoridad, orden_firma } = datosActualizados;

        const [result] = await dbEscritura.query(`
            UPDATE autoridades_reportes 
            SET 
                nombre_autoridad = ?, 
                cargo_autoridad = ?, 
                orden_firma = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id_autoridad = ? AND ID_USUARIO = ?
        `, [nombre_autoridad, cargo_autoridad, orden_firma, idAutoridad, usuarioId]);

        return result.affectedRows > 0;
    }

    // Eliminar autoridad (cambiar estado a INACTIVO) del usuario
    async eliminarAutoridad(idAutoridad, usuarioId) {
        const [result] = await dbEscritura.query(`
            UPDATE autoridades_reportes 
            SET 
                estado = 'INACTIVO',
                updated_at = CURRENT_TIMESTAMP
            WHERE id_autoridad = ? AND ID_USUARIO = ?
        `, [idAutoridad, usuarioId]);

        return result.affectedRows > 0;
    }

    // Obtener autoridades para firmas de reportes (solo las que se usan) por usuario
    async obtenerAutoridadesParaFirmas(usuarioId) {
        const [rows] = await dbEscritura.query(`
            SELECT 
                id_autoridad,
                nombre_autoridad,
                cargo_autoridad,
                orden_firma
            FROM autoridades_reportes
            WHERE estado = 'ACTIVO' AND ID_USUARIO = ?
            ORDER BY orden_firma ASC
            LIMIT 2
        `, [usuarioId]);
        return rows;
    }

    // Verificar si existe una autoridad con el mismo orden
    async verificarOrdenExistente(orden_firma, usuarioId, idAutoridad = null) {
        let query = `
            SELECT id_autoridad 
            FROM autoridades_reportes 
            WHERE orden_firma = ? AND estado = 'ACTIVO' AND ID_USUARIO = ?
        `;
        let params = [orden_firma, usuarioId];

        if (idAutoridad) {
            query += ` AND id_autoridad != ?`;
            params.push(idAutoridad);
        }

        const [rows] = await dbEscritura.query(query, params);
        return rows.length > 0;
    }

    // Obtener siguiente orden disponible
    async obtenerSiguienteOrden(usuarioId) {
        const [rows] = await dbEscritura.query(`
            SELECT COALESCE(MAX(orden_firma), 0) + 1 AS siguiente_orden
            FROM autoridades_reportes
            WHERE estado = 'ACTIVO' AND ID_USUARIO = ?
        `, [usuarioId]);
        return rows[0].siguiente_orden;
    }

    // Agregar este método al AutoridadesRepository
    async actualizarOrdenesMultiples(actualizaciones, usuarioId) {
        const connection = await dbEscritura.getConnection();

        try {
            await connection.beginTransaction();

            for (const actualizacion of actualizaciones) {
                await connection.query(`
                UPDATE autoridades_reportes 
                SET orden_firma = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id_autoridad = ? AND ID_USUARIO = ?
            `, [actualizacion.orden_firma, actualizacion.id_autoridad, usuarioId]);
            }

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}


module.exports = new AutoridadesRepository();