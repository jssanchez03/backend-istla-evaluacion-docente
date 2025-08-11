const autoridadesService = require('../services/autoridadesService');

class AutoridadesController {

    // Listar todas las autoridades
    async listarAutoridades(req, res) {
        try {
            const usuarioId = req.usuario.id;
            const resultado = await autoridadesService.listarAutoridades(usuarioId);

            res.status(200).json({
                success: true,
                data: resultado.data,
                message: resultado.message
            });

        } catch (error) {
            console.error('Error en listarAutoridades:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener autoridad por ID
    async obtenerAutoridadPorId(req, res) {
        try {
            const { id } = req.params;
            const usuarioId = req.usuario.id;
            const resultado = await autoridadesService.obtenerAutoridadPorId(id, usuarioId);

            res.status(200).json({
                success: true,
                data: resultado.data,
                message: resultado.message
            });

        } catch (error) {
            console.error('Error en obtenerAutoridadPorId:', error);

            if (error.message === 'ID de autoridad inválido' || error.message === 'Autoridad no encontrada') {
                res.status(404).json({
                    success: false,
                    message: error.message
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor',
                    error: error.message
                });
            }
        }
    }

    // Crear nueva autoridad
    async crearAutoridad(req, res) {
        try {
            const datosAutoridad = req.body;
            const usuarioId = req.usuario.id;
            const resultado = await autoridadesService.crearAutoridad(datosAutoridad, usuarioId);

            // ✅ ASEGURAR QUE LA RESPUESTA EXITOSA SEA CLARA
            return res.status(201).json({
                success: true,
                data: resultado.data,
                message: resultado.message
            });

        } catch (error) {
            console.error('Error en crearAutoridad:', error);

            if (error.message.includes('Faltan datos obligatorios') ||
                error.message.includes('inválido') ||
                error.message.includes('ya está en uso')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            } else {
                return res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor',
                    error: error.message
                });
            }
        }
    }

    // Actualizar autoridad existente
    async actualizarAutoridad(req, res) {
        try {
            const { id } = req.params;
            const datosActualizados = req.body;

            const usuarioId = req.usuario.id;
            const resultado = await autoridadesService.actualizarAutoridad(id, datosActualizados, usuarioId);

            // ✅ OBTENER LA AUTORIDAD ACTUALIZADA PARA DEVOLVERLA
            const autoridadActualizada = await autoridadesService.obtenerAutoridadPorId(id, usuarioId);

            return res.status(200).json({
                success: true,
                data: autoridadActualizada.data, // Incluir los datos actualizados
                message: resultado.message
            });

        } catch (error) {
            console.error('Error en actualizarAutoridad:', error);

            if (error.message === 'ID de autoridad inválido' ||
                error.message === 'Autoridad no encontrada') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            } else if (error.message.includes('Faltan datos obligatorios') ||
                error.message.includes('inválido') ||
                error.message.includes('ya está en uso')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            } else {
                return res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor',
                    error: error.message
                });
            }
        }
    }

    // Eliminar autoridad
    async eliminarAutoridad(req, res) {
        try {
            const { id } = req.params;
            const usuarioId = req.usuario.id;
            const resultado = await autoridadesService.eliminarAutoridad(id, usuarioId);

            return res.status(200).json({
                success: true,
                message: resultado.message
            });

        } catch (error) {
            console.error('Error en eliminarAutoridad:', error);

            if (error.message === 'ID de autoridad inválido' ||
                error.message === 'Autoridad no encontrada') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            } else if (error.message.includes('ya está inactiva')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            } else {
                return res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor',
                    error: error.message
                });
            }
        }
    }

    // Obtener autoridades para firmas de reportes
    async obtenerAutoridadesParaFirmas(req, res) {
        try {
            // Por defecto: firmas del usuario autenticado
            let usuarioId = req.usuario.id;
            // Si es admin y se pasa coordinadorId, permitir ver firmas de ese coordinador
            const { coordinadorId } = req.query;
            const rol = req.usuario.rol;
            if (coordinadorId && rol === 1) { // ajusta 1 al valor real de rol admin si es distinto
                usuarioId = parseInt(coordinadorId, 10) || usuarioId;
            }

            const resultado = await autoridadesService.obtenerAutoridadesParaFirmas(usuarioId);

            res.status(200).json({
                success: true,
                data: resultado.data,
                message: resultado.message
            });

        } catch (error) {
            console.error('Error en obtenerAutoridadesParaFirmas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Agregar este método al AutoridadesController
    async actualizarOrdenesMultiples(req, res) {
        try {
            const actualizaciones = req.body;
            const usuarioId = req.usuario.id;
            const resultado = await autoridadesService.actualizarOrdenesMultiples(actualizaciones, usuarioId);

            return res.status(200).json({
                success: true,
                message: resultado.message
            });

        } catch (error) {
            console.error('Error en actualizarOrdenesMultiples:', error);

            if (error.message.includes('actualizaciones deben ser') ||
                error.message.includes('debe tener id_autoridad')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            } else {
                return res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor',
                    error: error.message
                });
            }
        }
    }

}

module.exports = new AutoridadesController();