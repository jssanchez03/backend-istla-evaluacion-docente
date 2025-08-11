const formulariosRepository = require('../repositories/formulariosRepository');

// Formularios
async function listarFormularios() {
    return await formulariosRepository.listarFormularios();
}

async function crearFormulario(data) {
    return await formulariosRepository.crearFormulario(data);
}

async function actualizarFormulario(id, data) {
    return await formulariosRepository.actualizarFormulario(id, data);
}

async function eliminarFormulario(id) {
    return await formulariosRepository.eliminarFormulario(id);
}

// Preguntas
async function listarPreguntas(idFormulario) {
    return await formulariosRepository.listarPreguntas(idFormulario);
}

async function crearPregunta(data) {
    return await formulariosRepository.crearPregunta(data);
}

async function actualizarPregunta(id, data) {
    return await formulariosRepository.actualizarPregunta(id, data);
}

async function eliminarPregunta(id) {
    return await formulariosRepository.eliminarPregunta(id);
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