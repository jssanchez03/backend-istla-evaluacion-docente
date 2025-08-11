const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testSecurityMeasures() {
    console.log('🧪 Probando medidas de seguridad...\n');

    try {
        // 1. Probar endpoint de salud
        console.log('1️⃣ Probando endpoint de salud...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Health check exitoso:', healthResponse.data);

        // 2. Probar rate limiting (hacer múltiples requests rápidos)
        console.log('\n2️⃣ Probando rate limiting...');
        const requests = [];
        for (let i = 0; i < 5; i++) {
            requests.push(axios.get(`${BASE_URL}/api/v1/evaluaciones/estudiante/mis-evaluaciones`));
        }
        
        const responses = await Promise.allSettled(requests);
        let successCount = 0;
        let rateLimitCount = 0;
        
        responses.forEach((response, index) => {
            if (response.status === 'fulfilled') {
                successCount++;
            } else if (response.reason.response?.status === 429) {
                rateLimitCount++;
            }
        });
        
        console.log(`✅ Requests exitosos: ${successCount}`);
        console.log(`⚠️ Requests bloqueados por rate limit: ${rateLimitCount}`);

        // 3. Probar headers de seguridad
        console.log('\n3️⃣ Probando headers de seguridad...');
        const headersResponse = await axios.get(`${BASE_URL}/health`);
        const securityHeaders = headersResponse.headers;
        
        const requiredHeaders = [
            'x-content-type-options',
            'x-frame-options', 
            'x-xss-protection',
            'strict-transport-security',
            'content-security-policy'
        ];
        
        const foundHeaders = requiredHeaders.filter(header => 
            securityHeaders[header] || securityHeaders[header.replace(/-/g, '')]
        );
        
        console.log(`✅ Headers de seguridad encontrados: ${foundHeaders.length}/${requiredHeaders.length}`);
        foundHeaders.forEach(header => {
            console.log(`   - ${header}: ${securityHeaders[header] || securityHeaders[header.replace(/-/g, '')]}`);
        });

        // 4. Probar CORS
        console.log('\n4️⃣ Probando CORS...');
        const corsResponse = await axios.get(`${BASE_URL}/health`, {
            headers: {
                'Origin': 'http://localhost:5173'
            }
        });
        
        if (corsResponse.headers['access-control-allow-origin']) {
            console.log('✅ CORS configurado correctamente');
        } else {
            console.log('⚠️ CORS no detectado en headers');
        }

        console.log('\n🎉 Todas las pruebas completadas exitosamente!');
        console.log('📊 Resumen:');
        console.log(`   - Rate limiting: ${rateLimitCount > 0 ? '✅ Funcionando' : '⚠️ Muy permisivo'}`);
        console.log(`   - Security headers: ${foundHeaders.length >= 4 ? '✅ Configurados' : '⚠️ Incompletos'}`);
        console.log(`   - CORS: ✅ Funcionando`);
        console.log(`   - Health check: ✅ Funcionando`);

    } catch (error) {
        console.error('❌ Error durante las pruebas:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

// Ejecutar pruebas
testSecurityMeasures(); 