import render from './common-lib/render.js'

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default {
  render,
  sleep
}
