// services/reportesCalificacionCarreraService.js
const reportesCalificacionCarreraRepository = require('../repositories/reportesCalificacionCarreraRepository');
const autoridadesRepository = require('../repositories/autoridadesRepository');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

class ReportesCalificacionCarreraService {

    // Obtener datos del reporte filtrado por carrera del coordinador
    async obtenerDatosReporteCoordinador(idPeriodo, cedulaCoordinador) {
        try {
            // Obtener carrera del coordinador
            const coordinadorData = await reportesCalificacionCarreraRepository.obtenerCarreraCoordinador(cedulaCoordinador);
            if (!coordinadorData) {
                throw new Error('No se encontró la carrera del coordinador');
            }

            // Obtener docentes de la carrera
            const docentes = await reportesCalificacionCarreraRepository.obtenerDocentesConCalificaciones(
                coordinadorData.id_carrera,
                idPeriodo
            );

            // Obtener calificaciones para cada docente
            const docentesConCalificaciones = await Promise.all(
                docentes.map(async (docente) => {
                    const calificaciones = await reportesCalificacionCarreraRepository.obtenerCalificacionesDocente(
                        docente.id_distributivo,
                        docente.id_docente_distributivo,
                        idPeriodo
                    );

                    // Calcular promedio ponderado
                    const promedioPonderado = this.calcularPromedioPonderado(calificaciones);

                    return {
                        ...docente,
                        ...calificaciones,
                        promedio_ponderado: promedioPonderado
                    };
                })
            );

            return {
                carrera: coordinadorData,
                docentes: docentesConCalificaciones
            };
        } catch (error) {
            console.error('Error en obtenerDatosReporteCoordinador:', error);
            throw error;
        }
    }

    // Obtener datos del reporte por carrera específica (para administradores)
    async obtenerDatosReportePorCarrera(idPeriodo, idCarrera) {
        try {
            // Obtener información de la carrera
            const carreraInfo = await reportesCalificacionCarreraRepository.obtenerInformacionCarrera(idCarrera);
            if (!carreraInfo) {
                throw new Error('No se encontró la carrera especificada');
            }

            // Obtener docentes de la carrera
            const docentes = await reportesCalificacionCarreraRepository.obtenerDocentesConCalificaciones(
                idCarrera,
                idPeriodo
            );

            // Obtener calificaciones para cada docente
            const docentesConCalificaciones = await Promise.all(
                docentes.map(async (docente) => {
                    const calificaciones = await reportesCalificacionCarreraRepository.obtenerCalificacionesDocente(
                        docente.id_distributivo,
                        docente.id_docente_distributivo,
                        idPeriodo
                    );

                    // Calcular promedio ponderado
                    const promedioPonderado = this.calcularPromedioPonderado(calificaciones);

                    return {
                        ...docente,
                        ...calificaciones,
                        promedio_ponderado: promedioPonderado
                    };
                })
            );

            return {
                carrera: carreraInfo,
                docentes: docentesConCalificaciones
            };
        } catch (error) {
            console.error('Error en obtenerDatosReportePorCarrera:', error);
            throw error;
        }
    }

    // Obtener datos del reporte de todas las carreras (para administradores)
    async obtenerDatosReporteTodasCarreras(idPeriodo) {
        try {
            // Obtener todos los docentes con sus carreras
            const docentes = await reportesCalificacionCarreraRepository.obtenerTodosDocentesConCalificaciones(idPeriodo);

            // Obtener calificaciones para cada docente
            const docentesConCalificaciones = await Promise.all(
                docentes.map(async (docente) => {
                    const calificaciones = await reportesCalificacionCarreraRepository.obtenerCalificacionesDocente(
                        docente.id_distributivo,
                        docente.id_docente_distributivo,
                        idPeriodo
                    );

                    // Calcular promedio ponderado
                    const promedioPonderado = this.calcularPromedioPonderado(calificaciones);

                    return {
                        ...docente,
                        ...calificaciones,
                        promedio_ponderado: promedioPonderado
                    };
                })
            );

            // Agrupar por carrera
            const docentesPorCarrera = this.agruparDocentesPorCarrera(docentesConCalificaciones);

            return docentesPorCarrera;
        } catch (error) {
            console.error('Error en obtenerDatosReporteTodasCarreras:', error);
            throw error;
        }
    }

    // Calcular promedio ponderado
    calcularPromedioPonderado(calificaciones) {
        const { autoevaluacion, heteroevaluacion, coevaluacion, evaluacion_autoridades } = calificaciones;

        // Ponderaciones: auto(10%), hetero(40%), coe(30%), autoridades(20%)
        const ponderaciones = {
            auto: 0.10,
            hetero: 0.40,
            coe: 0.30,
            autoridades: 0.20
        };

        const promedio = (
            (autoevaluacion * ponderaciones.auto) +
            (heteroevaluacion * ponderaciones.hetero) +
            (coevaluacion * ponderaciones.coe) +
            (evaluacion_autoridades * ponderaciones.autoridades)
        );

        return Math.round(promedio * 100) / 100; // Redondear a 2 decimales
    }

    // Agrupar docentes por carrera
    agruparDocentesPorCarrera(docentes) {
        const grupos = {};

        docentes.forEach(docente => {
            const carreraNombre = docente.nombre_carrera;
            if (!grupos[carreraNombre]) {
                grupos[carreraNombre] = {
                    id_carrera: docente.id_carrera,
                    nombre_carrera: carreraNombre,
                    docentes: []
                };
            }
            grupos[carreraNombre].docentes.push(docente);
        });

        return grupos;
    }

    // Generar PDF del reporte por carrera específica
    async generarPDFReportePorCarrera(idPeriodo, idCarrera, usuarioId) {
        try {
            const datos = await this.obtenerDatosReportePorCarrera(idPeriodo, idCarrera);
            const periodo = await reportesCalificacionCarreraRepository.obtenerInformacionPeriodo(idPeriodo);
            const autoridades = await autoridadesRepository.obtenerAutoridadesParaFirmas(usuarioId);

            if (datos.docentes.length === 0) {
                throw new Error('No se encontraron docentes para el período y carrera seleccionada');
            }

            // Crear estructura para PDF
            const datosParaPDF = {
                [datos.carrera.nombre_carrera]: {
                    id_carrera: datos.carrera.id_carrera,
                    nombre_carrera: datos.carrera.nombre_carrera,
                    docentes: datos.docentes
                }
            };

            const pdfBuffer = await this.crearPDF(datosParaPDF, periodo, autoridades, false);
            return pdfBuffer;
        } catch (error) {
            console.error('Error en generarPDFReportePorCarrera:', error);
            throw error;
        }
    }

    // Generar PDF del reporte de todas las carreras
    async generarPDFReporteTodasCarreras(idPeriodo, usuarioId) {
        try {
            const datosParaPDF = await this.obtenerDatosReporteTodasCarreras(idPeriodo);
            const periodo = await reportesCalificacionCarreraRepository.obtenerInformacionPeriodo(idPeriodo);
            const autoridades = await autoridadesRepository.obtenerAutoridadesParaFirmas(usuarioId);

            if (Object.keys(datosParaPDF).length === 0) {
                throw new Error('No se encontraron docentes para el período seleccionado');
            }

            // Firmas configuradas por el usuario autenticado
            const pdfBuffer = await this.crearPDF(datosParaPDF, periodo, autoridades, false);
            return pdfBuffer;
        } catch (error) {
            console.error('Error en generarPDFReporteTodasCarreras:', error);
            throw error;
        }
    }

    // Función para capitalizar texto
    capitalizarTexto(texto) {
        if (!texto || typeof texto !== 'string') return '—';
        return texto
            .toLowerCase()
            .split(' ')
            .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
            .join(' ');
    }

    // Crear PDF
    async crearPDF(datosAgrupados, periodo, autoridades, soloVicerrectora = false) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    layout: 'portrait',
                    margins: { top: 120, bottom: 80, left: 30, right: 30 }
                });

                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(buffers);
                    resolve(pdfBuffer);
                });

                // Agregar encabezado de la primera página (CON tablas)
                this.agregarEncabezado(doc, periodo, true); // true = primera página
                let primerContenido = true;

                // Iterar por cada carrera
                Object.keys(datosAgrupados).forEach((carrera, index) => {
                    const datosCarrera = datosAgrupados[carrera];

                    if (doc.y > doc.page.height - 200) {
                        doc.addPage();
                        this.agregarEncabezado(doc, periodo, false); // false = NO es primera página
                    }

                    // Calcular startX para alinear con la tabla
                    const columnWidths = [20, 130, 50, 80, 80, 70, 60, 30];
                    const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
                    const startX = (doc.page.width - totalWidth) / 2;

                    // Título de la carrera alineado con la tabla
                    doc.fontSize(12).font('Helvetica-Bold');
                    doc.text(`CARRERA: ${this.capitalizarTexto(carrera)}`, startX, doc.y + (primerContenido ? 0 : 20));
                    doc.moveDown(1);

                    // Crear tabla de docentes
                    this.crearTablaDocentes(doc, datosCarrera.docentes, periodo);
                    primerContenido = false;
                });

                // Agregar firmas
                this.agregarSeccionFirmas(doc, autoridades, soloVicerrectora);
                doc.end();

            } catch (error) {
                reject(error);
            }
        });
    }

    // Agregar encabezado
    agregarEncabezado(doc, periodo, esPrimeraPagina = false) {
        try {
            // Rutas de las imágenes
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
                doc.image(logoPath, 35, 9, { width: 185, height: 45 });
            }

            // Títulos
            doc.fontSize(16).font('Helvetica-Bold');
            doc.text('REPORTE DE CALIFICACIONES POR CARRERA', 30, 80, { align: 'center' });

            doc.fontSize(12).font('Helvetica');
            doc.text(`PERÍODO: ${periodo ? periodo.descripcion : 'No especificado'}`, 30, 100, { align: 'center' });

            doc.fontSize(10);
            doc.text(`Generado el: ${moment().format('DD/MM/YYYY HH:mm')}`, 30, 115, { align: 'center' });

            // Solo agregar tablas si es la primera página
            if (esPrimeraPagina) {
                // Tablas de ponderaciones y escala valorativa en la misma fila
                this.agregarTablasCompactasEncabezado(doc);
                // Más separación antes de la carrera
                doc.y += 20;
            } else {
                // En páginas siguientes, solo agregar separación básica
                doc.y += 15;
            }

        } catch (error) {
            console.error('Error al cargar imágenes:', error.message);
            // Continuar sin imágenes
            doc.fontSize(16).font('Helvetica-Bold');
            doc.text('REPORTE DE CALIFICACIONES POR CARRERA', 30, 50, { align: 'center' });
            doc.fontSize(12).font('Helvetica');
            doc.text(`PERÍODO: ${periodo ? periodo.descripcion : 'No especificado'}`, 30, 70, { align: 'center' });
            doc.fontSize(10);
            doc.text(`Generado el: ${moment().format('DD/MM/YYYY HH:mm')}`, 30, 85, { align: 'center' });

            // Solo agregar tablas si es la primera página
            if (esPrimeraPagina) {
                this.agregarTablasCompactasEncabezado(doc);
                doc.y += 20;
            } else {
                doc.y += 15;
            }
        }
    }

    // NUEVO: Tablas compactas de ponderaciones y escala valorativa en la misma fila
    agregarTablasCompactasEncabezado(doc) {
        const startX = 38;
        const startY = doc.y + 25;
        // Ponderaciones
        const ponderColWidths = [68, 72, 63, 68];
        const ponderHeaders = ['Autoevaluación', 'Heteroevaluación', 'Coevaluación', 'Ev. Autoridades'];
        const ponderValues = ['10%', '40%', '30%', '20%'];
        // Escala valorativa
        const escalaColWidths = [45, 38, 38, 48, 50];
        const escalaHeaders = ['0-20', '21-30', '31-50', '51-85', '86-100'];
        const escalaValues = ['Deficiente', 'Regular', 'Buena', 'Muy buena', 'Excelente'];

        // Títulos de las tablas
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Ponderaciones', startX, startY - 15, { width: ponderColWidths.reduce((a, b) => a + b, 0), align: 'left' });
        doc.text('Escala Valorativa', startX + ponderColWidths.reduce((a, b) => a + b, 0) + 30, startY - 15, { width: escalaColWidths.reduce((a, b) => a + b, 0), align: 'left' });

        const tableHeight = 32;

        // Ponderaciones
        let x = startX;
        // Encabezados con fondo gris claro
        doc.fontSize(8).font('Helvetica-Bold');
        ponderHeaders.forEach((header, i) => {
            doc.rect(x, startY, ponderColWidths[i], 14).fillAndStroke('#E0E0E0', '#B0B0B0');
            doc.fillColor('#222').text(header, x, startY + 2, {
                width: ponderColWidths[i],
                align: 'center'
            });
            x += ponderColWidths[i];
        });
        // Valores
        x = startX;
        doc.fontSize(8).font('Helvetica');
        ponderValues.forEach((val, i) => {
            doc.rect(x, startY + 14, ponderColWidths[i], 14).stroke('#B0B0B0');
            doc.fillColor('#222').text(val, x, startY + 16, {
                width: ponderColWidths[i],
                align: 'center'
            });
            x += ponderColWidths[i];
        });

        // Escala valorativa
        x = startX + ponderColWidths.reduce((a, b) => a + b, 0) + 30;
        doc.fontSize(8).font('Helvetica-Bold');
        escalaHeaders.forEach((header, i) => {
            doc.rect(x, startY, escalaColWidths[i], 14).fillAndStroke('#E0E0E0', '#B0B0B0');
            doc.fillColor('#222').text(header, x, startY + 2, {
                width: escalaColWidths[i],
                align: 'center'
            });
            x += escalaColWidths[i];
        });
        // Valores
        x = startX + ponderColWidths.reduce((a, b) => a + b, 0) + 30;
        doc.fontSize(8).font('Helvetica');
        escalaValues.forEach((val, i) => {
            doc.rect(x, startY + 14, escalaColWidths[i], 14).stroke('#B0B0B0');
            doc.fillColor('#222').text(val, x, startY + 16, {
                width: escalaColWidths[i],
                align: 'center'
            });
            x += escalaColWidths[i];
        });
        // Ajustar Y
        doc.y = startY + tableHeight + 8;
    }

    // Crear tabla de docentes
    // Solución: Modificar el método crearTablaDocentes para agregar fondo gris a los encabezados

    crearTablaDocentes(doc, docentes, periodo) {
        const startY = doc.y;
        const rowHeight = 25;

        // Anchos de columnas ajustados
        const columnWidths = [20, 130, 50, 80, 80, 70, 60, 30];
        const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
        const startX = (doc.page.width - totalWidth) / 2;

        // Encabezados con nombres completos
        const headers = [
            'N°', 'Docente', 'Cédula', 'Autoevaluación', 'Heteroevaluación', 'Coevaluación', 'Eval. Autoridades', 'Total'
        ];

        // CAMBIO: Crear función auxiliar para dibujar encabezados con fondo gris
        const dibujarEncabezadosConFondo = (x, y) => {
            doc.fontSize(9).font('Helvetica-Bold');
            let currentX = x;
            headers.forEach((header, index) => {
                // CAMBIO: Usar fillAndStroke con color gris en lugar de solo stroke
                doc.rect(currentX, y, columnWidths[index], rowHeight)
                    .fillAndStroke('#E0E0E0', '#B0B0B0');

                // Asegurar que el texto sea negro después del fill
                doc.fillColor('#222').text(header, currentX + 2, y + 4, {
                    width: columnWidths[index] - 4,
                    align: 'center',
                    lineGap: 1
                });
                currentX += columnWidths[index];
            });
        };

        // Dibujar encabezados iniciales
        dibujarEncabezadosConFondo(startX, startY);

        // Filas de datos
        let currentY = startY + rowHeight;

        docentes.forEach((docente, index) => {
            // Verificar si necesitamos nueva página
            if (currentY + rowHeight > doc.page.height - 120) {
                doc.addPage();
                this.agregarEncabezado(doc, periodo, false); // false = NO es primera página
                currentY = doc.y;

                // CAMBIO: Usar la función auxiliar para redibujar encabezados con fondo gris
                dibujarEncabezadosConFondo(startX, currentY);
                currentY += rowHeight;
            }

            // Función auxiliar para formatear valores numéricos
            const formatearValor = (valor) => {
                if (valor === null || valor === undefined || isNaN(valor)) {
                    return '0.00';
                }
                const numero = parseFloat(valor);
                return isNaN(numero) ? '0.00' : numero.toFixed(2);
            };

            // Dibujar fila de datos
            let currentX = startX;
            const rowData = [
                (index + 1).toString(),
                this.capitalizarTexto(docente.nombre_completo),
                docente.cedula_docente || '—',
                formatearValor(docente.autoevaluacion),
                formatearValor(docente.heteroevaluacion),
                formatearValor(docente.coevaluacion),
                formatearValor(docente.evaluacion_autoridades),
                formatearValor(docente.promedio_ponderado)
            ];

            // Establecer fuente y tamaño uniforme para todas las celdas
            doc.fontSize(8).font('Helvetica');

            rowData.forEach((data, colIndex) => {
                // CAMBIO: Para las filas de datos, mantener solo stroke (sin fondo)
                doc.rect(currentX, currentY, columnWidths[colIndex], rowHeight).stroke();

                const textAlign = colIndex === 1 ? 'left' : 'center';
                const textY = currentY + (rowHeight - 8) / 2;

                // Asegurar que el texto sea negro
                doc.fillColor('#222').text(data, currentX + 2, textY, {
                    width: columnWidths[colIndex] - 4,
                    align: textAlign,
                    ellipsis: true
                });

                currentX += columnWidths[colIndex];
            });

            currentY += rowHeight;
        });

        // Actualizar posición Y del documento
        doc.y = currentY + 20;
    }

    // Tabla de ponderaciones
    agregarTablaPonderaciones(doc) {
        const startX = 70;
        const startY = doc.y + 10;
        const colWidths = [90, 90, 90, 110];
        const headers = ['Autoevaluación', 'Heteroevaluación', 'Coevaluación', 'Eval. Autoridades'];
        const values = ['10%', '40%', '30%', '20%'];

        // Encabezados
        doc.fontSize(9).font('Helvetica-Bold');
        let x = startX;
        headers.forEach((header, i) => {
            doc.rect(x, startY, colWidths[i], 18).stroke();
            doc.text(header, x, startY + 2, {
                width: colWidths[i],
                align: 'center'
            });
            x += colWidths[i];
        });
        // Valores
        x = startX;
        doc.fontSize(9).font('Helvetica');
        values.forEach((val, i) => {
            doc.rect(x, startY + 18, colWidths[i], 16).stroke();
            doc.text(val, x, startY + 18 + 2, {
                width: colWidths[i],
                align: 'center'
            });
            x += colWidths[i];
        });
        doc.y = startY + 38;
    }

    // Tabla de escala valorativa
    agregarTablaEscalaValorativa(doc) {
        const startX = 70;
        const startY = doc.y + 10;
        const colWidths = [60, 60, 60, 90, 90];
        const headers = ['0-20', '21-30', '31-50', '51-85', '86-100'];
        const values = ['Deficiente', 'Regular', 'Buena', 'Muy buena', 'Excelente'];

        // Encabezados
        doc.fontSize(9).font('Helvetica-Bold');
        let x = startX;
        headers.forEach((header, i) => {
            doc.rect(x, startY, colWidths[i], 18).stroke();
            doc.text(header, x, startY + 2, {
                width: colWidths[i],
                align: 'center'
            });
            x += colWidths[i];
        });
        // Valores
        x = startX;
        doc.fontSize(9).font('Helvetica');
        values.forEach((val, i) => {
            doc.rect(x, startY + 18, colWidths[i], 16).stroke();
            doc.text(val, x, startY + 18 + 2, {
                width: colWidths[i],
                align: 'center'
            });
            x += colWidths[i];
        });
        doc.y = startY + 38;
    }

    // Agregar sección de firmas (solo Vicerrector)
    agregarSeccionFirmas(doc, autoridades, soloVicerrectora = false) {
        // Verificar si necesitamos nueva página
        if (doc.y > doc.page.height - 150) {
            doc.addPage();
            this.agregarEncabezado(doc, { descripcion: 'Firmas' });
        }

        const pageWidth = doc.page.width;
        const marginX = 50;
        const availableWidth = pageWidth - (marginX * 2);
        const startY = doc.y + 30;

        // Filtrar solo la vicerrectora si corresponde
        let autoridadesFiltradas = autoridades;
        if (soloVicerrectora && Array.isArray(autoridades)) {
            autoridadesFiltradas = autoridades.filter(a => a.cargo_autoridad && a.cargo_autoridad.toUpperCase().includes('VICERRECTOR'));
        }

        // Default si no hay autoridades configuradas
        if (!Array.isArray(autoridadesFiltradas) || autoridadesFiltradas.length === 0) {
            const nombre = 'Mg. Sandra Rivilla Requelme';
            const cargo = 'VICERRECTORA';
            const centerX = marginX + (availableWidth / 2);
            // Línea
            doc.moveTo(centerX - 100, startY + 20)
               .lineTo(centerX + 100, startY + 20)
               .stroke();
            // Nombre
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text(nombre, marginX, startY + 28, { width: availableWidth, align: 'center' });
            // Cargo
            doc.fontSize(9).font('Helvetica');
            doc.text(cargo, marginX, startY + 42, { width: availableWidth, align: 'center' });
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
        const leftX = marginX + 20;
        const rightX = pageWidth - marginX - 220; // ancho aprox de línea/columna
        const lineWidth = 200;

        // Firma izquierda
        doc.moveTo(leftX, startY)
           .lineTo(leftX + lineWidth, startY)
           .stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text(firmas[0].nombre_autoridad || '', leftX, startY + 8, { width: lineWidth, align: 'center' });
        doc.fontSize(9).font('Helvetica');
        doc.text((firmas[0].cargo_autoridad || '').toUpperCase(), leftX, startY + 22, { width: lineWidth, align: 'center' });

        // Firma derecha
        doc.moveTo(rightX, startY)
           .lineTo(rightX + lineWidth, startY)
           .stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text(firmas[1].nombre_autoridad || '', rightX, startY + 8, { width: lineWidth, align: 'center' });
        doc.fontSize(9).font('Helvetica');
        doc.text((firmas[1].cargo_autoridad || '').toUpperCase(), rightX, startY + 22, { width: lineWidth, align: 'center' });
    }

    // Método para obtener lista de carreras activas
    async obtenerCarrerasActivas(idPeriodo = null) {
        try {
            return await reportesCalificacionCarreraRepository.obtenerCarrerasActivas(idPeriodo);
        } catch (error) {
            console.error('Error en obtenerCarrerasActivas:', error);
            throw error;
        }
    }

    // Método para obtener lista de periodos
    async obtenerPeriodos() {
        try {
            return await reportesCalificacionCarreraRepository.obtenerPeriodos();
        } catch (error) {
            console.error('Error en obtenerPeriodos:', error);
            throw error;
        }
    }
}

module.exports = new ReportesCalificacionCarreraService();