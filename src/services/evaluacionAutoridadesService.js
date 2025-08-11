const AutoridadesRepository = require('../repositories/evaluacionAutoridadesRepository');

class AutoridadesService {
    // Obtener datos iniciales para el formulario
    async obtenerDatosIniciales(idPeriodo = null) {
        try {
            const [periodos, carreras] = await Promise.all([
                AutoridadesRepository.obtenerPeriodos(),
                AutoridadesRepository.obtenerCarreras(idPeriodo)
            ]);

            return {
                success: true,
                data: {
                    periodos,
                    carreras
                }
            };
        } catch (error) {
            console.error('Error en obtenerDatosIniciales:', error);
            return {
                success: false,
                message: 'Error al obtener datos iniciales',
                error: error.message
            };
        }
    }

    // Obtener docentes por período y carrera
    async obtenerDocentes(idPeriodo, idCarrera) {
        try {
            if (!idPeriodo || !idCarrera) {
                return {
                    success: false,
                    message: 'El período y la carrera son requeridos'
                };
            }

            const docentes = await AutoridadesRepository.obtenerDocentesPorPeriodoYCarrera(idPeriodo, idCarrera);

            return {
                success: true,
                data: docentes
            };
        } catch (error) {
            console.error('Error en obtenerDocentes:', error);
            return {
                success: false,
                message: 'Error al obtener docentes',
                error: error.message
            };
        }
    }

    // Crear o actualizar evaluación de autoridad
    async crearEvaluacion(evaluacionData) {
        try {
            // Validaciones
            const {
                id_periodo,
                id_docente_evaluado,
                id_carrera,
                calificacion,
                evaluador_cedula,
                evaluador_nombres,
                evaluador_apellidos,
                observaciones
            } = evaluacionData;

            // Validar campos requeridos
            if (!id_periodo || !id_docente_evaluado || !id_carrera || calificacion === undefined || !evaluador_cedula) {
                return {
                    success: false,
                    message: 'Faltan datos requeridos para crear la evaluación'
                };
            }

            // Validar calificación
            if (calificacion < 0 || calificacion > 100) {
                return {
                    success: false,
                    message: 'La calificación debe estar entre 0 y 100'
                };
            }

            // Crear o actualizar evaluación
            const resultado = await AutoridadesRepository.crearEvaluacionAutoridad(evaluacionData);

            return {
                success: true,
                message: `Evaluación ${resultado.accion} correctamente`,
                data: resultado
            };
        } catch (error) {
            console.error('Error en crearEvaluacion:', error);

            // Manejar errores específicos de duplicados
            if (error.code === 'ER_DUP_ENTRY') {
                return {
                    success: false,
                    message: 'Ya existe una evaluación para este docente en este período'
                };
            }

            return {
                success: false,
                message: 'Error al crear la evaluación',
                error: error.message
            };
        }
    }

    // Actualizar evaluación existente
    async actualizarEvaluacion(idEvaluacion, datosActualizacion) {
        try {
            const { calificacion, observaciones } = datosActualizacion;

            if (!idEvaluacion) {
                return {
                    success: false,
                    message: 'El ID de evaluación es requerido'
                };
            }

            // Validar calificación si se proporciona
            if (calificacion !== undefined && (calificacion < 0 || calificacion > 100)) {
                return {
                    success: false,
                    message: 'La calificación debe estar entre 0 y 100'
                };
            }

            // Actualizar evaluación
            const resultado = await AutoridadesRepository.actualizarEvaluacion(idEvaluacion, datosActualizacion);

            return {
                success: true,
                message: 'Evaluación actualizada correctamente',
                data: resultado
            };
        } catch (error) {
            console.error('Error en actualizarEvaluacion:', error);
            return {
                success: false,
                message: 'Error al actualizar la evaluación',
                error: error.message
            };
        }
    }

    // Obtener evaluaciones por período
    async obtenerEvaluacionesPorPeriodo(idPeriodo) {
        try {
            if (!idPeriodo) {
                return {
                    success: false,
                    message: 'El período es requerido'
                };
            }

            const evaluaciones = await AutoridadesRepository.obtenerEvaluacionesPorPeriodo(idPeriodo);

            return {
                success: true,
                data: evaluaciones
            };
        } catch (error) {
            console.error('Error en obtenerEvaluacionesPorPeriodo:', error);
            return {
                success: false,
                message: 'Error al obtener evaluaciones',
                error: error.message
            };
        }
    }

    // Obtener evaluación específica
    async obtenerEvaluacionDocente(idPeriodo, idDocente, evaluadorCedula) {
        try {
            if (!idPeriodo || !idDocente || !evaluadorCedula) {
                return {
                    success: false,
                    message: 'Faltan parámetros requeridos'
                };
            }

            const evaluacion = await AutoridadesRepository.obtenerEvaluacionDocente(idPeriodo, idDocente, evaluadorCedula);

            return {
                success: true,
                data: evaluacion
            };
        } catch (error) {
            console.error('Error en obtenerEvaluacionDocente:', error);
            return {
                success: false,
                message: 'Error al obtener evaluación',
                error: error.message
            };
        }
    }

    // Eliminar evaluación
    async eliminarEvaluacion(idEvaluacion) {
        try {
            if (!idEvaluacion) {
                return {
                    success: false,
                    message: 'El ID de evaluación es requerido'
                };
            }

            await AutoridadesRepository.eliminarEvaluacion(idEvaluacion);

            return {
                success: true,
                message: 'Evaluación eliminada correctamente'
            };
        } catch (error) {
            console.error('Error en eliminarEvaluacion:', error);
            return {
                success: false,
                message: 'Error al eliminar evaluación',
                error: error.message
            };
        }
    }

    // Validar calificación
    validarCalificacion(calificacion) {
        const cal = parseFloat(calificacion);
        return !isNaN(cal) && cal >= 0 && cal <= 100;
    }

    // Formatear respuesta para el frontend
    formatearRespuesta(success, message, data = null, error = null) {
        return {
            success,
            message,
            data,
            error,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new AutoridadesService();