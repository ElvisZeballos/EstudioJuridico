# Integración WhatsApp — Documentación Técnica

## Índice

1. [Visión general](#1-visión-general)
2. [Arquitectura de componentes](#2-arquitectura-de-componentes)
3. [Primera conexión — escaneo de QR](#3-primera-conexión--escaneo-de-qr)
4. [Persistencia de sesión](#4-persistencia-de-sesión)
5. [Persistencia de mensajes](#5-persistencia-de-mensajes)
6. [Extracción diaria — bucle secuencial](#6-extracción-diaria--bucle-secuencial)
7. [Reconexión dentro del bucle](#7-reconexión-dentro-del-bucle)
8. [Endpoints HTTP](#8-endpoints-http)
9. [Datos almacenados y retención](#9-datos-almacenados-y-retención)
10. [Flujo completo día a día](#10-flujo-completo-día-a-día)
11. [Consideraciones importantes](#11-consideraciones-importantes)

---

## 1. Visión general

La integración usa la librería **Baileys** (`@whiskeysockets/baileys`) para conectar una cuenta de WhatsApp mediante el protocolo Web multi-dispositivo. No se usa la API oficial de WhatsApp Business; el sistema emula un navegador Chrome como dispositivo vinculado.

**Principio de diseño clave**: las sesiones de WhatsApp están **apagadas todo el día**. Solo se encienden una vez al día durante el proceso de extracción, y se apagan al terminar. Esto minimiza el consumo de recursos y permite escalar a decenas de abogados sin mantener conexiones permanentes.

| Responsabilidad | Archivo |
|---|---|
| Conectar/desconectar sesiones, guardar mensajes en tiempo real | `whatsappService.ts` |
| Bucle secuencial de extracción diaria | `whatsappRunner.ts` |
| Programar el cron diario | `cronService.ts` |

---

## 2. Arquitectura de componentes

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Profile.tsx)                                 │
│  Botón "Conectar WhatsApp" → QR (solo primera vez)      │
│  Botón "Extraer mensajes hoy" (ABOGADO/ADMIN, manual)   │
└────────────────┬────────────────────────────────────────┘
                 │ HTTP
┌────────────────▼────────────────────────────────────────┐
│  API Routes (/api/whatsapp/*)                           │
│  whatsapp.ts → whatsappController.ts                    │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  whatsappService.ts                                     │
│  - activeSessions: Map<userId, ActiveSession>           │
│  - startWhatsAppSession()   — abre socket Baileys       │
│  - waitForConnected()       — polling hasta CONNECTED   │
│  - softDisconnectSession()  — cierra sin borrar datos   │
│  - disconnectAllSessions()  — limpieza final forzada    │
│  - persistMessages()  → WhatsAppMessage (DB)            │
│  - getAccumulatedMessages() ← WhatsAppMessage (DB)      │
└────────────────┬────────────────────────────────────────┘
                 │ Baileys WebSocket (solo durante extracción)
┌────────────────▼────────────────────────────────────────┐
│  WhatsApp Web (servidor de WhatsApp)                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  cronService.ts — todos los días 22:00 UTC (5 PM UTC-5) │
│  → whatsappRunner.ts → bucle por cada abogado           │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Primera conexión — escaneo de QR

Esta sección describe en detalle qué pasa la **primera vez** que un abogado vincula su WhatsApp con el sistema. Es el único momento en que se escanea un QR. A partir de ahí, el sistema opera de forma autónoma.

### Paso 1 — El usuario pulsa "Conectar WhatsApp"

```
Frontend → POST /api/whatsapp/connect
               ↓
       startWhatsAppSession(userId)
```

El servicio busca en `WhatsAppSession` si ya existe un registro para ese usuario.
Como es la primera vez, **no existe** → se llama a `initAuthCreds()` para generar credenciales vacías.

### Paso 2 — Se crea el socket y Baileys genera el QR

```
makeWASocket({
  version: última versión de WhatsApp Web,
  auth: { creds: vacías, keys: vacías },
  browser: ['EstudioJuridico', 'Chrome', '1.0.0'],
  syncFullHistory: true,
  shouldSyncHistoryMessage: () => true,
})
```

Baileys intenta autenticarse con las credenciales vacías. Como no hay sesión previa, WhatsApp responde enviando un código QR.

El evento `connection.update` dispara con `qr` presente:
```
sessionData.qr = await QRCode.toDataURL(qr)  // imagen base64
sessionData.status = 'CONNECTING'
```

### Paso 3 — El frontend muestra el QR

El frontend hace polling a `GET /api/whatsapp/status` cada pocos segundos.
Cuando recibe `status: 'CONNECTING'` con `qr` no nulo, muestra la imagen del QR en pantalla.

### Paso 4 — El usuario escanea el QR con su teléfono

WhatsApp móvil escanea el código. En ese momento:

1. El teléfono confirma la vinculación con los servidores de WhatsApp.
2. WhatsApp **cierra el socket actual** enviando un cierre con código `515` (`STREAM_CHANGED`).

Esto es comportamiento normal del protocolo — no es un error.

### Paso 5 — Reconexión automática post-QR

```
connection.update → connection === 'close', código 515
  → NO es logout
  → reconnectAttempts (0) < MAX (5)
  → setTimeout 3s → startWhatsAppSession(userId)
```

El sistema espera 3 segundos y reconecta. Esta vez las credenciales **ya fueron guardadas** por el evento `creds.update` que Baileys disparó justo antes del cierre. El socket nuevo se autentica sin QR.

### Paso 6 — La sesión abre correctamente

```
connection.update → connection === 'open'
  → sessionData.status = 'CONNECTED'
  → sessionData.reconnectAttempts = 0
  → WhatsAppSession.connected = true  (DB)
```

El frontend hace polling, recibe `status: 'CONNECTED'`, oculta el QR y muestra el estado conectado.

### Paso 7 — WhatsApp envía el historial completo (INITIAL_BOOTSTRAP)

Este es el evento más importante de la primera conexión:

```
messaging-history.set → { messages: [...cientos o miles de msgs...] }
  → persistMessages(userId, msgs)
  → upsert en WhatsAppMessage (DB) en lotes de 100
```

WhatsApp envía el historial de **las últimas semanas** de todas las conversaciones del teléfono. Todo se guarda en `WhatsAppMessage`.

> **Este evento solo ocurre una vez en toda la vida de la sesión.** En todas las conexiones siguientes WhatsApp solo manda el delta (mensajes nuevos desde la última vez que el dispositivo estuvo online), nunca el historial completo de nuevo.

### Paso 8 — Mensajes nuevos en tiempo real

Mientras la sesión esté activa (durante la ventana de extracción), cada mensaje que llega o se envía dispara:

```
messages.upsert → type: 'notify' (mensaje nuevo en tiempo real)
               → type: 'append'  (delta al reconectar)
  → persistMessages(userId, msgs) → DB
```

### Resumen visual del flujo QR

```
Usuario pulsa "Conectar"
        │
        ▼
startWhatsAppSession(userId)
  creds = vacías → Baileys pide QR a WhatsApp
        │
        ▼
connection.update → qr presente
  sessionData.qr = base64
        │
        ▼
Frontend muestra QR (polling /status)
        │
        ▼
Usuario escanea con el teléfono
        │
        ▼
WhatsApp cierra socket (STREAM_CHANGED 515)
        │
        ▼
Reconexión automática (3s delay)
  creds = guardadas → Baileys autentica sin QR
        │
        ▼
connection.update → 'open'
  connected = true en DB
        │
        ▼
messaging-history.set (INITIAL_BOOTSTRAP)
  → historial completo → WhatsAppMessage (DB)
        │
        ▼
Sesión activa — messages.upsert en tiempo real
```

---

## 4. Persistencia de sesión

### Modelo `WhatsAppSession`

```prisma
model WhatsAppSession {
  id        String   @id @default(uuid())
  userId    String   @unique
  creds     String   @db.Text   // credenciales Baileys serializadas con BufferJSON
  keys      String   @db.Text   // claves Signal serializadas con BufferJSON
  connected Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**`creds`**: contiene el par de claves de identidad del dispositivo, el JID de la cuenta, el token de acceso, etc. Es lo que identifica al servidor como un dispositivo vinculado ante WhatsApp.

**`keys`**: contiene las claves del protocolo Signal (cifrado E2E). Se actualizan en cada intercambio de mensajes.

Ambos campos se serializan con `JSON.stringify(data, BufferJSON.replacer)` para preservar los `Uint8Array` que Baileys usa internamente, y se deserializan con `JSON.parse(str, BufferJSON.reviver)`.

Cada vez que cambian (evento `creds.update`), se llama a `saveCreds()` que hace un `upsert` en DB.

**`connected`**: en la nueva arquitectura este campo indica si la sesión estuvo activa en la última extracción. Se pone en `true` cuando `connection === 'open'` y vuelve a `false` cuando `softDisconnectSession` cierra el socket al terminar el bucle. **No indica si hay un socket activo ahora mismo** — eso lo determina el Map `activeSessions` en memoria.

---

## 5. Persistencia de mensajes

### Modelo `WhatsAppMessage`

```prisma
model WhatsAppMessage {
  id        String   @id @default(uuid())
  userId    String
  messageId String
  remoteJid String   // JID del chat (persona o grupo)
  timestamp DateTime
  rawJson   String   @db.Text  // mensaje proto serializado completo
  createdAt DateTime @default(now())

  @@unique([userId, messageId])
}
```

**`rawJson`**: el mensaje `proto.IWebMessageInfo` completo serializado con `BufferJSON.replacer`. Contiene todo: texto, metadatos, información de media, citas, reacciones, etc.

### ¿Cuándo se guardan mensajes?

| Evento Baileys | Tipo | Cuándo ocurre |
|---|---|---|
| `messaging-history.set` | Historial | Solo en la primera vinculación (INITIAL_BOOTSTRAP) |
| `messages.upsert` (type: `append`) | Delta | Al reconectar — mensajes recibidos mientras el socket estaba apagado |
| `messages.upsert` (type: `notify`) | Tiempo real | Mensaje nuevo mientras el socket está activo (durante la ventana de extracción) |

### Proceso de guardado (`persistMessages`)

```
msgs[] de Baileys
  │
  ▼
Filtrar: solo msgs con key.id + key.remoteJid + messageTimestamp
  │
  ▼
Mapear a filas: { userId, messageId, remoteJid, timestamp, rawJson }
  │
  ▼
Lotes de 100 → upsert en paralelo
  (where: userId_messageId único → no duplica si llega dos veces)
```

### Retención

- **Ventana de lectura**: 48 horas. `getAccumulatedMessages()` filtra `timestamp >= now - 48h`.
- **Limpieza automática**: al final de cada extracción de usuario, el runner borra todos sus `WhatsAppMessage` con `timestamp < now - 48h`.
- **Al desconectar manualmente**: `disconnectWhatsApp()` elimina **todos** los mensajes del usuario sin importar la fecha.

---

## 6. Extracción diaria — bucle secuencial

### Cuándo se ejecuta

- **Automático**: todos los días a las **22:00 UTC** (5 PM UTC-5) vía `node-cron`.
- **Manual**: botón "Extraer mensajes hoy" en el perfil (solo visible para ABOGADO/ADMIN).

### Principio de diseño

El runner procesa **un abogado a la vez**. Para cada uno: conecta su sesión, espera a que WhatsApp mande los mensajes del día, extrae, limpia y cierra. Recién entonces pasa al siguiente. Esto evita tener múltiples sockets abiertos simultáneamente y mantiene bajo el consumo de recursos.

### Bucle secuencial

```
runWhatsAppExtraction()
  │
  ▼
Crear carpeta: /temp/whatsapp_YYYY-MM-DD/
  │
  ▼
Consultar DB: todos los WhatsAppSession
  → filtrar: role = 'ABOGADO' y active = true
  │
  ▼
Para cada abogado [i/total]:
  │
  ├─ 1. CONECTAR
  │      startWhatsAppSession(userId)
  │      → si ya hay credenciales: reconecta sin QR
  │      → si no tiene credenciales: genera QR (no aplica en cron)
  │
  ├─ 2. ESPERAR CONEXIÓN (máx. 60 segundos)
  │      waitForConnected(userId, 60_000)
  │      → polling cada 500ms hasta status === 'CONNECTED'
  │      → si timeout: log warn → softDisconnect → siguiente abogado
  │
  ├─ 3. ESPERAR DELTA (15 segundos fijos)
  │      WhatsApp envía via messages.upsert (type: 'append')
  │      todos los mensajes desde la última conexión (~24h)
  │      → persistMessages() los guarda en WhatsAppMessage (DB)
  │
  ├─ 4. EXTRAER
  │      extractForUser(userId, nombre, apellido, runDir, i)
  │        ├── getAccumulatedMessages() ← DB últimas 48h
  │        ├── filtrar: solo mensajes de las últimas 24h
  │        ├── agrupar por conversación (remoteJid)
  │        ├── por cada mensaje → processMessage()
  │        │     ├── texto → { tipo: 'texto', cuerpo }
  │        │     ├── imagen → descarga .jpg → guarda en media/
  │        │     └── PDF → descarga .pdf → guarda en media/
  │        └── escribe messages.json
  │
  ├─ 5. LIMPIAR MENSAJES VIEJOS
  │      deleteMany WHERE userId = ? AND timestamp < now - 48h
  │      → log si se eliminaron filas
  │
  └─ 6. CERRAR SESIÓN
         softDisconnectSession(userId)
           → session.intentionalDisconnect = true
           → socket.end()
           → activeSessions.delete(userId)
           → WhatsAppSession.connected = false (DB)
  │
  ▼ (siguiente abogado)
  │
  ▼
VALIDACIÓN FINAL
  disconnectAllSessions()
  → si quedó alguna sesión abierta por error → fuerza cierre
  → si no quedó ninguna → no hace nada
  │
  ▼
Log: "Runner finalizado — resultados en /temp/..."
```

### Estructura del output

```
/temp/whatsapp_2026-05-02/
  └── 01_María_González/
        ├── messages.json
        └── media/
              ├── imagen_de_JuanPerez_14-30_0.jpg
              └── contrato_14-32_1.pdf
```

```json
{
  "abogado": { "id": "uuid", "nombre": "María", "apellido": "González" },
  "generadoEn": "2026-05-02T22:00:05.000Z",
  "periodo": "ultimas_24_horas",
  "totalMensajes": 42,
  "totalConversaciones": 7,
  "carpeta": "/ruta/absoluta/...",
  "conversaciones": {
    "5491112345678@s.whatsapp.net": {
      "jid": "5491112345678@s.whatsapp.net",
      "nombre": "Juan Pérez",
      "esGrupo": false,
      "mensajes": [
        { "timestamp": "2026-05-02T18:30:00.000Z", "deMi": false, "tipo": "texto", "cuerpo": "Hola doctora" },
        { "timestamp": "2026-05-02T18:31:00.000Z", "deMi": true, "tipo": "imagen", "nombreArchivo": "imagen_de_JuanPerez_18-31_1.jpg", "archivo": "media/imagen_de_JuanPerez_18-31_1.jpg" }
      ]
    }
  }
}
```

---

## 7. Reconexión dentro del bucle

Durante el paso 2 (`waitForConnected`), si el socket se cae por un error transitorio de red, la lógica de reconexión automática vuelve a intentar hasta 5 veces con 3 segundos de espera. El polling de `waitForConnected` eventualmente verá `status === 'CONNECTED'` cuando el intento exitoso complete.

```
connection.update → 'close' (NO intentional, NO logout)
  → reconnectAttempts < 5
  → setTimeout 3s → startWhatsAppSession()
  → nueva conexión → 'open' → status = 'CONNECTED'
  → waitForConnected() resuelve true
```

Si los 5 intentos fallan, `activeSessions` elimina la entrada y `waitForConnected` hace timeout → el abogado se salta con un log de advertencia.

**Nota**: `softDisconnectSession` marca `intentionalDisconnect = true` antes de cerrar el socket, lo que suprime la reconexión automática. Esto garantiza que al cerrar intencionalmente al final de cada iteración, el socket no vuelva a abrirse solo.

---

## 8. Endpoints HTTP

Todos requieren autenticación (`authenticateToken`).

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `POST` | `/api/whatsapp/connect` | Todos | Inicia sesión (muestra QR si es la primera vez) |
| `GET` | `/api/whatsapp/status` | Todos | Devuelve estado actual + QR si está disponible |
| `DELETE` | `/api/whatsapp/disconnect` | Todos | Desconecta y borra sesión + todos los mensajes |
| `POST` | `/api/whatsapp/run-extraction` | ABOGADO, ADMIN | Dispara extracción manual en background |
| `GET` | `/api/whatsapp/debug` | Todos | Diagnóstico: estado en memoria, en DB, cantidad de mensajes |

### Respuesta de `/status`

```json
{
  "status": "CONNECTED" | "CONNECTING" | "DISCONNECTED",
  "qr": "data:image/png;base64,..." | null,
  "hasSession": true | false
}
```

---

## 9. Datos almacenados y retención

| Dato | Dónde | Retención |
|---|---|---|
| Credenciales (creds + keys) | `WhatsAppSession` (DB) | Permanente hasta desconexión manual |
| Mensajes crudos (rawJson) | `WhatsAppMessage` (DB) | Borrados al superar 48h (limpieza en cada extracción) |
| Archivos de media (imágenes, PDFs) | `/temp/` en disco | No se borran automáticamente |
| JSON de extracción | `/temp/` en disco | No se borran automáticamente |

---

## 10. Flujo completo día a día

```
Todo el día (00:00 – 21:59 UTC):
  Sin sesiones activas. Cero conexiones a WhatsApp.
  Server consume recursos mínimos.

22:00 UTC (5 PM UTC-5):
  Cron dispara runWhatsAppExtraction()

  ┌── Abogado 1 ──────────────────────────────────────┐
  │  conectar → esperar 60s → esperar delta 15s        │
  │  → extraer → limpiar msgs >48h → cerrar sesión     │
  └────────────────────────────────────────────────────┘
  ┌── Abogado 2 ──────────────────────────────────────┐
  │  conectar → esperar 60s → esperar delta 15s        │
  │  → extraer → limpiar msgs >48h → cerrar sesión     │
  └────────────────────────────────────────────────────┘
  ... (un abogado a la vez)

  Validación final: cerrar cualquier sesión residual

  → /temp/whatsapp_YYYY-MM-DD/ generado y listo

Después de ~22:15 UTC:
  Sin sesiones activas nuevamente.
```

---

## 11. Consideraciones importantes

### Primera conexión es manual y obligatoria

Cada abogado debe escanear el QR **una sola vez** desde la página de perfil. Hasta que lo haga, no existe `WhatsAppSession` en DB y el runner no lo procesará. Después del primer escaneo, todo el flujo es automático.

### El INITIAL_BOOTSTRAP solo llega una vez

Al escanear el QR, WhatsApp envía el historial completo de conversaciones (semanas de mensajes). Este evento `messaging-history.set` **no se repite** en ninguna conexión posterior. Si el servidor no pudo guardar esos mensajes (e.g., error de DB), hay que desconectar y re-escanear el QR para recibir el historial de nuevo.

### Por qué el bucle es secuencial y no paralelo

Abrir múltiples sockets Baileys simultáneamente con distintas cuentas es posible técnicamente, pero:
- Consume más memoria y CPU por cada socket activo
- Complica el manejo de errores
- No hay ventaja real de tiempo (cada usuario espera su propio delta de 15s de todas formas)

Con 10 abogados el bucle completo tarda ~13 minutos (15s settle + tiempo de extracción por usuario), lo cual es perfectamente aceptable para un proceso nocturno.

### softDisconnect vs disconnect

| Función | Borra mensajes | Borra credenciales | Uso |
|---|---|---|---|
| `softDisconnectSession(userId)` | No | No | Runner al terminar cada usuario |
| `disconnectAllSessions()` | No | No | Limpieza forzada al final del runner |
| `disconnectWhatsApp(userId)` | Sí (todos) | Sí (sesión entera) | Botón manual del usuario en perfil |

### Tipos de media soportados

| Tipo | Extensión | Campo en JSON |
|---|---|---|
| Texto | — | `tipo: "texto"`, `cuerpo` |
| Imagen | `.jpg` | `tipo: "imagen"`, `archivo`, `caption?` |
| Documento PDF | `.pdf` | `tipo: "documento_pdf"`, `nombreArchivo`, `archivo` |
| Audio, video, stickers | — | Se ignoran (processMessage retorna null) |
