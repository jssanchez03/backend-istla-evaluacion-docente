require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const {
    helmet,
    createRateLimiter,
    authRateLimiter,
    criticalEndpointsLimiter,
    securityHeaders,
    securityLogger,
    xssProtection,
    errorHandler
} = require('./src/middleware/securityMiddleware');

const app = express();

// CORS debe ir PRIMERO para evitar conflictos
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [
        'http://localhost:5173',
        'https://evaluacion.istla-sigala.edu.ec'
    ];

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Middleware de seguridad DESPUÉS de CORS
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(securityHeaders);
app.use(securityLogger);
app.use(xssProtection);

// Rate limiting general mejorado
app.use(createRateLimiter());

// Rate limiting para endpoints críticos (más permisivo para desarrollo)
app.use('/api/auth', criticalEndpointsLimiter);
app.use('/api/evaluaciones', criticalEndpointsLimiter);
app.use('/api/formularios', criticalEndpointsLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

app.use(express.static('public', {
    setHeaders: function (res, path, stat) {
        if (path.endsWith('.docx')) {
            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        }
    }
}));

const routes = require('./src/routes');
app.use('/api', routes);

// Middleware de manejo de errores mejorado
app.use(errorHandler);

// Ruta para verificar estado del servidor
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        security: 'Active'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
    if (process.env.NODE_ENV === 'development') {
        console.log(`🔒 Middleware de seguridad mejorado activado`);
        console.log(`🛡️ Rate limiting configurado para endpoints críticos`);
    }
});
