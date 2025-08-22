const pLimit = require('p-limit').default;
const evaluacionesRepository = require('../repositories/evaluacionesRepository');
const { dbLectura } = require('../config/database');
const { enviarCorreo } = require('./emailService');
const { cargarTemplateYReemplazar } = require('./plantillaCorreo');
const usuariosRepository = require('../repositories/usuarioRepository');
// Configurar límite de correos simultáneos (recomendado: 5 para Gmail)
const limit = pLimit(5);


// Función para crear una nueva evaluación
async function crearEvaluacion(usuario, data) {
    try {
        const evaluacionExistente = await evaluacionesRepository.existeEvaluacionPorFormularioYPeriodo(
            data.id_formulario,
            data.id_periodo
        );
        if (evaluacionExistente) {
            // Obtener información del período y formulario para el mensaje
            const [periodo, formulario] = await Promise.all([
                evaluacionesRepository.obtenerPeriodoPorId(data.id_periodo),
                evaluacionesRepository.obtenerFormularioPorId(data.id_formulario)
            ]);
            const nombrePeriodo = periodo?.descripcion || 'este período';
            const tipoEvaluacion = formulario?.nombre || 'este tipo de evaluación';
            // Crear error específico
            const error = new Error(
                `Ya existe una evaluación de tipo "${tipoEvaluacion}" para el período "${nombrePeriodo}".`
            );
            error.tipo = 'EVALUACION_DUPLICADA';
            error.detalles = {
                tipo_evaluacion: tipoEvaluacion,
                periodo: nombrePeriodo,
                evaluacion_existente_id: evaluacionExistente.id_evaluacion
            };
            throw error;
        }
        // Si es una evaluación específica usuario-docente (no autoevaluación)
        if (data.evaluado_id && usuario.id) {
            const duplicadaUsuario = await evaluacionesRepository.existeEvaluacionDuplicada({
                evaluador_id: usuario.id,
                evaluado_id: data.evaluado_id,
                id_formulario: data.id_formulario,
                id_periodo: data.id_periodo,
                id_distributivo: data.id_distributivo
            });
            if (duplicadaUsuario) {
                const error = new Error('Ya has evaluado a este docente en este período.');
                error.tipo = 'EVALUACION_DUPLICADA_USUARIO';
                throw error;
            }
        }
        // Crear la nueva evaluación
        const nuevaEvaluacion = {
            id_formulario: data.id_formulario,
            id_periodo: data.id_periodo,
            fecha_inicio: data.fecha_inicio || new Date(),
            fecha_fin: data.fecha_fin || null,
            estado: 'pendiente',
            fecha_notificacion: data.fecha_notificacion || null
        };
        const evaluacion = await evaluacionesRepository.crearEvaluacion(nuevaEvaluacion);
        return evaluacion;
    } catch (error) {
        console.error('Error en crearEvaluacion service:', error);
        throw error;
    }
}

// Función para guardar respuestas
async function guardarRespuestas(idEvaluacion, respuestas, idUsuario) {
    let evaluadoId = null;
    let idDistributivo = null;
    for (const respuesta of respuestas) {
        if (!respuesta.evaluado_id || !respuesta.id_distributivo) {
            throw new Error('Cada respuesta debe incluir evaluado_id e id_distributivo');
        }
        // Guardamos una sola vez estos valores para registrar la evaluación al final
        evaluadoId = respuesta.evaluado_id;
        idDistributivo = respuesta.id_distributivo;
        await evaluacionesRepository.guardarRespuesta(idEvaluacion, respuesta, idUsuario);
    }
    // Marcamos evaluación como completada (en tabla nueva)
    await evaluacionesRepository.registrarEvaluacionRealizada({
        idEvaluacion,
        evaluadorId: idUsuario,
        evaluadoId,
        idDistributivo,
    });
    await evaluacionesRepository.finalizarEvaluacion(idEvaluacion);
}

// Función para obtener evaluación por ID (se ocupa para cargar la evaluación formualrio en el frontend)
const obtenerEvaluacionPorId = async (idEvaluacion, idDistributivo = null) => {
    return await evaluacionesRepository.obtenerEvaluacionPorId(idEvaluacion, idDistributivo);
};

// Función para obtener resúmenes de evaluaciones por período (se ocupa en la tabla de resumen)
async function obtenerResúmenesPorPeriodo(idEvaluador, idPeriodo) {
    return await evaluacionesRepository.obtenerResúmenesPorPeriodo(idEvaluador, idPeriodo);
}

// Función para obtener mis evaluaciones por período (si se usa)
async function obtenerMisEvaluacionesPorPeriodo(idEstudiante) {
    try {
        // Primero obtenemos el período actual
        const idPeriodo = await evaluacionesRepository.obtenerPeriodoActual();
        if (!idPeriodo) {
            throw new Error('No se encontró un período activo');
        }
        // Obtener evaluaciones del período para este estudiante
        const evaluaciones = await evaluacionesRepository.obtenerEvaluacionesPorPeriodo(idEstudiante, idPeriodo);
        return evaluaciones;
    } catch (error) {
        console.error('Error al obtener evaluaciones del estudiante:', error);
        throw error;
    }
}

// Función para obtener todas las evaluaciones de un usuario (se usa en el perfil admin para la tabla de evaluaciones)
async function obtenerTodasMisEvaluaciones(idEstudiante) {
    return await evaluacionesRepository.obtenerTodasEvaluacionesDelUsuario(idEstudiante);
}

// Función para obtener evaluaciones de estudiante (solo heteroevaluaciones)
async function obtenerEvaluacionesEstudiante(idEstudiante) {
    try {
        const evaluaciones = await evaluacionesRepository.obtenerEvaluacionesEstudiantePorId(idEstudiante);
        return evaluaciones;
    } catch (error) {
        console.error('Error al obtener evaluaciones de estudiante:', error);
        throw error;
    }
}

// Función para obtener evaluaciones de docente por ID (para coevaluación y autoevaluación)
async function obtenerEvaluacionesDocentePorId(idDocente, idUsuario) {
    return await evaluacionesRepository.obtenerEvaluacionesDocentePorId(idDocente, idUsuario);
}

// Función para obtener evaluaciones de docente por cédula (para coevaluación y autoevaluación)
async function obtenerEvaluacionesDocentePorCedula(cedula, idUsuario) {
    const [[{ ID_DOCENTE } = {}]] = await dbLectura.query(`
        SELECT ID_DOCENTE FROM HORARIOS_DOCENTE WHERE CEDULA_DOCENTE = ?
    `, [cedula]);
    if (!ID_DOCENTE) return [];
    return await obtenerEvaluacionesDocentePorId(ID_DOCENTE, idUsuario);
}


// Función optimizada para notificar evaluación
async function notificarEvaluacion(idEvaluacion) {
    try {
        const evaluacion = await usuariosRepository.obtenerEvaluacionPorId(idEvaluacion);
        if (!evaluacion) throw new Error('Evaluación no encontrada');

        const idFormulario = evaluacion.id_formulario;
        const periodo = evaluacion.id_periodo;
        let tipo, tipoFormal;
        let destinatarios = [];

        if (idFormulario === 2) {
            tipo = 'hetero';
            tipoFormal = 'Heteroevaluación';
        } else if (idFormulario === 1) {
            tipo = 'auto';
            tipoFormal = 'Autoevaluación';
        } else if (idFormulario === 3) {
            tipo = 'coe';
            tipoFormal = 'Coevaluación';
        } else {
            throw new Error('Tipo de formulario no reconocido');
        }

        if (tipo === 'hetero') {
            const estudiantes = await usuariosRepository.obtenerCorreosEstudiantesPorPeriodo(periodo);
            destinatarios = estudiantes.map(est => ({
                correo: est.correo,
                nombre: est.nombre,
                tipo: 'estudiante'
            }));
        }
        else if (tipo === 'auto') {
            const docentes = await usuariosRepository.obtenerCorreosDocentesPorPeriodo(periodo);
            destinatarios = docentes.map(doc => ({
                correo: doc.correo,
                nombre: doc.nombre,
                tipo: 'docente'
            }));
        }
        else if (tipo === 'coe') {
            // Notificar a todos los coordinadores en coevaluaciones
            const coordinadores = await usuariosRepository.obtenerCorreoCoordinador();
            if (coordinadores && coordinadores.length > 0) {
                coordinadores.forEach(coordinador => {
                    destinatarios.push({
                        correo: coordinador.correo,
                        nombre: coordinador.nombre,
                        tipo: 'coordinador'
                    });
                });
            }
        }

        if (destinatarios.length === 0) {
            throw new Error(`No se encontraron destinatarios para ${tipoFormal} en el periodo ${periodo}`);
        }

        // ENVÍO EN PARALELO CON LÍMITE DE CONCURRENCIA
        const promesasEnvio = destinatarios.map(destinatario =>
            limit(async () => {
                try {
                    const esCoordinador = destinatario.tipo === 'coordinador' && tipo === 'coe';
                    const esReNotificacion = evaluacion.fecha_notificacion ? true : false;
                    const prefijoMensaje = esReNotificacion ? 'RECORDATORIO: ' : '';

                    // MENSAJE_ESPECIAL personalizado
                    let mensajeEspecial = '';
                    if (esCoordinador) {
                        mensajeEspecial = `Como coordinador, asigna los docentes que se evaluarán mutuamente en esta coevaluación y notifícales desde tu panel de control.`;
                        if (esReNotificacion) {
                            mensajeEspecial += ' (RECORDATORIO)';
                        }
                    } else if (tipo === 'auto') {
                        mensajeEspecial = `${prefijoMensaje}Por favor, realiza tu autoevaluación correspondiente a este periodo desde tu panel de usuario.`;
                    } else if (tipo === 'coe') {
                        mensajeEspecial = `${prefijoMensaje}Has sido seleccionado para coevaluar a tus colegas docentes. Ingresa a tu panel para completar las evaluaciones asignadas.`;
                    } else if (tipo === 'hetero') {
                        mensajeEspecial = `${prefijoMensaje}Tienes una heteroevaluación pendiente. Ingresa al sistema y completa la evaluación asignada.`;
                    }

                    const mensajeContacto = esCoordinador
                        ? ''
                        : '<p>Si tienes dudas, comunícate con el coordinador académico.</p>';

                    const correoDestino = destinatario.correo;

                    const html = cargarTemplateYReemplazar({
                        NOMBRE: destinatario.nombre,
                        TIPO_EVALUACION: tipoFormal,
                        PERIODO: evaluacion.nombre_periodo || 'Periodo actual',
                        MENSAJE_ESPECIAL: mensajeEspecial,
                        CONDICIONAL_CONTACTO: mensajeContacto,
                        SITIO_URL: 'https://evaluacion.istla-sigala.edu.ec/',
                        ANIO: new Date().getFullYear()
                    });

                    const asunto = esCoordinador
                        ? `${prefijoMensaje}Asignación de Coevaluación Requerida`
                        : `${prefijoMensaje}Evaluación ${tipoFormal} ${esReNotificacion ? '- Recordatorio' : 'asignada'}`;

                    // VERIFICAR QUE LA FUNCIÓN EXISTE ANTES DE LLAMARLA
                    if (typeof enviarCorreo !== 'function') {
                        throw new Error('La función enviarCorreo no está disponible');
                    }

                    await enviarCorreo(correoDestino, asunto, html);
                    return { exito: true, correo: destinatario.correo };
                } catch (error) {
                    console.error(`❌ Error enviando correo a ${destinatario.correo}:`, error.message);
                    return { exito: false, correo: destinatario.correo, error: error.message };
                }
            })
        );

        // Esperar a que todos los correos se envíen
        const resultados = await Promise.all(promesasEnvio);

        const enviadosExitosos = resultados.filter(r => r.exito).length;
        const erroresEnvio = resultados.filter(r => !r.exito).map(r => `${r.correo}: ${r.error}`);

        // Actualizar fecha de notificación si se enviaron correos exitosamente
        if (enviadosExitosos > 0) {
            const fechaActual = new Date();
            await evaluacionesRepository.actualizarFechaNotificacion(idEvaluacion, fechaActual);
        }

        return {
            totalDestinatarios: destinatarios.length,
            enviadosExitosos,
            errores: erroresEnvio,
            fechaNotificacion: enviadosExitosos > 0 ? new Date() : null,
            tipo: tipo,
            esReNotificacion: evaluacion.fecha_notificacion ? true : false,
        };

    } catch (error) {
        console.error('❌ Error en notificarEvaluacion:', error);
        throw error;
    }
}

// Eliminar evaluación
async function eliminarEvaluacion(idEvaluacion) {
    return await evaluacionesRepository.eliminarEvaluacionPorId(idEvaluacion);
}

// Editar evaluación
async function editarEvaluacion(idEvaluacion, data) {
    try {
        // Si se está cambiando el formulario o período, validar duplicados
        if (data.id_formulario || data.id_periodo) {
            // Obtener la evaluación actual para comparar
            const evaluacionActual = await evaluacionesRepository.obtenerEvaluacionPorId(idEvaluacion);
            if (!evaluacionActual) {
                throw new Error('Evaluación no encontrada');
            }

            // Usar los valores nuevos o mantener los actuales
            const formularioFinal = data.id_formulario || evaluacionActual.id_formulario;
            const periodoFinal = data.id_periodo || evaluacionActual.id_periodo;

            // Solo validar si realmente hay cambios en formulario o período
            if (formularioFinal !== evaluacionActual.id_formulario || periodoFinal !== evaluacionActual.id_periodo) {
                // Verificar si ya existe una evaluación con el mismo formulario y período (excluyendo la actual)
                const evaluacionExistente = await evaluacionesRepository.existeEvaluacionPorFormularioYPeriodoExcluyendo(
                    formularioFinal,
                    periodoFinal,
                    idEvaluacion
                );

                if (evaluacionExistente) {
                    // Obtener información del período y formulario para el mensaje
                    const [periodo, formulario] = await Promise.all([
                        evaluacionesRepository.obtenerPeriodoPorId(periodoFinal),
                        evaluacionesRepository.obtenerFormularioPorId(formularioFinal)
                    ]);
                    const nombrePeriodo = periodo?.descripcion || 'este período';
                    const tipoEvaluacion = formulario?.nombre || 'este tipo de evaluación';
                    
                    // Crear error específico
                    const error = new Error(
                        `Ya existe una evaluación de tipo "${tipoEvaluacion}" para el período "${nombrePeriodo}".`
                    );
                    error.tipo = 'EVALUACION_DUPLICADA';
                    error.detalles = {
                        tipo_evaluacion: tipoEvaluacion,
                        periodo: nombrePeriodo,
                        evaluacion_existente_id: evaluacionExistente.id_evaluacion
                    };
                    throw error;
                }
            }
        }

        return await evaluacionesRepository.actualizarEvaluacionPorId(idEvaluacion, data);
    } catch (error) {
        console.error('Error en editarEvaluacion service:', error);
        throw error;
    }
}

module.exports = {
    crearEvaluacion,
    guardarRespuestas,
    obtenerEvaluacionPorId,
    obtenerResúmenesPorPeriodo,
    obtenerMisEvaluacionesPorPeriodo,
    obtenerTodasMisEvaluaciones,
    obtenerEvaluacionesEstudiante,
    obtenerEvaluacionesDocentePorId,
    obtenerEvaluacionesDocentePorCedula,
    notificarEvaluacion,
    eliminarEvaluacion,
    editarEvaluacion
};