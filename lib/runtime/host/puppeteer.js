import { importHost } from './import-host.js';
const { default: puppeteer } = await importHost('lib', 'puppeteer', 'puppeteer.js');
export default puppeteer;
