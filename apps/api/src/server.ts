import { execFileSync } from "node:child_process"
import path from "node:path"
import { buildApp } from "./app.js"

async function runMigrations() {
  const prismaCli = path.resolve("node_modules/prisma/build/index.js")
  try {
    execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], { stdio: "inherit" })
  } catch (err) {
    console.error("[openkiosco] Error ejecutando migraciones:", err)
  }
}

async function main() {
  if (process.env.AUTO_MIGRATE === "1") {
    await runMigrations()
  }

  const port = Number(process.env.PORT ?? 3000)
  const host = process.env.HOST ?? "0.0.0.0"

  const app = await buildApp()

  const stop = async () => {
    await app.close()
    process.exit(0)
  }
  process.on("SIGINT", stop)
  process.on("SIGTERM", stop)

  app.listen({ port, host }).catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
