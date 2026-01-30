const fs = require('fs-extra');
const path = require('path');

class ConfigBuilder {
    constructor() {
        this.configDir = path.join(__dirname, '..', 'config');
        this.buildDir = path.join(__dirname, '..', 'public', 'config');
    }

    async build() {
        console.log('Building configuration files...\n');
        
        // Ensure build directory exists
        fs.ensureDirSync(this.buildDir);
        
        // Process each environment
        const environments = ['development', 'staging', 'production'];
        
        for (const env of environments) {
            await this.buildEnvironmentConfig(env);
        }
        
        // Copy settings.json and schema
        this.copyStaticConfigFiles();
        
        console.log('\nConfiguration build complete!');
    }

    async buildEnvironmentConfig(environment) {
        console.log(`Building ${environment} configuration...`);
        
        try {
            // Load base settings
            const baseConfig = await this.loadConfig('settings.json');
            
            // Load environment-specific config
            const envConfig = await this.loadConfig(`${environment}.json`);
            
            // Merge configurations
            const mergedConfig = this.deepMerge({}, baseConfig, envConfig);
            
            // Set environment
            mergedConfig.environment = environment;
            
            // Add build metadata
            mergedConfig.build = {
                timestamp: new Date().toISOString(),
                environment: environment,
                version: baseConfig.application?.version || '1.0.0'
            };
            
            // Write merged config
            const outputPath = path.join(this.buildDir, `${environment}.config.json`);
            fs.writeFileSync(outputPath, JSON.stringify(mergedConfig, null, 2));
            
            // Also create minified version
            const minifiedPath = path.join(this.buildDir, `${environment}.config.min.json`);
            fs.writeFileSync(minifiedPath, JSON.stringify(mergedConfig));
            
            console.log(`  ✓ ${environment}.config.json`);
            console.log(`  ✓ ${environment}.config.min.json`);
            
        } catch (error) {
            console.error(`  ✗ Failed to build ${environment} config:`, error.message);
        }
    }

    async loadConfig(filename) {
        const configPath = path.join(this.configDir, filename);
        
        if (!fs.existsSync(configPath)) {
            return {};
        }
        
        const content = await fs.readFile(configPath, 'utf8');
        return JSON.parse(content);
    }

    copyStaticConfigFiles() {
        const files = ['settings.json', 'config-schema.json'];
        
        for (const file of files) {
            const source = path.join(this.configDir, file);
            const destination = path.join(this.buildDir, file);
            
            if (fs.existsSync(source)) {
                fs.copySync(source, destination);
                console.log(`  ✓ ${file}`);
            }
        }
    }

    deepMerge(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();

        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.deepMerge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }

        return this.deepMerge(target, ...sources);
    }

    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }
}

// Run builder
(async () => {
    const builder = new ConfigBuilder();
    await builder.build();
})().catch(console.error);
