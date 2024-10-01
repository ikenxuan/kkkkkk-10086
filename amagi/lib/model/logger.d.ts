import log4js from 'log4js'
import chalk from 'chalk'
declare module 'log4js' {
    interface Logger {
        chalk?: typeof chalk;
        red: typeof chalk.red;
        green: typeof chalk.green;
        yellow: typeof chalk.yellow;
        blue: typeof chalk.blue;
        magenta: typeof chalk.magenta;
        cyan: typeof chalk.cyan;
        white: typeof chalk.white;
        gray: typeof chalk.gray;
    }
}
declare const logger: log4js.Logger
export { logger }
