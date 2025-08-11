const dashboardRepo = require('../repositories/dashboardRepository');

async function obtenerEstadisticasGenerales(periodo) {
    const periodos = await dashboardRepo.obtenerPeriodosOrdenados();
    const indexActual = periodos.findIndex(p => p.id_periodo == periodo);
    const periodoAnterior = indexActual + 1 < periodos.length ? periodos[indexActual + 1].id_periodo : null;
    const actual = {
        totalDocentes: await dashboardRepo.obtenerTotalDocentesEvaluados(periodo),
        totalEvaluaciones: await dashboardRepo.obtenerTotalEvaluacionesCompletadas(periodo),
        promedioGeneral: await dashboardRepo.obtenerPromedioGeneral(periodo),
        tasaParticipacion: await dashboardRepo.obtenerTasaParticipacion(periodo)
    };
    let anterior = {
        total_docentes: 0,
        total_completadas: 0,
        promedio_general: 0,
        tasa_participacion: 0
    };
    if (periodoAnterior) {
        anterior = {
            total_docentes: (await dashboardRepo.obtenerTotalDocentesEvaluados(periodoAnterior)).total_docentes,
            total_completadas: (await dashboardRepo.obtenerTotalEvaluacionesCompletadas(periodoAnterior)).total_completadas,
            promedio_general: (await dashboardRepo.obtenerPromedioGeneral(periodoAnterior)).promedio_general,
            tasa_participacion: (await dashboardRepo.obtenerTasaParticipacion(periodoAnterior)).tasa_participacion
        };
    }
    return {
        total_docentes_evaluados: actual.totalDocentes.total_docentes,
        total_docentes_anteriores: anterior.total_docentes,
        total_evaluaciones_completadas: actual.totalEvaluaciones.total_completadas,
        total_evaluaciones_anteriores: anterior.total_completadas,
        promedio_general: actual.promedioGeneral.promedio_general,
        promedio_general_anterior: anterior.promedio_general,
        tasa_participacion: actual.tasaParticipacion.tasa_participacion,
        tasa_participacion_anterior: anterior.tasa_participacion
    };
}

async function obtenerDatosGraficos(periodo) {
    const [
        promedioPorTipo,
        promedioPorCarrera,
        datosHistoricos
    ] = await Promise.all([
        dashboardRepo.obtenerPromedioPorTipoEvaluacion(periodo),
        dashboardRepo.obtenerPromedioPorCarrera(periodo),
        dashboardRepo.obtenerDatosHistoricos(periodo)
    ]);
    return {
        promedioPorTipo,
        promedioPorCarrera,
        datosHistoricos
    };
}

async function obtenerDetalleParticipacionPorTipo(periodo) {
    try {
        const detalle = await dashboardRepo.obtenerDetalleParticipacionPorTipo(periodo);
        return detalle;
    } catch (error) {
        console.error('[ERROR] Error en servicio de detalle de participación:', error);
        throw error;
    }
}

async function obtenerResultadosDetallados(periodo) {
    try {
        const resultados = await dashboardRepo.obtenerResultadosDetallados(periodo);
        return resultados;
    } catch (error) {
        console.error('[ERROR] Error en servicio de resultados detallados:', error);
        throw error;
    }
}

// Función para obtener estadísticas por tipo de pregunta
async function obtenerEstadisticasPorTipoPregunta(idPeriodo) {
    try {
        return await dashboardRepo.obtenerEstadisticasTipoPregunta(idPeriodo);
    } catch (error) {
        console.error('Error al obtener estadísticas por tipo de pregunta:', error);
        throw error;
    }
}

// Cache temporal en memoria para mejorar rendimiento
const cacheDocentes = new Map();
const cacheEvaluadores = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Función para limpiar cache expirado
function limpiarCacheExpirado() {
    const ahora = Date.now();
    for (const [key, value] of cacheDocentes.entries()) {
        if (ahora - value.timestamp > CACHE_TTL) {
            cacheDocentes.delete(key);
        }
    }
    for (const [key, value] of cacheEvaluadores.entries()) {
        if (ahora - value.timestamp > CACHE_TTL) {
            cacheEvaluadores.delete(key);
        }
    }
}

// Función OPTIMIZADA para obtener todas las respuestas organizadas por tipo de pregunta y docente
async function obtenerRespuestasPorTipoYDocente(idPeriodo) {
    try {
        // Limpiar cache expirado
        limpiarCacheExpirado();
        // Obtener todas las respuestas con información enriquecida
        const respuestasEnriquecidas = await dashboardRepo.obtenerRespuestasEnriquecidas(idPeriodo);
        // Organizar las respuestas por tipo y docente
        const respuestasOrganizadas = organizarRespuestasPorTipoYDocente(respuestasEnriquecidas);
        return respuestasOrganizadas;
    } catch (error) {
        console.error('Error en obtenerRespuestasPorTipoYDocente:', error);
        throw error;
    }
}

// Función auxiliar mejorada para organizar respuestas - CORREGIDA para agrupar por cédula
function organizarRespuestasPorTipoYDocente(respuestasEnriquecidas) {
    const respuestasOrganizadas = {
        actitudinal: {},
        conceptual: {},
        procedimental: {}
    };
    
    respuestasEnriquecidas.forEach(respuesta => {
        const tipoSeccion = respuesta.tipo_pregunta;
        const cedulaDocente = respuesta.cedula_docente || 'sin_cedula';
        const nombreDocente = respuesta.nombre_docente;
        
        // Verificar que el tipo de sección existe
        if (!respuestasOrganizadas[tipoSeccion]) {
            return;
        }
        
        // Usar cédula como clave para agrupar por docente único
        if (!respuestasOrganizadas[tipoSeccion][cedulaDocente]) {
            respuestasOrganizadas[tipoSeccion][cedulaDocente] = {
                docente: nombreDocente,
                cedula: cedulaDocente,
                asignatura: respuesta.todas_las_materias || respuesta.nombre_asignatura,
                respuestas: []
            };
        }
        
        respuestasOrganizadas[tipoSeccion][cedulaDocente].respuestas.push({
            id_respuesta: respuesta.id_respuesta,
            pregunta: respuesta.pregunta_texto,
            respuesta: respuesta.respuesta,
            evaluador: respuesta.nombre_evaluador,
            formulario: respuesta.formulario_nombre,
            tipo_evaluacion: getNameTipoEvaluacion(respuesta.id_formulario)
        });
    });
    
    // Convertir objetos a arrays para facilitar el manejo en frontend
    return {
        actitudinal: Object.values(respuestasOrganizadas.actitudinal),
        conceptual: Object.values(respuestasOrganizadas.conceptual),
        procedimental: Object.values(respuestasOrganizadas.procedimental)
    };
}

// Función auxiliar para obtener el nombre del tipo de evaluación
function getNameTipoEvaluacion(idFormulario) {
    switch (idFormulario) {
        case 1: return 'Autoevaluación';
        case 2: return 'Heteroevaluación';
        case 3: return 'Coevaluación';
        default: return 'Desconocido';
    }
}

async function obtenerDatosMapaCalor(idPeriodo) {
    try {
        const { resultados, estadisticasGenerales, totalGlobal } = await dashboardRepo.obtenerDatosMapaCalor(idPeriodo);
        // Organizar los datos en formato matriz para el heatmap
        const mapaCalor = {
            actitudinal: { autoevaluacion: 0, heteroevaluacion: 0, coevaluacion: 0 },
            conceptual: { autoevaluacion: 0, heteroevaluacion: 0, coevaluacion: 0 },
            procedimental: { autoevaluacion: 0, heteroevaluacion: 0, coevaluacion: 0 }
        };
        const estadisticas = {
            actitudinal: { autoevaluacion: {}, heteroevaluacion: {}, coevaluacion: {} },
            conceptual: { autoevaluacion: {}, heteroevaluacion: {}, coevaluacion: {} },
            procedimental: { autoevaluacion: {}, heteroevaluacion: {}, coevaluacion: {} }
        };
        // Mapear tipos de evaluación
        const tiposEvaluacion = {
            1: 'autoevaluacion',
            2: 'heteroevaluacion',
            3: 'coevaluacion'
        };
        // Procesar datos de promedios
        resultados.forEach(dato => {
            const tipoEval = tiposEvaluacion[dato.id_formulario];
            if (mapaCalor[dato.tipo_pregunta] && tipoEval) {
                mapaCalor[dato.tipo_pregunta][tipoEval] = parseFloat(dato.promedio_seccion) || 0;
            }
        });
        // Procesar estadísticas detalladas
        estadisticasGenerales.forEach(dato => {
            const tipoEval = tiposEvaluacion[dato.id_formulario];
            if (estadisticas[dato.tipo_pregunta] && tipoEval) {
                estadisticas[dato.tipo_pregunta][tipoEval] = {
                    total_respuestas: dato.total_respuestas,
                    docentes_evaluados: dato.docentes_evaluados,
                    evaluadores_participantes: dato.evaluadores_participantes
                };
            }
        });
        // Agregar información global
        const resumen = {
            total_docentes_evaluados: totalGlobal.total_docentes_evaluados,
            total_evaluadores: totalGlobal.total_evaluadores,
            periodo_id: idPeriodo
        };
        return {
            mapaCalor,
            estadisticas,
            resumen
        };
    } catch (error) {
        console.error('Error en servicio de mapa de calor:', error);
        throw error;
    }
}

// Obtener promedio por ítem del formulario por tipo de evaluación
async function obtenerPromedioItemsPorTipo(idPeriodo, tipoEvaluacion) {
    try {
        const datosPromedio = await dashboardRepo.obtenerPromedioItemsPorTipo(idPeriodo, tipoEvaluacion);
        
        const tiposEvaluacion = {
            1: 'Autoevaluación',
            2: 'Heteroevaluación',
            3: 'Coevaluación'
        };

        // Organizar datos por tipo de pregunta
        const promediosPorTipo = {
            actitudinal: [],
            conceptual: [],
            procedimental: []
        };

        // Agrupar preguntas por tipo
        datosPromedio.forEach(item => {
            if (promediosPorTipo[item.tipo_pregunta]) {
                promediosPorTipo[item.tipo_pregunta].push({
                    id_pregunta: item.id_pregunta,
                    texto_pregunta: item.texto,
                    promedio: parseFloat(item.promedio_item).toFixed(2),
                    total_respuestas: item.total_respuestas,
                    desviacion_estandar: parseFloat(item.desviacion_estandar || 0).toFixed(2)
                });
            }
        });

        // Calcular estadísticas generales
        const estadisticasGenerales = {
            total_preguntas: datosPromedio.length,
            promedio_general: datosPromedio.length > 0 ? 
                (datosPromedio.reduce((acc, item) => acc + parseFloat(item.promedio_item), 0) / datosPromedio.length).toFixed(2) : 0,
            tipo_evaluacion: tiposEvaluacion[tipoEvaluacion],
            periodo_id: idPeriodo
        };

        return {
            promedios_por_tipo: promediosPorTipo,
            estadisticas_generales: estadisticasGenerales
        };

    } catch (error) {
        console.error('Error en servicio obtenerPromedioItemsPorTipo:', error);
        throw error;
    }
}

// Obtener preguntas con mejor y peor puntuación por tipo
async function obtenerPreguntasExtremas(idPeriodo, tipoEvaluacion) {
    try {
        const preguntasExtremas = await dashboardRepo.obtenerPreguntasExtremas(idPeriodo, tipoEvaluacion);
        
        const tiposEvaluacion = {
            1: 'Autoevaluación',
            2: 'Heteroevaluación',
            3: 'Coevaluación'
        };

        // Separar por tipo de pregunta y obtener extremos
        const resultados = {
            actitudinal: { mejores: [], peores: [] },
            conceptual: { mejores: [], peores: [] },
            procedimental: { mejores: [], peores: [] }
        };

        // Agrupar por tipo de pregunta
        const preguntasPorTipo = {
            actitudinal: [],
            conceptual: [],
            procedimental: []
        };

        preguntasExtremas.forEach(pregunta => {
            if (preguntasPorTipo[pregunta.tipo_pregunta]) {
                preguntasPorTipo[pregunta.tipo_pregunta].push({
                    id_pregunta: pregunta.id_pregunta,
                    texto_pregunta: pregunta.texto_pregunta,
                    promedio: parseFloat(pregunta.promedio_item),
                    total_respuestas: pregunta.total_respuestas,
                    tipo_pregunta: pregunta.tipo_pregunta
                });
            }
        });

        // Para cada tipo, obtener las 3 mejores y 3 peores
        Object.keys(preguntasPorTipo).forEach(tipo => {
            const preguntas = preguntasPorTipo[tipo];
            if (preguntas.length > 0) {
                // Ordenar por promedio descendente para mejores
                const mejores = preguntas
                    .sort((a, b) => b.promedio - a.promedio)
                    .slice(0, 3);

                // Ordenar por promedio ascendente para peores
                const peores = preguntas
                    .sort((a, b) => a.promedio - b.promedio)
                    .slice(0, 3);

                resultados[tipo] = {
                    mejores: mejores.map(p => ({
                        ...p,
                        promedio: p.promedio.toFixed(2)
                    })),
                    peores: peores.map(p => ({
                        ...p,
                        promedio: p.promedio.toFixed(2)
                    }))
                };
            }
        });

        return {
            preguntas_extremas: resultados,
            tipo_evaluacion: tiposEvaluacion[tipoEvaluacion],
            periodo_id: idPeriodo
        };

    } catch (error) {
        console.error('Error en servicio obtenerPreguntasExtremas:', error);
        throw error;
    }
}

// Obtener promedios por carrera filtrado por tipo de evaluación
async function obtenerPromediosPorCarrera(idPeriodo, tipoEvaluacion) {
    const tiposEvaluacion = {
        1: 'Autoevaluación',
        2: 'Heteroevaluación',
        3: 'Coevaluación'
    };
    try {
        const promediosCarrera = await dashboardRepo.obtenerPromediosPorCarrera(idPeriodo, tipoEvaluacion);
        
        // Organizar datos por carrera
        const carrerasData = {};
        
        promediosCarrera.forEach(item => {
            if (!carrerasData[item.nombre_carrera]) {
                carrerasData[item.nombre_carrera] = {
                    nombre_carrera: item.nombre_carrera,
                    total_docentes: item.total_docentes,
                    total_respuestas: item.total_respuestas,
                    promedio_general: 0, // Inicializar en 0
                    secciones: {}
                };
            }
            
            // Verificar que el promedio sea un número válido antes de parsearlo
            const promedioSeccion = (item.promedio_seccion === null || item.promedio_seccion === undefined || isNaN(item.promedio_seccion)) 
                ? 0 : parseFloat(item.promedio_seccion);
            
            carrerasData[item.nombre_carrera].secciones[item.tipo_pregunta] = {
                promedio: promedioSeccion.toFixed(2),
                total_respuestas: item.respuestas_seccion || 0
            };
        });

        // Calcular promedio general para cada carrera
        Object.keys(carrerasData).forEach(nombreCarrera => {
            const carrera = carrerasData[nombreCarrera];
            const secciones = Object.values(carrera.secciones);
            
            if (secciones.length > 0) {
                // Filtrar solo promedios válidos (mayores a 0)
                const promediosValidos = secciones
                    .map(seccion => parseFloat(seccion.promedio))
                    .filter(promedio => !isNaN(promedio) && promedio > 0);
                
                if (promediosValidos.length > 0) {
                    const sumaPromedios = promediosValidos.reduce((acc, promedio) => acc + promedio, 0);
                    carrera.promedio_general = (sumaPromedios / promediosValidos.length).toFixed(2);
                } else {
                    carrera.promedio_general = "0.00";
                }
            } else {
                carrera.promedio_general = "0.00";
            }
        });

        // Convertir a array y ordenar por promedio general
        const carrerasArray = Object.values(carrerasData)
            .sort((a, b) => parseFloat(b.promedio_general) - parseFloat(a.promedio_general));

        // Calcular estadísticas generales
        const carrerasConPromedioValido = carrerasArray.filter(carrera => parseFloat(carrera.promedio_general) > 0);
        
        const estadisticasGenerales = {
            total_carreras: carrerasArray.length,
            promedio_institucional: carrerasConPromedioValido.length > 0 ? 
                (carrerasConPromedioValido.reduce((acc, carrera) => 
                    acc + parseFloat(carrera.promedio_general), 0) / carrerasConPromedioValido.length).toFixed(2) : "0.00",
            total_docentes_evaluados: carrerasArray.reduce((acc, carrera) => acc + carrera.total_docentes, 0),
            total_respuestas: carrerasArray.reduce((acc, carrera) => acc + carrera.total_respuestas, 0),
            tipo_evaluacion: tiposEvaluacion[tipoEvaluacion] || 'Tipo desconocido',
            periodo_id: idPeriodo,
            carreras_con_datos: carrerasConPromedioValido.length
        };

        return {
            carreras: carrerasArray,
            estadisticas_generales: estadisticasGenerales
        };

    } catch (error) {
        console.error('Error en servicio obtenerPromediosPorCarrera:', error);
        throw error;
    }
}

// Obtener información del periodo
async function obtenerPeriodo(idPeriodo) {
    try {
        const periodo = await dashboardRepo.obtenerPeriodo(idPeriodo);
        return periodo;
    } catch (error) {
        console.error('Error en servicio obtenerPeriodo:', error);
        throw error;
    }
}

module.exports = {
    obtenerEstadisticasGenerales,
    obtenerDatosGraficos,
    obtenerDetalleParticipacionPorTipo,
    obtenerResultadosDetallados,
    obtenerEstadisticasPorTipoPregunta,
    obtenerRespuestasPorTipoYDocente,
    obtenerDatosMapaCalor,
    obtenerPromedioItemsPorTipo,
    obtenerPreguntasExtremas,
    obtenerPromediosPorCarrera,
    obtenerPeriodo
};