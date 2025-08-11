const formulariosService = require('../services/formulariosService');

// Formularios
async function listarFormularios(req, res) {
    try {
        const formularios = await formulariosService.listarFormularios();
        res.json(formularios);
    } catch (error) {
        console.error('Error en listarFormularios:', error);
        res.status(500).json({ error: 'Error al listar formularios' });
    }
}

async function crearFormulario(req, res) {
    try {
        const nuevoFormulario = await formulariosService.crearFormulario(req.body);
        res.status(201).json(nuevoFormulario);
    } catch (error) {
        console.error('Error en crearFormulario:', error);
        res.status(500).json({ error: 'Error al crear formulario' });
    }
}

async function actualizarFormulario(req, res) {
    try {
        const { id } = req.params;
        const formularioActualizado = await formulariosService.actualizarFormulario(id, req.body);
        res.json(formularioActualizado);
    } catch (error) {
        console.error('Error en actualizarFormulario:', error);
        res.status(500).json({ error: 'Error al actualizar formulario' });
    }
}

async function eliminarFormulario(req, res) {
    try {
        const { id } = req.params;
        await formulariosService.eliminarFormulario(id);
        res.status(204).send();
    } catch (error) {
        console.error('Error en eliminarFormulario:', error);
        res.status(500).json({ error: 'Error al eliminar formulario' });
    }
}

// Preguntas
async function listarPreguntas(req, res) {
    try {
        const { id } = req.params;
        const preguntas = await formulariosService.listarPreguntas(id);
        res.json(preguntas);
    } catch (error) {
        console.error('Error en listarPreguntas:', error);
        res.status(500).json({ error: 'Error al listar preguntas' });
    }
}

async function crearPregunta(req, res) {
    try {
        const nuevaPregunta = await formulariosService.crearPregunta(req.body);
        res.status(201).json(nuevaPregunta);
    } catch (error) {
        console.error('Error en crearPregunta:', error);
        res.status(500).json({ error: 'Error al crear pregunta' });
    }
}

async function actualizarPregunta(req, res) {
    try {
        const { id } = req.params;
        const preguntaActualizada = await formulariosService.actualizarPregunta(id, req.body);
        res.json(preguntaActualizada);
    } catch (error) {
        console.error('Error en actualizarPregunta:', error);
        res.status(500).json({ error: 'Error al actualizar pregunta' });
    }
}

async function eliminarPregunta(req, res) {
    try {
        const { id } = req.params;
        await formulariosService.eliminarPregunta(id);
        res.status(204).send();
    } catch (error) {
        console.error('Error en eliminarPregunta:', error);
        res.status(500).json({ error: 'Error al eliminar pregunta' });
    }
}

module.exports = {
    listarFormularios,
    crearFormulario,
    actualizarFormulario,
    eliminarFormulario,
    listarPreguntas,
    crearPregunta,
    actualizarPregunta,
    eliminarPregunta
};
