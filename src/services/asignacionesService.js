const asignacionesRepository = require('../repositories/asignacionesRepository');

async function asignarCoevaluador(data) {
    // Validaciones básicas
    if (!data.id_periodo || !data.id_docente_evaluador || !data.id_docente_evaluado) {
        throw new Error('Faltan datos requeridos: período, docente evaluador y docente evaluado');
    }    
    if (data.id_docente_evaluador === data.id_docente_evaluado) {
        throw new Error('Un docente no puede evaluarse a sí mismo');
    }    
    
    // VALIDACIÓN DE FECHA: Solo verificar que no sea anterior a hoy
    if (data.fecha) {
        console.log('Fecha recibida del frontend:', data.fecha);
        console.log('Tipo de fecha recibida:', typeof data.fecha);
        
        // Parsear la fecha manualmente para evitar problemas de zona horaria
        const [year, month, day] = data.fecha.split('-').map(Number);
        const fechaAsignacion = new Date(year, month - 1, day); // month - 1 porque Date usa 0-11
        const fechaActual = new Date();
        
        // Resetear las horas para comparar solo fechas
        fechaActual.setHours(0, 0, 0, 0);
        fechaAsignacion.setHours(0, 0, 0, 0);
        
        // Debug: Mostrar las fechas para verificar
        console.log('Fecha asignación:', fechaAsignacion.toDateString());
        console.log('Fecha actual:', fechaActual.toDateString());
        console.log('¿Es anterior?', fechaAsignacion < fechaActual);
        
        if (fechaAsignacion < fechaActual) {
            throw new Error('No se puede crear una asignación con una fecha anterior a la fecha actual');
        }
        
        // Si se proporcionan horas, solo validar que la hora de fin sea posterior a la hora de inicio
        if (data.hora_inicio && data.hora_fin) {
            const [horaInicio, minutoInicio] = data.hora_inicio.split(':').map(Number);
            const [horaFin, minutoFin] = data.hora_fin.split(':').map(Number);
            
            const fechaHoraInicio = new Date(data.fecha);
            fechaHoraInicio.setHours(horaInicio, minutoInicio, 0, 0);
            
            const fechaHoraFin = new Date(data.fecha);
            fechaHoraFin.setHours(horaFin, minutoFin, 0, 0);
            
            if (fechaHoraFin <= fechaHoraInicio) {
                throw new Error('La hora de fin debe ser posterior a la hora de inicio');
            }
        }
    }
    
    // Verificar que existan los docentes y el período
    const [docenteEvaluadorExiste, docenteEvaluadoExiste, periodoExiste] = await Promise.all([
        asignacionesRepository.verificarDocente(data.id_docente_evaluador),
        asignacionesRepository.verificarDocente(data.id_docente_evaluado),
        asignacionesRepository.verificarPeriodo(data.id_periodo)
    ]);    
    if (!docenteEvaluadorExiste) {
        throw new Error('El docente evaluador no existe');
    }
    if (!docenteEvaluadoExiste) {
        throw new Error('El docente evaluado no existe');
    }
    if (!periodoExiste) {
        throw new Error('El período no existe');
    }    
    // NUEVA VALIDACIÓN: Verificar si ya existe una asignación específica
    const yaExiste = await asignacionesRepository.verificarAsignacionExistente(
        data.id_periodo,
        data.id_docente_evaluador,
        data.id_docente_evaluado,
        data.id_asignatura || null
    );    
    if (yaExiste) {
        if (data.id_asignatura) {
            throw new Error('Ya existe una asignación entre estos docentes para esta asignatura en este período');
        } else {
            throw new Error('Ya existe una asignación general entre estos docentes para este período');
        }
    }   
    return await asignacionesRepository.crearAsignacion(data);
}

async function listarAsignaciones(id_periodo) {
    if (!id_periodo) {
        throw new Error('El ID del período es requerido');
    }
    return await asignacionesRepository.obtenerAsignacionesPorPeriodo(id_periodo);
}

async function eliminarAsignacion(id_asignacion) {
    if (!id_asignacion) {
        throw new Error('El ID de la asignación es requerido');
    }
    return await asignacionesRepository.eliminarAsignacion(id_asignacion);
}

async function editarAsignacion(id_asignacion, data) {
    if (!id_asignacion) {
        throw new Error('El ID de la asignación es requerido');
    }
    // Validaciones básicas (puedes agregar más si lo deseas)
    if (!data.id_periodo || !data.id_docente_evaluador || !data.id_docente_evaluado) {
        throw new Error('Faltan datos requeridos: período, docente evaluador y docente evaluado');
    }
    if (data.id_docente_evaluador === data.id_docente_evaluado) {
        throw new Error('Un docente no puede evaluarse a sí mismo');
    }
    
    // VALIDACIÓN DE FECHA: Solo verificar que no sea anterior a hoy
    if (data.fecha) {
        // Parsear la fecha manualmente para evitar problemas de zona horaria
        const [year, month, day] = data.fecha.split('-').map(Number);
        const fechaAsignacion = new Date(year, month - 1, day); // month - 1 porque Date usa 0-11
        const fechaActual = new Date();
        
        // Resetear las horas para comparar solo fechas
        fechaActual.setHours(0, 0, 0, 0);
        fechaAsignacion.setHours(0, 0, 0, 0);
        
        if (fechaAsignacion < fechaActual) {
            throw new Error('No se puede editar una asignación con una fecha anterior a la fecha actual');
        }
        
        // Si se proporcionan horas, solo validar que la hora de fin sea posterior a la hora de inicio
        if (data.hora_inicio && data.hora_fin) {
            const [horaInicio, minutoInicio] = data.hora_inicio.split(':').map(Number);
            const [horaFin, minutoFin] = data.hora_fin.split(':').map(Number);
            
            const fechaHoraInicio = new Date(data.fecha);
            fechaHoraInicio.setHours(horaInicio, minutoInicio, 0, 0);
            
            const fechaHoraFin = new Date(data.fecha);
            fechaHoraFin.setHours(horaFin, minutoFin, 0, 0);
            
            if (fechaHoraFin <= fechaHoraInicio) {
                throw new Error('La hora de fin debe ser posterior a la hora de inicio');
            }
        }
    }
    
    return await asignacionesRepository.editarAsignacion(id_asignacion, data);
}

function toTitleCase(str) {
    if (!str || typeof str !== 'string') return str;
    return str
        .toLowerCase()
        .trim()
        .split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Función para limpiar y validar nombres de docentes
function limpiarNombreDocente(nombre) {
    if (!nombre || typeof nombre !== 'string') return null;
    const nombreLimpio = nombre.trim().replace(/\s+/g, ' ');
    // Filtrar nombres inválidos
    if (nombreLimpio === '' ||
        nombreLimpio.includes('@') ||
        nombreLimpio.length < 2 ||
        nombreLimpio.toLowerCase() === 'null' ||
        nombreLimpio.toLowerCase() === 'undefined') {
        return null;
    }
    return toTitleCase(nombreLimpio);
}

// Obtener docentes evaluadores por periodo
async function obtenerDocentesEvaluadores(idPeriodo) {
    if (!idPeriodo) {
        throw new Error('El ID del período es requerido');
    }
    try {
        const docentes = await asignacionesRepository.obtenerDocentesEvaluadores(idPeriodo);
        return docentes
            .map(d => ({
                ...d,
                nombre: limpiarNombreDocente(d.nombre)
            }))
            .filter(d => d.nombre !== null) // Filtrar nombres inválidos
            .sort((a, b) => a.nombre.localeCompare(b.nombre)); // Ordenar alfabéticamente
    } catch (error) {
        console.error('Error en obtenerDocentesEvaluadores:', error);
        throw new Error('Error al obtener los docentes evaluadores');
    }
}

// Obtener docentes con sus materias por periodo
async function obtenerDocentesConMateriasPorPeriodo(idPeriodo) {
    if (!idPeriodo) {
        throw new Error('El ID del período es requerido');
    }
    try {
        const docentes = await asignacionesRepository.obtenerDocentesConMateriasPorPeriodo(idPeriodo);
        // Limpiar nombres y filtrar registros inválidos
        const docentesLimpios = docentes
            .map(d => ({
                ...d,
                nombre: limpiarNombreDocente(d.nombre)
            }))
            .filter(d => d.nombre !== null);
        // Agrupar por docente y sus materias
        const docentesAgrupados = {};
        docentesLimpios.forEach(d => {
            if (!docentesAgrupados[d.id_docente]) {
                docentesAgrupados[d.id_docente] = {
                    id_docente: d.id_docente,
                    nombre: d.nombre,
                    materias: []
                };
            }
            // Evitar materias duplicadas
            const materiaExiste = docentesAgrupados[d.id_docente].materias.some(
                m => m.id_distributivo === d.id_distributivo
            );
            if (!materiaExiste) {
                docentesAgrupados[d.id_docente].materias.push({
                    id_distributivo: d.id_distributivo,
                    id_asignatura: d.id_asignatura,
                    nombre_asignatura: d.nombre_asignatura || 'Materia sin nombre'
                });
            }
        });
        // Convertir a array y ordenar
        const resultado = Object.values(docentesAgrupados)
            .filter(d => d.materias.length > 0) // Solo docentes con materias
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
        return resultado;
    } catch (error) {
        console.error('Error en obtenerDocentesConMateriasPorPeriodo:', error);
        throw new Error('Error al obtener los docentes con materias');
    }
}

async function obtenerAsignacionesCompletas() {
    try {
        const asignaciones = await asignacionesRepository.obtenerAsignacionesCompletas();
        return asignaciones.map(asig => ({
            ...asig,
            nombre_evaluador: limpiarNombreDocente(asig.nombre_evaluador) || 'Docente no encontrado',
            nombre_evaluado: limpiarNombreDocente(asig.nombre_evaluado) || 'Docente no encontrado'
        }));
    } catch (error) {
        console.error('Error en obtenerAsignacionesCompletas:', error);
        throw new Error('Error al obtener las asignaciones completas');
    }
}

// Obtener asignaturas por periodo
async function obtenerAsignaturasPorPeriodo(idPeriodo) {
    if (!idPeriodo) {
        throw new Error('El ID del período es requerido');
    }
    try {
        return await asignacionesRepository.obtenerAsignaturasPorPeriodo(idPeriodo);
    } catch (error) {
        console.error('Error en obtenerAsignaturasPorPeriodo:', error);
        throw new Error('Error al obtener las asignaturas');
    }
}

// Función para formatear nombres correctamente (primera letra mayúscula, resto minúscula)
function formatearNombre(nombre) {
    return limpiarNombreDocente(nombre) || '';
}

module.exports = {
    asignarCoevaluador,
    listarAsignaciones,
    eliminarAsignacion,
    editarAsignacion,
    obtenerDocentesEvaluadores,
    obtenerDocentesConMateriasPorPeriodo,
    obtenerAsignacionesCompletas,
    obtenerAsignaturasPorPeriodo,
    formatearNombre
};