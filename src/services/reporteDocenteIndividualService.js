const PDFDocument = require('pdfkit');
const moment = require('moment');
const path = require('path');
const fs = require('fs');
const reporteDocenteIndividualRepository = require('../repositories/reporteDocenteIndividualRepository');
const autoridadesService = require('./autoridadesService');

class ReporteDocenteIndividualService {

    // Obtener datos completos del docente para el reporte
    async obtenerDatosDocente(idPeriodo, cedulaDocente) {
        try {
            // Obtener información básica del docente
            const docenteInfo = await reporteDocenteIndividualRepository.obtenerInformacionDocente(cedulaDocente);

            if (!docenteInfo) {
                throw new Error('Docente no encontrado');
            }

            const idDocente = docenteInfo.id_docente;


            // Obtener información del período
            const periodoInfo = await reporteDocenteIndividualRepository.obtenerInformacionPeriodo(idPeriodo);

            if (!periodoInfo) {
                throw new Error('Período no encontrado');
            }

            // Obtener evaluaciones por tipo
            const evaluaciones = {
                autoevaluacion: null,
                heteroevaluacion: null,
                coevaluacion: null,
                autoridades: null
            };

            // Autoevaluación
            const autoeval = await reporteDocenteIndividualRepository.obtenerAutoevaluaciones(idPeriodo, idDocente, cedulaDocente);
            if (autoeval.length > 0) {
                evaluaciones.autoevaluacion = {
                    promedio: parseFloat(autoeval[0].promedio_calificacion) || 0,
                    total: autoeval[0].total_evaluaciones || 0,
                    fecha: autoeval[0].fecha_fin,
                    asignatura: autoeval[0].nombre_asignatura
                };
            }

            // Heteroevaluación
            const heteroeval = await reporteDocenteIndividualRepository.obtenerHeteroevaluaciones(idPeriodo, idDocente, cedulaDocente);
            if (heteroeval.length > 0) {
                // Calcular promedio general de todas las heteroevaluaciones
                const promedioTotal = heteroeval.reduce((sum, h) => sum + (parseFloat(h.promedio_calificacion) || 0), 0);
                const totalEvaluaciones = heteroeval.reduce((sum, h) => sum + (h.total_evaluaciones || 0), 0);

                evaluaciones.heteroevaluacion = {
                    promedio: promedioTotal / heteroeval.length,
                    total: totalEvaluaciones,
                    asignaturas: heteroeval.map(h => h.nombre_asignatura).join(', ')
                };
            }

            // Coevaluación
            const coeval = await reporteDocenteIndividualRepository.obtenerCoevaluaciones(idPeriodo, idDocente, cedulaDocente);
            if (coeval.length > 0) {
                // Calcular promedio general de todas las coevaluaciones
                const promedioTotal = coeval.reduce((sum, c) => sum + (parseFloat(c.promedio_calificacion) || 0), 0);
                const totalEvaluaciones = coeval.reduce((sum, c) => sum + (c.total_evaluaciones || 0), 0);

                evaluaciones.coevaluacion = {
                    promedio: promedioTotal / coeval.length,
                    total: totalEvaluaciones,
                    asignaturas: coeval.map(c => c.nombre_asignatura).join(', ')
                };
            }

            // Evaluaciones de autoridades
            const autoridades = await reporteDocenteIndividualRepository.obtenerEvaluacionesAutoridades(idPeriodo, idDocente, cedulaDocente);

            if (autoridades.length > 0) {
                // Calcular promedio general de todas las evaluaciones de autoridades
                const promedioTotal = autoridades.reduce((sum, a) => sum + (parseFloat(a.promedio_calificacion) || 0), 0);
                const totalEvaluaciones = autoridades.reduce((sum, a) => sum + (a.total_evaluaciones || 0), 0);

                evaluaciones.autoridades = {
                    promedio: promedioTotal / autoridades.length,
                    total: totalEvaluaciones,
                    asignaturas: autoridades.map(a => a.nombre_asignatura).join(', '),
                    observaciones: autoridades.map(a => a.observaciones).filter(obs => obs && obs.trim()).join('; ')
                };
            } else {
                // Sin evaluaciones de autoridades
            }

            // Calcular promedio ponderado
            const promedios = this.calcularPromediosPonderados(evaluaciones);

            return {
                docente: {
                    nombre: docenteInfo.nombre_completo,
                    cedula: docenteInfo.cedula
                },
                periodo: periodoInfo.descripcion,
                evaluaciones,
                promedios
            };

        } catch (error) {
            console.error('Error al obtener datos del docente:', error);
            throw error;
        }
    }

    // Calcular promedios ponderados
    calcularPromediosPonderados(evaluaciones) {
        const ponderaciones = {
            autoevaluacion: 0.10,    // 10%
            heteroevaluacion: 0.40,  // 40%
            coevaluacion: 0.30,      // 30%
            autoridades: 0.20        // 20%
        };

        let promedioTotal = 0;
        let pesoTotal = 0;
        const detalles = {};

        // Autoevaluación
        if (evaluaciones.autoevaluacion && evaluaciones.autoevaluacion.promedio !== undefined) {
            const promedio = evaluaciones.autoevaluacion.promedio || 0;
            detalles.autoevaluacion = {
                promedio: promedio,
                ponderacion: ponderaciones.autoevaluacion,
                contribucion: promedio * ponderaciones.autoevaluacion
            };
            promedioTotal += detalles.autoevaluacion.contribucion;
            pesoTotal += ponderaciones.autoevaluacion;
        }

        // Heteroevaluación
        if (evaluaciones.heteroevaluacion && evaluaciones.heteroevaluacion.promedio !== undefined) {
            const promedio = evaluaciones.heteroevaluacion.promedio || 0;
            detalles.heteroevaluacion = {
                promedio: promedio,
                ponderacion: ponderaciones.heteroevaluacion,
                contribucion: promedio * ponderaciones.heteroevaluacion
            };
            promedioTotal += detalles.heteroevaluacion.contribucion;
            pesoTotal += ponderaciones.heteroevaluacion;
        }

        // Coevaluación
        if (evaluaciones.coevaluacion && evaluaciones.coevaluacion.promedio !== undefined) {
            const promedio = evaluaciones.coevaluacion.promedio || 0;
            detalles.coevaluacion = {
                promedio: promedio,
                ponderacion: ponderaciones.coevaluacion,
                contribucion: promedio * ponderaciones.coevaluacion
            };
            promedioTotal += detalles.coevaluacion.contribucion;
            pesoTotal += ponderaciones.coevaluacion;
        }

        // Evaluación de autoridades
        if (evaluaciones.autoridades && evaluaciones.autoridades.promedio !== undefined) {
            const promedio = evaluaciones.autoridades.promedio || 0;
            detalles.autoridades = {
                promedio: promedio,
                ponderacion: ponderaciones.autoridades,
                contribucion: promedio * ponderaciones.autoridades
            };
            promedioTotal += detalles.autoridades.contribucion;
            pesoTotal += ponderaciones.autoridades;
        }

        return {
            promedioFinal: promedioTotal, // Ya está calculado correctamente con las ponderaciones
            detalles
        };
    }

    // Generar PDF del reporte
    async generarReportePDF(idPeriodo, cedulaDocente, usuarioId = null) {
        try {
            const datos = await this.obtenerDatosDocente(idPeriodo, cedulaDocente);

            // Obtener firmas de autoridades si se proporciona usuarioId
            let autoridades = [];
            if (usuarioId) {
                try {
                    const resultadoAutoridades = await autoridadesService.listarAutoridades(usuarioId);
                    autoridades = resultadoAutoridades.data || [];
                } catch (error) {
                    console.warn('No se pudieron obtener las autoridades para firmas:', error.message);
                }
            }

            if (!datos || !datos.docente) {
                throw new Error('No se encontraron datos del docente');
            }

            // Verificar si hay al menos una evaluación (ahora todos son objetos)
            const tieneEvaluaciones =
                (datos.evaluaciones && (
                    datos.evaluaciones.autoevaluacion ||
                    datos.evaluaciones.heteroevaluacion ||
                    datos.evaluaciones.coevaluacion ||
                    datos.evaluaciones.autoridades
                )) || false;

            if (!tieneEvaluaciones) {
                throw new Error('No se encontraron evaluaciones para este docente en el período especificado');
            }

            return new Promise((resolve, reject) => {
                const chunks = [];
                const doc = new PDFDocument({ margin: 50 });

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(chunks);
                    resolve(pdfBuffer);
                });

                doc.on('error', reject);

                // Agregar encabezado con imágenes usando el mismo formato que otros reportes
                const logoPath = path.join(__dirname, '../assets/logo_istla.png');
                const encabezadoPath = path.join(__dirname, '../assets/encabezado.png');

                // Verificar si las imágenes existen
                const logoExists = fs.existsSync(logoPath);
                const encabezadoExists = fs.existsSync(encabezadoPath);

                if (encabezadoExists) {
                    // Imagen de encabezado de fondo - estirada a lo ancho de la hoja
                    const pageWidth = doc.page.width;
                    const margins = 0;
                    const encabezadoWidth = pageWidth - (margins * 2);
                    doc.image(encabezadoPath, margins, 0, {
                        width: encabezadoWidth,
                        height: 60
                    });
                }

                if (logoExists) {
                    // Logo sobrepuesto en la esquina superior izquierda
                    doc.image(logoPath, 35, 9, { width: 185, height: 45 });
                }

                // Título principal (movido más abajo para dar espacio a las imágenes)
                doc.fontSize(16).font('Helvetica-Bold');
                doc.text('REPORTE INDIVIDUAL DE EVALUACIÓN DOCENTE', 50, 105, { align: 'center' });

                // PERÍODO en mayúsculas
                doc.fontSize(12).font('Helvetica');
                doc.text(`PERÍODO: ${datos.periodo}`, 50, 125, { align: 'center' });

                // Información del docente
                doc.fontSize(14).font('Helvetica-Bold')
                    .text('INFORMACIÓN DEL DOCENTE', 50, 150)
                    .fontSize(12).font('Helvetica')
                    .text(`Nombre: ${datos.docente.nombre}`, 50, 170)
                    .text(`Cédula: ${datos.docente.cedula}`, 50, 190)
                    .text(`Fecha de generación: ${moment().format('DD/MM/YYYY HH:mm')}`, 50, 210);

                // Generar contenido del PDF
                const yAfterTabla = this.generarTablaPuntajes(doc, datos);
                const yAfterEscala = this.generarEscalaValorativa(doc, yAfterTabla + 20);
                const yAfterObservaciones = this.generarObservaciones(doc, datos, yAfterEscala + 18);
                // Ajustar cursor para que las firmas respeten el espacio tras observaciones
                doc.y = yAfterObservaciones + 30; // un poco más de separación

                // Agregar firmas si hay autoridades
                if (autoridades.length > 0) {
                    this.agregarSeccionFirmas(doc, autoridades);
                }

                doc.end();
            });

        } catch (error) {
            console.error('Error al generar PDF:', error);
            throw error;
        }
    }

    // Generar encabezado del PDF
    generarEncabezadoPDF(doc, datos) {
        // Logo y encabezado
        const logoPath = path.join(__dirname, '../assets/logo_istla.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 50, { width: 80 });
        }

        doc.fontSize(16).font('Helvetica-Bold')
            .text('INSTITUTO SUPERIOR TECNOLÓGICO LUIS ARBOLEDA MARTÍNEZ', 150, 60)
            .fontSize(12).font('Helvetica')
            .text('REPORTE INDIVIDUAL DE EVALUACIÓN DOCENTE', 150, 80)
            .text(`Período: ${datos.periodo}`, 150, 100);

        // Información del docente
        doc.fontSize(14).font('Helvetica-Bold')
            .text('INFORMACIÓN DEL DOCENTE', 50, 150);

        doc.fontSize(12).font('Helvetica')
            .text(`Nombre: ${datos.docente.nombre}`, 50, 170)
            .text(`Cédula: ${datos.docente.cedula}`, 50, 190)
            .text(`Fecha de generación: ${moment().format('DD/MM/YYYY HH:mm')}`, 50, 210);

        return 250;
    }

    // Generar tabla de puntajes
    generarTablaPuntajes(doc, datos) {
        // Encabezado de sección más compacto
        doc.fontSize(12).font('Helvetica-Bold')
            .text('RESUMEN DE EVALUACIONES', 50, 240);

        let yPos = 260;

        // Encabezados de tabla (alineados a 460px de ancho total)
        const tableHeaders = ['Tipo de Evaluación', 'Promedio', 'Ponderación', 'Contribución'];
        const columnWidths = [200, 80, 80, 100]; // total 460
        let xPosition = 50;

        const headerHeight = 22;
        const rowHeight = 18;

        doc.fontSize(9).font('Helvetica-Bold');
        tableHeaders.forEach((header, index) => {
            doc.rect(xPosition, yPos, columnWidths[index], headerHeight).stroke();
            doc.text(header, xPosition + 5, yPos + 6, { width: columnWidths[index] - 10 });
            xPosition += columnWidths[index];
        });

        yPos += headerHeight;

        // Filas de datos
        const tiposEvaluacion = [
            { key: 'autoevaluacion', nombre: 'Autoevaluación' },
            { key: 'heteroevaluacion', nombre: 'Heteroevaluación (Estudiantes)' },
            { key: 'coevaluacion', nombre: 'Coevaluación (Docentes)' },
            { key: 'autoridades', nombre: 'Evaluación Autoridades' }
        ];

        doc.fontSize(9).font('Helvetica');
        tiposEvaluacion.forEach(tipo => {
            const detalle = datos.promedios.detalles[tipo.key];
            if (detalle) {
                xPosition = 50;

                // Tipo de evaluación
                doc.rect(xPosition, yPos, columnWidths[0], rowHeight).stroke();
                doc.text(tipo.nombre, xPosition + 5, yPos + 5, { width: columnWidths[0] - 10 });
                xPosition += columnWidths[0];

                // Promedio
                doc.rect(xPosition, yPos, columnWidths[1], rowHeight).stroke();
                doc.text(detalle.promedio.toFixed(2), xPosition + 5, yPos + 5, { width: columnWidths[1] - 10, align: 'center' });
                xPosition += columnWidths[1];

                // Ponderación
                doc.rect(xPosition, yPos, columnWidths[2], rowHeight).stroke();
                doc.text(`${(detalle.ponderacion * 100).toFixed(0)}%`, xPosition + 5, yPos + 5, { width: columnWidths[2] - 10, align: 'center' });
                xPosition += columnWidths[2];

                // Contribución
                doc.rect(xPosition, yPos, columnWidths[3], rowHeight).stroke();
                doc.text(detalle.contribucion.toFixed(2), xPosition + 5, yPos + 5, { width: columnWidths[3] - 10, align: 'center' });

                yPos += rowHeight;
            }
        });

        // Fila del promedio final integrada en la tabla
        xPosition = 50;
        
        // Fila destacada para el promedio final (una sola celda que abarca toda la tabla)
        const finalRowHeight = 25;
        const totalWidth = columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3];
        doc.rect(xPosition, yPos, totalWidth, finalRowHeight).stroke();
        doc.fontSize(11).font('Helvetica-Bold')
           .text(`PROMEDIO FINAL PONDERADO: ${(datos.promedios.promedioFinal).toFixed(2)}/100`, xPosition + 5, yPos + 8, { 
               width: totalWidth - 10, 
               align: 'center' 
           });

        // Devolver la última posición usada para continuar el contenido
        return yPos + finalRowHeight + 10;
    }

    // Generar sección de observaciones
    generarObservaciones(doc, datos, startY = 400) {
        // Si estamos muy abajo, crear una nueva página para evitar solapamientos
        let yPosition = startY;
        const pageBottom = doc.page.height - 200; // margen inferior más amplio
        if (yPosition > pageBottom) {
            doc.addPage();
            yPosition = 50;
        }

        doc.fontSize(12).font('Helvetica-Bold')
            .text('OBSERVACIONES DE AUTORIDADES', 50, yPosition);

        yPosition += 20;

        // Verificar si hay observaciones de autoridades (string agregada)
        const obsAutoridades = datos.evaluaciones && datos.evaluaciones.autoridades && datos.evaluaciones.autoridades.observaciones
            ? String(datos.evaluaciones.autoridades.observaciones).trim()
            : '';

        // Crear un cuadro para las observaciones
        const cuadroWidth = 460; // igual ancho que la tabla de resumen
        const cuadroHeight = 50;

        // Dibujar el cuadro
        doc.rect(50, yPosition, cuadroWidth, cuadroHeight).stroke();

        if (obsAutoridades.length > 0) {
            doc.fontSize(9).font('Helvetica')
                .text(obsAutoridades, 55, yPosition + 8, {
                    width: cuadroWidth - 10,
                    height: cuadroHeight - 16,
                    ellipsis: true
                });
        } else {
            doc.fontSize(9).font('Helvetica-Oblique')
                .text('Sin observaciones', 55, yPosition + 18, {
                    width: cuadroWidth - 10,
                    align: 'left'
                });
        }

        return yPosition + cuadroHeight;
    }

    // Generar tabla de escala valorativa
    generarEscalaValorativa(doc, startY) {
        let yPosition = startY;
        const pageBottom = doc.page.height - 150;

        if (yPosition > pageBottom) {
            doc.addPage();
            yPosition = 50;
        }

        doc.fontSize(11).font('Helvetica-Bold')
            .text('ESCALA VALORATIVA', 50, yPosition);

        yPosition += 20;

        // Definir rangos y etiquetas
        const escalas = [
            { rango: '0-20', etiqueta: 'Deficiente', color: '#ff4444' },
            { rango: '21-30', etiqueta: 'Regular', color: '#ff8800' },
            { rango: '31-50', etiqueta: 'Buena', color: '#ffcc00' },
            { rango: '51-85', etiqueta: 'Muy buena', color: '#88cc00' },
            { rango: '86-100', etiqueta: 'Excelente', color: '#44cc44' }
        ];

        // Configuración de la tabla
        const cellWidth = 92; // 460 / 5 para coincidir con el ancho del resumen
        const cellHeight = 22;
        let xPos = 50;

        // Dibujar encabezados y celdas
        escalas.forEach((escala, index) => {
            // Celda del rango
            doc.rect(xPos, yPosition, cellWidth, cellHeight).stroke();
            doc.fontSize(8.5).font('Helvetica-Bold');
            doc.text(escala.rango, xPos + 5, yPosition + 6, {
                width: cellWidth - 10,
                align: 'center'
            });

            // Celda de la etiqueta
            doc.rect(xPos, yPosition + cellHeight, cellWidth, cellHeight).stroke();
            doc.fontSize(8.5).font('Helvetica');
            doc.text(escala.etiqueta, xPos + 5, yPosition + cellHeight + 6, {
                width: cellWidth - 10,
                align: 'center'
            });

            xPos += cellWidth;
        });

        return yPosition + (cellHeight * 2) + 14;
    }

    // Agregar sección de firmas
    agregarSeccionFirmas(doc, autoridades) {
        // Verificar si necesitamos nueva página
        if (doc.y > doc.page.height - 150) {
            doc.addPage();
        }

        // Dejar más espacio en blanco para la firma
        const startY = doc.y + 60;
        const pageWidth = doc.page.width;
        const marginX = 50;
        const availableWidth = pageWidth - (marginX * 2);

        // Filtrar solo autoridades activas
        const autoridadesFiltradas = autoridades.filter(a =>
            a.estado === 'ACTIVO' && a.nombre_autoridad && a.cargo_autoridad
        );

        if (autoridadesFiltradas.length === 0) {
            return;
        }

        // Usar hasta 2 firmas
        const firmas = autoridadesFiltradas.slice(0, 2);

        if (firmas.length === 1) {
            const centerX = marginX + (availableWidth / 2);
            // Línea
            doc.moveTo(centerX - 100, startY)
                .lineTo(centerX + 100, startY)
                .stroke();
            // Nombre
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text(firmas[0].nombre_autoridad || '', marginX, startY + 8, { width: availableWidth, align: 'center' });
            // Cargo
            doc.fontSize(9).font('Helvetica');
            doc.text((firmas[0].cargo_autoridad || '').toUpperCase(), marginX, startY + 22, { width: availableWidth, align: 'center' });
            return;
        }

        // Dos firmas: izquierda y derecha
        const leftX = marginX + 10;
        const rightX = pageWidth - marginX - 210;
        const lineWidth = 220; // líneas más largas

        // Firma izquierda
        doc.moveTo(leftX, startY)
            .lineTo(leftX + lineWidth, startY)
            .stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text(firmas[0].nombre_autoridad || '', leftX, startY + 8, { width: lineWidth, align: 'center' });
        doc.fontSize(9).font('Helvetica');
        doc.text((firmas[0].cargo_autoridad || '').toUpperCase(), leftX, startY + 24, { width: lineWidth, align: 'center' });

        // Firma derecha
        doc.moveTo(rightX, startY)
            .lineTo(rightX + lineWidth, startY)
            .stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text(firmas[1].nombre_autoridad || '', rightX, startY + 8, { width: lineWidth, align: 'center' });
        doc.fontSize(9).font('Helvetica');
        doc.text((firmas[1].cargo_autoridad || '').toUpperCase(), rightX, startY + 24, { width: lineWidth, align: 'center' });
    }
}

module.exports = new ReporteDocenteIndividualService();
