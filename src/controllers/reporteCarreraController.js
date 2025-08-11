const reporteCarreraService = require('../services/reporteCarreraService');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fs = require('fs');
const path = require('path');

// Función para convertir nombre a formato título (primera letra mayúscula)
function formatearNombreATitulo(nombre) {
    // Convertir todo a minúsculas primero
    const nombreMinuscula = nombre.toLowerCase();

    // Dividir en palabras y capitalizar cada una
    return nombreMinuscula.split(/\s+/).map(palabra => {
        if (palabra.length === 0) return palabra;
        return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    }).join(' ');
}

// Función para obtener solo el nombre sin título
function obtenerNombreSinTitulo(nombreCompleto) {
    // Remover "Ing." si está presente al inicio
    return nombreCompleto.replace(/^Ing\.\s*/i, '').trim();
}


// Obtener carreras activas
async function obtenerCarrerasActivas(req, res) {
    try {
        const idPeriodo = req.query.idPeriodo || null;
        const carreras = await reporteCarreraService.obtenerCarrerasActivas(idPeriodo);
        res.json({
            success: true,
            data: carreras
        });
    } catch (error) {
        console.error('Error en obtenerCarrerasActivas controller:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener carreras activas',
            error: error.message
        });
    }
}

// Obtener periodos
async function obtenerPeriodos(req, res) {
    try {
        const periodos = await reporteCarreraService.obtenerPeriodos();
        res.json({
            success: true,
            data: periodos
        });
    } catch (error) {
        console.error('Error en obtenerPeriodos controller:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener periodos',
            error: error.message
        });
    }
}

// Generar reporte de carrera
async function generarReporteCarrera(req, res) {
    try {
        const { idCarrera, idPeriodo, numeroInicioOficio } = req.body;

        if (!idCarrera || !idPeriodo || !numeroInicioOficio) {
            return res.status(400).json({
                success: false,
                message: 'ID de carrera, periodo y número de inicio de oficio son requeridos'
            });
        }

        // Obtener datos del reporte
        const datos = await reporteCarreraService.obtenerDatosReporteCarrera(idCarrera, idPeriodo);

        if (!datos.docentes || datos.docentes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No se encontraron docentes para la carrera y periodo especificados'
            });
        }

        // Generar el documento Word con el número de inicio
        const wordBuffer = await generarDocumentoWord(datos, numeroInicioOficio);

        // Configurar headers para descarga
        const fechaActual = new Date().toISOString().split('T')[0];
        const nombreArchivo = `Reporte_Evaluacion_${datos.carrera.nombre_carrera.replace(/\s+/g, '_')}_${fechaActual}.docx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
        res.setHeader('Content-Length', wordBuffer.length);

        res.send(wordBuffer);

    } catch (error) {
        console.error('Error en generarReporteCarrera controller:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar reporte',
            error: error.message
        });
    }
}

// Generar documento Word
async function generarDocumentoWord(datos, numeroInicioOficio) {
    try {
        // Ruta de la plantilla Word (debes crear este archivo)
        const templatePath = path.join(__dirname, '../templates/plantilla_reporte.docx');

        // Verificar si existe la plantilla
        if (!fs.existsSync(templatePath)) {
            throw new Error('Plantilla Word no encontrada. Asegúrate de crear el archivo: ' + templatePath);
        }

        // Leer la plantilla
        const content = fs.readFileSync(templatePath, 'binary');
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        // Preparar datos para la plantilla
        const fechaActual = new Date().toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        const añoActual = new Date().getFullYear();

        const datosPlantilla = {
            fecha: fechaActual,
            carrera: datos.carrera.nombre_carrera,
            carrera_upper: datos.carrera.nombre_carrera.toUpperCase(),
            periodo: datos.periodo.descripcion,
            periodo_upper: datos.periodo.descripcion.toUpperCase(),
            docentes: datos.docentes.map((docente, index) => ({
                // nombre_completo siempre en mayúsculas
                nombre_completo: docente.nombre_completo.toUpperCase(),
                // nombre_con_titulo en formato título con "Ing." al inicio
                nombre_con_titulo: `Ing. ${formatearNombreATitulo(obtenerNombreSinTitulo(docente.nombre_completo))}`,
                auto_ponderada: docente.evaluaciones.auto_ponderada.toFixed(2),
                hetero_ponderada: docente.evaluaciones.hetero_ponderada.toFixed(2),
                co_ponderada: docente.evaluaciones.co_ponderada.toFixed(2),
                autoridades_ponderada: docente.evaluaciones.autoridades_ponderada.toFixed(2),
                total_ponderado: docente.evaluaciones.total_ponderado.toFixed(2),
                // Generar número de oficio secuencial
                numero_oficio: `ISTLA-VR-${añoActual}-${numeroInicioOficio + index}-O`
            }))
        };

        // Renderizar el documento
        doc.render(datosPlantilla);

        // Generar el buffer del documento
        const buffer = doc.getZip().generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
        });

        return buffer;

    } catch (error) {
        console.error('Error generando documento Word:', error);
        throw error;
    }
}

module.exports = {
    obtenerCarrerasActivas,
    obtenerPeriodos,
    generarReporteCarrera
};