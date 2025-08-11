const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const autoridadesRepository = require('../repositories/autoridadesRepository');

class ReportePromedioItemsService {
    constructor() {
        // Colores del tema - Escala de grises formal
        this.colors = {
            primary: '#2C2C2C',
            secondary: '#4A4A4A',
            accent: '#6B6B6B',
            success: '#333333',
            warning: '#555555',
            light: '#F5F5F5',
            gray: '#999999',
            darkGray: '#444444',
            white: '#FFFFFF',
            border: '#E0E0E0'
        };
    }

    async generarPDF(datosPromedio, periodo, usuarioId) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margins: { top: 120, bottom: 80, left: 50, right: 50 }
                });

                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                // Agregar encabezado
                this.agregarEncabezado(doc, periodo, datosPromedio.estadisticas_generales.tipo_evaluacion);

                // Agregar estadísticas generales
                this.agregarEstadisticasGenerales(doc, datosPromedio.estadisticas_generales);

                // Agregar promedios por tipo
                this.agregarPromediosPorTipo(doc, datosPromedio.promedios_por_tipo);

                // Agregar sección de firmas personalizadas (máx 2) del usuario
                // Nota: el fetch es asíncrono; hacemos una pequeña envoltura para esperar antes de cerrar
                (async () => {
                    try {
                        const autoridades = await autoridadesRepository.obtenerAutoridadesParaFirmas(usuarioId);
                        this.agregarSeccionFirmas(doc, autoridades);
                        doc.end();
                    } catch (e) {
                        console.error('Error obteniendo autoridades para firmas:', e);
                        // Continuar cerrando el doc aunque falle la carga de firmas
                        doc.end();
                    }
                })();
            } catch (error) {
                console.error('Error generando PDF:', error);
                reject(error);
            }
        });
    }

    agregarEncabezado(doc, periodo, tipoEvaluacion) {
        try {
            // Rutas de las imágenes
            const logoPath = path.join(__dirname, '../assets/logo_istla.png');
            const encabezadoPath = path.join(__dirname, '../assets/encabezado.png');

            // Verificar si las imágenes existen
            if (fs.existsSync(encabezadoPath)) {
                // Imagen de encabezado de fondo - estirada a lo ancho de la hoja
                const pageWidth = doc.page.width;
                const margins = 0;
                const encabezadoWidth = pageWidth - (margins * 2);
                doc.image(encabezadoPath, margins, 0, {
                    width: encabezadoWidth,
                    height: 60
                });
            }

            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, 35, 9, { width: 185, height: 45 });
            }

            // Títulos manteniendo el estilo original
            doc.fontSize(16).font('Helvetica-Bold')
                .fillColor('#000000')
                .text('REPORTE DE PROMEDIOS POR ÍTEM', 30, 80, { align: 'center' });

            doc.fontSize(12).font('Helvetica')
                .fillColor('#000000')
                .text(`TIPO DE EVALUACIÓN: ${tipoEvaluacion.toUpperCase()}`, 30, 100, { align: 'center' });

            doc.text(`PERÍODO: ${periodo}`, 30, 120, { align: 'center' });

            doc.fontSize(10)
                .fillColor('#000000')
                .text(`Generado el: ${moment().format('DD/MM/YYYY HH:mm')}`, 30, 140, { align: 'center' });

            doc.moveDown(2);

        } catch (error) {
            console.error('Error al cargar imágenes:', error.message);
            // Continuar sin imágenes - estilo original
            doc.fontSize(16).font('Helvetica-Bold')
                .fillColor('#000000')
                .text('REPORTE DE PROMEDIOS POR ÍTEM', 30, 50, { align: 'center' });

            doc.fontSize(12).font('Helvetica')
                .fillColor('#000000')
                .text(`TIPO DE EVALUACIÓN: ${tipoEvaluacion.toUpperCase()}`, 30, 70, { align: 'center' });

            doc.text(`PERÍODO: ${periodo}`, 30, 90, { align: 'center' });

            doc.fontSize(10)
                .fillColor('#000000')
                .text(`Generado el: ${moment().format('DD/MM/YYYY HH:mm')}`, 30, 110, { align: 'center' });

            doc.moveDown(2);
        }
    }

    agregarEstadisticasGenerales(doc, estadisticas) {
        // Título de la sección
        doc.fontSize(12).font('Helvetica-Bold')
            .fillColor(this.colors.primary)
            .text('ESTADÍSTICAS GENERALES', 70, doc.y);

        doc.moveDown(0.5);

        // Caja con estadísticas principales
        const boxY = doc.y;
        const boxHeight = 70;

        // Fondo gris claro
        doc.rect(50, boxY, doc.page.width - 100, boxHeight)
            .fillAndStroke(this.colors.light, this.colors.border);

        // Métricas con layout mejorado
        const leftCol = 70;
        const rightCol = 320;
        const textY = boxY + 15;

        // Total de preguntas
        doc.fontSize(10).font('Helvetica-Bold')
            .fillColor(this.colors.darkGray)
            .text('TOTAL DE PREGUNTAS', leftCol, textY);

        doc.fontSize(16).font('Helvetica-Bold')
            .fillColor(this.colors.primary)
            .text(estadisticas.total_preguntas.toString(), leftCol, textY + 18);

        // Promedio general
        doc.fontSize(10).font('Helvetica-Bold')
            .fillColor(this.colors.darkGray)
            .text('PROMEDIO GENERAL', rightCol, textY);

        doc.fontSize(16).font('Helvetica-Bold')
            .fillColor(this.colors.primary)
            .text(estadisticas.promedio_general.toString(), rightCol, textY + 18);

        doc.y = boxY + boxHeight + 20;
    }

    agregarPromediosPorTipo(doc, promediosPorTipo) {
        const tipos = {
            actitudinal: {
                titulo: 'PREGUNTAS ACTITUDINALES',
                color: this.colors.darkGray
            },
            conceptual: {
                titulo: 'PREGUNTAS CONCEPTUALES',
                color: this.colors.darkGray
            },
            procedimental: {
                titulo: 'PREGUNTAS PROCEDIMENTALES',
                color: this.colors.darkGray
            }
        };

        // Contador global para la numeración continua
        let numeroPregunta = 1;

        Object.entries(promediosPorTipo).forEach(([tipo, preguntas]) => {
            if (preguntas.length > 0) {
                // Verificar si necesitamos una nueva página
                if (doc.y > doc.page.height - 200) {
                    doc.addPage();
                    doc.y = 50;
                }

                const tipoConfig = tipos[tipo];

                // Título del tipo con diseño formal
                const titleY = doc.y;
                const titleHeight = 30;

                // Fondo del título
                doc.rect(50, titleY, doc.page.width - 100, titleHeight)
                    .fillAndStroke(this.colors.border, this.colors.border);

                // Título
                doc.fontSize(12).font('Helvetica-Bold')
                    .fillColor(tipoConfig.color)
                    .text(tipoConfig.titulo, 70, titleY + 10);

                // Contador de preguntas
                doc.fontSize(10).font('Helvetica')
                    .fillColor(this.colors.gray)
                    .text(`(${preguntas.length} pregunta${preguntas.length > 1 ? 's' : ''})`, doc.page.width - 150, titleY + 10);

                doc.y = titleY + titleHeight + 10;

                // Preguntas con formato mejorado
                preguntas.forEach((pregunta) => {
                    // Verificar espacio para nueva página
                    if (doc.y > doc.page.height - 120) {
                        doc.addPage();
                        doc.y = 50;
                    }

                    const preguntaY = doc.y;

                    // Fondo alternado sutil
                    const bgColor = numeroPregunta % 2 === 0 ? this.colors.white : '#FAFAFA';
                    doc.rect(50, preguntaY, doc.page.width - 100, 50)
                        .fillAndStroke(bgColor, this.colors.border);

                    // Número de pregunta (usando el contador global)
                    doc.fontSize(10).font('Helvetica-Bold')
                        .fillColor(this.colors.darkGray)
                        .text(`${numeroPregunta}.`, 70, preguntaY + 8);

                    // Texto de la pregunta
                    doc.fontSize(10).font('Helvetica-Bold')
                        .fillColor(this.colors.primary)
                        .text(this.truncarTexto(pregunta.texto_pregunta, 100), 85, preguntaY + 8, {
                            width: 400,
                            height: 15
                        });

                    // Métricas en la siguiente línea con sangría
                    const metricsY = preguntaY + 25;

                    doc.fontSize(9).font('Helvetica')
                        .fillColor(this.colors.gray)
                        .text(`Promedio: ${pregunta.promedio} | Total Respuestas: ${pregunta.total_respuestas} | Desviación Estándar: ${pregunta.desviacion_estandar}`,
                            90, metricsY);

                    doc.y = preguntaY + 60;

                    // Incrementar el contador global
                    numeroPregunta++;
                });

                doc.moveDown(1);
            }
        });
    }

    agregarPiePagina(doc) {
        // Línea decorativa
        doc.moveTo(50, doc.page.height - 50)
            .lineTo(doc.page.width - 50, doc.page.height - 50)
            .strokeColor(this.colors.gray)
            .lineWidth(1)
            .stroke();

        // Texto del pie de página
        doc.fontSize(8).font('Helvetica')
            .fillColor(this.colors.gray)
            .text('Reporte generado automáticamente por el Sistema de Evaluación', 50, doc.page.height - 40)
            .text(`Página ${doc.bufferedPageRange().start + 1}`, doc.page.width - 100, doc.page.height - 40);
    }

    // Agregar sección de firmas (hasta 2 autoridades del usuario)
    agregarSeccionFirmas(doc, autoridades = []) {
        if (!Array.isArray(autoridades) || autoridades.length === 0) {
            return; // sin firmas configuradas
        }

        // Usar hasta 2 firmas
        const firmas = autoridades.slice(0, 2);

        const pageWidth = doc.page.width;
        const marginX = 50;
        const availableWidth = pageWidth - (marginX * 2);
        const startY = doc.y + 40;

        // Calculamos posiciones: 1 firma centrada, 2 firmas izquierda/derecha
        const slots = firmas.length === 1
            ? [{ x: marginX + availableWidth / 2 - 100 }]
            : [
                { x: marginX + 30 },
                { x: pageWidth - marginX - 230 }
            ];

        firmas.forEach((firma, idx) => {
            const baseX = slots[idx].x;
            const lineWidth = 200;
            const y = startY;

            // Línea de firma
            doc.moveTo(baseX, y)
                .lineTo(baseX + lineWidth, y)
                .stroke();

            // Nombre
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
            doc.text(firma.nombre_autoridad || '', baseX, y + 8, {
                width: lineWidth,
                align: 'center'
            });

            // Cargo
            doc.fontSize(9).font('Helvetica').fillColor('#000000');
            doc.text((firma.cargo_autoridad || '').toUpperCase(), baseX, y + 22, {
                width: lineWidth,
                align: 'center'
            });
        });
    }

    // Métodos auxiliares
    obtenerColorPromedio(promedio) {
        // Mantenemos tonos grises para formal
        if (promedio >= 4.5) return this.colors.primary;
        if (promedio >= 3.5) return this.colors.secondary;
        return this.colors.accent;
    }

    truncarTexto(texto, maxLength) {
        if (texto.length <= maxLength) return texto;
        return texto.substring(0, maxLength) + '...';
    }
}

module.exports = new ReportePromedioItemsService();