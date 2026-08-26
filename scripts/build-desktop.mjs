import { spawnSync, spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import esbuild from "esbuild"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const API = path.join(ROOT, "apps", "api")
const WEB = path.join(ROOT, "apps", "web")
const TAURI = path.join(ROOT, "src-tauri")
const RES = path.join(TAURI, "resources")
const API_RES = path.join(RES, "api")
const WEB_RES = path.join(RES, "web")
const RUNTIME_RES = path.join(RES, "runtime")
const PORT = 4820
const VERIFY = process.argv.includes("--verify")

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts,
  })
  if (res.status !== 0) {
    console.error(`[desktop] fallo el comando: ${cmd} ${args.join(" ")}`)
    process.exit(1)
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function healthCheck() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/health`)
    if (!res.ok) return false
    const body = await res.json()
    return body.status === "ok"
  } catch {
    return false
  }
}

async function main() {
  console.log("[1/6] Compilando frontend...")
  run("npm", ["run", "build", "-w", "apps/web"], { cwd: ROOT })

  fs.rmSync(RES, { recursive: true, force: true })
  fs.mkdirSync(path.join(API_RES, "dist"), { recursive: true })
  fs.mkdirSync(path.join(API_RES, "prisma"), { recursive: true })
  fs.mkdirSync(WEB_RES, { recursive: true })
  fs.mkdirSync(RUNTIME_RES, { recursive: true })

  console.log("[2/6] Copiando assets web...")
  fs.cpSync(path.join(WEB, "dist"), WEB_RES, { recursive: true })

  console.log("[3/6] Empaquetando backend con esbuild...")
  await esbuild.build({
    entryPoints: [path.join(API, "src", "server.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    outfile: path.join(API_RES, "dist", "server.js"),
    logLevel: "warning",
  })

  console.log("[4/6] Copiando schema y migraciones de Prisma...")
  fs.copyFileSync(
    path.join(API, "prisma", "schema.prisma"),
    path.join(API_RES, "prisma", "schema.prisma"),
  )
  fs.cpSync(path.join(API, "prisma", "migrations"), path.join(API_RES, "prisma", "migrations"), {
    recursive: true,
  })

  console.log("[5/6] Instalando dependencias de produccion del backend...")
  const apiPkg = JSON.parse(fs.readFileSync(path.join(API, "package.json"), "utf8"))
  const deps = { ...apiPkg.dependencies, prisma: apiPkg.devDependencies.prisma }
  fs.writeFileSync(
    path.join(API_RES, "package.json"),
    JSON.stringify(
      { name: "openkiosco-api", private: true, version: "0.1.0", dependencies: deps },
      null,
      2,
    ),
  )
  run("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], { cwd: API_RES })

  console.log("[5b] Generando cliente Prisma...")
  run(
    "node",
    ["node_modules/prisma/build/index.js", "generate", "--schema=prisma/schema.prisma"],
    { cwd: API_RES },
  )

  if (process.platform === "win32") {
    console.log("[5c] Empaquetando runtime Node portable (Windows)...")
    fs.copyFileSync(process.execPath, path.join(RUNTIME_RES, "node.exe"))
  } else {
    console.log("[5c] Empaquetando runtime Node portable (Linux/Unix)...")
    fs.copyFileSync(process.execPath, path.join(RUNTIME_RES, "node"))
    fs.chmodSync(path.join(RUNTIME_RES, "node"), 0o755)
  }

  console.log("")
  console.log("Recursos de escritorio listos en src-tauri/resources/")
  console.log(`  api/       -> backend compilado + node_modules prod + prisma`)
  console.log(`  web/       -> frontend estatico`)
  console.log(`  runtime/   -> runtime de Node portable (${process.platform === "win32" ? "node.exe" : "node"})`)

  if (VERIFY) {
    console.log("")
    console.log("[6/6] Verificacion: arrancando servidor empaquetado...")
    const dbPath = path.join(API_RES, "verify.db").replaceAll("\\", "/")
    const nodeExe =
      process.platform === "win32" ? path.join(RUNTIME_RES, "node.exe") : process.execPath
    const child = spawn(nodeExe, ["dist/server.js"], {
      cwd: API_RES,
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: String(PORT),
        AUTO_MIGRATE: "1",
        DATABASE_URL: `file:${dbPath}`,
        JWT_SECRET: "verify-secret",
        PUBLIC_DIR: WEB_RES,
      },
    })

    let ok = false
    for (let i = 0; i < 60; i++) {
      await sleep(500)
      if (await healthCheck()) {
        ok = true
        break
      }
    }

    if (ok) {
      const html = await fetch(`http://127.0.0.1:${PORT}/`).then((r) => r.text())
      const users = await fetch(`http://127.0.0.1:${PORT}/api/auth/users`).then((r) => r.json())
      console.log(`  /health        -> OK`)
      console.log(`  / (SPA)        -> ${html.includes('id="root"') ? "OK sirve el frontend" : "SIN contenido!"}`)
      console.log(`  /api/auth/users-> ${users.users?.length ?? 0} usuario(s)`)
      console.log("Servidor empaquetado verificado.")
    } else {
      console.error("El servidor empaquetado NO respondio a tiempo.")
    }

    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" })
    } else {
      child.kill("SIGTERM")
    }
    await sleep(1000)

    for (const suffix of ["", "-journal"]) {
      fs.rmSync(path.join(API_RES, `verify.db${suffix}`), { force: true })
    }

    if (!ok) process.exit(1)
  }

  console.log("")
  console.log("Siguiente paso (requiere Rust): npm run desktop:build")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
