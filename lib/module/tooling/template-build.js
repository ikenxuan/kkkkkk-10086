import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const PluginPath = fileURLToPath(new URL('../../../', import.meta.url));
const tsconfigPath = join(PluginPath, 'tsconfig.json');
/**
 * ktr standalone typechecks its generated entry with the root tsconfig.
 * Keep the application tsconfig strict while removing options that describe
 * only the src/ emit boundary during that short-lived template build.
 */
const buildTemplates = () => {
    const original = readFileSync(tsconfigPath, 'utf8');
    const config = JSON.parse(original);
    const compilerOptions = config.compilerOptions ?? {};
    delete compilerOptions.rootDir;
    delete compilerOptions.noUncheckedIndexedAccess;
    config.compilerOptions = compilerOptions;
    writeFileSync(tsconfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    try {
        execSync('pnpm exec ktr build', {
            cwd: PluginPath,
            stdio: 'inherit'
        });
    }
    finally {
        writeFileSync(tsconfigPath, original, 'utf8');
    }
};
buildTemplates();
