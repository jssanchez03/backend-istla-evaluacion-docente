const axios = require('axios');
const crypto = require('crypto');

class SecurityTester {
    constructor(baseURL = 'http://localhost:3000') {
        this.baseURL = baseURL;
        this.results = [];
    }

    async runAllTests() {
        console.log('🔒 Iniciando pruebas de seguridad...\n');
        
        await this.testSQLInjection();
        await this.testXSS();
        await this.testCSRF();
        await this.testAuthentication();
        await this.testAuthorization();
        await this.testInputValidation();
        await this.testRateLimiting();
        await this.testSecurityHeaders();
        await this.testFileUpload();
        await this.testErrorHandling();
        
        this.printResults();
    }

    async testSQLInjection() {
        console.log('🔍 Probando SQL Injection...');
        const payloads = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "' UNION SELECT * FROM users --",
            "admin'--",
            "1' OR '1' = '1' --"
        ];

        for (const payload of payloads) {
            try {
                const response = await axios.post(`${this.baseURL}/api/auth/login`, {
                    email: payload,
                    password: payload
                });
                
                if (response.status === 200) {
                    this.results.push({
                        test: 'SQL Injection',
                        payload,
                        status: 'VULNERABLE',
                        severity: 'HIGH'
                    });
                }
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    this.results.push({
                        test: 'SQL Injection',
                        payload,
                        status: 'SAFE',
                        severity: 'LOW'
                    });
                }
            }
        }
    }

    async testXSS() {
        console.log('🔍 Probando XSS...');
        const payloads = [
            '<script>alert("XSS")</script>',
            'javascript:alert("XSS")',
            '<img src="x" onerror="alert(\'XSS\')">',
            '<svg onload="alert(\'XSS\')">',
            '"><script>alert("XSS")</script>'
        ];

        for (const payload of payloads) {
            try {
                const response = await axios.post(`${this.baseURL}/api/auth/login`, {
                    email: payload,
                    password: payload
                });
                
                // Verificar si el payload se refleja en la respuesta
                if (response.data && JSON.stringify(response.data).includes(payload)) {
                    this.results.push({
                        test: 'XSS',
                        payload,
                        status: 'VULNERABLE',
                        severity: 'HIGH'
                    });
                } else {
                    this.results.push({
                        test: 'XSS',
                        payload,
                        status: 'SAFE',
                        severity: 'LOW'
                    });
                }
            } catch (error) {
                this.results.push({
                    test: 'XSS',
                    payload,
                    status: 'SAFE',
                    severity: 'LOW'
                });
            }
        }
    }

    async testCSRF() {
        console.log('🔍 Probando CSRF...');
        try {
            // Intentar hacer una petición sin el token CSRF
            const response = await axios.post(`${this.baseURL}/api/auth/login`, {
                email: 'test@test.com',
                password: 'password'
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            this.results.push({
                test: 'CSRF',
                status: 'NEEDS_REVIEW',
                severity: 'MEDIUM',
                note: 'Verificar si se implementa protección CSRF'
            });
        } catch (error) {
            this.results.push({
                test: 'CSRF',
                status: 'SAFE',
                severity: 'LOW'
            });
        }
    }

    async testAuthentication() {
        console.log('🔍 Probando autenticación...');
        
        // Test 1: Credenciales vacías
        try {
            await axios.post(`${this.baseURL}/api/auth/login`, {
                email: '',
                password: ''
            });
            this.results.push({
                test: 'Authentication - Empty Credentials',
                status: 'VULNERABLE',
                severity: 'MEDIUM'
            });
        } catch (error) {
            this.results.push({
                test: 'Authentication - Empty Credentials',
                status: 'SAFE',
                severity: 'LOW'
            });
        }

        // Test 2: Credenciales débiles
        try {
            await axios.post(`${this.baseURL}/api/auth/login`, {
                email: 'admin',
                password: 'admin'
            });
            this.results.push({
                test: 'Authentication - Weak Credentials',
                status: 'NEEDS_REVIEW',
                severity: 'MEDIUM'
            });
        } catch (error) {
            this.results.push({
                test: 'Authentication - Weak Credentials',
                status: 'SAFE',
                severity: 'LOW'
            });
        }
    }

    async testAuthorization() {
        console.log('🔍 Probando autorización...');
        
        try {
            // Intentar acceder a rutas protegidas sin token
            const protectedRoutes = [
                '/api/dashboard',
                '/api/evaluaciones',
                '/api/usuarios'
            ];

            for (const route of protectedRoutes) {
                try {
                    const response = await axios.get(`${this.baseURL}${route}`);
                    if (response.status === 200) {
                        this.results.push({
                            test: `Authorization - ${route}`,
                            status: 'VULNERABLE',
                            severity: 'HIGH'
                        });
                    }
                } catch (error) {
                    if (error.response && error.response.status === 401) {
                        this.results.push({
                            test: `Authorization - ${route}`,
                            status: 'SAFE',
                            severity: 'LOW'
                        });
                    }
                }
            }
        } catch (error) {
            this.results.push({
                test: 'Authorization',
                status: 'ERROR',
                severity: 'UNKNOWN'
            });
        }
    }

    async testInputValidation() {
        console.log('🔍 Probando validación de entrada...');
        
        const invalidInputs = [
            { email: 'invalid-email', password: '123' },
            { email: 'test@test.com', password: 'a'.repeat(1000) },
            { email: 'a'.repeat(1000), password: 'password' },
            { email: 'test@test.com', password: '' },
            { email: '', password: 'password' }
        ];

        for (const input of invalidInputs) {
            try {
                const response = await axios.post(`${this.baseURL}/api/auth/login`, input);
                if (response.status === 200) {
                    this.results.push({
                        test: 'Input Validation',
                        input: JSON.stringify(input),
                        status: 'VULNERABLE',
                        severity: 'MEDIUM'
                    });
                }
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    this.results.push({
                        test: 'Input Validation',
                        input: JSON.stringify(input),
                        status: 'SAFE',
                        severity: 'LOW'
                    });
                }
            }
        }
    }

    async testRateLimiting() {
        console.log('🔍 Probando rate limiting...');
        
        try {
            // Probar rate limiting general
            const promises = [];
            for (let i = 0; i < 150; i++) { // Más solicitudes para asegurar que se active
                promises.push(
                    axios.get(`${this.baseURL}/health`, {
                        timeout: 5000
                    }).catch(err => err.response)
                );
            }
            
            const responses = await Promise.all(promises);
            const rateLimited = responses.filter(res => res && res.status === 429);
            
            if (rateLimited.length > 0) {
                return { status: 'SAFE', severity: 'LOW', message: 'Rate limiting funcionando correctamente' };
            } else {
                return { status: 'VULNERABLE', severity: 'MEDIUM', message: 'Rate limiting no detectado' };
            }
        } catch (error) {
            return { status: 'ERROR', severity: 'UNKNOWN', message: 'Error probando rate limiting' };
        }
    }

    async testSecurityHeaders() {
        console.log('🔍 Probando headers de seguridad...');
        
        try {
            const response = await axios.get(`${this.baseURL}/health`);
            const headers = response.headers;
            
            const requiredHeaders = [
                'x-content-type-options',
                'x-frame-options',
                'x-xss-protection',
                'strict-transport-security'
            ];

            const missingHeaders = requiredHeaders.filter(header => 
                !headers[header] && !headers[header.replace('-', '_')]
            );

            if (missingHeaders.length === 0) {
                this.results.push({
                    test: 'Security Headers',
                    status: 'SAFE',
                    severity: 'LOW'
                });
            } else {
                this.results.push({
                    test: 'Security Headers',
                    status: 'VULNERABLE',
                    severity: 'MEDIUM',
                    note: `Missing headers: ${missingHeaders.join(', ')}`
                });
            }
        } catch (error) {
            this.results.push({
                test: 'Security Headers',
                status: 'ERROR',
                severity: 'UNKNOWN'
            });
        }
    }

    async testFileUpload() {
        console.log('🔍 Probando carga de archivos...');
        
        // Este test requeriría implementar endpoints de carga de archivos
        this.results.push({
            test: 'File Upload',
            status: 'NOT_IMPLEMENTED',
            severity: 'INFO',
            note: 'No se encontraron endpoints de carga de archivos'
        });
    }

    async testErrorHandling() {
        console.log('🔍 Probando manejo de errores...');
        
        try {
            // Intentar acceder a una ruta que no existe
            const response = await axios.get(`${this.baseURL}/api/nonexistent`);
            
            if (response.status === 404) {
                this.results.push({
                    test: 'Error Handling',
                    status: 'SAFE',
                    severity: 'LOW'
                });
            } else {
                this.results.push({
                    test: 'Error Handling',
                    status: 'NEEDS_REVIEW',
                    severity: 'MEDIUM'
                });
            }
        } catch (error) {
            if (error.response && error.response.status === 404) {
                this.results.push({
                    test: 'Error Handling',
                    status: 'SAFE',
                    severity: 'LOW'
                });
            } else {
                this.results.push({
                    test: 'Error Handling',
                    status: 'NEEDS_REVIEW',
                    severity: 'MEDIUM'
                });
            }
        }
    }

    printResults() {
        console.log('\n📊 RESULTADOS DE PRUEBAS DE SEGURIDAD\n');
        console.log('='.repeat(80));
        
        const vulnerabilities = this.results.filter(r => r.status === 'VULNERABLE');
        const safe = this.results.filter(r => r.status === 'SAFE');
        const needsReview = this.results.filter(r => r.status === 'NEEDS_REVIEW');
        
        console.log(`🔴 Vulnerabilidades encontradas: ${vulnerabilities.length}`);
        console.log(`🟢 Pruebas seguras: ${safe.length}`);
        console.log(`🟡 Necesita revisión: ${needsReview.length}`);
        console.log(`📋 Total de pruebas: ${this.results.length}\n`);
        
        if (vulnerabilities.length > 0) {
            console.log('🔴 VULNERABILIDADES CRÍTICAS:');
            vulnerabilities.forEach(v => {
                console.log(`  • ${v.test}: ${v.severity} - ${v.payload || v.note || ''}`);
            });
            console.log();
        }
        
        if (needsReview.length > 0) {
            console.log('🟡 NECESITA REVISIÓN:');
            needsReview.forEach(v => {
                console.log(`  • ${v.test}: ${v.note || ''}`);
            });
            console.log();
        }
        
        console.log('📋 DETALLE COMPLETO:');
        this.results.forEach(result => {
            const emoji = result.status === 'SAFE' ? '🟢' : 
                         result.status === 'VULNERABLE' ? '🔴' : 
                         result.status === 'NEEDS_REVIEW' ? '🟡' : '⚪';
            console.log(`${emoji} ${result.test}: ${result.status} (${result.severity})`);
            if (result.note) console.log(`    Nota: ${result.note}`);
        });
        
        console.log('\n' + '='.repeat(80));
    }
}

// Ejecutar las pruebas si el script se ejecuta directamente
if (require.main === module) {
    const tester = new SecurityTester();
    tester.runAllTests().catch(console.error);
}

module.exports = SecurityTester; 