// ========== SERVICE MODIFICADO (reporteCoevaluacionService.js) ==========
const reporteCoevaluacionRepository = require('../repositories/reporteCoevaluacionRepository');
const autoridadesRepository = require('../repositories/autoridadesRepository');
const { formatearNombre } = require('./asignacionesService');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

class ReporteCoevaluacionService {
    // 🔄 MODIFICADO: Obtener datos filtrados por TODAS las carreras del coordinador (multi-carrera)
    async obtenerDatosParaReporte(idPeriodo, cedulaCoordinador) {
        try {
            // Obtener TODAS las carreras activas del coordinador
            const carrerasCoord = await reporteCoevaluacionRepository.obtenerCarrerasCoordinador(cedulaCoordinador);
            const carreraIds = Array.isArray(carrerasCoord) && carrerasCoord.length > 0
                ? carrerasCoord.map(c => c.id_carrera)
                : null;

            // Obtener datos filtrados por union de carreras (si existen)
            const asignaciones = await reporteCoevaluacionRepository.obtenerAsignacionesParaReporte(idPeriodo, carreraIds);
            if (asignaciones.length === 0) {
                return [];
            }
            // Obtener carreras y niveles para todas las asignaturas
            const asignaturaIds = [...new Set(asignaciones.map(a => a.id_asignatura))].filter(Boolean);
            // Para enriquecimiento, no filtramos por una sola carrera cuando el coordinador tiene múltiples
            const { carreras, niveles } = await reporteCoevaluacionRepository.obtenerCarrerasYNivelesPorAsignaturas(asignaturaIds, null);
            // Enriquecer datos con carrera y nivel
            const asignacionesEnriquecidas = asignaciones.map(asig => ({
                ...asig,
                carrera: carreras.get(asig.id_asignatura) || { nombre: 'Sin carrera' },
                nivel: niveles.get(asig.id_asignatura) || { nombre: 'Sin nivel' }
            }));
            return asignacionesEnriquecidas;
        } catch (error) {
            console.error('Error en obtenerDatosParaReporte:', error);
            throw error;
        }
    }

    // 🔄 MODIFICADO: Generar reporte filtrado por TODAS las carreras del coordinador
    async generarReportePDF(idPeriodo, cedulaCoordinador, usuarioId) {
        try {
            // Obtener TODAS las carreras activas del coordinador
            const carrerasCoord = await reporteCoevaluacionRepository.obtenerCarrerasCoordinador(cedulaCoordinador);
            const carreraIds = Array.isArray(carrerasCoord) && carrerasCoord.length > 0
                ? carrerasCoord.map(c => c.id_carrera)
                : null;

            // Obtener datos filtrados y autoridades para firmas
            const [asignaciones, periodo, autoridades] = await Promise.all([
                reporteCoevaluacionRepository.obtenerAsignacionesParaReporte(idPeriodo, carreraIds),
                reporteCoevaluacionRepository.obtenerPeriodo(idPeriodo),
                autoridadesRepository.obtenerAutoridadesParaFirmas(usuarioId)
            ]);
            if (asignaciones.length === 0) {
                throw new Error('No se encontraron asignaciones para el período y carrera seleccionada');
            }
            // Obtener carreras y niveles para todas las asignaturas
            const asignaturaIds = [...new Set(asignaciones.map(a => a.id_asignatura))].filter(Boolean);
            const { carreras, niveles } = await reporteCoevaluacionRepository.obtenerCarrerasYNivelesPorAsignaturas(asignaturaIds, null);
            // Enriquecer datos con carrera y nivel
            const asignacionesEnriquecidas = asignaciones.map(asig => ({
                ...asig,
                carrera: carreras.get(asig.id_asignatura) || { nombre: 'Sin carrera' },
                nivel: niveles.get(asig.id_asignatura) || { nombre: 'Sin nivel' }
            }));
            // Agrupar por carrera y nivel
            const asignacionesAgrupadas = this.agruparAsignaciones(asignacionesEnriquecidas);
            // Permitir firmas configuradas (hasta 2), sin forzar solo Vicerrectora
            const soloVicerrectora = false;
            const pdfBuffer = await this.crearPDF(asignacionesAgrupadas, periodo, autoridades, soloVicerrectora);
            return pdfBuffer;
        } catch (error) {
            console.error('Error en generarReportePDF:', error);
            throw error;
        }
    }

    // 🆕 NUEVO: Obtener datos filtrados por carrera específica (para administradores)
    async obtenerDatosParaReportePorCarrera(idPeriodo, idCarrera) {
        try {
            // Obtener datos filtrados por carrera específica
            const asignaciones = await reporteCoevaluacionRepository.obtenerAsignacionesParaReporte(idPeriodo, idCarrera);

            if (asignaciones.length === 0) {
                return [];
            }

            // Obtener carreras y niveles para todas las asignaturas
            const asignaturaIds = [...new Set(asignaciones.map(a => a.id_asignatura))].filter(Boolean);
            const { carreras, niveles } = await reporteCoevaluacionRepository.obtenerCarrerasYNivelesPorAsignaturas(asignaturaIds, idCarrera);

            // Enriquecer datos con carrera y nivel
            const asignacionesEnriquecidas = asignaciones.map(asig => ({
                ...asig,
                carrera: carreras.get(asig.id_asignatura) || { nombre: 'Sin carrera' },
                nivel: niveles.get(asig.id_asignatura) || { nombre: 'Sin nivel' }
            }));

            return asignacionesEnriquecidas;
        } catch (error) {
            console.error('Error en obtenerDatosParaReportePorCarrera:', error);
            throw error;
        }
    }

    // 🆕 NUEVO: Generar reporte PDF por carrera específica (para administradores)
    async generarReportePDFPorCarrera(idPeriodo, idCarrera, usuarioId) {
        try {
            // Obtener datos filtrados por carrera específica y autoridades para firmas
            const [asignaciones, periodo, autoridades] = await Promise.all([
                reporteCoevaluacionRepository.obtenerAsignacionesParaReporte(idPeriodo, idCarrera),
                reporteCoevaluacionRepository.obtenerPeriodo(idPeriodo),
                autoridadesRepository.obtenerAutoridadesParaFirmas(usuarioId)
            ]);

            if (asignaciones.length === 0) {
                throw new Error('No se encontraron asignaciones para el período y carrera seleccionada');
            }

            // Obtener carreras y niveles para todas las asignaturas
            const asignaturaIds = [...new Set(asignaciones.map(a => a.id_asignatura))].filter(Boolean);
            const { carreras, niveles } = await reporteCoevaluacionRepository.obtenerCarrerasYNivelesPorAsignaturas(asignaturaIds, idCarrera);

            // Enriquecer datos con carrera y nivel
            const asignacionesEnriquecidas = asignaciones.map(asig => ({
                ...asig,
                carrera: carreras.get(asig.id_asignatura) || { nombre: 'Sin carrera' },
                nivel: niveles.get(asig.id_asignatura) || { nombre: 'Sin nivel' }
            }));

            // Agrupar por carrera y nivel
            const asignacionesAgrupadas = this.agruparAsignaciones(asignacionesEnriquecidas);

            // Generar PDF permitiendo firmas configuradas (hasta 2)
            const pdfBuffer = await this.crearPDF(asignacionesAgrupadas, periodo, autoridades, false);

            return pdfBuffer;
        } catch (error) {
            console.error('Error en generarReportePDFPorCarrera:', error);
            throw error;
        }
    }
    
    // ✅ NUEVO: Función para capitalizar texto (primera letra mayúscula, resto minúsculas)
    capitalizarTexto(texto) {
        if (!texto || typeof texto !== 'string') return '—';

        return texto
            .toLowerCase()
            .split(' ')
            .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
            .join(' ');
    }

    agruparAsignaciones(asignaciones) {
        const grupos = {};
        asignaciones.forEach(asig => {
            const carreraNombre = asig.carrera.nombre;
            const nivelNombre = asig.nivel.nombre;
            if (!grupos[carreraNombre]) {
                grupos[carreraNombre] = {};
            }
            if (!grupos[carreraNombre][nivelNombre]) {
                grupos[carreraNombre][nivelNombre] = [];
            }
            grupos[carreraNombre][nivelNombre].push(asig);
        });
        return grupos;
    }

    // 🔄 MODIFICADO: Crear PDF con autoridades dinámicas
    async crearPDF(asignacionesAgrupadas, periodo, autoridades, soloVicerrectora = false) {
        return new Promise((resolve, reject) => {
            try {
                // Cambiar a orientación vertical (portrait)
                const doc = new PDFDocument({
                    size: 'A4',
                    layout: 'portrait',
                    margins: { top: 120, bottom: 80, left: 50, right: 50 }
                });
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(buffers);
                    resolve(pdfBuffer);
                });

                // Agregar imágenes y encabezado
                this.agregarImagenesYEncabezado(doc, periodo);
                let primerContenido = true;

                // ✅ MODIFICADO: Definir posición X de la tabla para reutilizar en títulos (actualizado con nuevos anchos)
                const columnWidths = [25, 90, 90, 110, 50, 35, 35, 50]; // Más espacio para docentes y día, menos para horas
                const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
                const startX = (doc.page.width - totalWidth) / 2; // Centrar tabla

                // Iterar por carrera y nivel - CON LÓGICA MEJORADA PARA NO REPETIR CARRERA
                Object.keys(asignacionesAgrupadas).forEach((carrera, carreraIndex) => {
                    // Mostrar título de carrera solo una vez por carrera
                    if (doc.y > doc.page.height - 150) {
                        doc.addPage();
                        // Usar el periodo real pasado como argumento
                        this.agregarImagenesYEncabezado(doc, periodo);
                        currentY = doc.y;

                        // Redibujar encabezados en nueva página
                        doc.fontSize(10).font('Helvetica-Bold');
                        currentX = startX;
                        headers.forEach((header, index) => {
                            doc.rect(currentX, currentY, columnWidths[index], baseRowHeight).stroke();
                            // Centrar texto en encabezados verticalmente
                            const headerLines = header.split('\n');
                            const headerHeight = headerLines.length * 10;
                            const headerY = currentY + (baseRowHeight - headerHeight) / 2;
                            
                            doc.text(header, currentX + 3, headerY, {
                                width: columnWidths[index] - 6,
                                align: 'center',
                                lineGap: 1
                            });
                            currentX += columnWidths[index];
                        });
                    }

                    // ✅ MODIFICADO: Título de la carrera - alineado con la tabla y capitalizado
                    doc.fontSize(10).font('Helvetica-Bold');
                    doc.text(`Carrera: ${this.capitalizarTexto(carrera)}`, startX, doc.y + (primerContenido ? 0 : 15));
                    doc.moveDown(0.5);

                    // Iterar por los niveles de esta carrera
                    Object.keys(asignacionesAgrupadas[carrera]).forEach((nivel, nivelIndex) => {
                        const asignaciones = asignacionesAgrupadas[carrera][nivel];

                        // Verificar si hay espacio suficiente para el título del nivel y al menos una fila
                        if (doc.y > doc.page.height - 150) {
                            doc.addPage();
                            this.agregarImagenesYEncabezado(doc, periodo);
                        }

                        // ✅ MODIFICADO: Título del nivel alineado con la tabla y capitalizado
                        doc.fontSize(10).font('Helvetica-Bold');
                        doc.text(`Nivel: ${this.capitalizarTexto(nivel)}`, startX, doc.y + 5);
                        doc.moveDown(0.5);

                        // Crear tabla
                        this.crearTabla(doc, asignaciones, periodo);
                        doc.moveDown(0); // Espacio reducido entre niveles de la misma carrera
                    });

                    primerContenido = false;
                    doc.moveDown(0.5); // Espacio extra entre carreras diferentes
                });

                // Agregar firmas al final con autoridades dinámicas
                this.agregarSeccionFirmas(doc, autoridades, soloVicerrectora);
                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    agregarImagenesYEncabezado(doc, periodo) {
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
                const margins = 0; // Márgenes pequeños
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
            doc.text('REPORTE DE ASIGNACIONES DE COEVALUACIONES', 50, 105, { align: 'center' });

            // PERÍODO en mayúsculas
            doc.fontSize(12).font('Helvetica');
            doc.text(`PERÍODO: ${periodo ? periodo.descripcion_periodo : 'No especificado'}`, 50, 125, { align: 'center' });

            // Fecha de generación
            doc.fontSize(10);
            doc.text(`Generado el: ${moment().format('DD/MM/YYYY HH:mm')}`, 50, 140, { align: 'center' });

            // Establecer posición Y para el contenido con más espacio
            doc.y = 170; // Cambiado de 160 a 170 para dar más espacio
        } catch (error) {
            console.error('Error al cargar imágenes:', error.message);
            // Continuar sin imágenes si hay error
            doc.fontSize(16).font('Helvetica-Bold');
            doc.text('REPORTE DE ASIGNACIONES DE COEVALUACIONES', 50, 50, { align: 'center' });
            doc.fontSize(12).font('Helvetica');
            doc.text(`PERÍODO: ${periodo ? periodo.descripcion_periodo : 'No especificado'}`, 50, 70, { align: 'center' });
            doc.fontSize(10);
            doc.text(`Generado el: ${moment().format('DD/MM/YYYY HH:mm')}`, 50, 85, { align: 'center' });
            doc.y = 120; // Cambiado de 110 a 120 para dar más espacio
        }
    }

    // ✅ MODIFICADO: Tabla con textos capitalizados
    crearTabla(doc, asignaciones, periodo) {
        const startY = doc.y;
        const baseRowHeight = 30; // Altura mínima
        const lineHeight = 12; // Altura por línea de texto
        const padding = 8; // Padding interno de las celdas

        // Ajustar anchos de columna - más espacio para nombres completos y días
        const columnWidths = [25, 90, 90, 110, 50, 35, 35, 50]; // Más espacio para docentes y día, menos para horas
        const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
        const startX = (doc.page.width - totalWidth) / 2; // Centrar tabla

        // Encabezados - Textos más cortos para evitar saltos de línea (agregando Nº)
        const headers = ['Nº', 'Docente\nEvaluador', 'Docente\nEvaluado', 'Asignatura', 'Fecha', 'Inicio', 'Fin', 'Día'];

        // Función para calcular líneas de texto que necesita una celda
        const calcularLineasTexto = (texto, ancho, fontSize) => {
            if (!texto || texto === '—') return 1;

            doc.fontSize(fontSize);
            const palabras = texto.split(' ');
            let lineas = 1;
            let lineaActual = '';
            const anchoDisponible = ancho - 8; // Padding más generoso

            palabras.forEach(palabra => {
                const pruebaLinea = lineaActual + (lineaActual ? ' ' : '') + palabra;
                const anchoTexto = doc.widthOfString(pruebaLinea);

                if (anchoTexto > anchoDisponible) {
                    lineas++;
                    lineaActual = palabra;
                } else {
                    lineaActual = pruebaLinea;
                }
            });

            return lineas;
        };

        // Función para calcular la altura necesaria para una fila
        const calcularAlturaFila = (asignacion, index) => {
            const rowData = [
                (index + 1).toString(),
                this.capitalizarTexto(asignacion.nombre_evaluador) || '—',
                this.capitalizarTexto(asignacion.nombre_evaluado) || '—',
                this.capitalizarTexto(asignacion.nombre_asignatura) || '—',
                asignacion.fecha ? moment(asignacion.fecha).format('DD/MM/YYYY') : '—',
                asignacion.hora_inicio ? moment(asignacion.hora_inicio, 'HH:mm:ss').format('HH:mm') : '—',
                asignacion.hora_fin ? moment(asignacion.hora_fin, 'HH:mm:ss').format('HH:mm') : '—',
                this.capitalizarTexto(asignacion.dia) || '—'
            ];

            let maxLineas = 1;

            rowData.forEach((data, colIndex) => {
                const lineas = calcularLineasTexto(data, columnWidths[colIndex], 8);
                maxLineas = Math.max(maxLineas, lineas);
            });

            return Math.max(baseRowHeight, (maxLineas * lineHeight) + padding);
        };

        doc.fontSize(10).font('Helvetica-Bold');
        let currentX = startX;

        // Dibujar encabezados
        headers.forEach((header, index) => {
            doc.rect(currentX, startY, columnWidths[index], baseRowHeight).stroke();
            // Centrar texto en encabezados verticalmente
            const headerLines = header.split('\n');
            const headerHeight = headerLines.length * 10;
            const headerY = startY + (baseRowHeight - headerHeight) / 2;
            
            doc.text(header, currentX + 3, headerY, {
                width: columnWidths[index] - 6,
                align: 'center',
                lineGap: 1
            });
            currentX += columnWidths[index];
        });

        // Filas de datos
        doc.font('Helvetica');
        let currentY = startY + baseRowHeight;

        asignaciones.forEach((asig, index) => {
            // Calcular altura necesaria para esta fila
            const rowHeight = calcularAlturaFila(asig, index);

            // Verificar si necesitamos nueva página
            if (currentY + rowHeight > doc.page.height - 140) {
                doc.addPage();
                // Usar el periodo real pasado como argumento
                this.agregarImagenesYEncabezado(doc, periodo);
                currentY = doc.y;

                // Redibujar encabezados en nueva página
                doc.fontSize(10).font('Helvetica-Bold');
                currentX = startX;
                headers.forEach((header, index) => {
                    doc.rect(currentX, currentY, columnWidths[index], baseRowHeight).stroke();
                    // Centrar texto en encabezados verticalmente
                    const headerLines = header.split('\n');
                    const headerHeight = headerLines.length * 10;
                    const headerY = currentY + (baseRowHeight - headerHeight) / 2;
                    
                    doc.text(header, currentX + 3, headerY, {
                        width: columnWidths[index] - 6,
                        align: 'center',
                        lineGap: 1
                    });
                    currentX += columnWidths[index];
                });
                currentY += baseRowHeight;
                doc.font('Helvetica');
            }

            currentX = startX;

            // ✅ MODIFICADO: Aplicar capitalización a todos los textos
            const rowData = [
                (index + 1).toString(),
                this.capitalizarTexto(asig.nombre_evaluador) || '—',
                this.capitalizarTexto(asig.nombre_evaluado) || '—',
                this.capitalizarTexto(asig.nombre_asignatura) || '—',
                asig.fecha ? moment(asig.fecha).format('DD/MM/YYYY') : '—',
                asig.hora_inicio ? moment(asig.hora_inicio, 'HH:mm:ss').format('HH:mm') : '—',
                asig.hora_fin ? moment(asig.hora_fin, 'HH:mm:ss').format('HH:mm') : '—',
                this.capitalizarTexto(asig.dia) || '—'
            ];

            rowData.forEach((data, colIndex) => {
                // Dibujar celda con altura dinámica
                doc.rect(currentX, currentY, columnWidths[colIndex], rowHeight).stroke();
                doc.fontSize(8);

                // Mantener alineación centrada para todas las columnas
                let alignment = 'center';
                let textX = currentX + 3;

                // Calcular altura real del texto para centrado vertical preciso
                const textWidth = columnWidths[colIndex] - 8;
                const textOptions = { width: textWidth, align: alignment, lineGap: 1 };
                const textHeight = doc.heightOfString(data || ' ', textOptions);
                const textY = currentY + Math.max(0, (rowHeight - textHeight) / 2);

                doc.text(data, textX, textY, {
                    ...textOptions,
                    ellipsis: false
                });
                currentX += columnWidths[colIndex];
            });

            currentY += rowHeight;
        });

        doc.y = currentY + 15; // Espacio después de la tabla
    }

    // 🔄 MODIFICADO: Función para agregar sección de firmas dinámicas
    agregarSeccionFirmas(doc, autoridades, soloVicerrectora = false) {
        // Verificar si hay espacio suficiente, si no, agregar nueva página
        if (doc.y > doc.page.height - 180) {
            doc.addPage();
            this.agregarImagenesYEncabezado(doc, { descripcion_periodo: '' });
        }

        // Espacio antes de las firmas
        doc.y += 40;

        // Filtrar solo la vicerrectora si corresponde
        let autoridadesFiltradas = autoridades;
        if (soloVicerrectora && Array.isArray(autoridades)) {
            autoridadesFiltradas = autoridades.filter(a => a.cargo_autoridad && a.cargo_autoridad.toUpperCase().includes('VICERRECTOR'));
        }

        // Verificar si hay autoridades disponibles
        if (!autoridadesFiltradas || autoridadesFiltradas.length === 0) {
            // Mantener firmas por defecto si no hay autoridades configuradas
            this.agregarFirmasDefault(doc);
            return;
        }

        // Calcular posiciones para centrar las firmas según la cantidad
        const pageWidth = doc.page.width;
        const margins = 50;
        const lineWidth = 150;
        const spaceBetweenSignatures = 60;

        const numAutoridades = Math.min(autoridadesFiltradas.length, 3); // Máximo 3 firmas
        const totalSignaturesWidth = (lineWidth * numAutoridades) + (spaceBetweenSignatures * (numAutoridades - 1));
        const startX = (pageWidth - totalSignaturesWidth) / 2;

        const signatureY = doc.y;

        // Dibujar firmas dinámicamente
        autoridadesFiltradas.slice(0, 3).forEach((autoridad, index) => {
            const currentX = startX + (index * (lineWidth + spaceBetweenSignatures));

            // Línea para la firma
            doc.strokeColor('#000000')
                .lineWidth(1)
                .moveTo(currentX, signatureY)
                .lineTo(currentX + lineWidth, signatureY)
                .stroke();

            // Nombre de la autoridad
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text(autoridad.nombre_autoridad, currentX, signatureY + 10, {
                width: lineWidth,
                align: 'center'
            });

            // Eliminar el espaciado extra
            // doc.moveDown(1.2);

            // Cargo de la autoridad
            doc.fontSize(9).font('Helvetica');
            doc.text(autoridad.cargo_autoridad.toUpperCase(), currentX, signatureY + 25, {
                width: lineWidth,
                align: 'center'
            });
        });

        // Agregar número de página al final de las firmas
        doc.fontSize(8);
        doc.text(
            'Página 1 de 1',
            0,
            signatureY + 60,
            { width: pageWidth, align: 'center' }
        );

        // Actualizar doc.y para que apunte al final del contenido completo
        doc.y = signatureY + 80;
    }

    // 🆕 NUEVO: Función para firmas por defecto (fallback)
    agregarFirmasDefault(doc) {
        const pageWidth = doc.page.width;
        const margins = 50;
        const lineWidth = 150;
        const spaceBetweenSignatures = 60;

        // Calcular posiciones para centrar las firmas por defecto
        const totalSignaturesWidth = (lineWidth * 2) + spaceBetweenSignatures;
        const startX = (pageWidth - totalSignaturesWidth) / 2;
        const leftX = startX;
        const rightX = startX + lineWidth + spaceBetweenSignatures;

        const signatureY = doc.y;

        // Líneas para las firmas por defecto
        doc.strokeColor('#000000')
            .lineWidth(1)
            .moveTo(leftX, signatureY)
            .lineTo(leftX + lineWidth, signatureY)
            .stroke();

        doc.moveTo(rightX, signatureY)
            .lineTo(rightX + lineWidth, signatureY)
            .stroke();

        // Firmas por defecto
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Mg. Javier Cevallos', leftX, signatureY + 10, {
            width: lineWidth,
            align: 'center'
        });
        doc.fontSize(9).font('Helvetica');
        doc.text('COORDINADOR', leftX, signatureY + 25, {
            width: lineWidth,
            align: 'center'
        });

        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Mg. Sandra Rivilla Requelme', rightX, signatureY + 10, {
            width: lineWidth,
            align: 'center'
        });
        doc.fontSize(9).font('Helvetica');
        doc.text('VICERRECTORA', rightX, signatureY + 25, {
            width: lineWidth,
            align: 'center'
        });

        // Agregar número de página
        doc.fontSize(8);
        doc.text(
            'Página 1 de 1',
            0,
            signatureY + 60,
            { width: pageWidth, align: 'center' }
        );

        doc.y = signatureY + 80;
    }
}

module.exports = new ReporteCoevaluacionService();