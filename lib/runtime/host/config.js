import { importHost } from './import-host.js';
const { default: config } = await importHost('lib', 'config', 'config.js');
export default config;
