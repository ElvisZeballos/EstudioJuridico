# Integración con Google Calendar

## ¿Cómo funciona?

Cada abogado puede vincular su propia cuenta de Google Calendar con la aplicación. Una vez conectado, todas las novedades que agenden se sincronizan automáticamente como eventos en su calendario.

La configuración de la aplicación (pasos 1–7) se hace **una sola vez** por el desarrollador. Cada abogado solo necesita hacer el **Paso 8** desde su cuenta en la app.

---

## Configuración inicial (solo una vez)

### Paso 1 — Crear proyecto en Google Cloud

1. Abrí [console.cloud.google.com](https://console.cloud.google.com) con una cuenta Google
2. Clic en el selector de proyecto (arriba a la izquierda) → **Nuevo proyecto**
3. Nombre: `Estudio Juridico`
4. Clic en **Crear**

---

### Paso 2 — Habilitar la Google Calendar API

1. Menú izquierdo → **APIs y servicios → Biblioteca**
2. Buscá `Google Calendar API`
3. Clic en el resultado → **Habilitar**

---

### Paso 3 — Configurar la Pantalla de consentimiento OAuth

1. Menú izquierdo → **APIs y servicios → Pantalla de consentimiento de OAuth**
2. Tipo de usuario: **Externo** → Crear
3. Completá los campos:
   - Nombre de la app: `Estudio Jurídico`
   - Correo de asistencia: tu correo
   - Correo del desarrollador: tu correo
4. Clic en **Guardar y continuar** en cada paso (podés dejar todo lo demás vacío)
5. En **"Usuarios de prueba"** → agregá los correos Gmail de los abogados que usarán la app
6. Finalizá el asistente

> **Nota:** Mientras la app esté en modo prueba, solo los usuarios agregados en este paso pueden conectar su Google Calendar. Para eliminar esta restricción, publicá la app haciendo clic en **"Publicar aplicación"** en esa misma pantalla.

---

### Paso 4 — Crear credenciales OAuth 2.0

1. Menú izquierdo → **APIs y servicios → Credenciales**
2. Clic en **+ Crear credenciales → ID de cliente de OAuth**
3. Tipo de aplicación: **Aplicación web**
4. Nombre: `Estudio Jurídico Backend`
5. En **"URI de redireccionamiento autorizados"** → agregá:
   ```
   http://localhost:3001/api/google-calendar/callback
   ```
   > Si en el futuro desplegás la app en producción, también agregá la URL de producción aquí, por ejemplo: `https://tudominio.com/api/google-calendar/callback`
6. Clic en **Crear**
7. Copiá el **Client ID** y el **Client Secret** que aparecen en el popup

---

### Paso 5 — Configurar las variables de entorno

En el archivo `backend/.env`, reemplazá los valores correspondientes:

```env
GOOGLE_CLIENT_ID=aqui_tu_client_id
GOOGLE_CLIENT_SECRET=aqui_tu_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google-calendar/callback
```

La línea `GOOGLE_REDIRECT_URI` ya está correcta si usás el puerto por defecto.

---

### Paso 6 — Reiniciar el backend

```bash
cd backend
npm run dev
```

---

## Conexión por cada abogado (una vez por usuario)

Cada abogado realiza este paso desde su propia cuenta en la aplicación:

1. Iniciar sesión en la app
2. Ir al **Dashboard (Home)**
3. Hacer clic en **"Conectar Google Calendar"**
4. Se abre Google para pedir autorización → aceptar los permisos
5. La app muestra el mensaje **"Google Calendar conectado correctamente"**

Cada abogado vincula **su propio** Google Calendar. La desconexión también está disponible desde el mismo botón en el dashboard.

---

## Uso en novedades

Al agregar o editar una novedad en un caso:

1. Activá el toggle **"Agendar evento"** al final del formulario
2. Seleccioná la **fecha y hora** del evento
3. Si Google Calendar está conectado, verás el badge verde **"Se sincronizará con Google Calendar"**
4. Al guardar, el evento se crea automáticamente en el calendario del abogado

Las novedades agendadas muestran un badge azul con la fecha y hora en la lista de novedades del caso.

Si se edita o elimina la novedad, el evento en Google Calendar se actualiza o elimina automáticamente.

---

## Endpoints de la API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/google-calendar/connect` | Devuelve la URL de autorización OAuth |
| `GET` | `/api/google-calendar/callback` | Callback OAuth (maneja Google) |
| `GET` | `/api/google-calendar/status` | Indica si el usuario está conectado |
| `DELETE` | `/api/google-calendar/disconnect` | Desvincula Google Calendar |
| `GET` | `/api/novedades/agendadas` | Lista todas las novedades agendadas del usuario |
