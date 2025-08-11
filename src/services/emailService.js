const nodemailer = require('nodemailer');
require('dotenv').config();

// Crear pool de conexiones para mejorar rendimiento
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.CORREO_REMITE,
        pass: process.env.CORREO_PASSWORD,
    },
    pool: true, // Usar pool de conexiones
    maxConnections: 5, // Máximo 5 conexiones simultáneas
    maxMessages: 10, // Máximo 10 mensajes por conexión
    rateDelta: 1000, // Ventana de tiempo para rate limiting (1 segundo)
    rateLimit: 5 // Máximo 5 correos por ventana de tiempo
});

// Verificar conexión al iniciar
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Error configurando transporter:', error);
    } else {
        // Eliminar todos los console.log, console.warn y console.debug innecesarios
    }
});

async function enviarCorreo(destinatario, asunto, mensajeHTML) {
    const mailOptions = {
        from: `"Evaluación Docente ISTLA" <${process.env.CORREO_REMITE}>`,
        to: destinatario,
        subject: asunto,
        html: mensajeHTML,
        attachments: [
            {
                filename: 'logo_istla.jpg',
                path: require('path').join(__dirname, '../assets/logo_istla.jpg'),
                cid: 'logo_istla'
            }
        ]
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        // Eliminar todos los console.log, console.warn y console.debug innecesarios
        return info;
    } catch (error) {
        console.error(`❌ Error enviando correo a ${destinatario}:`, error.message);
        throw new Error(`No se pudo enviar el correo a ${destinatario}: ${error.message}`);
    }
}

// Función para envío masivo optimizado
async function enviarCorreosMasivos(correos) {
    const resultados = [];

    for (const correo of correos) {
        try {
            const info = await enviarCorreo(correo.destinatario, correo.asunto, correo.html);
            resultados.push({
                destinatario: correo.destinatario,
                exito: true,
                messageId: info.messageId
            });
        } catch (error) {
            resultados.push({
                destinatario: correo.destinatario,
                exito: false,
                error: error.message
            });
        }
    }

    return resultados;
}

// Cerrar conexiones cuando la aplicación termina
process.on('SIGINT', () => {
    transporter.close();
    // Eliminar todos los console.log, console.warn y console.debug innecesarios
    process.exit(0);
});

module.exports = {
    enviarCorreo,
    enviarCorreosMasivos,
    transporter
};