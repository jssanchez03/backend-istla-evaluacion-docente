// controllers/reportesCalificacionCarreraController.js
const reportesCalificacionCarreraService = require('../services/reportesCalificacionCarreraService');

class ReportesCalificacionCarreraController {
    
    // Obtener carreras activas (opcionalmente por periodo)
    async obtenerCarrerasActivas(req, res) {
        try {
            const idPeriodo = req.query.idPeriodo || req.params.idPeriodo || null;
            const carreras = await reportesCalificacionCarreraService.obtenerCarrerasActivas(idPeriodo);
            res.json({
                success: true,
                data: carreras
            });
        } catch (error) {
            console.error('Error al obtener carreras activas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener las carreras activas'
            });
        }
    }

    // Obtener periodos
    async obtenerPeriodos(req, res) {
        try {
            const periodos = await reportesCalificacionCarreraService.obtenerPeriodos();
            res.json({
                success: true,
                data: periodos
            });
        } catch (error) {
            console.error('Error al obtener periodos:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener los periodos'
            });
        }
    }

    // Generar reporte PDF por carrera específica
    async generarReportePDFPorCarrera(req, res) {
        try {
            const { idCarrera, idPeriodo } = req.params;
            const { id } = req.usuario; // usuarioId para firmas

            const pdfBuffer = await reportesCalificacionCarreraService.generarPDFReportePorCarrera(
                idPeriodo,
                parseInt(idCarrera),
                id
            );

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="reporte_calificaciones_carrera.pdf"');
            res.send(pdfBuffer);
        } catch (error) {
            console.error('Error al generar reporte PDF por carrera:', error);
            
            if (error.message === 'No se encontró la carrera especificada') {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontró la carrera especificada'
                });
            }
            
            if (error.message === 'No se encontraron docentes para el período y carrera seleccionada') {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontraron docentes para el período y carrera seleccionada'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error al generar el reporte PDF'
            });
        }
    }

    // Generar reporte PDF de todas las carreras
    async generarReportePDFTodasCarreras(req, res) {
        try {
            const { idPeriodo } = req.params;
            const { id } = req.usuario; // usuarioId para firmas

            const pdfBuffer = await reportesCalificacionCarreraService.generarPDFReporteTodasCarreras(idPeriodo, id);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="reporte_calificaciones_todas_carreras.pdf"');
            res.send(pdfBuffer);
        } catch (error) {
            console.error('Error al generar reporte PDF todas las carreras:', error);
            
            if (error.message === 'No se encontraron docentes para el período seleccionado') {
                return res.status(404).json({
                    success: false,
                    message: 'No se encontraron docentes para el período seleccionado'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error al generar el reporte PDF'
            });
        }
    }

    // Obtener datos del reporte (sin generar PDF)
    async obtenerDatosReporte(req, res) {
        try {
            const { idCarrera, idPeriodo } = req.params;
            const userRole = req.usuario.role;
            const cedulaCoordinador = req.usuario.cedula;

            let datos;

            if (userRole === 'coordinador') {
                datos = await reportesCalificacionCarreraService.obtenerDatosReporteCoordinador(
                    idPeriodo,
                    cedulaCoordinador
                );
            } else if (idCarrera && idCarrera !== 'todas') {
                datos = await reportesCalificacionCarreraService.obtenerDatosReportePorCarrera(
                    idPeriodo,
                    parseInt(idCarrera)
                );
            } else {
                datos = await reportesCalificacionCarreraService.obtenerDatosReporteTodasCarreras(idPeriodo);
            }

            res.json({
                success: true,
                data: datos
            });
        } catch (error) {
            console.error('Error al obtener datos del reporte:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener los datos del reporte'
            });
        }
    }
}

module.exports = new ReportesCalificacionCarreraController();