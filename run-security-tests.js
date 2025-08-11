#!/usr/bin/env node

const SecurityTester = require('./security-tests');
const PenetrationTester = require('./penetration-test');
const ZAPSecurityScanner = require('./zap-security-scan');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class SecurityTestRunner {
    constructor() {
        this.results = {
            dependencyScan: null,
            securityTests: null,
            penetrationTests: null,
            zapScan: null,
            sonarQube: null
        };
        this.reportDir = './security-reports';
    }

    async runAllTests() {
        console.log('🔒 INICIANDO SUITE COMPLETA DE PRUEBAS DE SEGURIDAD');
        console.log('='.repeat(80));
        console.log('Fecha:', new Date().toISOString());
        console.log('Proyecto: Sistema de Evaluación ISTLA');
        console.log('='.repeat(80) + '\n');

        // Crear directorio para reportes
        if (!fs.existsSync(this.reportDir)) {
            fs.mkdirSync(this.reportDir, { recursive: true });
        }

        try {
            // 1. Análisis de dependencias
            await this.runDependencyScan();
            
            // 2. Pruebas de seguridad básicas
            await this.runSecurityTests();
            
            // 3. Pruebas de penetración
            await this.runPenetrationTests();
            
            // 4. Escaneo con OWASP ZAP (opcional)
            await this.runZAPScan();
            
            // 5. Verificar SonarQube (si está configurado)
            await this.checkSonarQube();
            
            // 6. Generar reporte final
            await this.generateFinalReport();
            
        } catch (error) {
            console.error('❌ Error durante las pruebas:', error);
        }
    }

    async runDependencyScan() {
        console.log('📦 1. ANÁLISIS DE DEPENDENCIAS');
        console.log('-'.repeat(50));
        
        try {
            // NPM Audit
            console.log('🔍 Ejecutando npm audit...');
            const auditResult = await this.executeCommand('npm audit --json');
            this.results.dependencyScan = JSON.parse(auditResult);
            
            console.log('✅ Análisis de dependencias completado');
            
            // Mostrar resumen
            const vulnerabilities = this.results.dependencyScan.metadata.vulnerabilities;
            console.log(`📊 Vulnerabilidades encontradas:`);
            console.log(`  🔴 Críticas: ${vulnerabilities.critical || 0}`);
            console.log(`  🟠 Altas: ${vulnerabilities.high || 0}`);
            console.log(`  🟡 Medias: ${vulnerabilities.moderate || 0}`);
            console.log(`  🟢 Bajas: ${vulnerabilities.low || 0}`);
            
        } catch (error) {
            console.error('❌ Error en análisis de dependencias:', error.message);
        }
        
        console.log('');
    }

    async runSecurityTests() {
        console.log('🔒 2. PRUEBAS DE SEGURIDAD BÁSICAS');
        console.log('-'.repeat(50));
        
        try {
            const tester = new SecurityTester();
            await tester.runAllTests();
            this.results.securityTests = tester.results;
            
            console.log('✅ Pruebas de seguridad básicas completadas');
        } catch (error) {
            console.error('❌ Error en pruebas de seguridad:', error.message);
        }
        
        console.log('');
    }

    async runPenetrationTests() {
        console.log('🎯 3. PRUEBAS DE PENETRACIÓN');
        console.log('-'.repeat(50));
        
        try {
            const tester = new PenetrationTester();
            await tester.runAllTests();
            this.results.penetrationTests = tester.results;
            
            console.log('✅ Pruebas de penetración completadas');
        } catch (error) {
            console.error('❌ Error en pruebas de penetración:', error.message);
        }
        
        console.log('');
    }

    async runZAPScan() {
        console.log('🕷️  4. ESCANEO CON OWASP ZAP');
        console.log('-'.repeat(50));
        
        try {
            // Verificar si ZAP está instalado
            const zapCheck = await this.executeCommand('zap --version');
            if (zapCheck) {
                const scanner = new ZAPSecurityScanner();
                const reportFile = await scanner.runBaselineScan();
                this.results.zapScan = reportFile;
                
                console.log('✅ Escaneo ZAP completado');
            } else {
                console.log('⚠️  OWASP ZAP no está instalado. Saltando escaneo ZAP.');
                console.log('💡 Para instalar ZAP: https://www.zaproxy.org/download/');
            }
        } catch (error) {
            console.log('⚠️  OWASP ZAP no está disponible. Saltando escaneo ZAP.');
        }
        
        console.log('');
    }

    async checkSonarQube() {
        console.log('🔍 5. VERIFICACIÓN DE SONARQUBE');
        console.log('-'.repeat(50));
        
        try {
            // Verificar si hay reportes de SonarQube
            const sonarReports = fs.readdirSync('.').filter(file => 
                file.includes('sonar') || file.includes('SonarQube')
            );
            
            if (sonarReports.length > 0) {
                console.log('✅ Reportes de SonarQube encontrados:');
                sonarReports.forEach(report => console.log(`  📄 ${report}`));
                this.results.sonarQube = sonarReports;
            } else {
                console.log('⚠️  No se encontraron reportes de SonarQube');
                console.log('💡 Ejecuta SonarQube para análisis estático de código');
            }
        } catch (error) {
            console.log('⚠️  No se pudieron verificar reportes de SonarQube');
        }
        
        console.log('');
    }

    async generateFinalReport() {
        console.log('📊 6. GENERANDO REPORTE FINAL');
        console.log('-'.repeat(50));
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = path.join(this.reportDir, `security-report-${timestamp}.md`);
        
        let report = `# Reporte de Seguridad - Sistema de Evaluación ISTLA

**Fecha:** ${new Date().toISOString()}
**Proyecto:** Sistema de Evaluación ISTLA
**Versión:** 1.0.0

## 📋 Resumen Ejecutivo

`;

        // Resumen de vulnerabilidades
        let totalCritical = 0;
        let totalHigh = 0;
        let totalMedium = 0;
        let totalLow = 0;

        // Contar vulnerabilidades de dependencias
        if (this.results.dependencyScan) {
            const vulns = this.results.dependencyScan.metadata.vulnerabilities;
            totalCritical += vulns.critical || 0;
            totalHigh += vulns.high || 0;
            totalMedium += vulns.moderate || 0;
            totalLow += vulns.low || 0;
        }

        // Contar vulnerabilidades de pruebas de seguridad
        if (this.results.securityTests) {
            const securityVulns = this.results.securityTests.filter(r => r.status === 'VULNERABLE');
            securityVulns.forEach(v => {
                if (v.severity === 'HIGH') totalHigh++;
                else if (v.severity === 'MEDIUM') totalMedium++;
                else if (v.severity === 'LOW') totalLow++;
            });
        }

        // Contar vulnerabilidades de penetración
        if (this.results.penetrationTests) {
            const penVulns = this.results.penetrationTests.filter(r => r.status === 'VULNERABLE');
            penVulns.forEach(v => {
                if (v.severity === 'CRITICAL') totalCritical++;
                else if (v.severity === 'HIGH') totalHigh++;
                else if (v.severity === 'MEDIUM') totalMedium++;
                else if (v.severity === 'LOW') totalLow++;
            });
        }

        report += `### 🔴 Vulnerabilidades Críticas: ${totalCritical}
### 🟠 Vulnerabilidades Altas: ${totalHigh}
### 🟡 Vulnerabilidades Medias: ${totalMedium}
### 🟢 Vulnerabilidades Bajas: ${totalLow}

## 📊 Detalles por Categoría

### 1. Análisis de Dependencias

`;

        if (this.results.dependencyScan) {
            const vulns = this.results.dependencyScan.metadata.vulnerabilities;
            report += `- **Críticas:** ${vulns.critical || 0}
- **Altas:** ${vulns.high || 0}
- **Medias:** ${vulns.moderate || 0}
- **Bajas:** ${vulns.low || 0}

`;
        } else {
            report += `No se pudo completar el análisis de dependencias.

`;
        }

        report += `### 2. Pruebas de Seguridad Básicas

`;

        if (this.results.securityTests) {
            const vulns = this.results.securityTests.filter(r => r.status === 'VULNERABLE');
            const safe = this.results.securityTests.filter(r => r.status === 'SAFE');
            
            report += `- **Vulnerabilidades encontradas:** ${vulns.length}
- **Pruebas seguras:** ${safe.length}
- **Total de pruebas:** ${this.results.securityTests.length}

`;
        } else {
            report += `No se pudieron completar las pruebas de seguridad básicas.

`;
        }

        report += `### 3. Pruebas de Penetración

`;

        if (this.results.penetrationTests) {
            const critical = this.results.penetrationTests.filter(r => r.severity === 'CRITICAL');
            const high = this.results.penetrationTests.filter(r => r.severity === 'HIGH');
            const medium = this.results.penetrationTests.filter(r => r.severity === 'MEDIUM');
            const low = this.results.penetrationTests.filter(r => r.severity === 'LOW');
            
            report += `- **Críticas:** ${critical.length}
- **Altas:** ${high.length}
- **Medias:** ${medium.length}
- **Bajas:** ${low.length}

`;
        } else {
            report += `No se pudieron completar las pruebas de penetración.

`;
        }

        report += `### 4. Escaneo OWASP ZAP

`;

        if (this.results.zapScan) {
            report += `✅ Escaneo completado
📄 Reporte: ${this.results.zapScan}

`;
        } else {
            report += `⚠️ No se pudo completar el escaneo ZAP

`;
        }

        report += `### 5. Análisis SonarQube

`;

        if (this.results.sonarQube && this.results.sonarQube.length > 0) {
            report += `✅ Reportes encontrados:
`;
            this.results.sonarQube.forEach(reportFile => {
                report += `- ${reportFile}
`;
            });
        } else {
            report += `⚠️ No se encontraron reportes de SonarQube

`;
        }

        report += `## 🎯 Recomendaciones

`;

        if (totalCritical > 0) {
            report += `### 🔴 CRÍTICO
- **Corregir inmediatamente** las vulnerabilidades críticas
- Revisar y actualizar dependencias vulnerables
- Implementar parches de seguridad urgentes

`;
        }

        if (totalHigh > 0) {
            report += `### 🟠 ALTO
- **Priorizar** la corrección de vulnerabilidades altas
- Revisar configuración de seguridad
- Implementar validaciones adicionales

`;
        }

        if (totalMedium > 0) {
            report += `### 🟡 MEDIO
- **Planificar** la corrección de vulnerabilidades medias
- Mejorar prácticas de desarrollo seguro
- Implementar pruebas de seguridad automatizadas

`;
        }

        if (totalLow > 0) {
            report += `### 🟢 BAJO
- **Considerar** la corrección de vulnerabilidades bajas
- Mejorar documentación de seguridad
- Implementar monitoreo continuo

`;
        }

        report += `## 📝 Próximos Pasos

1. **Revisar** todos los hallazgos de seguridad
2. **Priorizar** correcciones según severidad
3. **Implementar** mejoras de seguridad
4. **Documentar** cambios realizados
5. **Re-ejecutar** pruebas después de correcciones
6. **Establecer** proceso de seguridad continua

## 🔧 Herramientas Utilizadas

- **NPM Audit:** Análisis de dependencias
- **Security Tests:** Pruebas automatizadas de seguridad
- **Penetration Tests:** Pruebas de penetración
- **OWASP ZAP:** Escaneo de vulnerabilidades web
- **SonarQube:** Análisis estático de código

---
*Reporte generado automáticamente por Security Test Runner*
`;

        // Guardar reporte
        fs.writeFileSync(reportFile, report);
        
        console.log(`✅ Reporte final generado: ${reportFile}`);
        
        // Mostrar resumen final
        console.log('\n📊 RESUMEN FINAL');
        console.log('='.repeat(50));
        console.log(`🔴 Críticas: ${totalCritical}`);
        console.log(`🟠 Altas: ${totalHigh}`);
        console.log(`🟡 Medias: ${totalMedium}`);
        console.log(`🟢 Bajas: ${totalLow}`);
        console.log(`📄 Reporte: ${reportFile}`);
        console.log('='.repeat(50));
    }

    executeCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout);
            });
        });
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    const runner = new SecurityTestRunner();
    runner.runAllTests().catch(console.error);
}

module.exports = SecurityTestRunner; 