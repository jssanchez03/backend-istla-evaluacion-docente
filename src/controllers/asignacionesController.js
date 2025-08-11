const asignacionesService = require('../services/asignacionesService');

async function crearAsignacion(req, res) {
    try {
        // Solo extraer los campos que existen en la tabla actualizada
        const { 
            id_periodo, 
            id_docente_evaluador, 
            id_docente_evaluado, 
            fecha,
            hora_inicio,
            hora_fin,
            dia,
            id_asignatura
        } = req.body;        
        
        // Validación básica
        if (!id_periodo || !id_docente_evaluador || !id_docente_evaluado) {
            return res.status(400).json({ 
                error: 'Faltan datos requeridos: id_periodo, id_docente_evaluador, id_docente_evaluado' 
            });
        }        
        
        // Validar que sean números
        if (isNaN(id_periodo) || isNaN(id_docente_evaluador) || isNaN(id_docente_evaluado)) {
            return res.status(400).json({ 
                error: 'Los IDs deben ser números válidos' 
            });
        }

        // Validar id_asignatura si se proporciona
        if (id_asignatura && isNaN(id_asignatura)) {
            return res.status(400).json({ 
                error: 'El ID de asignatura debe ser un número válido' 
            });
        }        
        
        const nuevaAsignacion = await asignacionesService.asignarCoevaluador({
            id_periodo: parseInt(id_periodo),
            id_docente_evaluador: parseInt(id_docente_evaluador),
            id_docente_evaluado: parseInt(id_docente_evaluado),
            fecha: fecha || null,
            hora_inicio: hora_inicio || null,
            hora_fin: hora_fin || null,
            dia: dia || null,
            id_asignatura: id_asignatura ? parseInt(id_asignatura) : null
        });        
        
        res.status(201).json({ 
            success: true,
            message: 'Asignación creada exitosamente',
            id_asignacion: nuevaAsignacion 
        });
    } catch (error) {
        console.error('Error al crear asignación:', error);                
        
        // Manejo de errores específicos
        if (error.message.includes('Ya existe una asignación entre estos docentes para esta asignatura')) {
            return res.status(409).json({ 
                error: 'Ya existe una asignación entre estos docentes para esta asignatura en este período. Selecciona una asignatura diferente.' 
            });
        }        
        
        if (error.message.includes('Ya existe una asignación general')) {
            return res.status(409).json({ 
                error: 'Ya existe una asignación general entre estos docentes para este período. Especifica una asignatura para crear una nueva asignación.' 
            });
        }               
        
        if (error.message.includes('no existe') || error.message.includes('no puede evaluarse')) {
            return res.status(400).json({ error: error.message });
        }        
        
        res.status(500).json({ error: 'Error interno del servidor al crear la asignación' });
    }
}

async function obtenerAsignaciones(req, res) {
    try {
        const { idPeriodo } = req.params;
        if (!idPeriodo || isNaN(idPeriodo)) {
            return res.status(400).json({ 
                error: 'El ID del período debe ser un número válido' 
            });
        }
        const asignaciones = await asignacionesService.listarAsignaciones(parseInt(idPeriodo));
        res.json(asignaciones);
    } catch (error) {
        console.error('Error al obtener asignaciones:', error);
        res.status(500).json({ error: 'Error al obtener las asignaciones' });
    }
}

async function eliminarAsignacion(req, res) {
    try {
        const { idAsignacion } = req.params;
        if (!idAsignacion || isNaN(idAsignacion)) {
            return res.status(400).json({ 
                error: 'El ID de la asignación debe ser un número válido' 
            });
        }
        await asignacionesService.eliminarAsignacion(parseInt(idAsignacion));
        res.status(200).json({ 
            success: true,
            message: 'Asignación eliminada exitosamente' 
        });
    } catch (error) {
        console.error('Error al eliminar asignación:', error);
        res.status(500).json({ error: 'Error al eliminar la asignación' });
    }
}

async function editarAsignacion(req, res) {
    try {
        const { idAsignacion } = req.params;
        if (!idAsignacion || isNaN(idAsignacion)) {
            return res.status(400).json({ error: 'El ID de la asignación debe ser un número válido' });
        }
        await asignacionesService.editarAsignacion(parseInt(idAsignacion), req.body);
        res.status(200).json({ success: true, message: 'Asignación editada exitosamente' });
    } catch (error) {
        console.error('Error al editar asignación:', error);
        res.status(500).json({ error: 'Error al editar la asignación', detalles: error.message });
    }
}

// Obtener docentes evaluadores por periodo
async function getDocentesEvaluadores(req, res) {
    try {
        const { idPeriodo } = req.params;
        if (!idPeriodo || isNaN(idPeriodo)) {
            return res.status(400).json({ 
                error: 'El ID del período debe ser un número válido' 
            });
        }
        const docentes = await asignacionesService.obtenerDocentesEvaluadores(parseInt(idPeriodo));        
        res.json({
            success: true,
            total: docentes.length,
            data: docentes
        });
    } catch (error) {
        console.error('Error al obtener docentes evaluadores:', error);
        res.status(500).json({ error: 'Error al obtener los docentes evaluadores' });
    }
}

// Obtener docentes con materias por periodo
async function getDocentesConMaterias(req, res) {
    try {
        const { idPeriodo } = req.params;
        if (!idPeriodo || isNaN(idPeriodo)) {
            return res.status(400).json({ 
                error: 'El ID del período debe ser un número válido' 
            });
        }
        const docentes = await asignacionesService.obtenerDocentesConMateriasPorPeriodo(parseInt(idPeriodo));        
        res.json({
            success: true,
            total: docentes.length,
            data: docentes
        });
    } catch (error) {
        console.error('Error al obtener docentes con materias:', error);
        res.status(500).json({ error: 'Error al obtener los docentes con materias' });
    }
}

async function getAsignacionesCompletas(req, res) {
    try {
        const asignaciones = await asignacionesService.obtenerAsignacionesCompletas();        
        res.json({
            success: true,
            total: asignaciones.length,
            data: asignaciones
        });
    } catch (error) {
        console.error('Error al obtener asignaciones completas:', error);
        res.status(500).json({ error: 'Error al obtener las asignaciones completas' });
    }
}

// Obtener asignaturas por periodo
async function getAsignaturasPorPeriodo(req, res) {
    try {
        const { idPeriodo } = req.params;
        if (!idPeriodo || isNaN(idPeriodo)) {
            return res.status(400).json({ 
                error: 'El ID del período debe ser un número válido' 
            });
        }
        const asignaturas = await asignacionesService.obtenerAsignaturasPorPeriodo(parseInt(idPeriodo));        
        res.json({
            success: true,
            total: asignaturas.length,
            data: asignaturas
        });
    } catch (error) {
        console.error('Error al obtener asignaturas:', error);
        res.status(500).json({ error: 'Error al obtener las asignaturas' });
    }
}

module.exports = {
    crearAsignacion,
    obtenerAsignaciones,
    eliminarAsignacion,
    editarAsignacion,
    getDocentesEvaluadores,
    getDocentesConMaterias,
    getAsignacionesCompletas,
    getAsignaturasPorPeriodo
};