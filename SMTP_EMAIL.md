# Configuración de correo electrónico (SMTP)

## ¿Para qué se usa?

El sistema usa correo electrónico únicamente para el **restablecimiento de contraseña**. Cuando un usuario hace clic en "Olvidé mi contraseña", la app genera un token y le envía un link por email para que pueda crear una nueva contraseña.

---

## Variables de entorno

En `backend/.env`, configurá las siguientes variables:

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="tucorreo@gmail.com"
SMTP_PASS="xxxx xxxx xxxx xxxx"
SMTP_FROM="Estudio Jurídico <tucorreo@gmail.com>"
```

| Variable    | Descripción |
|-------------|-------------|
| `SMTP_HOST` | Servidor SMTP del proveedor de correo |
| `SMTP_PORT` | Puerto SMTP (587 para TLS/STARTTLS) |
| `SMTP_USER` | Dirección de correo que envía los emails |
| `SMTP_PASS` | Contraseña de aplicación (ver más abajo) |
| `SMTP_FROM` | Nombre y dirección que aparecen en el "De:" del correo |

---

## Configuración con Gmail (recomendado)

Gmail es la opción más simple para entornos de desarrollo y pequeñas producciones. **No uses tu contraseña de Gmail directamente** — Google bloquea el acceso directo por seguridad. En su lugar, creá una **contraseña de aplicación**.

### Paso 1 — Activar la verificación en dos pasos

1. Abrí [myaccount.google.com](https://myaccount.google.com)
2. Menú izquierdo → **Seguridad**
3. En "Cómo inicias sesión en Google" → **Verificación en dos pasos** → activala si no está activa

> La contraseña de aplicación solo está disponible si la verificación en dos pasos está activada.

---

### Paso 2 — Crear una contraseña de aplicación

1. En la misma sección de Seguridad, buscá **Contraseñas de aplicaciones**
   - Si no aparece, ingresá directamente a: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. En el campo "Nombre de la app" escribí algo como `Estudio Jurídico`
3. Clic en **Crear**
4. Google mostrará una contraseña de 16 caracteres (formato `xxxx xxxx xxxx xxxx`)
5. **Copiá esa contraseña** — solo se muestra una vez

---

### Paso 3 — Configurar el `.env`

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="tucorreo@gmail.com"
SMTP_PASS="xxxx xxxx xxxx xxxx"
SMTP_FROM="Estudio Jurídico <tucorreo@gmail.com>"
```

Reemplazá `tucorreo@gmail.com` con tu cuenta Gmail y `xxxx xxxx xxxx xxxx` con la contraseña de aplicación del paso anterior.

---

### Paso 4 — Reiniciar el backend

```bash
cd backend
npm run dev
```

---

## Uso en la aplicación

El envío de correo ocurre en una sola situación:

1. El usuario va a la pantalla de login y hace clic en **"¿Olvidaste tu contraseña?"**
2. Ingresa su email y confirma
3. El sistema genera un token de un solo uso (válido por 1 hora) y envía el link a su email
4. El usuario hace clic en el link y establece una nueva contraseña

El correo enviado tiene el asunto **"Restablecer contraseña - Estudio Jurídico"** y contiene un botón con el link de restablecimiento.

---

## Otros proveedores SMTP

Si preferís usar otro proveedor, solo cambiá `SMTP_HOST` y `SMTP_PORT`:

| Proveedor   | SMTP_HOST              | SMTP_PORT |
|-------------|------------------------|-----------|
| Gmail       | `smtp.gmail.com`       | 587       |
| Outlook     | `smtp.office365.com`   | 587       |
| Yahoo Mail  | `smtp.mail.yahoo.com`  | 587       |
| Zoho Mail   | `smtp.zoho.com`        | 587       |
| SendGrid    | `smtp.sendgrid.net`    | 587       |

Para SendGrid u otros servicios transaccionales, el `SMTP_USER` suele ser `apikey` y el `SMTP_PASS` es tu API key del servicio.

---

## Solución de problemas

**El correo no llega**
- Verificá que `SMTP_USER` y `SMTP_PASS` sean correctos en el `.env`
- Asegurate de que la contraseña de aplicación esté bien copiada (sin espacios extra)
- Revisá la carpeta de spam del destinatario

**Error de autenticación (535)**
- La contraseña de aplicación expiró o fue eliminada — creá una nueva en [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)

**Error de conexión / timeout**
- El puerto 587 puede estar bloqueado en algunos entornos corporativos — probá con el puerto 465 y `secure: true` (requiere cambio en el código)

**"Less secure app access"**
- Este mensaje ya no aplica en cuentas Gmail modernas — usá siempre contraseñas de aplicación en lugar de la contraseña principal
