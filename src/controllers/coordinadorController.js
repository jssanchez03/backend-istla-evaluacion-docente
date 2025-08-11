const coordinadorService = require('../services/coordinadorService');

// Obtener datos para los selects (coordinadores y carreras)
const obtenerDatosSelects = async (req, res) => {
    try {
        const resultado = await coordinadorService.obtenerDatosSelectsService();
        
        if (resultado.success) {
            res.status(200).json({
                success: true,
                data: resultado.data
            });
        } else {
            res.status(400).json({
                success: false,
                message: resultado.message
            });
        }
    } catch (error) {
        console.error('Error en obtenerDatosSelects:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Crear nueva asignación de coordinador
const crearCoordinadorCarrera = async (req, res) => {
    try {
        const coordinadorData = req.body;
        const resultado = await coordinadorService.crearCoordinadorCarreraService(coordinadorData);
        
        if (resultado.success) {
            res.status(201).json({
                success: true,
                message: resultado.message,
                data: resultado.data
            });
        } else {
            res.status(400).json({
                success: false,
                message: resultado.message
            });
        }
    } catch (error) {
        console.error('Error en crearCoordinadorCarrera:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Obtener todas las asignaciones de coordinadores
const obtenerAsignacionesCoordinadores = async (req, res) => {
    try {
        const resultado = await coordinadorService.obtenerAsignacionesCoordinadoresService();
        
        if (resultado.success) {
            res.status(200).json({
                success: true,
                data: resultado.data
            });
        } else {
            res.status(400).json({
                success: false,
                message: resultado.message
            });
        }
    } catch (error) {
        console.error('Error en obtenerAsignacionesCoordinadores:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Obtener coordinador por ID
const obtenerCoordinadorPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const resultado = await coordinadorService.obtenerCoordinadorPorIdService(id);
        
        if (resultado.success) {
            res.status(200).json({
                success: true,
                data: resultado.data
            });
        } else {
            res.status(404).json({
                success: false,
                message: resultado.message
            });
        }
    } catch (error) {
        console.error('Error en obtenerCoordinadorPorId:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Actualizar asignación de coordinador
const actualizarCoordinadorCarrera = async (req, res) => {
    try {
        const { id } = req.params;
        const coordinadorData = req.body;
        const resultado = await coordinadorService.actualizarCoordinadorCarreraService(id, coordinadorData);
        
        if (resultado.success) {
            res.status(200).json({
                success: true,
                message: resultado.message
            });
        } else {
            res.status(400).json({
                success: false,
                message: resultado.message
            });
        }
    } catch (error) {
        console.error('Error en actualizarCoordinadorCarrera:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

// Eliminar (desactivar) asignación de coordinador
const eliminarCoordinadorCarrera = async (req, res) => {
    try {
        const { id } = req.params;
        const resultado = await coordinadorService.eliminarCoordinadorCarreraService(id);
        
        if (resultado.success) {
            res.status(200).json({
                success: true,
                message: resultado.message
            });
        } else {
            res.status(404).json({
                success: false,
                message: resultado.message
            });
        }
    } catch (error) {
        console.error('Error en eliminarCoordinadorCarrera:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

module.exports = {
    obtenerDatosSelects,
    crearCoordinadorCarrera,
    obtenerAsignacionesCoordinadores,
    obtenerCoordinadorPorId,
    actualizarCoordinadorCarrera,
    eliminarCoordinadorCarrera
};