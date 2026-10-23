export function createVercelHandler(loadApp) {
  let application
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'private, no-store')
    try {
      application ??= loadApp().then(async ({ default: app }) => {
        await app.ready()
        return app
      }).catch(error => {
        application = undefined
        throw error
      })
      const app = await application
      app.server.emit('request', request, response)
    } catch (error) {
      console.error('Application initialization failed:', error.message)
      response.statusCode = 503
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.end(JSON.stringify({ error: 'اجرای سایت آماده نیست؛ تنظیمات اتصال پایگاه داده و کلید ورود را در ورسل بررسی کنید.' }))
    }
  }
}

export default createVercelHandler(() => import('../server/index.js'))
