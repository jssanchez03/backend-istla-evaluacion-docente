const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class ZAPSecurityScanner {
    constructor(targetURL = 'http://localhost:3000') {
        this.targetURL = targetURL;
        this.zapPath = process.env.ZAP_PATH || 'zap';
        this.reportDir = './security-reports';
    }

    async runZAPScan() {
        console.log('🔒 Iniciando escaneo de seguridad con OWASP ZAP...\n');
        
        // Crear directorio para reportes
        if (!fs.existsSync(this.reportDir)) {
            fs.mkdirSync(this.reportDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = path.join(this.reportDir, `zap-report-${timestamp}.html`);
        const jsonReportFile = path.join(this.reportDir, `zap-report-${timestamp}.json`);

        const zapCommand = `
            ${this.zapPath} -cmd -quickurl ${this.targetURL} \
            -quickout ${reportFile} \
            -quickprogress \
            -config api.disablekey=true \
            -config spider.maxDepth=3 \
            -config spider.maxChildren=10 \
            -config ajaxSpider.maxCrawlDepth=3 \
            -config ajaxSpider.maxCrawlState=3 \
            -config ajaxSpider.browserId=1 \
            -config scanPolicy.policy=0 \
            -config globalexcludeurl.url_list.url_0=logout \
            -config globalexcludeurl.url_list.url_1=logout \
            -config globalexcludeurl.url_list.url_2=logout \
            -config globalexcludeurl.url_list.url_3=logout \
            -config globalexcludeurl.url_list.url_4=logout \
            -config globalexcludeurl.url_list.url_5=logout \
            -config globalexcludeurl.url_list.url_6=logout \
            -config globalexcludeurl.url_list.url_7=logout \
            -config globalexcludeurl.url_list.url_8=logout \
            -config globalexcludeurl.url_list.url_9=logout \
            -config globalexcludeurl.url_list.url_10=logout \
            -config globalexcludeurl.url_list.url_11=logout \
            -config globalexcludeurl.url_list.url_12=logout \
            -config globalexcludeurl.url_list.url_13=logout \
            -config globalexcludeurl.url_list.url_14=logout \
            -config globalexcludeurl.url_list.url_15=logout \
            -config globalexcludeurl.url_list.url_16=logout \
            -config globalexcludeurl.url_list.url_17=logout \
            -config globalexcludeurl.url_list.url_18=logout \
            -config globalexcludeurl.url_list.url_19=logout \
            -config globalexcludeurl.url_list.url_20=logout \
            -config globalexcludeurl.url_list.url_21=logout \
            -config globalexcludeurl.url_list.url_22=logout \
            -config globalexcludeurl.url_list.url_23=logout \
            -config globalexcludeurl.url_list.url_24=logout \
            -config globalexcludeurl.url_list.url_25=logout \
            -config globalexcludeurl.url_list.url_26=logout \
            -config globalexcludeurl.url_list.url_27=logout \
            -config globalexcludeurl.url_list.url_28=logout \
            -config globalexcludeurl.url_list.url_29=logout \
            -config globalexcludeurl.url_list.url_30=logout \
            -config globalexcludeurl.url_list.url_31=logout \
            -config globalexcludeurl.url_list.url_32=logout \
            -config globalexcludeurl.url_list.url_33=logout \
            -config globalexcludeurl.url_list.url_34=logout \
            -config globalexcludeurl.url_list.url_35=logout \
            -config globalexcludeurl.url_list.url_36=logout \
            -config globalexcludeurl.url_list.url_37=logout \
            -config globalexcludeurl.url_list.url_38=logout \
            -config globalexcludeurl.url_list.url_39=logout \
            -config globalexcludeurl.url_list.url_40=logout \
            -config globalexcludeurl.url_list.url_41=logout \
            -config globalexcludeurl.url_list.url_42=logout \
            -config globalexcludeurl.url_list.url_43=logout \
            -config globalexcludeurl.url_list.url_44=logout \
            -config globalexcludeurl.url_list.url_45=logout \
            -config globalexcludeurl.url_list.url_46=logout \
            -config globalexcludeurl.url_list.url_47=logout \
            -config globalexcludeurl.url_list.url_48=logout \
            -config globalexcludeurl.url_list.url_49=logout \
            -config globalexcludeurl.url_list.url_50=logout \
            -config globalexcludeurl.url_list.url_51=logout \
            -config globalexcludeurl.url_list.url_52=logout \
            -config globalexcludeurl.url_list.url_53=logout \
            -config globalexcludeurl.url_list.url_54=logout \
            -config globalexcludeurl.url_list.url_55=logout \
            -config globalexcludeurl.url_list.url_56=logout \
            -config globalexcludeurl.url_list.url_57=logout \
            -config globalexcludeurl.url_list.url_58=logout \
            -config globalexcludeurl.url_list.url_59=logout \
            -config globalexcludeurl.url_list.url_60=logout \
            -config globalexcludeurl.url_list.url_61=logout \
            -config globalexcludeurl.url_list.url_62=logout \
            -config globalexcludeurl.url_list.url_63=logout \
            -config globalexcludeurl.url_list.url_64=logout \
            -config globalexcludeurl.url_list.url_65=logout \
            -config globalexcludeurl.url_list.url_66=logout \
            -config globalexcludeurl.url_list.url_67=logout \
            -config globalexcludeurl.url_list.url_68=logout \
            -config globalexcludeurl.url_list.url_69=logout \
            -config globalexcludeurl.url_list.url_70=logout \
            -config globalexcludeurl.url_list.url_71=logout \
            -config globalexcludeurl.url_list.url_72=logout \
            -config globalexcludeurl.url_list.url_73=logout \
            -config globalexcludeurl.url_list.url_74=logout \
            -config globalexcludeurl.url_list.url_75=logout \
            -config globalexcludeurl.url_list.url_76=logout \
            -config globalexcludeurl.url_list.url_77=logout \
            -config globalexcludeurl.url_list.url_78=logout \
            -config globalexcludeurl.url_list.url_79=logout \
            -config globalexcludeurl.url_list.url_80=logout \
            -config globalexcludeurl.url_list.url_81=logout \
            -config globalexcludeurl.url_list.url_82=logout \
            -config globalexcludeurl.url_list.url_83=logout \
            -config globalexcludeurl.url_list.url_84=logout \
            -config globalexcludeurl.url_list.url_85=logout \
            -config globalexcludeurl.url_list.url_86=logout \
            -config globalexcludeurl.url_list.url_87=logout \
            -config globalexcludeurl.url_list.url_88=logout \
            -config globalexcludeurl.url_list.url_89=logout \
            -config globalexcludeurl.url_list.url_90=logout \
            -config globalexcludeurl.url_list.url_91=logout \
            -config globalexcludeurl.url_list.url_92=logout \
            -config globalexcludeurl.url_list.url_93=logout \
            -config globalexcludeurl.url_list.url_94=logout \
            -config globalexcludeurl.url_list.url_95=logout \
            -config globalexcludeurl.url_list.url_96=logout \
            -config globalexcludeurl.url_list.url_97=logout \
            -config globalexcludeurl.url_list.url_98=logout \
            -config globalexcludeurl.url_list.url_99=logout
        `;

        return new Promise((resolve, reject) => {
            console.log('🚀 Ejecutando ZAP...');
            console.log(`🎯 Objetivo: ${this.targetURL}`);
            console.log(`📄 Reporte: ${reportFile}\n`);

            exec(zapCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ Error ejecutando ZAP:', error);
                    reject(error);
                    return;
                }

                console.log('✅ Escaneo completado');
                console.log('📊 Generando resumen...');

                // Generar resumen del reporte
                this.generateSummary(reportFile);
                resolve(reportFile);
            });
        });
    }

    generateSummary(reportFile) {
        if (fs.existsSync(reportFile)) {
            const reportContent = fs.readFileSync(reportFile, 'utf8');
            
            // Extraer estadísticas básicas del reporte HTML
            const highVulns = (reportContent.match(/High/g) || []).length;
            const mediumVulns = (reportContent.match(/Medium/g) || []).length;
            const lowVulns = (reportContent.match(/Low/g) || []).length;
            const infoVulns = (reportContent.match(/Info/g) || []).length;

            console.log('\n📊 RESUMEN DEL ESCANEO ZAP');
            console.log('='.repeat(50));
            console.log(`🔴 Vulnerabilidades Altas: ${highVulns}`);
            console.log(`🟡 Vulnerabilidades Medias: ${mediumVulns}`);
            console.log(`🟢 Vulnerabilidades Bajas: ${lowVulns}`);
            console.log(`ℹ️  Información: ${infoVulns}`);
            console.log(`📄 Reporte completo: ${reportFile}`);
            console.log('='.repeat(50));

            // Crear archivo de resumen
            const summaryFile = reportFile.replace('.html', '-summary.txt');
            const summary = `
RESUMEN DE SEGURIDAD - OWASP ZAP
Fecha: ${new Date().toISOString()}
Objetivo: ${this.targetURL}

ESTADÍSTICAS:
- Vulnerabilidades Altas: ${highVulns}
- Vulnerabilidades Medias: ${mediumVulns}
- Vulnerabilidades Bajas: ${lowVulns}
- Información: ${infoVulns}

RECOMENDACIONES:
${highVulns > 0 ? '🔴 CRÍTICO: Revisar y corregir vulnerabilidades altas inmediatamente' : '✅ No se encontraron vulnerabilidades críticas'}
${mediumVulns > 0 ? '🟡 ATENCIÓN: Revisar vulnerabilidades medias' : '✅ No se encontraron vulnerabilidades medias'}
${lowVulns > 0 ? '🟢 CONSIDERAR: Revisar vulnerabilidades bajas' : '✅ No se encontraron vulnerabilidades bajas'}

Reporte completo: ${reportFile}
            `;

            fs.writeFileSync(summaryFile, summary);
            console.log(`📝 Resumen guardado: ${summaryFile}`);
        }
    }

    async runBaselineScan() {
        console.log('🔒 Ejecutando escaneo de línea base...');
        return this.runZAPScan();
    }

    async runFullScan() {
        console.log('🔒 Ejecutando escaneo completo...');
        // Configurar para un escaneo más profundo
        this.zapPath += ' -config scanPolicy.policy=1';
        return this.runZAPScan();
    }
}

// Script para ejecutar desde línea de comandos
if (require.main === module) {
    const scanner = new ZAPSecurityScanner();
    const scanType = process.argv[2] || 'baseline';
    
    if (scanType === 'full') {
        scanner.runFullScan().catch(console.error);
    } else {
        scanner.runBaselineScan().catch(console.error);
    }
}

module.exports = ZAPSecurityScanner; 