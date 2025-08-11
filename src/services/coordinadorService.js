const coordinadorRepository = require('../repositories/coordinadorRepository');

// Obtener datos para los selects (coordinadores y carreras)
async function obtenerDatosSelectsService() {
    try {
        const [coordinadores, carreras] = await Promise.all([
            coordinadorRepository.obtenerCoordinadoresRepository(),
            coordinadorRepository.obtenerCarrerasRepository()
        ]);

        return {
            success: true,
            data: {
                coordinadores,
                carreras
            }
        };
    } catch (error) {
        console.error('Error al obtener datos para selects:', error);
        return {
            success: false,
            message: 'Error al obtener datos para los selects',
            error: error.message
        };
    }
}

// Crear nueva asignación de coordinador
async function crearCoordinadorCarreraService(coordinadorData) {
    try {
        // Validar datos requeridos
        const { cedula, nombres, apellidos, correo, id_carrera } = coordinadorData;
        
        if (!cedula || !nombres || !apellidos || !correo || !id_carrera) {
            return {
                success: false,
                message: 'Todos los campos son obligatorios'
            };
        }

        // Verificar si ya existe un coordinador activo para esta carrera
        const existeCoordinador = await coordinadorRepository.verificarCoordinadorExistenteRepository(id_carrera);
        
        if (existeCoordinador) {
            return {
                success: false,
                message: 'Ya existe un coordinador activo asignado a esta carrera'
            };
        }

        // Crear la asignación
        const resultado = await coordinadorRepository.crearCoordinadorCarreraRepository(coordinadorData);

        if (resultado.affectedRows > 0) {
            return {
                success: true,
                message: 'Coordinador asignado exitosamente',
                data: { id: resultado.insertId }
            };
        } else {
            return {
                success: false,
                message: 'No se pudo crear la asignación del coordinador'
            };
        }
    } catch (error) {
        console.error('Error al crear coordinador-carrera:', error);
        return {
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        };
    }
}

// Obtener todas las asignaciones de coordinadores
async function obtenerAsignacionesCoordinadoresService() {
    try {
        const asignaciones = await coordinadorRepository.obtenerAsignacionesCoordinadoresRepository();
        
        return {
            success: true,
            data: asignaciones
        };
    } catch (error) {
        console.error('Error al obtener asignaciones de coordinadores:', error);
        return {
            success: false,
            message: 'Error al obtener las asignaciones de coordinadores',
            error: error.message
        };
    }
}

// Obtener coordinador por ID
async function obtenerCoordinadorPorIdService(id) {
    try {
        if (!id) {
            return {
                success: false,
                message: 'ID del coordinador es requerido'
            };
        }

        const coordinador = await coordinadorRepository.obtenerCoordinadorPorIdRepository(id);
        
        if (!coordinador) {
            return {
                success: false,
                message: 'Coordinador no encontrado'
            };
        }

        return {
            success: true,
            data: coordinador
        };
    } catch (error) {
        console.error('Error al obtener coordinador por ID:', error);
        return {
            success: false,
            message: 'Error al obtener el coordinador',
            error: error.message
        };
    }
}

// Actualizar asignación de coordinador
async function actualizarCoordinadorCarreraService(id, coordinadorData) {
    try {
        // Validar datos requeridos
        const { cedula, nombres, apellidos, correo, id_carrera } = coordinadorData;
        
        if (!cedula || !nombres || !apellidos || !correo || !id_carrera) {
            return {
                success: false,
                message: 'Todos los campos son obligatorios'
            };
        }

        // Verificar si el coordinador existe
        const coordinadorExistente = await coordinadorRepository.obtenerCoordinadorPorIdRepository(id);
        if (!coordinadorExistente) {
            return {
                success: false,
                message: 'Coordinador no encontrado'
            };
        }

        // Verificar si ya existe otro coordinador activo para esta carrera
        const existeOtroCoordinador = await coordinadorRepository.verificarCoordinadorExistenteRepository(id_carrera, id);
        
        if (existeOtroCoordinador) {
            return {
                success: false,
                message: 'Ya existe otro coordinador activo asignado a esta carrera'
            };
        }

        // Actualizar la asignación
        const resultado = await coordinadorRepository.actualizarCoordinadorCarreraRepository(id, coordinadorData);

        if (resultado.affectedRows > 0) {
            return {
                success: true,
                message: 'Coordinador actualizado exitosamente'
            };
        } else {
            return {
                success: false,
                message: 'No se pudo actualizar la asignación del coordinador'
            };
        }
    } catch (error) {
        console.error('Error al actualizar coordinador-carrera:', error);
        return {
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        };
    }
}

// Eliminar (desactivar) asignación de coordinador
async function eliminarCoordinadorCarreraService(id) {
    try {
        if (!id) {
            return {
                success: false,
                message: 'ID del coordinador es requerido'
            };
        }

        // Verificar si el coordinador existe
        const coordinadorExistente = await coordinadorRepository.obtenerCoordinadorPorIdRepository(id);
        if (!coordinadorExistente) {
            return {
                success: false,
                message: 'Coordinador no encontrado'
            };
        }

        // Eliminar (desactivar) la asignación
        const resultado = await coordinadorRepository.eliminarCoordinadorCarreraRepository(id);

        if (resultado.affectedRows > 0) {
            return {
                success: true,
                message: 'Coordinador eliminado exitosamente'
            };
        } else {
            return {
                success: false,
                message: 'No se pudo eliminar la asignación del coordinador'
            };
        }
    } catch (error) {
        console.error('Error al eliminar coordinador-carrera:', error);
        return {
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        };
    }
}

module.exports = {
    obtenerDatosSelectsService,
    crearCoordinadorCarreraService,
    obtenerAsignacionesCoordinadoresService,
    obtenerCoordinadorPorIdService,
    actualizarCoordinadorCarreraService,
    eliminarCoordinadorCarreraService
};