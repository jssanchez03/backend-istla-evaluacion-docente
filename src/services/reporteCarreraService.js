// services/reporteCarreraService.js
const reporteCarreraRepository = require('../repositories/reporteCarreraRepository');

class ReporteCarreraService {

    // Obtener todas las carreras activas del distributivo para un periodo (o todas si no se pasa periodo)
    async obtenerCarrerasActivas(idPeriodo = null) {
        try {
            return await reporteCarreraRepository.obtenerCarrerasActivas(idPeriodo);
        } catch (error) {
            console.error('Error en obtenerCarrerasActivas service:', error);
            throw error;
        }
    }

    // Obtener todos los periodos
    async obtenerPeriodos() {
        try {
            return await reporteCarreraRepository.obtenerPeriodos();
        } catch (error) {
            console.error('Error en obtenerPeriodos service:', error);
            throw error;
        }
    }

    // Obtener datos completos para el reporte
    async obtenerDatosReporteCarrera(idCarrera, idPeriodo) {
        try {
            // Obtener información de la carrera
            const carrera = await reporteCarreraRepository.obtenerInformacionCarrera(idCarrera);
            if (!carrera) {
                throw new Error('Carrera no encontrada');
            }
            // Obtener información del periodo
            const periodo = await reporteCarreraRepository.obtenerInformacionPeriodo(idPeriodo);
            if (!periodo) {
                throw new Error('Periodo no encontrado');
            }
            // Obtener docentes de la carrera en el periodo
            const docentes = await reporteCarreraRepository.obtenerDocentesPorCarreraPeriodo(idCarrera, idPeriodo);

            if (docentes.length === 0) {
                return {
                    carrera,
                    periodo,
                    docentes: []
                };
            }
            // Obtener evaluaciones para cada docente
            const docentesConEvaluaciones = [];
            for (const docente of docentes) {
                try {
                    const evaluaciones = await reporteCarreraRepository.obtenerEvaluacionesDocente(
                        docente.id_distributivo,
                        docente.id_docente_distributivo,
                        idPeriodo
                    );
                    // Validar y convertir valores, asegurándose de que sean números
                    const autoevaluacion = this.validarNumero(evaluaciones.autoevaluacion);
                    const heteroevaluacion = this.validarNumero(evaluaciones.heteroevaluacion);
                    const coevaluacion = this.validarNumero(evaluaciones.coevaluacion);
                    const evaluacionAutoridades = this.validarNumero(evaluaciones.evaluacion_autoridades);
                    // Aplicar ponderaciones: Auto 10%, Hetero 40%, Co 30%, Autoridades 20%
                    const autoPonderada = (autoevaluacion * 0.10);
                    const heteroPonderada = (heteroevaluacion * 0.40);
                    const coPonderada = (coevaluacion * 0.30);
                    const autoridadesPonderada = (evaluacionAutoridades * 0.20);
                    const totalPonderado = autoPonderada + heteroPonderada + coPonderada + autoridadesPonderada;
                    docentesConEvaluaciones.push({
                        ...docente,
                        evaluaciones: {
                            autoevaluacion: parseFloat(autoevaluacion.toFixed(2)),
                            heteroevaluacion: parseFloat(heteroevaluacion.toFixed(2)),
                            coevaluacion: parseFloat(coevaluacion.toFixed(2)),
                            evaluacion_autoridades: parseFloat(evaluacionAutoridades.toFixed(2)),
                            auto_ponderada: parseFloat(autoPonderada.toFixed(2)),
                            hetero_ponderada: parseFloat(heteroPonderada.toFixed(2)),
                            co_ponderada: parseFloat(coPonderada.toFixed(2)),
                            autoridades_ponderada: parseFloat(autoridadesPonderada.toFixed(2)),
                            total_ponderado: parseFloat(totalPonderado.toFixed(2))
                        }
                    });
                } catch (error) {
                    console.error(`Error obteniendo evaluaciones para docente ${docente.id_distributivo}:`, error);
                    // Incluir docente sin evaluaciones
                    docentesConEvaluaciones.push({
                        ...docente,
                        evaluaciones: {
                            autoevaluacion: 0,
                            heteroevaluacion: 0,
                            coevaluacion: 0,
                            evaluacion_autoridades: 0,
                            auto_ponderada: 0,
                            hetero_ponderada: 0,
                            co_ponderada: 0,
                            autoridades_ponderada: 0,
                            total_ponderado: 0
                        }
                    });
                }
            }

            return {
                carrera,
                periodo,
                docentes: docentesConEvaluaciones
            };
        } catch (error) {
            console.error('Error en obtenerDatosReporteCarrera service:', error);
            throw error;
        }
    }
    // Método auxiliar para validar y convertir números
    validarNumero(valor) {
        // Si el valor es null, undefined, NaN o no es un número válido, devolver 0
        if (valor === null || valor === undefined || isNaN(valor)) {
            return 0;
        }
        // Convertir a número si es string
        const numero = typeof valor === 'string' ? parseFloat(valor) : valor;
        // Verificar si la conversión fue exitosa
        return isNaN(numero) ? 0 : numero;
    }
}

module.exports = new ReporteCarreraService();