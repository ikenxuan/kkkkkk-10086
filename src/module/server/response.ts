import type { Response } from 'express'

export const sendSuccess = (res: Response, data: unknown, message = 'success'): void => {
  res.json({ success: true, code: 200, message, data })
}

export const sendBadRequest = (res: Response, message = 'Bad Request'): void => {
  res.status(400).json({ success: false, code: 400, message, error: message })
}

export const sendNotFound = (res: Response, message = 'Not Found'): void => {
  res.status(404).json({ success: false, code: 404, message, error: message })
}

export const sendServerError = (res: Response, message = 'Server Error'): void => {
  res.status(500).json({ success: false, code: 500, message, error: message })
}
