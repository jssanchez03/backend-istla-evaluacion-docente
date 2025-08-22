const reporteDocenteIndividualService = require('../services/reporteDocenteIndividualService');

// Generar reporte PDF individual para un docente
async function generarReporteDocente(req, res) {
    try {
        const { idPeriodo, cedulaDocente } = req.params;
        const { id } = req.usuario; // usuarioId para firmas

        // Validaciones básicas
        if (!idPeriodo || !cedulaDocente) {
            return res.status(400).json({
                error: 'Se requieren el ID del período y la cédula del docente'
            });
        }

        if (isNaN(idPeriodo)) {
            return res.status(400).json({
                error: 'El ID del período debe ser un número válido'
            });
        }

        // Generar el reporte PDF
        const pdfBuffer = await reporteDocenteIndividualService.generarReportePDF(
            parseInt(idPeriodo), 
            cedulaDocente,
            id
        );

        // Configurar headers para descarga del PDF
        const nombreArchivo = `reporte_docente_${cedulaDocente}_periodo_${idPeriodo}.pdf`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        // Enviar el PDF
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error al generar reporte individual del docente:', error);
        
        if (error.message.includes('Docente no encontrado')) {
            return res.status(404).json({
                error: 'Docente no encontrado'
            });
        }
        
        if (error.message.includes('No se encontraron evaluaciones')) {
            return res.status(404).json({
                error: 'No se encontraron evaluaciones para este docente en el período especificado'
            });
        }

        res.status(500).json({
            error: 'Error interno del servidor al generar el reporte'
        });
    }
}

// Obtener datos del docente para vista previa (sin generar PDF)
async function obtenerDatosDocente(req, res) {
    try {
        const { idPeriodo, cedulaDocente } = req.params;

        // Validaciones básicas
        if (!idPeriodo || !cedulaDocente) {
            return res.status(400).json({
                error: 'Se requieren el ID del período y la cédula del docente'
            });
        }

        if (isNaN(idPeriodo)) {
            return res.status(400).json({
                error: 'El ID del período debe ser un número válido'
            });
        }

        // Obtener datos del docente
        const datos = await reporteDocenteIndividualService.obtenerDatosDocente(
            parseInt(idPeriodo), 
            cedulaDocente
        );

        res.json({
            success: true,
            data: datos
        });

    } catch (error) {
        console.error('Error al obtener datos del docente:', error);
        
        if (error.message.includes('Docente no encontrado')) {
            return res.status(404).json({
                error: 'Docente no encontrado'
            });
        }

        res.status(500).json({
            error: 'Error interno del servidor al obtener los datos del docente'
        });
    }
}

module.exports = {
    generarReporteDocente,
    obtenerDatosDocente
};
