import log4js from 'log4js'
import chalk from 'chalk'
log4js.configure({
  appenders: {
    console: {
      type: 'stdout',
      layout: {
        type: 'pattern',
        pattern: '%[[amagi][%d{hh:mm:ss.SSS}][%4.4p]%] %m'
      }
    },
    command: {
      type: 'dateFile',
      filename: 'logs/command',
      pattern: 'yyyy-MM-dd.log',
      numBackups: 15,
      alwaysIncludePattern: true,
      layout: {
        type: 'pattern',
        pattern: '[%d{hh:mm:ss.SSS}][%4.4p] %m'
      }
    },
    pluginConsole: {
      type: 'stdout',
      layout: {
        type: 'pattern',
        pattern: '%[[%d{hh:mm:ss.SSS}][%4.4p][plugin]%] %m'
      }
    },
    pluginCommand: {
      type: 'dateFile',
      filename: 'logs/pluginCommand',
      pattern: 'yyyy-MM-dd.log',
      numBackups: 15,
      alwaysIncludePattern: true,
      layout: { type: 'pattern', pattern: '[%d{hh:mm:ss.SSS}][%4.4p] %m' }
    }
  },
  categories: {
    default: { appenders: [ 'console', 'command' ], level: 'info' } // 添加default类别
  },
  pm2: true
})
const logger = log4js.getLogger('default')
logger.chalk = chalk
logger.red = chalk.red
logger.green = chalk.green
logger.yellow = chalk.yellow
logger.blue = chalk.blue
logger.magenta = chalk.magenta
logger.cyan = chalk.cyan
logger.white = chalk.white
logger.gray = chalk.gray
export { logger }
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL21vZGVsL2xvZ2dlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUE7QUFDM0IsT0FBTyxLQUFLLE1BQU0sT0FBTyxDQUFBO0FBRXpCLE1BQU0sQ0FBQyxTQUFTLENBQUM7SUFDZixTQUFTLEVBQUU7UUFDVCxPQUFPLEVBQUU7WUFDUCxJQUFJLEVBQUUsUUFBUTtZQUNkLE1BQU0sRUFBRTtnQkFDTixJQUFJLEVBQUUsU0FBUztnQkFDZixPQUFPLEVBQUUseUNBQXlDO2FBQ25EO1NBQ0Y7UUFDRCxPQUFPLEVBQUU7WUFDUCxJQUFJLEVBQUUsVUFBVTtZQUNoQixRQUFRLEVBQUUsY0FBYztZQUN4QixPQUFPLEVBQUUsZ0JBQWdCO1lBQ3pCLFVBQVUsRUFBRSxFQUFFO1lBQ2Qsb0JBQW9CLEVBQUUsSUFBSTtZQUMxQixNQUFNLEVBQUU7Z0JBQ04sSUFBSSxFQUFFLFNBQVM7Z0JBQ2YsT0FBTyxFQUFFLDhCQUE4QjthQUN4QztTQUNGO1FBQ0QsYUFBYSxFQUFFO1lBQ2IsSUFBSSxFQUFFLFFBQVE7WUFDZCxNQUFNLEVBQUU7Z0JBQ04sSUFBSSxFQUFFLFNBQVM7Z0JBQ2YsT0FBTyxFQUFFLDBDQUEwQzthQUNwRDtTQUNGO1FBQ0QsYUFBYSxFQUFFO1lBQ2IsSUFBSSxFQUFFLFVBQVU7WUFDaEIsUUFBUSxFQUFFLG9CQUFvQjtZQUM5QixPQUFPLEVBQUUsZ0JBQWdCO1lBQ3pCLFVBQVUsRUFBRSxFQUFFO1lBQ2Qsb0JBQW9CLEVBQUUsSUFBSTtZQUMxQixNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSw4QkFBOEIsRUFBRTtTQUNyRTtLQUNGO0lBQ0QsVUFBVSxFQUFFO1FBQ1YsT0FBTyxFQUFFLEVBQUUsU0FBUyxFQUFFLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsRUFBRSxjQUFjO0tBQzlFO0lBQ0QsR0FBRyxFQUFFLElBQUk7Q0FDVixDQUFDLENBQUE7QUFjRixNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFBO0FBRTFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFBO0FBQ3BCLE1BQU0sQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQTtBQUN0QixNQUFNLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUE7QUFDMUIsTUFBTSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFBO0FBQzVCLE1BQU0sQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQTtBQUN4QixNQUFNLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUE7QUFDOUIsTUFBTSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFBO0FBQ3hCLE1BQU0sQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQTtBQUMxQixNQUFNLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUE7QUFHeEIsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFBIn0=