import log4js from 'log4js'
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
const logger = log4js.getLogger()
export { logger }
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL21vZGVsL2xvZ2dlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUE7QUFFM0IsTUFBTSxDQUFDLFNBQVMsQ0FBQztJQUNmLFNBQVMsRUFBRTtRQUNULE9BQU8sRUFBRTtZQUNQLElBQUksRUFBRSxRQUFRO1lBQ2QsTUFBTSxFQUFFO2dCQUNOLElBQUksRUFBRSxTQUFTO2dCQUNmLE9BQU8sRUFBRSx5Q0FBeUM7YUFDbkQ7U0FDRjtRQUNELE9BQU8sRUFBRTtZQUNQLElBQUksRUFBRSxVQUFVO1lBQ2hCLFFBQVEsRUFBRSxjQUFjO1lBQ3hCLE9BQU8sRUFBRSxnQkFBZ0I7WUFDekIsVUFBVSxFQUFFLEVBQUU7WUFDZCxvQkFBb0IsRUFBRSxJQUFJO1lBQzFCLE1BQU0sRUFBRTtnQkFDTixJQUFJLEVBQUUsU0FBUztnQkFDZixPQUFPLEVBQUUsOEJBQThCO2FBQ3hDO1NBQ0Y7UUFDRCxhQUFhLEVBQUU7WUFDYixJQUFJLEVBQUUsUUFBUTtZQUNkLE1BQU0sRUFBRTtnQkFDTixJQUFJLEVBQUUsU0FBUztnQkFDZixPQUFPLEVBQUUsMENBQTBDO2FBQ3BEO1NBQ0Y7UUFDRCxhQUFhLEVBQUU7WUFDYixJQUFJLEVBQUUsVUFBVTtZQUNoQixRQUFRLEVBQUUsb0JBQW9CO1lBQzlCLE9BQU8sRUFBRSxnQkFBZ0I7WUFDekIsVUFBVSxFQUFFLEVBQUU7WUFDZCxvQkFBb0IsRUFBRSxJQUFJO1lBQzFCLE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLDhCQUE4QixFQUFFO1NBQ3JFO0tBQ0Y7SUFDRCxVQUFVLEVBQUU7UUFDVixPQUFPLEVBQUUsRUFBRSxTQUFTLEVBQUUsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxFQUFFLGNBQWM7S0FDOUU7SUFDRCxHQUFHLEVBQUUsSUFBSTtDQUNWLENBQUMsQ0FBQTtBQUVGLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQTtBQUNqQyxPQUFPLEVBQUUsTUFBTSxFQUFFLENBQUEifQ==