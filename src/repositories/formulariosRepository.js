const { dbEscritura } = require('../config/database');

// Formularios
async function listarFormularios() {
    const [rows] = await dbEscritura.query('SELECT * FROM formularios');
    return rows;
}

async function crearFormulario(data) {
    const [result] = await dbEscritura.query(
        'INSERT INTO formularios (nombre) VALUES (?)',
        [data.nombre]
    );
    return { id: result.insertId, ...data };
}

async function actualizarFormulario(id, data) {
    await dbEscritura.query(
        'UPDATE formularios SET nombre = ? WHERE id_formulario = ?',
        [data.nombre, id]
    );
    return { id, ...data };
}

async function eliminarFormulario(id) {
    await dbEscritura.query('DELETE FROM formularios WHERE id_formulario = ?', [id]);
}

// Preguntas
async function listarPreguntas(idFormulario) {
    const [rows] = await dbEscritura.query(
        'SELECT * FROM preguntas WHERE id_formulario = ?',
        [idFormulario]
    );
    return rows;
}

async function crearPregunta(data) {
    const [result] = await dbEscritura.query(
        'INSERT INTO preguntas (id_formulario, texto, tipo_pregunta) VALUES (?, ?, ?)',
        [data.id_formulario, data.texto, data.tipo_pregunta]
    );
    return { id: result.insertId, ...data };
}

async function actualizarPregunta(id, data) {
    await dbEscritura.query(
        'UPDATE preguntas SET texto = ?, tipo_pregunta = ? WHERE id_pregunta = ?',
        [data.texto, data.tipo_pregunta, id]
    );
    return { id, ...data };
}

async function eliminarPregunta(id) {
    await dbEscritura.query('DELETE FROM preguntas WHERE id_pregunta = ?', [id]);
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