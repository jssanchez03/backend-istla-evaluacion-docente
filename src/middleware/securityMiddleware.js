const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Configuración MÍNIMAMENTE RESTRICTIVA de rate limiting
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 10000) => {
    return rateLimit({
        windowMs,
        max,
        message: {
            error: 'Demasiadas solicitudes desde esta IP, inténtalo de nuevo más tarde.'
        },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        keyGenerator: (req) => {
            return req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
        },
        handler: (req, res) => {
            res.status(429).json({
                error: 'Rate limit excedido',
                message: 'Demasiadas solicitudes desde esta IP',
                retryAfter: Math.ceil(windowMs / 1000)
            });
        }
    });
};

// Rate limiter MUY PERMISIVO para autenticación
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // ¡MÁXIMO PERMISIVO! Era 5, ahora 100
    message: {
        error: 'Demasiados intentos de inicio de sesión. Inténtalo de nuevo en 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        return req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
    },
    handler: (req, res) => {
        res.status(429).json({
            error: 'Rate limit de autenticación excedido',
            message: 'Demasiados intentos de inicio de sesión',
            retryAfter: 900
        });
    }
});

// Rate limiter SÚPER PERMISIVO para endpoints críticos
const criticalEndpointsLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 5000, // ¡SÚPER PERMISIVO! Era 100, ahora 5000
    message: {
        error: 'Demasiadas solicitudes a endpoint crítico'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skipFailedRequests: false,
    keyGenerator: (req) => {
        return req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
    },
    handler: (req, res) => {
        res.status(429).json({
            error: 'Rate limit excedido',
            message: 'Demasiadas solicitudes a endpoint crítico',
            retryAfter: Math.ceil(5 * 60 / 1000)
        });
    }
});

// Validación de entrada mejorada
const validateInput = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Datos de entrada inválidos',
            details: errors.array().map(error => ({
                field: error.param,
                message: error.msg,
                value: error.value
            }))
        });
    }
    next();
};

// Middleware para prevenir ataques XSS (mejorado)
const xssProtection = (req, res, next) => {
    // Sanitizar datos de entrada mejorado
    const sanitizeData = (data) => {
        if (typeof data === 'string') {
            return data
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;')
                .replace(/\\/g, '&#x5C;')
                .replace(/&/g, '&amp;');
        }
        return data;
    };

    // Sanitizar body recursivamente
    const sanitizeObject = (obj) => {
        if (typeof obj === 'object' && obj !== null) {
            Object.keys(obj).forEach(key => {
                if (typeof obj[key] === 'string') {
                    obj[key] = sanitizeData(obj[key]);
                } else if (typeof obj[key] === 'object') {
                    sanitizeObject(obj[key]);
                }
            });
        }
    };

    // Sanitizar body
    if (req.body) {
        sanitizeObject(req.body);
    }

    // Sanitizar query params
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (typeof req.query[key] === 'string') {
                req.query[key] = sanitizeData(req.query[key]);
            }
        });
    }

    next();
};

// Middleware para verificar headers de seguridad (mejorado)
const securityHeaders = (req, res, next) => {
    // Headers básicos de seguridad
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // Content Security Policy mejorado
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
    ].join('; ');

    res.setHeader('Content-Security-Policy', csp);

    // Headers adicionales
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    next();
};

// Middleware para logging de seguridad mejorado
const securityLogger = (req, res, next) => {
    const startTime = Date.now();

    const securityEvents = {
        timestamp: new Date().toISOString(),
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
        contentType: req.get('Content-Type'),
        contentLength: req.get('Content-Length')
    };

    // Detectar patrones sospechosos mejorados
    const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /union\s+select/i,
        /drop\s+table/i,
        /insert\s+into/i,
        /delete\s+from/i,
        /update\s+set/i,
        /exec\s*\(/i,
        /eval\s*\(/i,
        /document\.cookie/i,
        /alert\s*\(/i,
        /confirm\s*\(/i,
        /prompt\s*\(/i
    ];

    const requestString = JSON.stringify(req.body) + req.url + JSON.stringify(req.query);
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(requestString));

    if (isSuspicious && process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Actividad sospechosa detectada:', {
            ...securityEvents,
            suspiciousPattern: requestString.match(/<script|javascript:|union\s+select|drop\s+table/i)?.[0] || 'unknown'
        });
    }

    // Log de respuesta
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logEntry = {
            ...securityEvents,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
        };

        // Log diferentes niveles según el status code (solo en desarrollo)
        if (process.env.NODE_ENV === 'development') {
            if (res.statusCode >= 400) {
                console.error('❌ Error en solicitud:', logEntry);
            } else if (res.statusCode >= 300) {
                console.warn('⚠️ Redirección:', logEntry);
            } else {
                console.log('✅ Solicitud exitosa:', logEntry);
            }
        }
    });

    next();
};

// Middleware para manejo de errores mejorado
const errorHandler = (err, req, res, next) => {
    const errorLog = {
        timestamp: new Date().toISOString(),
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.url,
        method: req.method,
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip,
        userAgent: req.get('User-Agent')
    };

    // Log del error (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
        console.error('🚨 Error en aplicación:', errorLog);
    }

    // Respuesta segura (no exponer información sensible)
    const statusCode = err.statusCode || 500;
    const message = statusCode === 500
        ? 'Error interno del servidor'
        : err.message || 'Error en la aplicación';

    res.status(statusCode).json({
        error: message,
        status: statusCode,
        timestamp: new Date().toISOString()
    });
};

module.exports = {
    helmet,
    createRateLimiter,
    authRateLimiter,
    criticalEndpointsLimiter,
    validateInput,
    xssProtection,
    securityHeaders,
    securityLogger,
    errorHandler
};