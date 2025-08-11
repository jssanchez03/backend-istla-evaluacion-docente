const axios = require('axios');
const crypto = require('crypto');

class PenetrationTester {
    constructor(baseURL = 'http://localhost:3000') {
        this.baseURL = baseURL;
        this.results = [];
        this.session = null;
    }

    async runAllTests() {
        console.log('🔒 Iniciando pruebas de penetración...\n');
        
        await this.testAuthenticationBypass();
        await this.testSessionManagement();
        await this.testPrivilegeEscalation();
        await this.testDataExfiltration();
        await this.testBusinessLogic();
        await this.testAPISecurity();
        await this.testDirectoryTraversal();
        await this.testCommandInjection();
        await this.testNoSQLInjection();
        await this.testLDAPInjection();
        
        this.printResults();
    }

    async testAuthenticationBypass() {
        console.log('🔍 Probando bypass de autenticación...');
        
        const bypassAttempts = [
            // Intentar acceder sin token
            { method: 'GET', url: '/api/dashboard', headers: {} },
            { method: 'GET', url: '/api/usuarios', headers: {} },
            { method: 'POST', url: '/api/evaluaciones', headers: {}, data: {} },
            
            // Intentar con tokens falsos
            { method: 'GET', url: '/api/dashboard', headers: { 'Authorization': 'Bearer fake-token' } },
            { method: 'GET', url: '/api/dashboard', headers: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c' } },
            
            // Intentar con cookies falsas
            { method: 'GET', url: '/api/dashboard', headers: { 'Cookie': 'session=fake-session' } }
        ];

        for (const attempt of bypassAttempts) {
            try {
                const response = await axios({
                    method: attempt.method,
                    url: `${this.baseURL}${attempt.url}`,
                    headers: attempt.headers,
                    data: attempt.data
                });
                
                if (response.status === 200) {
                    this.results.push({
                        test: 'Authentication Bypass',
                        method: attempt.method,
                        url: attempt.url,
                        status: 'VULNERABLE',
                        severity: 'CRITICAL',
                        note: 'Acceso no autorizado permitido'
                    });
                }
            } catch (error) {
                if (error.response && error.response.status === 401) {
                    this.results.push({
                        test: 'Authentication Bypass',
                        method: attempt.method,
                        url: attempt.url,
                        status: 'SAFE',
                        severity: 'LOW'
                    });
                }
            }
        }
    }

    async testSessionManagement() {
        console.log('🔍 Probando gestión de sesiones...');
        
        try {
            // Test 1: Sesión sin expiración
            const loginResponse = await axios.post(`${this.baseURL}/api/auth/login`, {
                email: 'test@test.com',
                password: 'password'
            });
            
            if (loginResponse.data && loginResponse.data.token) {
                const token = loginResponse.data.token;
                
                // Verificar si el token expira
                setTimeout(async () => {
                    try {
                        const response = await axios.get(`${this.baseURL}/api/dashboard`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        
                        if (response.status === 200) {
                            this.results.push({
                                test: 'Session Management',
                                status: 'NEEDS_REVIEW',
                                severity: 'MEDIUM',
                                note: 'Verificar expiración de tokens'
                            });
                        }
                    } catch (error) {
                        this.results.push({
                            test: 'Session Management',
                            status: 'SAFE',
                            severity: 'LOW'
                        });
                    }
                }, 1000);
            }
        } catch (error) {
            this.results.push({
                test: 'Session Management',
                status: 'ERROR',
                severity: 'UNKNOWN'
            });
        }
    }

    async testPrivilegeEscalation() {
        console.log('🔍 Probando escalación de privilegios...');
        
        const escalationTests = [
            // Intentar acceder a rutas de admin como usuario normal
            { role: 'user', target: '/api/admin/usuarios' },
            { role: 'user', target: '/api/admin/configuracion' },
            { role: 'docente', target: '/api/admin/dashboard' },
            { role: 'estudiante', target: '/api/admin/reportes' }
        ];

        for (const test of escalationTests) {
            try {
                // Simular token de usuario con rol específico
                const fakeToken = this.generateFakeToken(test.role);
                
                const response = await axios.get(`${this.baseURL}${test.target}`, {
                    headers: { 'Authorization': `Bearer ${fakeToken}` }
                });
                
                if (response.status === 200) {
                    this.results.push({
                        test: 'Privilege Escalation',
                        role: test.role,
                        target: test.target,
                        status: 'VULNERABLE',
                        severity: 'HIGH',
                        note: 'Escalación de privilegios exitosa'
                    });
                }
            } catch (error) {
                if (error.response && error.response.status === 403) {
                    this.results.push({
                        test: 'Privilege Escalation',
                        role: test.role,
                        target: test.target,
                        status: 'SAFE',
                        severity: 'LOW'
                    });
                }
            }
        }
    }

    async testDataExfiltration() {
        console.log('🔍 Probando exfiltración de datos...');
        
        const exfiltrationTests = [
            // Intentar acceder a datos de otros usuarios
            '/api/usuarios/1',
            '/api/usuarios/999',
            '/api/evaluaciones/1',
            '/api/evaluaciones/999',
            
            // Intentar acceder a archivos sensibles
            '/api/configuracion',
            '/api/logs',
            '/api/backup',
            
            // Intentar listar usuarios
            '/api/usuarios?limit=1000',
            '/api/usuarios?page=999'
        ];

        for (const endpoint of exfiltrationTests) {
            try {
                const response = await axios.get(`${this.baseURL}${endpoint}`, {
                    headers: { 'Authorization': 'Bearer fake-token' }
                });
                
                if (response.status === 200 && response.data) {
                    this.results.push({
                        test: 'Data Exfiltration',
                        endpoint,
                        status: 'VULNERABLE',
                        severity: 'HIGH',
                        note: 'Datos sensibles accesibles'
                    });
                }
            } catch (error) {
                if (error.response && error.response.status === 401) {
                    this.results.push({
                        test: 'Data Exfiltration',
                        endpoint,
                        status: 'SAFE',
                        severity: 'LOW'
                    });
                }
            }
        }
    }

    async testBusinessLogic() {
        console.log('🔍 Probando lógica de negocio...');
        
        const businessLogicTests = [
            // Intentar crear evaluaciones duplicadas
            { test: 'Duplicate Evaluation', data: { evaluacionId: 1, userId: 1 } },
            
            // Intentar modificar evaluaciones de otros
            { test: 'Unauthorized Modification', data: { evaluacionId: 999, userId: 1 } },
            
            // Intentar acceder a datos fuera del período permitido
            { test: 'Time-based Access', data: { fecha: '2020-01-01' } },
            
            // Intentar enviar datos inválidos
            { test: 'Invalid Data', data: { email: 'invalid', password: '' } }
        ];

        for (const test of businessLogicTests) {
            try {
                const response = await axios.post(`${this.baseURL}/api/evaluaciones`, test.data);
                
                if (response.status === 200) {
                    this.results.push({
                        test: `Business Logic - ${test.test}`,
                        status: 'VULNERABLE',
                        severity: 'MEDIUM',
                        note: 'Lógica de negocio vulnerable'
                    });
                }
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    this.results.push({
                        test: `Business Logic - ${test.test}`,
                        status: 'SAFE',
                        severity: 'LOW'
                    });
                }
            }
        }
    }

    async testAPISecurity() {
        console.log('🔍 Probando seguridad de API...');
        
        const apiTests = [
            // Test de métodos HTTP no permitidos
            { method: 'PUT', url: '/api/auth/login' },
            { method: 'DELETE', url: '/api/auth/login' },
            { method: 'PATCH', url: '/api/auth/login' },
            
            // Test de versionado de API
            { method: 'GET', url: '/api/v1/usuarios' },
            { method: 'GET', url: '/api/v2/usuarios' },
            
            // Test de endpoints ocultos
            { method: 'GET', url: '/api/admin' },
            { method: 'GET', url: '/api/debug' },
            { method: 'GET', url: '/api/test' }
        ];

        for (const test of apiTests) {
            try {
                const response = await axios({
                    method: test.method,
                    url: `${this.baseURL}${test.url}`
                });
                
                if (response.status === 200) {
                    this.results.push({
                        test: 'API Security',
                        method: test.method,
                        url: test.url,
                        status: 'VULNERABLE',
                        severity: 'MEDIUM',
                        note: 'Endpoint no autorizado accesible'
                    });
                }
            } catch (error) {
                if (error.response && error.response.status === 405) {
                    this.results.push({
                        test: 'API Security',
                        method: test.method,
                        url: test.url,
                        status: 'SAFE',
                        severity: 'LOW'
                    });
                }
            }
        }
    }

    async testDirectoryTraversal() {
        console.log('🔍 Probando directory traversal...');
        
        const traversalPayloads = [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
            '....//....//....//etc/passwd',
            '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
            '..%252f..%252f..%252fetc%252fpasswd'
        ];

        for (const payload of traversalPayloads) {
            try {
                const response = await axios.get(`${this.baseURL}/api/files/${payload}`);
                
                if (response.status === 200 && response.data) {
                    this.results.push({
                        test: 'Directory Traversal',
                        payload,
                        status: 'VULNERABLE',
                        severity: 'HIGH',
                        note: 'Directory traversal exitoso'
                    });
                }
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    this.results.push({
                        test: 'Directory Traversal',
                        payload,
                        status: 'SAFE',
                        severity: 'LOW'
                    });
                }
            }
        }
    }

    async testCommandInjection() {
        console.log('🔍 Probando inyección de comandos...');
        
        const commandPayloads = [
            '; ls -la',
            '| whoami',
            '&& cat /etc/passwd',
            '; ping -c 1 127.0.0.1',
            '$(whoami)',
            '`id`'
        ];

        for (const payload of commandPayloads) {
            try {
                const response = await axios.post(`${this.baseURL}/api/system/command`, {
                    command: payload
                });
                
                if (response.status === 200) {
                    this.results.push({
                        test: 'Command Injection',
                        payload,
                        status: 'VULNERABLE',
                        severity: 'CRITICAL',
                        note: 'Inyección de comandos exitosa'
                    });
                }
            } catch (error) {
                this.results.push({
                    test: 'Command Injection',
                    payload,
                    status: 'SAFE',
                    severity: 'LOW'
                });
            }
        }
    }

    async testNoSQLInjection() {
        console.log('🔍 Probando inyección NoSQL...');
        
        const nosqlPayloads = [
            { email: { $ne: '' }, password: { $ne: '' } },
            { email: { $gt: '' }, password: { $gt: '' } },
            { email: { $regex: '.*' }, password: { $regex: '.*' } },
            { $or: [{ email: 'admin' }, { email: 'test' }] },
            { $where: '1==1' }
        ];

        for (const payload of nosqlPayloads) {
            try {
                const response = await axios.post(`${this.baseURL}/api/auth/login`, payload);
                
                if (response.status === 200) {
                    this.results.push({
                        test: 'NoSQL Injection',
                        payload: JSON.stringify(payload),
                        status: 'VULNERABLE',
                        severity: 'HIGH',
                        note: 'Inyección NoSQL exitosa'
                    });
                }
            } catch (error) {
                this.results.push({
                    test: 'NoSQL Injection',
                    payload: JSON.stringify(payload),
                    status: 'SAFE',
                    severity: 'LOW'
                });
            }
        }
    }

    async testLDAPInjection() {
        console.log('🔍 Probando inyección LDAP...');
        
        const ldapPayloads = [
            '*)(uid=*))(|(uid=*',
            '*))%00',
            'admin)(&(password=*))',
            '*)(|(password=*))',
            '*))%00)(|(password=*))'
        ];

        for (const payload of ldapPayloads) {
            try {
                const response = await axios.post(`${this.baseURL}/api/auth/login`, {
                    username: payload,
                    password: 'anything'
                });
                
                if (response.status === 200) {
                    this.results.push({
                        test: 'LDAP Injection',
                        payload,
                        status: 'VULNERABLE',
                        severity: 'HIGH',
                        note: 'Inyección LDAP exitosa'
                    });
                }
            } catch (error) {
                this.results.push({
                    test: 'LDAP Injection',
                    payload,
                    status: 'SAFE',
                    severity: 'LOW'
                });
            }
        }
    }

    generateFakeToken(role) {
        const header = {
            alg: 'HS256',
            typ: 'JWT'
        };
        
        const payload = {
            sub: '1234567890',
            name: 'Test User',
            role: role,
            iat: Math.floor(Date.now() / 1000)
        };
        
        const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
        const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const signature = crypto.createHmac('sha256', 'fake-secret').update(`${encodedHeader}.${encodedPayload}`).digest('base64url');
        
        return `${encodedHeader}.${encodedPayload}.${signature}`;
    }

    printResults() {
        console.log('\n📊 RESULTADOS DE PRUEBAS DE PENETRACIÓN\n');
        console.log('='.repeat(80));
        
        const critical = this.results.filter(r => r.severity === 'CRITICAL');
        const high = this.results.filter(r => r.severity === 'HIGH');
        const medium = this.results.filter(r => r.severity === 'MEDIUM');
        const low = this.results.filter(r => r.severity === 'LOW');
        
        console.log(`🔴 Críticas: ${critical.length}`);
        console.log(`🟠 Altas: ${high.length}`);
        console.log(`🟡 Medias: ${medium.length}`);
        console.log(`🟢 Bajas: ${low.length}`);
        console.log(`📋 Total: ${this.results.length}\n`);
        
        if (critical.length > 0) {
            console.log('🔴 VULNERABILIDADES CRÍTICAS:');
            critical.forEach(v => {
                console.log(`  • ${v.test}: ${v.note || ''}`);
            });
            console.log();
        }
        
        if (high.length > 0) {
            console.log('🟠 VULNERABILIDADES ALTAS:');
            high.forEach(v => {
                console.log(`  • ${v.test}: ${v.note || ''}`);
            });
            console.log();
        }
        
        console.log('📋 DETALLE COMPLETO:');
        this.results.forEach(result => {
            const emoji = result.severity === 'CRITICAL' ? '🔴' : 
                         result.severity === 'HIGH' ? '🟠' : 
                         result.severity === 'MEDIUM' ? '🟡' : '🟢';
            console.log(`${emoji} ${result.test}: ${result.status} (${result.severity})`);
            if (result.note) console.log(`    Nota: ${result.note}`);
        });
        
        console.log('\n' + '='.repeat(80));
    }
}

// Ejecutar las pruebas si el script se ejecuta directamente
if (require.main === module) {
    const tester = new PenetrationTester();
    tester.runAllTests().catch(console.error);
}

module.exports = PenetrationTester; 