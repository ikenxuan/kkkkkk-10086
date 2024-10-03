import log4js from 'log4js'
import { Chalk } from 'chalk'
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
const chalk = new Chalk({ level: 3 })
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL21vZGVsL2xvZ2dlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUE7QUFDM0IsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLE9BQU8sQ0FBQTtBQUU3QixNQUFNLENBQUMsU0FBUyxDQUFDO0lBQ2YsU0FBUyxFQUFFO1FBQ1QsT0FBTyxFQUFFO1lBQ1AsSUFBSSxFQUFFLFFBQVE7WUFDZCxNQUFNLEVBQUU7Z0JBQ04sSUFBSSxFQUFFLFNBQVM7Z0JBQ2YsT0FBTyxFQUFFLHlDQUF5QzthQUNuRDtTQUNGO1FBQ0QsT0FBTyxFQUFFO1lBQ1AsSUFBSSxFQUFFLFVBQVU7WUFDaEIsUUFBUSxFQUFFLGNBQWM7WUFDeEIsT0FBTyxFQUFFLGdCQUFnQjtZQUN6QixVQUFVLEVBQUUsRUFBRTtZQUNkLG9CQUFvQixFQUFFLElBQUk7WUFDMUIsTUFBTSxFQUFFO2dCQUNOLElBQUksRUFBRSxTQUFTO2dCQUNmLE9BQU8sRUFBRSw4QkFBOEI7YUFDeEM7U0FDRjtRQUNELGFBQWEsRUFBRTtZQUNiLElBQUksRUFBRSxRQUFRO1lBQ2QsTUFBTSxFQUFFO2dCQUNOLElBQUksRUFBRSxTQUFTO2dCQUNmLE9BQU8sRUFBRSwwQ0FBMEM7YUFDcEQ7U0FDRjtRQUNELGFBQWEsRUFBRTtZQUNiLElBQUksRUFBRSxVQUFVO1lBQ2hCLFFBQVEsRUFBRSxvQkFBb0I7WUFDOUIsT0FBTyxFQUFFLGdCQUFnQjtZQUN6QixVQUFVLEVBQUUsRUFBRTtZQUNkLG9CQUFvQixFQUFFLElBQUk7WUFDMUIsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsOEJBQThCLEVBQUU7U0FDckU7S0FDRjtJQUNELFVBQVUsRUFBRTtRQUNWLE9BQU8sRUFBRSxFQUFFLFNBQVMsRUFBRSxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEVBQUUsY0FBYztLQUM5RTtJQUNELEdBQUcsRUFBRSxJQUFJO0NBQ1YsQ0FBQyxDQUFBO0FBRUYsTUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQTtBQWdCckMsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQTtBQUUxQyxNQUFNLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQTtBQUNwQixNQUFNLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUE7QUFDdEIsTUFBTSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFBO0FBQzFCLE1BQU0sQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQTtBQUM1QixNQUFNLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUE7QUFDeEIsTUFBTSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFBO0FBQzlCLE1BQU0sQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQTtBQUN4QixNQUFNLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUE7QUFDMUIsTUFBTSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFBO0FBR3hCLE9BQU8sRUFBRSxNQUFNLEVBQUUsQ0FBQSJ9