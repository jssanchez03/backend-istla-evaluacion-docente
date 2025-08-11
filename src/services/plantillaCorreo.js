const fs = require('fs');
const path = require('path');

function cargarTemplateYReemplazar(data) {
    const templatePath = path.join(__dirname, '../utils/templates/evaluacion-asignada.html');
    let template = fs.readFileSync(templatePath, 'utf-8');
    // Primero manejar el mensaje especial
    if (data.MENSAJE_ESPECIAL) {
        const mensajeEspecialHtml = `
            <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p style="margin: 0; color: #1976d2;"><strong>Acción requerida:</strong> ${data.MENSAJE_ESPECIAL}</p>
            </div>
        `;
        template = template.replace('${MENSAJE_ESPECIAL}', mensajeEspecialHtml);
    } else {
        template = template.replace('${MENSAJE_ESPECIAL}', '');
    }
    // Reemplazar las demás variables
    for (const key in data) {
        if (key !== 'MENSAJE_ESPECIAL') {
            const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
            template = template.replace(regex, data[key] || '');
        }
    }
    return template;
}

module.exports = { cargarTemplateYReemplazar };