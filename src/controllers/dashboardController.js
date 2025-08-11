const dashboardService = require('../services/dashboardService');
const reportePromedioItemsService = require('../services/reportePromedioItemsService');

async function getEstadisticasGenerales(req, res) {
    const { periodo } = req.query;
    if (!periodo) {
        return res.status(400).json({ error: "Debe proporcionar un id_periodo" });
    }
    try {
        const estadisticas = await dashboardService.obtenerEstadisticasGenerales(periodo);
        res.json(estadisticas);
    } catch (error) {
        console.error("Error al obtener estadísticas generales:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
}

async function getDatosGraficos(req, res) {
    const { periodo } = req.query;
    if (!periodo) {
        return res.status(400).json({ error: "Debe proporcionar un id_periodo" });
    }
    try {
        const datos = await dashboardService.obtenerDatosGraficos(periodo);
        res.json(datos);
    } catch (error) {
        console.error("Error al obtener datos de gráficos:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
}

async function getDetalleParticipacionPorTipo(req, res) {
    const { periodo } = req.query;
    if (!periodo) {
        return res.status(400).json({ error: "Debe proporcionar un id_periodo" });
    }
    try {
        const detalle = await dashboardService.obtenerDetalleParticipacionPorTipo(periodo);
        res.json(detalle);
    } catch (error) {
        console.error("Error al obtener detalle de participación por tipo:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
}

async function getResultadosDetallados(req, res) {
    const { periodo } = req.query;
    if (!periodo) {
        return res.status(400).json({ error: "Debe proporcionar un id_periodo" });
    }
    try {
        const resultados = await dashboardService.obtenerResultadosDetallados(periodo);
        res.json(resultados);
    } catch (error) {
        console.error("Error al obtener resultados detallados:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
}

// Agregar cache si es posible
async function obtenerRespuestasPorTipoYDocente(req, res) {
    try {
        const { idPeriodo } = req.params;        
        const respuestas = await dashboardService.obtenerRespuestasPorTipoYDocente(parseInt(idPeriodo));        
        res.json(respuestas);
    } catch (error) {
        console.error('Error en obtenerRespuestasPorTipoYDocente:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Obtener estadísticas por tipo de pregunta
async function obtenerEstadisticasPorTipoPregunta(req, res) {
    try {
        const { idPeriodo } = req.params;
        const estadisticas = await dashboardService.obtenerEstadisticasPorTipoPregunta(parseInt(idPeriodo));
        res.json(estadisticas);
    } catch (error) {
        console.error('Error en obtenerEstadisticasPorTipoPregunta:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Obtener datos del mapa de calor por secciones
async function obtenerDatosMapaCalor(req, res) {
    try {
        const { idPeriodo } = req.params;
        if (!idPeriodo) {
            return res.status(400).json({ error: "Debe proporcionar un id_periodo" });
        }
        const datosMapaCalor = await dashboardService.obtenerDatosMapaCalor(parseInt(idPeriodo));
        res.json(datosMapaCalor);
    } catch (error) {
        console.error('Error en obtenerDatosMapaCalor:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Obtener promedio por ítem del formulario por tipo de evaluación
async function obtenerPromedioItemsPorTipo(req, res) {
    try {
        const { idPeriodo, tipoEvaluacion } = req.params;
        
        if (!idPeriodo || !tipoEvaluacion) {
            return res.status(400).json({ 
                error: "Debe proporcionar id_periodo y tipo_evaluacion (1=autoevaluacion, 2=heteroevaluacion, 3=coevaluacion)" 
            });
        }

        const tipoEvalNum = parseInt(tipoEvaluacion);
        if (![1, 2, 3].includes(tipoEvalNum)) {
            return res.status(400).json({ 
                error: "tipo_evaluacion debe ser 1, 2 o 3" 
            });
        }

        const datosPromedio = await dashboardService.obtenerPromedioItemsPorTipo(parseInt(idPeriodo), tipoEvalNum);
        res.json(datosPromedio);
    } catch (error) {
        console.error('Error en obtenerPromedioItemsPorTipo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Obtener preguntas con mejor y peor puntuación por tipo
async function obtenerPreguntasExtremas(req, res) {
    try {
        const { idPeriodo, tipoEvaluacion } = req.params;
        
        if (!idPeriodo || !tipoEvaluacion) {
            return res.status(400).json({ 
                error: "Debe proporcionar id_periodo y tipo_evaluacion" 
            });
        }

        const tipoEvalNum = parseInt(tipoEvaluacion);
        if (![1, 2, 3].includes(tipoEvalNum)) {
            return res.status(400).json({ 
                error: "tipo_evaluacion debe ser 1, 2 o 3" 
            });
        }

        const preguntasExtremas = await dashboardService.obtenerPreguntasExtremas(parseInt(idPeriodo), tipoEvalNum);
        res.json(preguntasExtremas);
    } catch (error) {
        console.error('Error en obtenerPreguntasExtremas:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Obtener promedios por carrera filtrado por tipo de evaluación
async function obtenerPromediosPorCarrera(req, res) {
    try {
        const { idPeriodo, tipoEvaluacion } = req.params;
        
        if (!idPeriodo || !tipoEvaluacion) {
            return res.status(400).json({ 
                error: "Debe proporcionar id_periodo y tipo_evaluacion" 
            });
        }

        const tipoEvalNum = parseInt(tipoEvaluacion);
        if (![1, 2, 3].includes(tipoEvalNum)) {
            return res.status(400).json({ 
                error: "tipo_evaluacion debe ser 1, 2 o 3" 
            });
        }

        const promediosCarrera = await dashboardService.obtenerPromediosPorCarrera(parseInt(idPeriodo), tipoEvalNum);
        res.json(promediosCarrera);
    } catch (error) {
        console.error('Error en obtenerPromediosPorCarrera:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Generar PDF de promedio por ítem del formulario por tipo de evaluación
async function generarPDFPromedioItems(req, res) {
    try {
        const { idPeriodo, tipoEvaluacion } = req.params;
        
        if (!idPeriodo || !tipoEvaluacion) {
            return res.status(400).json({ 
                error: "Debe proporcionar id_periodo y tipo_evaluacion (1=autoevaluacion, 2=heteroevaluacion, 3=coevaluacion)" 
            });
        }

        const tipoEvalNum = parseInt(tipoEvaluacion);
        if (![1, 2, 3].includes(tipoEvalNum)) {
            return res.status(400).json({ 
                error: "tipo_evaluacion debe ser 1, 2 o 3" 
            });
        }

        // Obtener los datos del promedio
        const datosPromedio = await dashboardService.obtenerPromedioItemsPorTipo(parseInt(idPeriodo), tipoEvalNum);
        
        // Obtener información del periodo
        const periodo = await dashboardService.obtenerPeriodo(idPeriodo);
        
        // Generar el PDF con firmas del usuario autenticado
        const usuarioId = req.usuario.id;
        const pdfBuffer = await reportePromedioItemsService.generarPDF(datosPromedio, periodo.NOMBRE_PERIODO, usuarioId);

        // Configurar headers para la descarga
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=reporte_promedios_${tipoEvaluacion}_${idPeriodo}.pdf`);
        
        // Enviar el PDF
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error en generarPDFPromedioItems:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}

module.exports = {
    getEstadisticasGenerales,
    getDatosGraficos,
    getDetalleParticipacionPorTipo,
    getResultadosDetallados,
    obtenerRespuestasPorTipoYDocente,
    obtenerEstadisticasPorTipoPregunta,
    obtenerDatosMapaCalor,
    obtenerPromedioItemsPorTipo,
    obtenerPreguntasExtremas,
    obtenerPromediosPorCarrera,
    generarPDFPromedioItems
};