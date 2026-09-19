// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Start der Desktop-Fassung.
//!
//! Bis Fassung 1.2 enthielt das Programm nur die gebaute Oberfläche. Alles,
//! was einen Server braucht — Mailversand, Belegerkennung, KI-Funktionen —,
//! lief in der Desktop-Fassung deshalb ins Leere: Ein Aufruf an `/api/...`
//! fand niemanden, der antwortet.
//!
//! Seit Fassung 1.3 bringt das Programm den Server mit, den auch der
//! Docker-Betrieb verwendet. Mitgeliefert werden:
//!
//!   binaries/vm-node             die Node-Laufzeitumgebung (bei Tauri
//!                                "Sidecar" genannt, je Plattform eine)
//!   server-runtime/server.cjs    der Server selbst
//!   server-runtime/dist/         die Oberfläche, die er ausliefert
//!   server-runtime/node_modules/ die Pakete, die er zur Laufzeit lädt
//!
//! Ablauf beim Start:
//!
//!   1. Server starten und seine Ausgabe mitlesen
//!   2. auf die Zeile "VM_SERVER_BEREIT <adresse>" warten (höchstens 30 s)
//!   3. Fenster auf diese Adresse öffnen
//!
//! Schlägt Schritt 1 oder 2 fehl, öffnet sich das Fenster trotzdem — dann mit
//! der mitgelieferten Oberfläche ohne Server. Die Anwendung verhält sich dann
//! genau wie die bisherige Desktop-Fassung: Mitglieder, Finanzen und alles
//! Übrige arbeiten normal weiter, nur Mailversand und KI-Funktionen fehlen.
//! Lieber das als ein Programm, das gar nicht erst aufgeht.

use std::sync::Mutex;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Wie lange auf die Bereitmeldung des Servers gewartet wird.
const WARTEZEIT_SEKUNDEN: u64 = 30;

/// Die Zeile, mit der der Server meldet, dass er Anfragen annimmt.
const BEREIT_KENNUNG: &str = "VM_SERVER_BEREIT ";

const FENSTER_TITEL: &str = "VereinsManager • Revisionssichere Vereinsverwaltung";

/// Hält den laufenden Serverprozess fest.
///
/// Ohne diese Ablage würde das Handle am Ende von `starte_server` verworfen.
/// Beim Beenden der Anwendung wird der Prozess darüber gezielt gestoppt —
/// sonst liefe er verwaist weiter und belegte den Port.
struct ServerProzess(Mutex<Option<CommandChild>>);

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(ServerProzess(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();

            // Nebenher: Das Warten auf den Server darf den Programmstart nicht
            // blockieren.
            tauri::async_runtime::spawn(async move {
                let adresse = starte_server(&handle).await;
                oeffne_fenster(&handle, adresse);
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Fehler beim Starten der VereinsManager Desktop-Anwendung")
        .run(|handle, ereignis| {
            if let tauri::RunEvent::Exit = ereignis {
                beende_server(handle);
            }
        });
}

/// Startet den mitgelieferten Server und wartet auf seine Bereitmeldung.
///
/// Gibt die Adresse zurück, unter der er antwortet — oder None, wenn er nicht
/// startete oder sich nicht rechtzeitig gemeldet hat.
async fn starte_server(app: &tauri::AppHandle) -> Option<String> {
    // Die Vereinsdaten und die Serverkonfiguration gehören in das Verzeichnis,
    // das das Betriebssystem für diese Anwendung vorsieht — nicht neben das
    // Programm, wo ein Update sie überschreiben könnte.
    let datenverzeichnis = match app.path().app_data_dir() {
        Ok(pfad) => pfad,
        Err(fehler) => {
            eprintln!("Kein Datenverzeichnis verfügbar: {fehler}");
            return None;
        }
    };
    if let Err(fehler) = std::fs::create_dir_all(&datenverzeichnis) {
        eprintln!("Datenverzeichnis konnte nicht angelegt werden: {fehler}");
        return None;
    }

    let ressourcen = match app.path().resource_dir() {
        Ok(pfad) => pfad,
        Err(fehler) => {
            eprintln!("Mitgelieferte Dateien nicht gefunden: {fehler}");
            return None;
        }
    };
    let serverordner = ressourcen.join("server-runtime");
    let serverdatei = serverordner.join("server.cjs");

    if !serverdatei.exists() {
        eprintln!(
            "Der mitgelieferte Server fehlt: {}",
            serverdatei.to_string_lossy()
        );
        return None;
    }

    let befehl = match app.shell().sidecar("vm-node") {
        Ok(befehl) => befehl,
        Err(fehler) => {
            eprintln!("Die Node-Laufzeitumgebung fehlt: {fehler}");
            return None;
        }
    };

    let befehl = befehl
        .args([serverdatei.to_string_lossy().to_string()])
        .current_dir(serverordner)
        .env("NODE_ENV", "production")
        // Ohne diese Angabe legte der Server seine Konfiguration neben das
        // Programm — in der Desktop-Fassung ein Verzeichnis, in das er je nach
        // Betriebssystem gar nicht schreiben darf.
        .env("VM_DATA_DIR", datenverzeichnis.to_string_lossy().to_string());

    let (mut ausgabe, kind) = match befehl.spawn() {
        Ok(ergebnis) => ergebnis,
        Err(fehler) => {
            eprintln!("Der Server konnte nicht gestartet werden: {fehler}");
            return None;
        }
    };

    if let Some(ablage) = app.try_state::<ServerProzess>() {
        if let Ok(mut platz) = ablage.0.lock() {
            *platz = Some(kind);
        }
    }

    let warten = async {
        while let Some(ereignis) = ausgabe.recv().await {
            match ereignis {
                CommandEvent::Stdout(zeile) => {
                    let text = String::from_utf8_lossy(&zeile).to_string();
                    print!("[Server] {text}");
                    if let Some(rest) = text.split(BEREIT_KENNUNG).nth(1) {
                        return Some(rest.trim().to_string());
                    }
                }
                CommandEvent::Stderr(zeile) => {
                    eprint!("[Server] {}", String::from_utf8_lossy(&zeile));
                }
                CommandEvent::Terminated(ende) => {
                    eprintln!("Der Server hat sich beendet: {ende:?}");
                    return None;
                }
                _ => {}
            }
        }
        None
    };

    match tokio::time::timeout(
        tokio::time::Duration::from_secs(WARTEZEIT_SEKUNDEN),
        warten,
    )
    .await
    {
        Ok(adresse) => adresse,
        Err(_) => {
            eprintln!(
                "Der Server hat sich nicht innerhalb von {WARTEZEIT_SEKUNDEN} Sekunden gemeldet."
            );
            None
        }
    }
}

/// Öffnet das Hauptfenster — entweder auf dem laufenden Server oder, wenn der
/// nicht zustande kam, auf der mitgelieferten Oberfläche.
fn oeffne_fenster(app: &tauri::AppHandle, adresse: Option<String>) {
    let ziel = match adresse.as_deref().map(str::parse::<tauri::Url>) {
        Some(Ok(url)) => WebviewUrl::External(url),
        _ => {
            eprintln!(
                "Die Anwendung startet ohne Server. Mitgliederverwaltung, Finanzen \
                 und alle übrigen Bereiche arbeiten normal; Mailversand und \
                 KI-Funktionen stehen nicht zur Verfügung."
            );
            WebviewUrl::App("index.html".into())
        }
    };

    let ergebnis = WebviewWindowBuilder::new(app, "main", ziel)
        .title(FENSTER_TITEL)
        .inner_size(1360.0, 860.0)
        .min_inner_size(960.0, 640.0)
        .resizable(true)
        .center()
        .build();

    if let Err(fehler) = ergebnis {
        eprintln!("Das Anwendungsfenster konnte nicht geöffnet werden: {fehler}");
    }
}

/// Beendet den Serverprozess beim Schließen der Anwendung.
fn beende_server(app: &tauri::AppHandle) {
    if let Some(ablage) = app.try_state::<ServerProzess>() {
        if let Ok(mut platz) = ablage.0.lock() {
            if let Some(kind) = platz.take() {
                let _ = kind.kill();
            }
        }
    }
}
