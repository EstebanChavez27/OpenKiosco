#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Manager, Url};

const PORT: u16 = 4820;

struct ServerState {
    child: Mutex<Option<Child>>,
    spawned_by_us: Mutex<bool>,
}

fn health_ok() -> bool {
    let Ok(mut stream) = TcpStream::connect(("127.0.0.1", PORT)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(800)));
    let req = format!("GET /health HTTP/1.1\r\nHost: 127.0.0.1:{PORT}\r\nConnection: close\r\n\r\n");
    if stream.write_all(req.as_bytes()).is_err() {
        return false;
    }
    let mut buf = String::new();
    if stream.read_to_string(&mut buf).is_err() {
        return false;
    }
    buf.contains("\"status\":\"ok\"")
}

fn data_dir() -> PathBuf {
    #[cfg(windows)]
    {
        let base =
            std::env::var("APPDATA").unwrap_or_else(|_| std::env::temp_dir().to_string_lossy().into_owned());
        PathBuf::from(base).join("OpenKiosco")
    }
    #[cfg(not(windows))]
    {
        let base = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        PathBuf::from(base).join(".openkiosco")
    }
}

fn ensure_jwt_secret(dir: &PathBuf) -> String {
    let path = dir.join("jwt.secret");
    if let Ok(existing) = fs::read_to_string(&path) {
        let trimmed = existing.trim().to_string();
        if !trimmed.is_empty() {
            return trimmed;
        }
    }
    let mut seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(123456789)
        ^ (std::process::id() as u64) << 17;
    let chars: Vec<char> = "abcdef0123456789".chars().collect();
    let mut secret = String::new();
    for _ in 0..64 {
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        secret.push(chars[(seed % 16) as usize]);
    }
    let _ = fs::write(&path, &secret);
    secret
}

fn start_server(handle: &tauri::AppHandle) -> Result<Child, String> {
    let resources = handle.path().resource_dir().map_err(|e| e.to_string())?;
    let api_dir = resources.join("api");
    let server_js = api_dir.join("dist").join("server.js");
    let web_dir = resources.join("web");
    #[cfg(windows)]
    let bundled_node = resources.join("runtime").join("node.exe");
    #[cfg(not(windows))]
    let bundled_node = resources.join("runtime").join("node");

    if !server_js.exists() {
        return Err(format!(
            "No se encontro el backend empaquetado en {}",
            server_js.display()
        ));
    }

    #[allow(unused_mut)]
    let mut node: PathBuf = if bundled_node.exists() {
        bundled_node
    } else {
        PathBuf::from("node")
    };

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if node.exists() {
            let _ = fs::set_permissions(&node, fs::Permissions::from_mode(0o755));
        }
    }
    let _ = &node;

    let dir = data_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let db_path = dir.join("openkiosco.db");
    let database_url = format!("file:{}", db_path.to_string_lossy().replace('\\', "/"));
    let jwt_secret = ensure_jwt_secret(&dir);

    let mut command = Command::new(node);
    command
        .current_dir(&api_dir)
        .arg("dist/server.js")
        .env("NODE_ENV", "production")
        .env("HOST", "127.0.0.1")
        .env("PORT", PORT.to_string())
        .env("AUTO_MIGRATE", "1")
        .env("DATABASE_URL", &database_url)
        .env("JWT_SECRET", jwt_secret)
        .env("PUBLIC_DIR", web_dir);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command.spawn().map_err(|e| e.to_string())
}

fn kill_child(state: &ServerState) {
    if *state.spawned_by_us.lock().unwrap() {
        if let Some(mut child) = state.child.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn main() {
    tauri::Builder::default()
        .manage(ServerState {
            child: Mutex::new(None),
            spawned_by_us: Mutex::new(false),
        })
        .setup(|app| {
            let handle = app.handle().clone();
            let state = handle.state::<ServerState>();

            if !health_ok() {
                match start_server(&handle) {
                    Ok(child) => {
                        *state.child.lock().unwrap() = Some(child);
                        *state.spawned_by_us.lock().unwrap() = true;
                        for _ in 0..240 {
                            if health_ok() {
                                break;
                            }
                            std::thread::sleep(Duration::from_millis(500));
                        }
                    }
                    Err(err) => {
                        eprintln!("[OpenKiosco] Error iniciando el backend: {err}");
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                        }
                        return Ok(());
                    }
                }
            }

            #[cfg(debug_assertions)]
            if let Some(win) = app.get_webview_window("main") {
                let dev_url: Url = "http://localhost:5173".parse().expect("valid dev url");
                let _ = win.navigate(dev_url);
            }

            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error al construir OpenKiosco")
        .run(|app_handle, event| {
            if matches!(event, tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit) {
                kill_child(app_handle.state::<ServerState>());
            }
        });
}
