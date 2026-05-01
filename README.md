# PVRInfo Kiosko

App web para digital signage / kioskos de contenido multimedia.
Permite gestionar pantallas con playlists de imágenes y videos desde un panel admin, y reproducirlas en bucle en modo kiosk de Firefox.

**Stack:** React + Vite · Node.js + Express · SQLite (better-sqlite3) · Multer · FFmpeg · pdf2pic

---

## Tabla de contenidos

1. [Requisitos previos](#requisitos-previos)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Base de datos](#base-de-datos)
4. [Variables de entorno](#variables-de-entorno)
5. [Desarrollo local (Windows)](#desarrollo-local-windows)
6. [Build para producción](#build-para-producción)
7. [Despliegue en Ubuntu con Nginx](#despliegue-en-ubuntu-con-nginx)
8. [Firefox en modo kiosk](#firefox-en-modo-kiosk)
9. [API REST](#api-rest)
10. [Solución de problemas](#solución-de-problemas)

---

## Requisitos previos

| Herramienta | Versión mínima | Notas |
|-------------|---------------|-------|
| Node.js     | v18 LTS       | Recomendado v20 LTS. Descarga: https://nodejs.org |
| npm         | v9+           | Viene incluido con Node.js |
| Git         | cualquiera    | Para clonar el repo |

> **No se necesita Docker ni ningún servidor de base de datos externo.**
> El proyecto usa **SQLite**, una base de datos que vive en un archivo local (`data/kiosko.db` por defecto).
> Se crea automáticamente al levantar el servidor por primera vez.

---

## Estructura del proyecto

```
kiosko/
├── client/                   # Frontend React + Vite
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AdminDashboard.jsx    # Lista de kioskos
│   │   │   ├── AdminKioskEdit.jsx    # Editor de playlist
│   │   │   ├── KioskView.jsx         # Player fullscreen
│   │   │   └── NotFound.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js        # Proxy /api y /uploads → puerto 3001
│   └── package.json
├── server/                   # Backend Express + SQLite
│   ├── routes/
│   │   ├── kiosks.js         # CRUD de kioskos
│   │   ├── items.js          # Upload, edición y eliminación de items
│   │   └── public.js         # Endpoint público usado por el player
│   ├── app.js                # Entry point del servidor
│   ├── db.js                 # Conexión y esquema SQLite
│   ├── .env                  # Variables de entorno (no subir a git)
│   └── package.json
├── data/
│   └── kiosko.db             # Base de datos SQLite (se crea automáticamente)
├── uploads/                  # Archivos multimedia (se crean automáticamente)
│   └── <slug>/               # Carpeta por kiosko
├── .env.example              # Plantilla de variables de entorno
├── .gitignore
├── package.json              # Scripts raíz (concurrently)
└── README.md
```

---

## Base de datos

El proyecto usa **SQLite** a través del paquete `better-sqlite3`.

- **No requiere instalar ningún servidor** (ni MySQL, ni PostgreSQL, ni Docker).
- La base de datos es un archivo en `data/kiosko.db` por defecto.
- Si el archivo no existe, se crea automáticamente con el esquema correcto al arrancar el servidor.
- Para resetear completamente la base de datos, basta con borrar el archivo `kiosko.db` y reiniciar el servidor.

### Tablas

**`kiosks`** — Un kiosko es una pantalla o punto de visualización:

| Campo      | Tipo    | Descripción                        |
|------------|---------|-------------------------------------|
| id         | INTEGER | Clave primaria autoincremental      |
| name       | TEXT    | Nombre descriptivo (ej. "Recepción")|
| slug       | TEXT    | Identificador URL (ej. "recepcion") |
| orientation| TEXT    | `portrait` (9:16) o `landscape` (16:9) |
| fitMode    | TEXT    | `cover` (rellenar) o `contain` (mostrar completo) |
| enabled    | INTEGER | 1 = activo, 0 = desactivado         |
| createdAt  | TEXT    | Fecha de creación                   |
| updatedAt  | TEXT    | Última modificación                 |

**`kiosk_items`** — Cada imagen o video de la playlist de un kiosko:

| Campo           | Tipo    | Descripción                              |
|-----------------|---------|------------------------------------------|
| id              | INTEGER | Clave primaria autoincremental           |
| kioskId         | INTEGER | FK → kiosks.id (cascade delete)          |
| type            | TEXT    | `'image'` o `'video'`                    |
| filename        | TEXT    | Nombre del archivo en disco              |
| originalName    | TEXT    | Nombre original subido por el usuario    |
| filePath        | TEXT    | Ruta relativa al directorio de uploads   |
| mimeType        | TEXT    | MIME type del archivo                    |
| size            | INTEGER | Tamaño en bytes                          |
| durationSeconds | INTEGER | Segundos que se muestra (imágenes)       |
| sortOrder       | INTEGER | Posición en la playlist                  |
| enabled         | INTEGER | 1 = visible, 0 = oculto en el player     |

---

## Variables de entorno

Crear el archivo `server/.env` basándose en `.env.example`:

```bash
cp .env.example server/.env
```

Contenido del archivo:

```env
PORT=3001
SQLITE_PATH=./data/kiosko.db
UPLOAD_DIR=./uploads
TEMP_DIR=./temp
PUBLIC_BASE_URL=http://localhost:5173
MAX_FILE_SIZE_MB=200
```

| Variable         | Descripción                                                   |
|------------------|---------------------------------------------------------------|
| `PORT`           | Puerto donde corre el servidor Express                        |
| `SQLITE_PATH`    | Ruta al archivo de base de datos SQLite                       |
| `UPLOAD_DIR`     | Carpeta donde se guardan los archivos multimedia              |
| `TEMP_DIR`       | Carpeta para archivos temporales de herramientas              |
| `PUBLIC_BASE_URL`| URL base pública (usada en dev para el proxy del frontend)    |
| `MAX_FILE_SIZE_MB`| Tamaño máximo de archivo en MB para uploads                 |

> En producción, cambia `PUBLIC_BASE_URL` a la URL real del servidor (ej. `https://pvrinfo.giize.com`).
> Para despliegues con PM2/systemd, se recomiendan rutas absolutas para no depender del directorio desde donde arranque Node:
>
> ```env
> SQLITE_PATH=/opt/kiosplay/data/kiosko.db
> UPLOAD_DIR=/opt/kiosplay/uploads
> TEMP_DIR=/opt/kiosplay/temp
> ```

---

## Desarrollo local (Windows)

### 1. Clonar e instalar dependencias

```bash
git clone <url-del-repo> kiosko
cd kiosko
npm run install:all
```

Esto instala las dependencias de la raíz, `server/` y `client/` en un solo comando.

### 2. Configurar variables de entorno

```bash
copy .env.example server\.env
```

Los valores por defecto funcionan para desarrollo local sin modificar nada.

### 3. Levantar el entorno de desarrollo

```bash
npm run dev
```

Esto lanza dos procesos en paralelo:
- **Backend** → `http://localhost:3001` (Express + SQLite, con nodemon para auto-reload)
- **Frontend** → `http://localhost:5173` (Vite dev server con HMR)

El frontend proxea automáticamente `/api/*` y `/uploads/*` al backend, así que no hay CORS ni configuración extra.

### URLs de desarrollo

| URL | Descripción |
|-----|-------------|
| `http://localhost:5173/admin` | Panel de administración |
| `http://localhost:5173/admin/kiosk/:id` | Editor de playlist de un kiosko |
| `http://localhost:5173/:slug` | Player fullscreen (ej. `/recepcion`) |
| `http://localhost:3001/api/kiosks` | API REST directa |

### Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run install:all` | Instala dependencias de root + server + client |
| `npm run dev` | Lanza server y client en paralelo |
| `npm run dev:server` | Solo el servidor Express |
| `npm run dev:client` | Solo el frontend Vite |
| `npm run build` | Genera el build de producción del frontend |
| `npm start` | Inicia el servidor en modo producción |

---

## Build para producción

```bash
# 1. Generar el build del frontend
npm run build

# 2. Iniciar el servidor Express
#    Sirve la API en /api y el frontend compilado en la raíz
npm start
```

En producción, Express sirve todo desde un solo puerto (3001 por defecto):
- `http://servidor:3001/admin` → Panel admin
- `http://servidor:3001/:slug` → Player
- `http://servidor:3001/api/*` → API REST
- `http://servidor:3001/uploads/*` → Archivos multimedia

---

## Despliegue en Ubuntu con Nginx

### 1. Instalar Node.js (v20 LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Clonar el repositorio

```bash
cd /opt
sudo git clone <url-del-repo> kiosko
sudo chown -R $USER:$USER /opt/kiosko
cd /opt/kiosko
```

### 3. Instalar dependencias y construir

```bash
npm run install:all
npm run build
```

### 4. Configurar variables de entorno

```bash
cp .env.example server/.env
nano server/.env
```

Ajustar al menos:
```env
PORT=3001
SQLITE_PATH=/opt/kiosplay/data/kiosko.db
UPLOAD_DIR=/opt/kiosplay/uploads
TEMP_DIR=/opt/kiosplay/temp
PUBLIC_BASE_URL=https://pvrinfo.giize.com
```

### 5. Instalar PM2 y lanzar el servidor

```bash
sudo npm install -g pm2

# Desde la carpeta raíz del proyecto:
pm2 start server/app.js --name kiosko

# Guardar para que reinicie con el sistema
pm2 save
pm2 startup
# (ejecutar el comando que PM2 te indique)
```

Comandos útiles de PM2:

```bash
pm2 status          # Ver estado del proceso
pm2 logs kiosko     # Ver logs en tiempo real
pm2 restart kiosko  # Reiniciar
pm2 stop kiosko     # Detener
```

### 6. Configurar Nginx como reverse proxy

```bash
sudo nano /etc/nginx/sites-available/pvrinfo
```

```nginx
server {
    listen 80;
    server_name pvrinfo.giize.com;

    # Tamaño máximo de subida (igual o mayor que MAX_FILE_SIZE_MB)
    client_max_body_size 250M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Timeout mayor para archivos grandes
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_read_timeout 300s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/pvrinfo /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 7. HTTPS con Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d pvrinfo.giize.com
```

### Alternativa: systemd en lugar de PM2

```ini
# /etc/systemd/system/kiosko.service
[Unit]
Description=PVRInfo Kiosko Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/kiosko/server
ExecStart=/usr/bin/node app.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable kiosko
sudo systemctl start kiosko
sudo systemctl status kiosko
```

---

## Firefox en modo kiosk

```bash
# Linux / Ubuntu / Raspberry Pi
firefox --kiosk http://pvrinfo.giize.com/slug-del-kiosko

# Con display específico (entorno headless)
DISPLAY=:0 firefox --kiosk http://pvrinfo.giize.com/slug-del-kiosko

# Si Firefox ya está abierto, forzar nueva instancia
firefox --no-remote --kiosk http://pvrinfo.giize.com/slug-del-kiosko
```

Reemplaza `slug-del-kiosko` con el slug configurado en el panel admin (ej. `recepcion`, `proveedores`).

### Chromium en CTS con persistencia offline

Para CTS/Raspberry/Bookworm se recomienda Chromium con un perfil fijo. No borres `--user-data-dir` ni `--disk-cache-dir`; ahi viven el perfil, el service worker, `localStorage` y la cache offline del ultimo contenido cargado.

```bash
/usr/bin/chromium-browser \
  --kiosk \
  --start-fullscreen \
  --app=https://pvrinfo.giize.com/slug-del-kiosko \
  --user-data-dir=/home/admin/.config/chromium-kiosk \
  --disk-cache-dir=/home/admin/.cache/chromium-kiosk
```

La primera carga de cada kiosko debe hacerse con internet para sembrar cache. Despues, si la CTS reinicia sin internet, el service worker sirve el app shell, la ultima playlist valida y los medios ya descargados.

### Formato de pantalla

Cada kiosko tiene formato `Vertical 9:16 (1080x1920)` o `Horizontal 16:9 (1920x1080)`.

Tambien puede elegir el ajuste del contenido:
- `Rellenar pantalla` (`cover`): llena toda la pantalla y puede recortar bordes.
- `Mostrar completo` (`contain`): conserva la imagen o video completo y puede dejar barras negras.

### Reutilizar contenido entre kioskos

Desde el editor de un kiosko, el boton `Agregar existente` permite seleccionar imagenes o videos que ya estan en otros playlists. El sistema agrega una nueva entrada al playlist actual apuntando al mismo archivo, sin duplicarlo en disco.

Al eliminar un item, solo se quita de ese playlist. El archivo fisico se borra unicamente cuando ningun playlist lo sigue usando.

### Pantallas Samsung/Tizen antiguas

El player moderno sigue en:

```text
https://pvrinfo.giize.com/slug-del-kiosko
```

Para navegadores integrados antiguos usa el player liviano:

```text
https://pvrinfo.giize.com/tv/slug-del-kiosko
```

Ese player guarda la ultima playlist en `localStorage` y usa service worker si el navegador lo soporta. En Samsung/Tizen viejo la persistencia offline es de mejor esfuerzo; para garantia fuerte usa una CTS externa con Chromium.

---

## API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/kiosks` | Listar todos los kioskos |
| POST | `/api/kiosks` | Crear un kiosko (acepta `orientation` y `fitMode`) |
| GET | `/api/kiosks/:id` | Obtener un kiosko |
| PUT | `/api/kiosks/:id` | Editar nombre/slug/estado/formato |
| DELETE | `/api/kiosks/:id` | Eliminar kiosko y borrar solo archivos sin otras referencias |
| GET | `/api/kiosks/:id/media-library` | Listar contenido reutilizable de otros kioskos |
| GET | `/api/kiosks/:id/items` | Listar items de la playlist |
| POST | `/api/kiosks/:id/items/upload` | Subir archivos (multipart/form-data) |
| POST | `/api/kiosks/:id/items/from-existing` | Agregar al playlist contenido ya existente |
| PUT | `/api/items/:id` | Editar item (enabled, durationSeconds) |
| DELETE | `/api/items/:id` | Eliminar item y su archivo |
| PUT | `/api/kiosks/:id/reorder` | Reordenar playlist |
| GET | `/api/public/kiosk/:slug` | Datos del kiosko para el player |
| GET | `/tv/:slug` | Player legacy para navegadores Samsung/Tizen antiguos |

---

## Herramientas de conversión

Accesibles desde el panel admin en `/admin/tools`.

| Herramienta | Descripción | Requisitos del sistema |
|-------------|-------------|------------------------|
| Video → GIF | Convierte un fragmento de video a GIF animado | Solo FFmpeg (incluido en `ffmpeg-static`) |
| Comprimir Video | Reduce el tamaño de un video con H.264 | Solo FFmpeg (incluido en `ffmpeg-static`) |
| PDF → Imágenes | Convierte cada página de un PDF en imagen PNG/JPG | **ImageMagick + Ghostscript** |

### Instalar ImageMagick + Ghostscript para PDF → Imágenes

**Windows:**
1. Descargar e instalar [Ghostscript](https://www.ghostscript.com/releases/gsdnld.html) (versión 64-bit)
2. Descargar e instalar [ImageMagick](https://imagemagick.org/script/download.php#windows) — marcar "Install legacy utilities" durante la instalación
3. Reiniciar la terminal

**Ubuntu/Debian:**
```bash
sudo apt-get install imagemagick ghostscript
# Puede ser necesario habilitar PDF en ImageMagick:
sudo sed -i 's|<policy domain="coder" rights="none" pattern="PDF" />|<policy domain="coder" rights="read\|write" pattern="PDF" />|' /etc/ImageMagick-6/policy.xml
```

Los archivos temporales generados se guardan en `server/temp/` y se pueden limpiar manualmente.

---

## Solución de problemas

### Error: `EADDRINUSE: address already in use :::3001`

El puerto 3001 ya está siendo usado por otra instancia del servidor que no cerró bien.

**En Windows:**
```bash
# 1. Encontrar el PID que usa el puerto
netstat -ano | findstr :3001

# 2. Matar el proceso (reemplaza 12345 con el PID encontrado)
taskkill /F /PID 12345
```

**En Linux/Mac:**
```bash
lsof -ti:3001 | xargs kill -9
```

Luego vuelve a ejecutar `npm run dev`.

---

### El servidor arranca pero la web no carga

Verificar que el frontend también está corriendo. En dev deben estar ambos procesos activos (el output muestra `[0]` para el server y `[1]` para Vite).

---

### Error al subir archivos grandes

Si los uploads fallan con archivos de más de ~100MB:

1. Verificar `MAX_FILE_SIZE_MB` en `server/.env`
2. En producción con Nginx, verificar `client_max_body_size` en la config de Nginx

---

### Advertencia: "The CJS build of Vite's Node API is deprecated"

Es solo un warning, no afecta el funcionamiento. Se puede ignorar o resolver actualizando la configuración de Vite a ESM.

---

### Resetear la base de datos

```bash
# Detener el servidor primero, luego:
rm data/kiosko.db

# Al reiniciar, se crea automáticamente con el esquema vacío
npm run dev
```

Para eliminar también los archivos subidos:
```bash
rm -rf uploads/*
```
