// ========== CONTROLLER MODIFICADO (reporteCoevaluacionController.js) ==========
const reporteCoevaluacionService = require('../services/reporteCoevaluacionService');
const reporteCoevaluacionExcelService = require('../services/reporteCoevaluacionExcelService');

class ReporteCoevaluacionController {
    // 🔄 MODIFICADO: Generar reporte filtrado por carrera del coordinador
    async generarReporte(req, res) {
        try {
            const { idPeriodo } = req.params;
            const { cedula, id } = req.usuario; // Obtener cédula e id de usuario del token JWT

            if (!idPeriodo || isNaN(parseInt(idPeriodo))) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID del período debe ser un número válido'
                });
            }

            // Pasar la cédula del coordinador y el usuarioId al servicio
            const pdfBuffer = await reporteCoevaluacionService.generarReportePDF(parseInt(idPeriodo), cedula, id);

            // Configurar headers para descarga del PDF
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="reporte_coevaluaciones_periodo_${idPeriodo}.pdf"`);
            res.setHeader('Content-Length', pdfBuffer.length);

            // Enviar el PDF
            res.send(pdfBuffer);

        } catch (error) {
            console.error('Error al generar reporte:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al generar el reporte',
                error: error.message
            });
        }
    }

    // 🔄 MODIFICADO: Previsualizar datos filtrados por carrera del coordinador
    async previsualizarDatos(req, res) {
        try {
            const { idPeriodo } = req.params;
            const { cedula } = req.usuario; // Obtener cédula del token JWT

            if (!idPeriodo || isNaN(parseInt(idPeriodo))) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID del período debe ser un número válido'
                });
            }

            // Pasar la cédula del coordinador al servicio
            const asignaciones = await reporteCoevaluacionService.obtenerDatosParaReporte(parseInt(idPeriodo), cedula);

            if (asignaciones.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontraron asignaciones para el período y carrera seleccionada'
                });
            }

            res.json({
                success: true,
                data: asignaciones,
                message: `Se encontraron ${asignaciones.length} asignaciones para su carrera`
            });

        } catch (error) {
            console.error('Error al obtener datos para previsualización:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // 🆕 NUEVO: Endpoint para obtener autoridades disponibles para firmas
    async obtenerAutoridadesParaFirmas(req, res) {
        try {
            const autoridadesRepository = require('../repositories/autoridadesRepository');
            const autoridades = await autoridadesRepository.obtenerAutoridadesParaFirmas();

            res.json({
                success: true,
                data: autoridades,
                message: 'Autoridades obtenidas exitosamente'
            });

        } catch (error) {
            console.error('Error al obtener autoridades para firmas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener autoridades',
                error: error.message
            });
        }
    }

    // 🆕 NUEVO: Generar reporte Excel filtrado por carrera del coordinador
    async generarReporteExcel(req, res) {
        try {
            const { idPeriodo } = req.params;
            const { cedula, id } = req.usuario; // Obtener cédula e id del token JWT

            if (!idPeriodo || isNaN(parseInt(idPeriodo))) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID del período debe ser un número válido'
                });
            }

            // Pasar la cédula del coordinador y usuarioId al servicio de Excel
            const excelBuffer = await reporteCoevaluacionExcelService.generarReporteExcel(parseInt(idPeriodo), cedula, id);

            // Configurar headers para descarga del Excel
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="reporte_coevaluaciones_periodo_${idPeriodo}.xlsx"`);
            res.setHeader('Content-Length', excelBuffer.length);

            // Enviar el Excel
            res.send(excelBuffer);

        } catch (error) {
            console.error('Error al generar reporte Excel:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al generar el reporte Excel',
                error: error.message
            });
        }
    }

    // 🆕 NUEVO: Generar reporte PDF por carrera específica (para administradores)
    async generarReportePorCarrera(req, res) {
        try {
            const { idCarrera, idPeriodo } = req.params;
            const { id } = req.usuario; // usuarioId para obtener firmas

            if (!idCarrera || isNaN(parseInt(idCarrera))) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID de la carrera debe ser un número válido'
                });
            }

            if (!idPeriodo || isNaN(parseInt(idPeriodo))) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID del período debe ser un número válido'
                });
            }

            // Generar reporte por carrera específica (firmas del usuario autenticado)
            const pdfBuffer = await reporteCoevaluacionService.generarReportePDFPorCarrera(parseInt(idPeriodo), parseInt(idCarrera), id);

            // Configurar headers para descarga del PDF
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="reporte_coevaluaciones_carrera_${idCarrera}_periodo_${idPeriodo}.pdf"`);
            res.setHeader('Content-Length', pdfBuffer.length);

            // Enviar el PDF
            res.send(pdfBuffer);

        } catch (error) {
            console.error('Error al generar reporte por carrera:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al generar el reporte',
                error: error.message
            });
        }
    }

    // 🆕 NUEVO: Generar reporte Excel por carrera específica (para administradores)
    async generarReporteExcelPorCarrera(req, res) {
        try {
            const { idCarrera, idPeriodo } = req.params;
            const { id } = req.usuario; // usuarioId para firmas en Excel

            if (!idCarrera || isNaN(parseInt(idCarrera))) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID de la carrera debe ser un número válido'
                });
            }

            if (!idPeriodo || isNaN(parseInt(idPeriodo))) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID del período debe ser un número válido'
                });
            }

            // Generar reporte Excel por carrera específica
            const excelBuffer = await reporteCoevaluacionExcelService.generarReporteExcelPorCarrera(parseInt(idPeriodo), parseInt(idCarrera), id);

            // Configurar headers para descarga del Excel
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="reporte_coevaluaciones_carrera_${idCarrera}_periodo_${idPeriodo}.xlsx"`);
            res.setHeader('Content-Length', excelBuffer.length);

            // Enviar el Excel
            res.send(excelBuffer);

        } catch (error) {
            console.error('Error al generar reporte Excel por carrera:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al generar el reporte Excel',
                error: error.message
            });
        }
    }

    // 🆕 NUEVO: Previsualizar datos por carrera específica (para administradores)
    async previsualizarDatosPorCarrera(req, res) {
        try {
            const { idCarrera, idPeriodo } = req.params;

            if (!idCarrera || isNaN(parseInt(idCarrera))) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID de la carrera debe ser un número válido'
                });
            }

            if (!idPeriodo || isNaN(parseInt(idPeriodo))) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID del período debe ser un número válido'
                });
            }

            // Obtener datos por carrera específica
            const asignaciones = await reporteCoevaluacionService.obtenerDatosParaReportePorCarrera(parseInt(idPeriodo), parseInt(idCarrera));

            if (asignaciones.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontraron asignaciones para el período y carrera seleccionada'
                });
            }

            res.json({
                success: true,
                data: asignaciones,
                message: `Se encontraron ${asignaciones.length} asignaciones para la carrera seleccionada`
            });

        } catch (error) {
            console.error('Error al obtener datos para previsualización por carrera:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // 🆕 NUEVO: Obtener todas las carreras activas (para dropdown de administrador)
    async obtenerCarrerasActivas(req, res) {
        try {
            const reporteCoevaluacionRepository = require('../repositories/reporteCoevaluacionRepository');
            const carreras = await reporteCoevaluacionRepository.obtenerTodasLasCarreras();

            res.json({
                success: true,
                data: carreras,
                message: 'Carreras obtenidas exitosamente'
            });

        } catch (error) {
            console.error('Error al obtener carreras activas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener carreras',
                error: error.message
            });
        }
    }

    // 🆕 NUEVO: Obtener estadísticas de asignaciones por carrera
    async obtenerEstadisticasCarrera(req, res) {
        try {
            const { idCarrera, idPeriodo } = req.params;

            if (!idCarrera || isNaN(parseInt(idCarrera))) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID de la carrera debe ser un número válido'
                });
            }

            if (!idPeriodo || isNaN(parseInt(idPeriodo))) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID del período debe ser un número válido'
                });
            }

            const reporteCoevaluacionRepository = require('../repositories/reporteCoevaluacionRepository');
            const estadisticas = await reporteCoevaluacionRepository.obtenerEstadisticasAsignacionesPorCarrera(parseInt(idPeriodo), parseInt(idCarrera));

            res.json({
                success: true,
                data: estadisticas,
                message: 'Estadísticas obtenidas exitosamente'
            });

        } catch (error) {
            console.error('Error al obtener estadísticas de carrera:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener estadísticas',
                error: error.message
            });
        }
    }

    // 🆕 NUEVO: Generar reporte Excel general (todas las carreras) para admin/rectora
    async generarReporteExcelGeneral(req, res) {
        try {
            const { idPeriodo } = req.params;
            const { id } = req.usuario; // usuarioId para firmas en Excel

            if (!idPeriodo || isNaN(parseInt(idPeriodo))) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID del período debe ser un número válido'
                });
            }

            // Llamar al servicio con soloVicerrectora=true
            const excelBuffer = await reporteCoevaluacionExcelService.generarReporteExcelGeneral(parseInt(idPeriodo), id);

            // Configurar headers para descarga del Excel
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="reporte_coevaluaciones_general_periodo_${idPeriodo}.xlsx"`);
            res.setHeader('Content-Length', excelBuffer.length);

            // Enviar el Excel
            res.send(excelBuffer);

        } catch (error) {
            console.error('Error al generar reporte Excel general:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al generar el reporte Excel general',
                error: error.message
            });
        }
    }

}

module.exports = new ReporteCoevaluacionController();