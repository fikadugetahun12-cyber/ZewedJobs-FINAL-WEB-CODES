const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

class LibInstaller {
    constructor() {
        this.libsDir = path.join(__dirname, '..', 'libs');
        this.ensureLibsDirectory();
    }

    ensureLibsDirectory() {
        if (!fs.existsSync(this.libsDir)) {
            fs.mkdirpSync(this.libsDir);
        }
    }

    async installJQuery(version = '3.6.4') {
        const jqueryDir = path.join(this.libsDir, 'jquery');
        fs.ensureDirSync(jqueryDir);
        
        const files = [
            {
                url: `https://code.jquery.com/jquery-${version}.min.js`,
                filename: 'jquery.min.js'
            },
            {
                url: `https://code.jquery.com/jquery-${version}.slim.min.js`,
                filename: 'jquery.slim.min.js'
            },
            {
                url: 'https://code.jquery.com/jquery-migrate-3.4.1.min.js',
                filename: 'jquery-migrate.min.js'
            }
        ];
        
        console.log('Installing jQuery...');
        
        for (const file of files) {
            try {
                const response = await axios.get(file.url, { responseType: 'arraybuffer' });
                const filePath = path.join(jqueryDir, file.filename);
                fs.writeFileSync(filePath, response.data);
                console.log(`  ✓ ${file.filename}`);
            } catch (error) {
                console.error(`  ✗ Failed to download ${file.filename}:`, error.message);
            }
        }
        
        // Create package.json for jQuery
        const packageJson = {
            name: "jquery",
            version: version,
            description: "jQuery JavaScript Library",
            homepage: "https://jquery.com/",
            license: "MIT"
        };
        
        fs.writeFileSync(
            path.join(jqueryDir, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );
        
        console.log('jQuery installation complete');
    }

    async installChartJS(version = '4.3.0') {
        const chartjsDir = path.join(this.libsDir, 'chartjs');
        fs.ensureDirSync(chartjsDir);
        
        const cdnBase = 'https://cdn.jsdelivr.net/npm/chart.js';
        const files = [
            {
                url: `${cdnBase}@${version}/dist/chart.umd.js`,
                filename: 'chart.js'
            },
            {
                url: `${cdnBase}@${version}/dist/chart.umd.min.js`,
                filename: 'chart.min.js'
            },
            {
                url: 'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.min.js',
                filename: 'chartjs-adapter-date-fns.min.js'
            },
            {
                url: 'https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js',
                filename: 'chartjs-plugin-annotation.min.js'
            }
        ];
        
        console.log('Installing Chart.js...');
        
        for (const file of files) {
            try {
                const response = await axios.get(file.url, { responseType: 'arraybuffer' });
                const filePath = path.join(chartjsDir, file.filename);
                fs.writeFileSync(filePath, response.data);
                console.log(`  ✓ ${file.filename}`);
            } catch (error) {
                console.error(`  ✗ Failed to download ${file.filename}:`, error.message);
            }
        }
        
        // Create package.json for Chart.js
        const packageJson = {
            name: "chart.js",
            version: version,
            description: "Simple HTML5 Charts using the canvas element",
            homepage: "https://www.chartjs.org/",
            license: "MIT"
        };
        
        fs.writeFileSync(
            path.join(chartjsDir, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );
        
        console.log('Chart.js installation complete');
    }

    async installAll() {
        console.log('Installing all libraries...\n');
        
        await this.installJQuery();
        console.log();
        await this.installChartJS();
        console.log();
        
        console.log('All libraries installed successfully!');
        this.generateLibsManifest();
    }

    generateLibsManifest() {
        const manifest = {
            generated: new Date().toISOString(),
            libraries: {
                jquery: this.getLibraryInfo('jquery'),
                chartjs: this.getLibraryInfo('chartjs')
            }
        };
        
        const manifestPath = path.join(this.libsDir, 'manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        
        console.log('Generated libs/manifest.json');
    }

    getLibraryInfo(libName) {
        const libDir = path.join(this.libsDir, libName);
        const packagePath = path.join(libDir, 'package.json');
        
        if (fs.existsSync(packagePath)) {
            return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        }
        
        return { name: libName, version: 'unknown' };
    }
}

// Run installer
(async () => {
    const installer = new LibInstaller();
    await installer.installAll();
})().catch(console.error);
