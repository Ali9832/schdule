import {startupDiagnostic} from '../server/startup-errors.js'
export function createVercelHandler(loadApp){
  let application
  return async function handler(request,response){
  response.setHeader('Cache-Control','private, no-store')
  try{
    application??=loadApp().then(async({default:app})=>{await app.ready();return app})
    const app=await application
    app.server.emit('request',request,response)
  }catch(error){
    const diagnostic=startupDiagnostic(error)
    console.error('Application initialization failed:',{code:diagnostic.code,message:error.message,cause_code:error.cause?.code})
    response.statusCode=503
    response.setHeader('Content-Type','application/json; charset=utf-8')
    response.end(JSON.stringify(diagnostic))
  }
  }
}
export default createVercelHandler(()=>import('../server/index.js'))
