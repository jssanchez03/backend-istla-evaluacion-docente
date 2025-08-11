const AutoridadesService = require('../services/evaluacionAutoridadesService');

class AutoridadesController {
    // Obtener datos iniciales (periodos y carreras)
    async obtenerDatosIniciales(req, res) {
        try {
            const idPeriodo = req.query.idPeriodo || null;
            const resultado = await AutoridadesService.obtenerDatosIniciales(idPeriodo);
            if (resultado.success) {
                res.json(resultado);
            } else {
                res.status(400).json(resultado);
            }
        } catch (error) {
            console.error('Error en obtenerDatosIniciales:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener docentes por período y carrera
    async obtenerDocentes(req, res) {
        try {
            const { idPeriodo, idCarrera } = req.query;
            if (!idPeriodo || !idCarrera) {
                return res.status(400).json({
                    success: false,
                    message: 'Los parámetros idPeriodo e idCarrera son requeridos'
                });
            }
            const resultado = await AutoridadesService.obtenerDocentes(idPeriodo, idCarrera);
            if (resultado.success) {
                res.json(resultado);
            } else {
                res.status(400).json(resultado);
            }
        } catch (error) {
            console.error('Error en obtenerDocentes:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Crear o actualizar evaluación de autoridad
    async crearEvaluacion(req, res) {
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
            } = req.body;
            // Validaciones básicas
            if (!id_periodo || !id_docente_evaluado || !id_carrera || calificacion === undefined || !evaluador_cedula) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan datos requeridos para crear la evaluación'
                });
            }
            // Validar calificación
            if (!AutoridadesService.validarCalificacion(calificacion)) {
                return res.status(400).json({
                    success: false,
                    message: 'La calificación debe ser un número entre 0 y 100'
                });
            }
            const evaluacionData = {
                id_periodo,
                id_docente_evaluado,
                id_carrera,
                calificacion: parseFloat(calificacion),
                evaluador_cedula,
                evaluador_nombres,
                evaluador_apellidos,
                observaciones
            };
            const resultado = await AutoridadesService.crearEvaluacion(evaluacionData);
            if (resultado.success) {
                res.status(201).json(resultado);
            } else {
                res.status(400).json(resultado);
            }
        } catch (error) {
            console.error('Error en crearEvaluacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener evaluaciones por período
    async obtenerEvaluacionesPorPeriodo(req, res) {
        try {
            const { idPeriodo } = req.params;
            if (!idPeriodo) {
                return res.status(400).json({
                    success: false,
                    message: 'El parámetro idPeriodo es requerido'
                });
            }
            const resultado = await AutoridadesService.obtenerEvaluacionesPorPeriodo(idPeriodo);
            if (resultado.success) {
                res.json(resultado);
            } else {
                res.status(400).json(resultado);
            }
        } catch (error) {
            console.error('Error en obtenerEvaluacionesPorPeriodo:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener evaluación específica de un docente
    async obtenerEvaluacionDocente(req, res) {
        try {
            const { idPeriodo, idDocente, evaluadorCedula } = req.params;
            if (!idPeriodo || !idDocente || !evaluadorCedula) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan parámetros requeridos'
                });
            }
            const resultado = await AutoridadesService.obtenerEvaluacionDocente(idPeriodo, idDocente, evaluadorCedula);
            if (resultado.success) {
                res.json(resultado);
            } else {
                res.status(400).json(resultado);
            }
        } catch (error) {
            console.error('Error en obtenerEvaluacionDocente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Actualizar evaluación existente
    async actualizarEvaluacion(req, res) {
        try {
            const { idEvaluacion } = req.params;
            const {
                calificacion,
                observaciones
            } = req.body;
            if (!idEvaluacion) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID de evaluación es requerido'
                });
            }
            // Validar calificación si se proporciona
            if (calificacion !== undefined && !AutoridadesService.validarCalificacion(calificacion)) {
                return res.status(400).json({
                    success: false,
                    message: 'La calificación debe ser un número entre 0 y 100'
                });
            }
            // Llamar al servicio para actualizar
            const resultado = await AutoridadesService.actualizarEvaluacion(idEvaluacion, {
                calificacion: calificacion !== undefined ? parseFloat(calificacion) : undefined,
                observaciones
            });
            if (resultado.success) {
                res.json(resultado);
            } else {
                res.status(400).json(resultado);
            }
        } catch (error) {
            console.error('Error en actualizarEvaluacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Eliminar evaluación
    async eliminarEvaluacion(req, res) {
        try {
            const { idEvaluacion } = req.params;
            if (!idEvaluacion) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID de evaluación es requerido'
                });
            }
            const resultado = await AutoridadesService.eliminarEvaluacion(idEvaluacion);
            if (resultado.success) {
                res.json(resultado);
            } else {
                res.status(400).json(resultado);
            }
        } catch (error) {
            console.error('Error en eliminarEvaluacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener resumen de evaluaciones
    async obtenerResumen(req, res) {
        try {
            const { idPeriodo } = req.params;
            if (!idPeriodo) {
                return res.status(400).json({
                    success: false,
                    message: 'El parámetro idPeriodo es requerido'
                });
            }
            const resultado = await AutoridadesService.obtenerEvaluacionesPorPeriodo(idPeriodo);
            if (resultado.success) {
                const evaluaciones = resultado.data;
                const resumen = {
                    total_evaluaciones: evaluaciones.length,
                    promedio_calificaciones: evaluaciones.length > 0
                        ? (evaluaciones.reduce((sum, ev) => sum + parseFloat(ev.calificacion), 0) / evaluaciones.length).toFixed(2)
                        : 0,
                    evaluaciones_por_carrera: evaluaciones.reduce((acc, ev) => {
                        acc[ev.nombre_carrera] = (acc[ev.nombre_carrera] || 0) + 1;
                        return acc;
                    }, {}),
                    evaluaciones_por_evaluador: evaluaciones.reduce((acc, ev) => {
                        const evaluador = `${ev.evaluador_nombres} ${ev.evaluador_apellidos}`;
                        acc[evaluador] = (acc[evaluador] || 0) + 1;
                        return acc;
                    }, {})
                };
                res.json({
                    success: true,
                    data: {
                        resumen,
                        evaluaciones
                    }
                });
            } else {
                res.status(400).json(resultado);
            }
        } catch (error) {
            console.error('Error en obtenerResumen:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }
}

module.exports = new AutoridadesController();