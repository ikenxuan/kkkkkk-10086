export const sendSuccess = (res, data, message = 'success') => {
  res.json({ success: true, code: 200, message, data })
}

export const sendBadRequest = (res, message = 'Bad Request') => {
  res.status(400).json({ success: false, code: 400, message, error: message })
}

export const sendNotFound = (res, message = 'Not Found') => {
  res.status(404).json({ success: false, code: 404, message, error: message })
}

export const sendServerError = (res, message = 'Server Error') => {
  res.status(500).json({ success: false, code: 500, message, error: message })
}
