import { defineConfig, loadEnv, type Plugin } from 'vite'

// Yerelde /api/* isteklerini Vercel Function dosyalarına yönlendirir (Vercel'de gerekmez).
function apiDevServer(): Plugin {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''))
      server.middlewares.use(async (request, response, next) => {
        const match = request.url?.match(/^\/api\/([\w-]+)(?:\?|$)/)
        if (!match) return next()

        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(chunk as Buffer)
        let body: unknown
        try {
          body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined
        } catch {
          body = undefined
        }

        const adapted = Object.assign(request, { body })
        const reply = Object.assign(response, {
          status(code: number) {
            response.statusCode = code
            return reply
          },
          json(data: unknown) {
            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify(data))
          },
        })
        try {
          const module = await server.ssrLoadModule(`/api/${match[1]}.js`)
          await module.default(adapted, reply)
        } catch (error) {
          server.config.logger.error(String(error))
          reply.status(500).json({ error: 'Sunucu hatası.' })
        }
      })
    },
  }
}

export default defineConfig({ plugins: [apiDevServer()] })
