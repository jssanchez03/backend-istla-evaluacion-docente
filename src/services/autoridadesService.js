const autoridadesRepository = require('../repositories/autoridadesRepository');

class AutoridadesService {

    // Listar todas las autoridades activas del usuario
    async listarAutoridades(usuarioId) {
        try {
            const autoridades = await autoridadesRepository.obtenerTodasLasAutoridades(usuarioId);
            return {
                success: true,
                data: autoridades,
                message: 'Autoridades obtenidas exitosamente'
            };
        } catch (error) {
            console.error('Error en listarAutoridades:', error);
            throw new Error('Error al obtener las autoridades');
        }
    }

    // Obtener autoridad por ID
    async obtenerAutoridadPorId(idAutoridad, usuarioId) {
        try {
            if (!idAutoridad || isNaN(parseInt(idAutoridad))) {
                throw new Error('ID de autoridad inválido');
            }

            const autoridad = await autoridadesRepository.obtenerAutoridadPorId(idAutoridad, usuarioId);

            if (!autoridad) {
                throw new Error('Autoridad no encontrada');
            }

            return {
                success: true,
                data: autoridad,
                message: 'Autoridad obtenida exitosamente'
            };
        } catch (error) {
            console.error('Error en obtenerAutoridadPorId:', error);
            throw error;
        }
    }

    // Crear nueva autoridad
    async crearAutoridad(datosAutoridad, usuarioId) {
        try {
            // Validar datos obligatorios
            const { nombre_autoridad, cargo_autoridad } = datosAutoridad;

            if (!nombre_autoridad || !cargo_autoridad) {
                throw new Error('Faltan datos obligatorios: nombre_autoridad y cargo_autoridad son requeridos');
            }

            // Obtener siguiente orden si no se proporciona
            let orden_firma = datosAutoridad.orden_firma;
            if (!orden_firma) {
                orden_firma = await autoridadesRepository.obtenerSiguienteOrden(usuarioId);
            } else {
                // Verificar si el orden ya existe
                const ordenExiste = await autoridadesRepository.verificarOrdenExistente(orden_firma, usuarioId);
                if (ordenExiste) {
                    throw new Error('El orden de firma ya está en uso');
                }
            }

            const datosCompletos = {
                nombre_autoridad: nombre_autoridad.trim(),
                cargo_autoridad: cargo_autoridad.trim(),
                orden_firma
            };

            const idAutoridad = await autoridadesRepository.crearAutoridad(datosCompletos, usuarioId);

            return {
                success: true,
                data: { id_autoridad: idAutoridad },
                message: 'Autoridad creada exitosamente'
            };

        } catch (error) {
            console.error('Error en crearAutoridad:', error);
            throw error;
        }
    }

    // Actualizar autoridad existente
    async actualizarAutoridad(idAutoridad, datosActualizados, usuarioId) {
        try {
            if (!idAutoridad || isNaN(parseInt(idAutoridad))) {
                throw new Error('ID de autoridad inválido');
            }

            // Verificar que la autoridad existe
            const autoridadExistente = await autoridadesRepository.obtenerAutoridadPorId(idAutoridad, usuarioId);
            if (!autoridadExistente) {
                throw new Error('Autoridad no encontrada');
            }

            // Validar datos obligatorios
            const { nombre_autoridad, cargo_autoridad } = datosActualizados;

            if (!nombre_autoridad || !cargo_autoridad) {
                throw new Error('Faltan datos obligatorios: nombre_autoridad y cargo_autoridad son requeridos');
            }

            // Verificar orden de firma si se proporciona
            if (datosActualizados.orden_firma) {
                const ordenExiste = await autoridadesRepository.verificarOrdenExistente(
                    datosActualizados.orden_firma,
                    usuarioId,
                    idAutoridad
                );
                if (ordenExiste) {
                    throw new Error('El orden de firma ya está en uso');
                }
            }

            const datosCompletos = {
                nombre_autoridad: nombre_autoridad.trim(),
                cargo_autoridad: cargo_autoridad.trim(),
                orden_firma: datosActualizados.orden_firma || autoridadExistente.orden_firma
            };

            const actualizado = await autoridadesRepository.actualizarAutoridad(idAutoridad, datosCompletos, usuarioId);

            if (!actualizado) {
                throw new Error('No se pudo actualizar la autoridad');
            }

            return {
                success: true,
                message: 'Autoridad actualizada exitosamente'
            };

        } catch (error) {
            console.error('Error en actualizarAutoridad:', error);
            throw error;
        }
    }

    // Eliminar autoridad (cambiar estado a INACTIVO)
    async eliminarAutoridad(idAutoridad, usuarioId) {
        try {
            if (!idAutoridad || isNaN(parseInt(idAutoridad))) {
                throw new Error('ID de autoridad inválido');
            }

            // Verificar que la autoridad existe
            const autoridadExistente = await autoridadesRepository.obtenerAutoridadPorId(idAutoridad, usuarioId);
            if (!autoridadExistente) {
                throw new Error('Autoridad no encontrada');
            }

            if (autoridadExistente.estado === 'INACTIVO') {
                throw new Error('La autoridad ya está inactiva');
            }

            const eliminado = await autoridadesRepository.eliminarAutoridad(idAutoridad, usuarioId);

            if (!eliminado) {
                throw new Error('No se pudo eliminar la autoridad');
            }

            return {
                success: true,
                message: 'Autoridad eliminada exitosamente'
            };

        } catch (error) {
            console.error('Error en eliminarAutoridad:', error);
            throw error;
        }
    }

    // Obtener autoridades para firmas de reportes
    async obtenerAutoridadesParaFirmas(usuarioId) {
        try {
            const autoridades = await autoridadesRepository.obtenerAutoridadesParaFirmas(usuarioId);

            return {
                success: true,
                data: autoridades,
                message: 'Autoridades para firmas obtenidas exitosamente'
            };
        } catch (error) {
            console.error('Error en obtenerAutoridadesParaFirmas:', error);
            throw new Error('Error al obtener las autoridades para firmas');
        }
    }

    // Agregar este método al AutoridadesService
    async actualizarOrdenesMultiples(actualizaciones, usuarioId) {
        try {
            // Validar que las actualizaciones sean válidas
            if (!Array.isArray(actualizaciones) || actualizaciones.length === 0) {
                throw new Error('Las actualizaciones deben ser un array no vacío');
            }

            // Validar cada actualización
            for (const actualizacion of actualizaciones) {
                if (!actualizacion.id_autoridad || !actualizacion.orden_firma) {
                    throw new Error('Cada actualización debe tener id_autoridad y orden_firma');
                }
            }

            const actualizado = await autoridadesRepository.actualizarOrdenesMultiples(actualizaciones, usuarioId);

            if (!actualizado) {
                throw new Error('No se pudieron actualizar los órdenes');
            }

            return {
                success: true,
                message: 'Órdenes actualizados exitosamente'
            };

        } catch (error) {
            console.error('Error en actualizarOrdenesMultiples:', error);
            throw error;
        }
    }
}

module.exports = new AutoridadesService();