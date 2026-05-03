import { OpenAPIV3 } from 'openapi-types';

// ─── Reusable response components ──────────────────────────────────────────

const ErrorResponse = (description: string): OpenAPIV3.ResponseObject => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
});

const authResponses: Record<string, OpenAPIV3.ResponseObject> = {
  401: ErrorResponse('No autenticado — token ausente o inválido'),
  403: ErrorResponse('Sin permisos — rol insuficiente o token expirado'),
  500: ErrorResponse('Error interno del servidor'),
};

// ─── OpenAPI Document ───────────────────────────────────────────────────────

export const swaggerSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',

  info: {
    title: 'Estudio Jurídico — API',
    version: '1.0.0',
    description: `
## Bienvenido a la API del Estudio Jurídico

Esta API REST provee acceso completo al sistema de gestión de un estudio jurídico.
Permite administrar casos legales, clientes, abogados, movimientos financieros,
juzgados, y las integraciones con Google Calendar y WhatsApp.

---

### 🔐 Autenticación

Todos los endpoints (excepto los marcados como **público**) requieren un token JWT
enviado en el header \`Authorization\`:

\`\`\`
Authorization: Bearer <token>
\`\`\`

El token se obtiene desde \`POST /api/auth/login\` y tiene una validez de **2 horas**.
Puede renovarse con \`POST /api/auth/refresh\` antes de que expire.

---

### 👥 Roles y permisos

| Rol | Descripción |
|-----|-------------|
| \`ADMIN\` | Acceso total al sistema. Gestiona usuarios y configuración. |
| \`ABOGADO\` | Gestiona sus propios casos, clientes, juzgados y finanzas. |
| \`CLIENTE\` | Acceso de solo lectura a sus propios casos y novedades. |
| \`AUXILIAR\` | Acceso de lectura amplio; puede actualizar casos y clientes. |

---

### 🔒 Cifrado de datos sensibles

Los siguientes campos se almacenan **cifrados en la base de datos** y se
descifran automáticamente en las respuestas: \`dni\`, \`telefono\`, \`direccion\`,
\`fechaNacimiento\`, \`notas\`.

---

### 📋 Convenciones

- Las fechas se devuelven en formato **ISO 8601** (UTC).
- Los IDs son **UUID v4**.
- El borrado es siempre **lógico** (campo \`active: false\`); los registros no se eliminan físicamente.
- Las respuestas de error siguen el esquema \`{ "error": "mensaje descriptivo" }\`.
    `,
    contact: {
      name: 'Soporte Técnico',
      email: 'josecarloscamacho55@gmail.com',
    },
  },

  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Servidor de desarrollo',
    },
  ],

  tags: [
    {
      name: 'Auth',
      description: 'Registro, inicio de sesión, recuperación de contraseña y renovación de token.',
    },
    {
      name: 'Usuarios',
      description: 'Gestión de cuentas de usuario: creación, edición, foto de perfil e invitaciones.',
    },
    {
      name: 'Clientes',
      description: 'Gestión del directorio de clientes del estudio jurídico.',
    },
    {
      name: 'Casos',
      description: 'Gestión de expedientes y casos legales: abogados asignados, clientes, juzgado, partes, y estado.',
    },
    {
      name: 'Novedades',
      description: 'Actualizaciones y novedades vinculadas a un caso. Admiten agendamiento y sincronización con Google Calendar.',
    },
    {
      name: 'Juzgados',
      description: 'Directorio de juzgados y tribunales.',
    },
    {
      name: 'Movimientos',
      description: 'Registro de ingresos y egresos financieros asociados a casos.',
    },
    {
      name: 'Google Calendar',
      description: 'Integración OAuth 2.0 con Google Calendar para sincronizar novedades agendadas.',
    },
    {
      name: 'WhatsApp',
      description: 'Integración de WhatsApp mediante Baileys. Vincula la cuenta del abogado al sistema.',
    },
    {
      name: 'Admin',
      description: 'Panel de administración con estadísticas del servidor, base de datos y sistema.',
    },
  ],

  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT obtenido en `/api/auth/login`. Expira en 2 horas.',
      },
    },

    schemas: {
      // ── Error ─────────────────────────────────────────────────────────────
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Descripción del error', example: 'Credenciales inválidas' },
        },
        required: ['error'],
      },

      // ── Enums ─────────────────────────────────────────────────────────────
      Role: {
        type: 'string',
        enum: ['ADMIN', 'ABOGADO', 'CLIENTE', 'AUXILIAR'],
        description: 'Rol del usuario en el sistema',
      },
      CasoEstado: {
        type: 'string',
        enum: ['ACTIVO', 'PENDIENTE', 'CONCLUIDO', 'ARCHIVADO'],
        description: 'Estado actual del expediente',
      },
      TipoMovimiento: {
        type: 'string',
        enum: ['INGRESO', 'EGRESO'],
        description: 'Tipo de movimiento financiero',
      },

      // ── User ──────────────────────────────────────────────────────────────
      User: {
        type: 'object',
        description: 'Cuenta de usuario del sistema',
        properties: {
          id:              { type: 'string', format: 'uuid', description: 'Identificador único' },
          email:           { type: 'string', format: 'email', description: 'Correo electrónico (único)' },
          role:            { $ref: '#/components/schemas/Role' },
          nombre:          { type: 'string', description: 'Nombre de pila', example: 'María' },
          apellido:        { type: 'string', description: 'Apellido', example: 'González' },
          dni:             { type: 'string', nullable: true, description: 'Documento de identidad (descifrado)', example: '12.345.678' },
          telefono:        { type: 'string', nullable: true, description: 'Teléfono de contacto (descifrado)', example: '+54 9 11 1234-5678' },
          direccion:       { type: 'string', nullable: true, description: 'Dirección postal (descifrado)', example: 'Av. Corrientes 1234' },
          fechaNacimiento: { type: 'string', nullable: true, description: 'Fecha de nacimiento (descifrado)', example: '1985-06-15' },
          photoPath:       { type: 'string', nullable: true, description: 'Ruta relativa a la foto de perfil', example: '/uploads/foto.jpg' },
          active:          { type: 'boolean', description: 'Si la cuenta está activa' },
          createdAt:       { type: 'string', format: 'date-time', description: 'Fecha de creación' },
          updatedAt:       { type: 'string', format: 'date-time', description: 'Fecha de última actualización' },
        },
      },

      UserPublic: {
        type: 'object',
        description: 'Datos públicos de un usuario (para selectores)',
        properties: {
          id:       { type: 'string', format: 'uuid' },
          nombre:   { type: 'string' },
          apellido: { type: 'string' },
          email:    { type: 'string', format: 'email' },
          role:     { $ref: '#/components/schemas/Role' },
        },
      },

      AuthResponse: {
        type: 'object',
        description: 'Respuesta de autenticación exitosa',
        properties: {
          token: {
            type: 'string',
            description: 'JWT de acceso. Validez: 2 horas.',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
          user: { $ref: '#/components/schemas/User' },
        },
        required: ['token', 'user'],
      },

      // ── Client ────────────────────────────────────────────────────────────
      Referencia: {
        type: 'object',
        description: 'Referencia personal o laboral de un cliente',
        properties: {
          id:        { type: 'string', format: 'uuid' },
          nombre:    { type: 'string', example: 'Carlos Pérez' },
          relacion:  { type: 'string', example: 'Familiar' },
          telefono:  { type: 'string', example: '+54 9 11 8765-4321' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      Client: {
        type: 'object',
        description: 'Cliente del estudio jurídico',
        properties: {
          id:              { type: 'string', format: 'uuid' },
          nombre:          { type: 'string', example: 'Juan' },
          apellido:        { type: 'string', example: 'Rodríguez' },
          dni:             { type: 'string', description: 'DNI descifrado', example: '28.456.789' },
          email:           { type: 'string', format: 'email' },
          telefono:        { type: 'string', nullable: true, description: 'Descifrado' },
          direccion:       { type: 'string', nullable: true, description: 'Descifrado' },
          fechaNacimiento: { type: 'string', nullable: true, description: 'Descifrado' },
          notas:           { type: 'string', nullable: true, description: 'Notas internas (descifrado)' },
          active:          { type: 'boolean' },
          abogadoId:       { type: 'string', format: 'uuid', nullable: true },
          abogado: {
            nullable: true,
            allOf: [{ $ref: '#/components/schemas/UserPublic' }],
            description: 'Abogado responsable del cliente',
          },
          userId:          { type: 'string', format: 'uuid', nullable: true, description: 'Cuenta de usuario vinculada (portal de cliente)' },
          referencias:     { type: 'array', items: { $ref: '#/components/schemas/Referencia' } },
          createdAt:       { type: 'string', format: 'date-time' },
          updatedAt:       { type: 'string', format: 'date-time' },
        },
      },

      // ── Juzgado ───────────────────────────────────────────────────────────
      Juzgado: {
        type: 'object',
        description: 'Juzgado o tribunal',
        properties: {
          id:        { type: 'string', format: 'uuid' },
          nombre:    { type: 'string', example: 'Juzgado Civil N° 12' },
          tipo:      { type: 'string', nullable: true, example: 'Civil y Comercial' },
          direccion: { type: 'string', nullable: true, example: 'Av. Callao 123, CABA' },
          ciudad:    { type: 'string', nullable: true, example: 'Buenos Aires' },
          telefono:  { type: 'string', nullable: true },
          notas:     { type: 'string', nullable: true },
          active:    { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Caso ──────────────────────────────────────────────────────────────
      AbogadoContraparte: {
        type: 'object',
        description: 'Abogado de la parte contraria en un caso',
        properties: {
          id:        { type: 'string', format: 'uuid' },
          nombre:    { type: 'string', example: 'Dr. Roberto Silva' },
          direccion: { type: 'string', nullable: true },
          telefono:  { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      Demandado: {
        type: 'object',
        description: 'Persona demandada en un caso',
        properties: {
          id:        { type: 'string', format: 'uuid' },
          nombre:    { type: 'string', example: 'Empresa S.A.' },
          domicilio: { type: 'string', nullable: true },
          carnet:    { type: 'string', nullable: true, description: 'Número de documento o carnet' },
          telefono:  { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      Caso: {
        type: 'object',
        description: 'Expediente o caso legal',
        properties: {
          id:          { type: 'string', format: 'uuid' },
          titulo:      { type: 'string', example: 'Divorcio Rodríguez c/ López' },
          descripcion: { type: 'string', nullable: true },
          estado:      { $ref: '#/components/schemas/CasoEstado' },
          numero:      { type: 'string', nullable: true, description: 'Número de expediente judicial', example: '2024/00123' },
          fechaInicio: { type: 'string', format: 'date-time', nullable: true },
          fechaCierre: { type: 'string', format: 'date-time', nullable: true },
          notas:       { type: 'string', nullable: true },
          active:      { type: 'boolean' },
          juzgadoId:   { type: 'string', format: 'uuid', nullable: true },
          juzgado: {
            nullable: true,
            description: 'Juzgado asignado',
            type: 'object',
            properties: {
              id:     { type: 'string', format: 'uuid' },
              nombre: { type: 'string' },
              ciudad: { type: 'string', nullable: true },
            },
          },
          abogados: {
            type: 'array',
            description: 'Abogados asignados al caso',
            items: {
              type: 'object',
              properties: {
                abogadoId: { type: 'string', format: 'uuid' },
                abogado:   { $ref: '#/components/schemas/UserPublic' },
              },
            },
          },
          clientes: {
            type: 'array',
            description: 'Clientes involucrados en el caso',
            items: {
              type: 'object',
              properties: {
                clienteId: { type: 'string', format: 'uuid' },
                cliente: {
                  type: 'object',
                  properties: {
                    id:       { type: 'string', format: 'uuid' },
                    nombre:   { type: 'string' },
                    apellido: { type: 'string' },
                    email:    { type: 'string' },
                  },
                },
              },
            },
          },
          abogadosContraparte: {
            type: 'array',
            items: { $ref: '#/components/schemas/AbogadoContraparte' },
          },
          demandados: {
            type: 'array',
            items: { $ref: '#/components/schemas/Demandado' },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      CasoHistorialEntry: {
        type: 'object',
        description: 'Entrada en el historial de auditoría de un caso',
        properties: {
          id:           { type: 'string', format: 'uuid' },
          casoId:       { type: 'string', format: 'uuid' },
          usuarioId:    { type: 'string', format: 'uuid' },
          usuario: {
            type: 'object',
            properties: {
              id:       { type: 'string', format: 'uuid' },
              nombre:   { type: 'string' },
              apellido: { type: 'string' },
              role:     { $ref: '#/components/schemas/Role' },
            },
          },
          campo:        { type: 'string', description: 'Nombre del campo modificado', example: 'estado' },
          valorAntes:   { type: 'string', nullable: true, description: 'Valor anterior', example: 'ACTIVO' },
          valorDespues: { type: 'string', nullable: true, description: 'Valor nuevo', example: 'CONCLUIDO' },
          createdAt:    { type: 'string', format: 'date-time' },
        },
      },

      // ── Novedad ───────────────────────────────────────────────────────────
      CasoNovedad: {
        type: 'object',
        description: 'Novedad o actualización de un caso. Puede agendarse y sincronizarse con Google Calendar.',
        properties: {
          id:                   { type: 'string', format: 'uuid' },
          casoId:               { type: 'string', format: 'uuid' },
          caso: {
            type: 'object',
            properties: {
              id:     { type: 'string', format: 'uuid' },
              titulo: { type: 'string' },
            },
          },
          autorId:   { type: 'string', format: 'uuid' },
          autor:     { $ref: '#/components/schemas/UserPublic' },
          titulo:    { type: 'string', example: 'Audiencia preliminar' },
          contenido: { type: 'string', example: 'Se realizó la audiencia preliminar con resultado favorable.' },
          fecha:     { type: 'string', format: 'date-time', description: 'Fecha de la novedad' },
          fechaAgendada: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Si se define, se crea un evento en Google Calendar del usuario',
          },
          googleCalendarEventId: {
            type: 'string',
            nullable: true,
            description: 'ID del evento creado en Google Calendar',
          },
          active:    { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Movimiento ────────────────────────────────────────────────────────
      Movimiento: {
        type: 'object',
        description: 'Movimiento financiero (ingreso o egreso) asociado a un caso',
        properties: {
          id:        { type: 'string', format: 'uuid' },
          casoId:    { type: 'string', format: 'uuid' },
          caso: {
            type: 'object',
            properties: {
              id:     { type: 'string', format: 'uuid' },
              titulo: { type: 'string' },
              numero: { type: 'string', nullable: true },
            },
          },
          abogadoId: { type: 'string', format: 'uuid' },
          abogado:   { $ref: '#/components/schemas/UserPublic' },
          tipo:      { $ref: '#/components/schemas/TipoMovimiento' },
          concepto:  { type: 'string', description: 'Descripción del movimiento', example: 'Honorarios primera instancia' },
          monto:     { type: 'number', format: 'decimal', description: 'Monto en moneda local', example: 150000.00 },
          fecha:     { type: 'string', format: 'date-time' },
          notas:     { type: 'string', nullable: true },
          active:    { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      MovimientoStats: {
        type: 'object',
        description: 'Estadísticas financieras agregadas',
        properties: {
          totalIngresos:   { type: 'number', description: 'Suma total de ingresos', example: 500000 },
          totalEgresos:    { type: 'number', description: 'Suma total de egresos', example: 120000 },
          balance:         { type: 'number', description: 'Balance neto (ingresos - egresos)', example: 380000 },
          totalMovimientos:{ type: 'integer', description: 'Cantidad total de movimientos', example: 42 },
          cantIngresos:    { type: 'integer', example: 30 },
          cantEgresos:     { type: 'integer', example: 12 },
        },
      },

      // ── Admin Stats ───────────────────────────────────────────────────────
      AdminStats: {
        type: 'object',
        description: 'Estadísticas y estado del sistema (solo ADMIN)',
        properties: {
          server: {
            type: 'object',
            properties: {
              uptime:      { type: 'number', description: 'Uptime en segundos' },
              nodeVersion: { type: 'string', example: 'v20.11.0' },
              env:         { type: 'string', example: 'development' },
              platform:    { type: 'string', example: 'win32' },
              memory: {
                type: 'object',
                properties: {
                  heapUsedMB:  { type: 'number' },
                  heapTotalMB: { type: 'number' },
                  rssMB:       { type: 'number' },
                },
              },
            },
          },
          database: {
            type: 'object',
            properties: {
              connected:  { type: 'boolean' },
              latencyMs:  { type: 'number' },
              provider:   { type: 'string', example: 'postgresql' },
              url:        { type: 'string', description: 'Solo el hostname', example: 'localhost:5432' },
            },
          },
          storage: {
            type: 'object',
            properties: {
              uploadsDirMB:    { type: 'number' },
              diskAvailableGB: { type: 'number', nullable: true },
              diskTotalGB:     { type: 'number', nullable: true },
            },
          },
          counts: {
            type: 'object',
            properties: {
              totalUsers:    { type: 'integer' },
              activeUsers:   { type: 'integer' },
              totalClients:  { type: 'integer' },
              totalCasos:    { type: 'integer' },
            },
          },
          generatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── WhatsApp ──────────────────────────────────────────────────────────
      WhatsAppStatus: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['CONNECTING', 'CONNECTED', 'DISCONNECTED', 'STARTING'],
            description: 'Estado actual de la sesión',
          },
          qr: {
            type: 'string',
            nullable: true,
            description: 'Imagen QR en formato base64 data-URL (solo cuando status=CONNECTING)',
            example: 'data:image/png;base64,iVBORw0KGgo...',
          },
          hasSession: {
            type: 'boolean',
            description: 'Si existe una sesión guardada en la base de datos',
          },
        },
      },
    },
  },

  security: [{ BearerAuth: [] }],

  paths: {

    // ════════════════════════════════════════════════════════════════════════
    // AUTH
    // ════════════════════════════════════════════════════════════════════════

    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesión',
        description: 'Autentica un usuario con email y contraseña. Devuelve un JWT de acceso válido por **2 horas** y los datos completos del usuario.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email:    { type: 'string', format: 'email', example: 'abogado@estudio.com' },
                  password: { type: 'string', format: 'password', example: 'Abogado123!' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Autenticación exitosa',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
          },
          400: ErrorResponse('Email o contraseña faltantes'),
          401: ErrorResponse('Credenciales inválidas o cuenta inactiva'),
          500: ErrorResponse('Error interno'),
        },
      },
    },

    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Registrar nuevo usuario',
        description: 'Crea una nueva cuenta de usuario. El rol por defecto es `CLIENTE`. Los campos sensibles (`dni`, `telefono`, `direccion`, `fechaNacimiento`) se almacenan cifrados.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'nombre', 'apellido'],
                properties: {
                  email:           { type: 'string', format: 'email' },
                  password:        { type: 'string', minLength: 6 },
                  nombre:          { type: 'string' },
                  apellido:        { type: 'string' },
                  role:            { $ref: '#/components/schemas/Role' },
                  dni:             { type: 'string' },
                  telefono:        { type: 'string' },
                  direccion:       { type: 'string' },
                  fechaNacimiento: { type: 'string', example: '1985-06-15' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Usuario creado exitosamente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
          },
          400: ErrorResponse('Campos requeridos faltantes'),
          409: ErrorResponse('El email ya está registrado'),
          500: ErrorResponse('Error interno'),
        },
      },
    },

    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Obtener usuario autenticado',
        description: 'Devuelve el perfil completo (con campos sensibles descifrados) del usuario dueño del token.',
        responses: {
          200: {
            description: 'Perfil del usuario',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          ...authResponses,
        },
      },
    },

    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Renovar token JWT',
        description: 'Genera un nuevo token JWT de 2 horas a partir de un token válido (aunque esté por expirar). Útil para mantener sesiones activas sin re-autenticar.',
        responses: {
          200: {
            description: 'Nuevo token generado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { token: { type: 'string', description: 'Nuevo JWT' } },
                },
              },
            },
          },
          ...authResponses,
        },
      },
    },

    '/api/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Solicitar recuperación de contraseña',
        description: 'Envía un email con un enlace de restablecimiento de contraseña válido por **1 hora**. Por privacidad, siempre responde con el mismo mensaje independientemente de si el email existe.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Email enviado (o no, la respuesta es idéntica)',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { message: { type: 'string' } } },
              },
            },
          },
          500: ErrorResponse('Error al enviar el email'),
        },
      },
    },

    '/api/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Restablecer contraseña',
        description: 'Valida el token de recuperación y actualiza la contraseña. El token es de un solo uso y expira en 1 hora.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'password'],
                properties: {
                  token:    { type: 'string', description: 'Token recibido por email' },
                  password: { type: 'string', minLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Contraseña actualizada',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { message: { type: 'string' } } },
              },
            },
          },
          400: ErrorResponse('Token inválido, expirado o ya utilizado'),
          500: ErrorResponse('Error interno'),
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════
    // USUARIOS
    // ════════════════════════════════════════════════════════════════════════

    '/api/users': {
      get: {
        tags: ['Usuarios'],
        summary: 'Listar usuarios',
        description: 'Devuelve todos los usuarios del sistema. **Roles:** `ADMIN`, `AUXILIAR`.',
        responses: {
          200: {
            description: 'Lista de usuarios',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } },
          },
          ...authResponses,
        },
      },
      post: {
        tags: ['Usuarios'],
        summary: 'Crear usuario',
        description: 'Crea un nuevo usuario directamente (sin invitación). **Rol requerido:** `ADMIN`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'nombre', 'apellido'],
                properties: {
                  email:           { type: 'string', format: 'email' },
                  password:        { type: 'string', minLength: 6 },
                  nombre:          { type: 'string' },
                  apellido:        { type: 'string' },
                  role:            { $ref: '#/components/schemas/Role' },
                  dni:             { type: 'string' },
                  telefono:        { type: 'string' },
                  direccion:       { type: 'string' },
                  fechaNacimiento: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Usuario creado', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          400: ErrorResponse('Campos requeridos faltantes'),
          409: ErrorResponse('Email ya registrado'),
          ...authResponses,
        },
      },
    },

    '/api/users/invite': {
      post: {
        tags: ['Usuarios'],
        summary: 'Invitar usuario por email',
        description: 'Envía un email de invitación con un enlace de configuración válido por **7 días**. `ABOGADO` solo puede invitar con rol `CLIENTE`. **Roles:** `ADMIN`, `ABOGADO`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  role:  { $ref: '#/components/schemas/Role' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Invitación enviada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    user:    { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          400: ErrorResponse('Email requerido'),
          403: ErrorResponse('Sin permisos para este rol'),
          409: ErrorResponse('Email ya registrado'),
          ...authResponses,
        },
      },
    },

    '/api/users/abogados': {
      get: {
        tags: ['Usuarios'],
        summary: 'Listar abogados activos',
        description: 'Devuelve solo los usuarios con rol `ABOGADO` y `active: true`. Útil para selectores en formularios. **Roles:** `ADMIN`, `ABOGADO`, `AUXILIAR`.',
        responses: {
          200: {
            description: 'Lista de abogados',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/UserPublic' } } } },
          },
          ...authResponses,
        },
      },
    },

    '/api/users/{id}': {
      get: {
        tags: ['Usuarios'],
        summary: 'Obtener usuario por ID',
        description: 'Devuelve el perfil completo descifrado. Los usuarios solo pueden ver su propio perfil.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Usuario', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          404: ErrorResponse('Usuario no encontrado'),
          ...authResponses,
        },
      },
      put: {
        tags: ['Usuarios'],
        summary: 'Actualizar usuario',
        description: 'Actualiza el perfil. Los usuarios solo pueden editar su propia información; `ADMIN` puede modificar cualquier campo incluyendo `role` y `active`.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nombre:          { type: 'string' },
                  apellido:        { type: 'string' },
                  email:           { type: 'string', format: 'email' },
                  password:        { type: 'string', minLength: 6, description: 'Nueva contraseña (opcional)' },
                  dni:             { type: 'string' },
                  telefono:        { type: 'string' },
                  direccion:       { type: 'string' },
                  fechaNacimiento: { type: 'string' },
                  role:            { $ref: '#/components/schemas/Role', description: '(Solo ADMIN)' },
                  active:          { type: 'boolean', description: '(Solo ADMIN)' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Usuario actualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          403: ErrorResponse('No puede modificar otro usuario'),
          404: ErrorResponse('Usuario no encontrado'),
          ...authResponses,
        },
      },
      delete: {
        tags: ['Usuarios'],
        summary: 'Desactivar usuario',
        description: 'Realiza un borrado lógico (`active: false`). No se puede eliminar la propia cuenta. **Rol:** `ADMIN`.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Usuario desactivado', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
          400: ErrorResponse('No puede eliminar su propia cuenta'),
          404: ErrorResponse('Usuario no encontrado'),
          ...authResponses,
        },
      },
    },

    '/api/users/{id}/photo': {
      post: {
        tags: ['Usuarios'],
        summary: 'Subir foto de perfil',
        description: 'Sube una imagen como foto de perfil. Formatos aceptados: JPG, PNG, WebP. Tamaño máximo: 5 MB.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['photo'],
                properties: {
                  photo: { type: 'string', format: 'binary', description: 'Archivo de imagen (JPG, PNG, WebP — máx 5MB)' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Foto actualizada', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          400: ErrorResponse('Archivo inválido o demasiado grande'),
          ...authResponses,
        },
      },
    },

    '/api/users/{id}/reset-password': {
      post: {
        tags: ['Usuarios'],
        summary: 'Enviar reset de contraseña (admin)',
        description: 'El `ADMIN` fuerza el envío de un email de restablecimiento de contraseña al usuario indicado.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Email enviado', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
          404: ErrorResponse('Usuario no encontrado'),
          ...authResponses,
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════
    // CLIENTES
    // ════════════════════════════════════════════════════════════════════════

    '/api/clients': {
      get: {
        tags: ['Clientes'],
        summary: 'Listar clientes',
        description: 'Devuelve la lista de clientes con campos sensibles descifrados. `ABOGADO` ve solo sus clientes; `CLIENTE` ve solo su propio perfil; `AUXILIAR` ve todos.',
        responses: {
          200: {
            description: 'Lista de clientes',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Client' } } } },
          },
          ...authResponses,
        },
      },
      post: {
        tags: ['Clientes'],
        summary: 'Crear cliente',
        description: 'Crea un nuevo cliente. **Rol:** `ABOGADO`. El abogado se auto-asigna si no se especifica `abogadoId`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nombre', 'apellido', 'dni', 'email'],
                properties: {
                  nombre:          { type: 'string' },
                  apellido:        { type: 'string' },
                  dni:             { type: 'string' },
                  email:           { type: 'string', format: 'email' },
                  telefono:        { type: 'string' },
                  direccion:       { type: 'string' },
                  fechaNacimiento: { type: 'string' },
                  notas:           { type: 'string' },
                  abogadoId:       { type: 'string', format: 'uuid' },
                  userId:          { type: 'string', format: 'uuid', description: 'Vincular a una cuenta de usuario existente' },
                  referencias: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['nombre', 'relacion', 'telefono'],
                      properties: {
                        nombre:   { type: 'string' },
                        relacion: { type: 'string' },
                        telefono: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Cliente creado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Client' } } } },
          400: ErrorResponse('Campos requeridos faltantes'),
          ...authResponses,
        },
      },
    },

    '/api/clients/stats': {
      get: {
        tags: ['Clientes'],
        summary: 'Estadísticas de clientes',
        description: 'Devuelve conteos globales del sistema. **Roles:** `ABOGADO`, `AUXILIAR`.',
        responses: {
          200: {
            description: 'Estadísticas',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    totalClients:   { type: 'integer' },
                    totalUsers:     { type: 'integer' },
                    abogados:       { type: 'integer' },
                    recentClients:  { type: 'integer', description: 'Clientes creados en los últimos 30 días' },
                  },
                },
              },
            },
          },
          ...authResponses,
        },
      },
    },

    '/api/clients/{id}': {
      get: {
        tags: ['Clientes'],
        summary: 'Obtener cliente por ID',
        description: 'Devuelve el cliente con todos los campos sensibles descifrados. `CLIENTE` solo puede acceder a su propio perfil.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Cliente', content: { 'application/json': { schema: { $ref: '#/components/schemas/Client' } } } },
          403: ErrorResponse('Sin acceso a este cliente'),
          404: ErrorResponse('Cliente no encontrado'),
          ...authResponses,
        },
      },
      put: {
        tags: ['Clientes'],
        summary: 'Actualizar cliente',
        description: '`ABOGADO` solo puede editar sus propios clientes. `AUXILIAR` puede editar cualquiera.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nombre:          { type: 'string' },
                  apellido:        { type: 'string' },
                  dni:             { type: 'string' },
                  email:           { type: 'string', format: 'email' },
                  telefono:        { type: 'string' },
                  direccion:       { type: 'string' },
                  fechaNacimiento: { type: 'string' },
                  notas:           { type: 'string' },
                  active:          { type: 'boolean' },
                  referencias:     { type: 'array', items: { $ref: '#/components/schemas/Referencia' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Cliente actualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Client' } } } },
          403: ErrorResponse('Sin acceso a este cliente'),
          404: ErrorResponse('Cliente no encontrado'),
          ...authResponses,
        },
      },
      delete: {
        tags: ['Clientes'],
        summary: 'Desactivar cliente',
        description: 'Borrado lógico (`active: false`). **Rol:** `ABOGADO`.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Cliente desactivado', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
          403: ErrorResponse('Sin acceso'),
          404: ErrorResponse('Cliente no encontrado'),
          ...authResponses,
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════
    // CASOS
    // ════════════════════════════════════════════════════════════════════════

    '/api/casos': {
      get: {
        tags: ['Casos'],
        summary: 'Listar casos',
        description: 'Devuelve los expedientes accesibles al usuario. `ABOGADO` ve sus casos; `CLIENTE` ve los suyos; `AUXILIAR` ve todos. Incluye abogados, clientes, juzgado, demandados y partes contrarias.',
        responses: {
          200: {
            description: 'Lista de casos',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Caso' } } } },
          },
          ...authResponses,
        },
      },
      post: {
        tags: ['Casos'],
        summary: 'Crear caso',
        description: 'Crea un nuevo expediente con los abogados, clientes y partes asignados. **Rol:** `ABOGADO`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['titulo', 'abogadoIds', 'clienteIds'],
                properties: {
                  titulo:      { type: 'string', example: 'Divorcio Rodríguez c/ López' },
                  descripcion: { type: 'string' },
                  estado:      { $ref: '#/components/schemas/CasoEstado' },
                  numero:      { type: 'string', example: '2024/00123' },
                  fechaInicio: { type: 'string', format: 'date-time' },
                  fechaCierre: { type: 'string', format: 'date-time' },
                  notas:       { type: 'string' },
                  juzgadoId:   { type: 'string', format: 'uuid' },
                  abogadoIds:  { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, description: 'IDs de abogados asignados' },
                  clienteIds:  { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1, description: 'IDs de clientes involucrados' },
                  abogadosContraparte: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['nombre'],
                      properties: {
                        nombre:    { type: 'string' },
                        direccion: { type: 'string' },
                        telefono:  { type: 'string' },
                      },
                    },
                  },
                  demandados: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['nombre'],
                      properties: {
                        nombre:    { type: 'string' },
                        domicilio: { type: 'string' },
                        carnet:    { type: 'string' },
                        telefono:  { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Caso creado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Caso' } } } },
          400: ErrorResponse('Campos requeridos faltantes'),
          ...authResponses,
        },
      },
    },

    '/api/casos/{id}': {
      get: {
        tags: ['Casos'],
        summary: 'Obtener caso por ID',
        description: 'Devuelve el expediente completo con todas sus relaciones.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Caso', content: { 'application/json': { schema: { $ref: '#/components/schemas/Caso' } } } },
          403: ErrorResponse('Sin acceso a este caso'),
          404: ErrorResponse('Caso no encontrado'),
          ...authResponses,
        },
      },
      put: {
        tags: ['Casos'],
        summary: 'Actualizar caso',
        description: 'Actualiza el expediente y registra cada cambio en el historial de auditoría. **Roles:** `ABOGADO` (solo sus casos), `AUXILIAR` (cualquiera).',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  titulo:              { type: 'string' },
                  descripcion:         { type: 'string' },
                  estado:              { $ref: '#/components/schemas/CasoEstado' },
                  numero:              { type: 'string' },
                  fechaInicio:         { type: 'string', format: 'date-time' },
                  fechaCierre:         { type: 'string', format: 'date-time' },
                  notas:               { type: 'string' },
                  juzgadoId:           { type: 'string', format: 'uuid' },
                  abogadoIds:          { type: 'array', items: { type: 'string', format: 'uuid' } },
                  clienteIds:          { type: 'array', items: { type: 'string', format: 'uuid' } },
                  abogadosContraparte: { type: 'array', items: { $ref: '#/components/schemas/AbogadoContraparte' } },
                  demandados:          { type: 'array', items: { $ref: '#/components/schemas/Demandado' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Caso actualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Caso' } } } },
          403: ErrorResponse('Sin acceso a este caso'),
          404: ErrorResponse('Caso no encontrado'),
          ...authResponses,
        },
      },
      delete: {
        tags: ['Casos'],
        summary: 'Desactivar caso',
        description: 'Borrado lógico. **Rol:** `ABOGADO` asignado al caso.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Caso desactivado', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
          403: ErrorResponse('Sin acceso'),
          404: ErrorResponse('Caso no encontrado'),
          ...authResponses,
        },
      },
    },

    '/api/casos/{id}/historial': {
      get: {
        tags: ['Casos'],
        summary: 'Historial de auditoría del caso',
        description: 'Devuelve todos los cambios registrados en el expediente: qué campo cambió, valor anterior, valor nuevo, quién lo modificó y cuándo.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Historial de cambios',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/CasoHistorialEntry' } } } },
          },
          403: ErrorResponse('Sin acceso a este caso'),
          404: ErrorResponse('Caso no encontrado'),
          ...authResponses,
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════
    // NOVEDADES
    // ════════════════════════════════════════════════════════════════════════

    '/api/casos/{casoId}/novedades': {
      get: {
        tags: ['Novedades'],
        summary: 'Listar novedades de un caso',
        description: 'Devuelve todas las novedades activas del expediente, ordenadas por fecha descendente.',
        parameters: [{ name: 'casoId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Lista de novedades',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/CasoNovedad' } } } },
          },
          403: ErrorResponse('Sin acceso a este caso'),
          ...authResponses,
        },
      },
      post: {
        tags: ['Novedades'],
        summary: 'Crear novedad',
        description: 'Agrega una nueva novedad al caso. Si se incluye `fechaAgendada` y el usuario tiene Google Calendar conectado, se crea automáticamente un evento en el calendario. **Roles:** `ADMIN`, `ABOGADO`.',
        parameters: [{ name: 'casoId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['titulo', 'contenido', 'fecha'],
                properties: {
                  titulo:        { type: 'string', example: 'Audiencia preliminar' },
                  contenido:     { type: 'string', example: 'Se realizó con resultado favorable.' },
                  fecha:         { type: 'string', format: 'date-time', description: 'Fecha de la novedad' },
                  fechaAgendada: { type: 'string', format: 'date-time', nullable: true, description: 'Si se define, se agenda en Google Calendar' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Novedad creada', content: { 'application/json': { schema: { $ref: '#/components/schemas/CasoNovedad' } } } },
          400: ErrorResponse('Campos requeridos faltantes'),
          403: ErrorResponse('Sin acceso a este caso'),
          ...authResponses,
        },
      },
    },

    '/api/casos/{casoId}/novedades/{id}': {
      put: {
        tags: ['Novedades'],
        summary: 'Actualizar novedad',
        description: 'Actualiza la novedad. Si `fechaAgendada` cambia o se elimina, se sincroniza (actualiza o elimina) el evento de Google Calendar correspondiente. **Roles:** `ADMIN`, `ABOGADO` (solo las propias).',
        parameters: [
          { name: 'casoId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'id',     in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  titulo:        { type: 'string' },
                  contenido:     { type: 'string' },
                  fecha:         { type: 'string', format: 'date-time' },
                  fechaAgendada: { type: 'string', format: 'date-time', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Novedad actualizada', content: { 'application/json': { schema: { $ref: '#/components/schemas/CasoNovedad' } } } },
          403: ErrorResponse('Sin acceso'),
          404: ErrorResponse('Novedad no encontrada'),
          ...authResponses,
        },
      },
      delete: {
        tags: ['Novedades'],
        summary: 'Eliminar novedad',
        description: 'Borrado lógico. Elimina el evento de Google Calendar asociado si existía. **Roles:** `ADMIN`, `ABOGADO` (solo las propias).',
        parameters: [
          { name: 'casoId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'id',     in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Novedad eliminada', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
          403: ErrorResponse('Sin acceso'),
          404: ErrorResponse('Novedad no encontrada'),
          ...authResponses,
        },
      },
    },

    '/api/novedades/agendadas': {
      get: {
        tags: ['Novedades'],
        summary: 'Listar novedades agendadas',
        description: 'Devuelve todas las novedades con `fechaAgendada` definida, ordenadas por fecha ascendente. Usado por el calendario del dashboard. `ADMIN` ve todas; `ABOGADO` ve las de sus casos; `CLIENTE` ve las de sus casos.',
        responses: {
          200: {
            description: 'Novedades agendadas',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/CasoNovedad' } } } },
          },
          ...authResponses,
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════
    // JUZGADOS
    // ════════════════════════════════════════════════════════════════════════

    '/api/juzgados': {
      get: {
        tags: ['Juzgados'],
        summary: 'Listar juzgados',
        description: 'Devuelve todos los juzgados activos ordenados por nombre. **Rol:** `ABOGADO`.',
        responses: {
          200: {
            description: 'Lista de juzgados',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Juzgado' } } } },
          },
          ...authResponses,
        },
      },
      post: {
        tags: ['Juzgados'],
        summary: 'Crear juzgado',
        description: 'Agrega un nuevo juzgado al directorio. **Rol:** `ABOGADO`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nombre'],
                properties: {
                  nombre:    { type: 'string', example: 'Juzgado Civil N° 12' },
                  tipo:      { type: 'string', example: 'Civil y Comercial' },
                  direccion: { type: 'string' },
                  ciudad:    { type: 'string' },
                  telefono:  { type: 'string' },
                  notas:     { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Juzgado creado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Juzgado' } } } },
          400: ErrorResponse('Nombre requerido'),
          ...authResponses,
        },
      },
    },

    '/api/juzgados/{id}': {
      get: {
        tags: ['Juzgados'],
        summary: 'Obtener juzgado por ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Juzgado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Juzgado' } } } },
          404: ErrorResponse('Juzgado no encontrado'),
          ...authResponses,
        },
      },
      put: {
        tags: ['Juzgados'],
        summary: 'Actualizar juzgado',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nombre:    { type: 'string' },
                  tipo:      { type: 'string' },
                  direccion: { type: 'string' },
                  ciudad:    { type: 'string' },
                  telefono:  { type: 'string' },
                  notas:     { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Juzgado actualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Juzgado' } } } },
          404: ErrorResponse('Juzgado no encontrado'),
          ...authResponses,
        },
      },
      delete: {
        tags: ['Juzgados'],
        summary: 'Desactivar juzgado',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Juzgado desactivado', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
          404: ErrorResponse('Juzgado no encontrado'),
          ...authResponses,
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════
    // MOVIMIENTOS
    // ════════════════════════════════════════════════════════════════════════

    '/api/movimientos': {
      get: {
        tags: ['Movimientos'],
        summary: 'Listar movimientos financieros',
        description: '`ADMIN` ve todos; `ABOGADO` solo los suyos. Ordenados por fecha descendente.',
        responses: {
          200: {
            description: 'Lista de movimientos',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Movimiento' } } } },
          },
          ...authResponses,
        },
      },
      post: {
        tags: ['Movimientos'],
        summary: 'Registrar movimiento',
        description: 'Crea un ingreso o egreso vinculado a un caso. **Roles:** `ADMIN`, `ABOGADO`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['casoId', 'tipo', 'concepto', 'monto', 'fecha'],
                properties: {
                  casoId:    { type: 'string', format: 'uuid' },
                  tipo:      { $ref: '#/components/schemas/TipoMovimiento' },
                  concepto:  { type: 'string', example: 'Honorarios primera instancia' },
                  monto:     { type: 'number', example: 150000 },
                  fecha:     { type: 'string', format: 'date-time' },
                  notas:     { type: 'string' },
                  abogadoId: { type: 'string', format: 'uuid', description: 'Solo ADMIN puede especificar otro abogado' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Movimiento creado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Movimiento' } } } },
          400: ErrorResponse('Campos requeridos faltantes'),
          403: ErrorResponse('Sin acceso al caso'),
          ...authResponses,
        },
      },
    },

    '/api/movimientos/stats': {
      get: {
        tags: ['Movimientos'],
        summary: 'Estadísticas financieras globales',
        description: 'Totales de ingresos, egresos y balance. `ADMIN` ve todo el sistema; `ABOGADO` solo el suyo.',
        responses: {
          200: { description: 'Estadísticas', content: { 'application/json': { schema: { $ref: '#/components/schemas/MovimientoStats' } } } },
          ...authResponses,
        },
      },
    },

    '/api/movimientos/caso/{casoId}': {
      get: {
        tags: ['Movimientos'],
        summary: 'Movimientos de un caso',
        parameters: [{ name: 'casoId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Movimientos del caso',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Movimiento' } } } },
          },
          403: ErrorResponse('Sin acceso al caso'),
          ...authResponses,
        },
      },
    },

    '/api/movimientos/caso/{casoId}/stats': {
      get: {
        tags: ['Movimientos'],
        summary: 'Estadísticas financieras de un caso',
        parameters: [{ name: 'casoId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Estadísticas del caso', content: { 'application/json': { schema: { $ref: '#/components/schemas/MovimientoStats' } } } },
          403: ErrorResponse('Sin acceso al caso'),
          ...authResponses,
        },
      },
    },

    '/api/movimientos/{id}': {
      put: {
        tags: ['Movimientos'],
        summary: 'Actualizar movimiento',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  tipo:     { $ref: '#/components/schemas/TipoMovimiento' },
                  concepto: { type: 'string' },
                  monto:    { type: 'number' },
                  fecha:    { type: 'string', format: 'date-time' },
                  notas:    { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Movimiento actualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Movimiento' } } } },
          403: ErrorResponse('Sin acceso'),
          404: ErrorResponse('Movimiento no encontrado'),
          ...authResponses,
        },
      },
      delete: {
        tags: ['Movimientos'],
        summary: 'Eliminar movimiento',
        description: 'Borrado lógico. `ABOGADO` solo puede eliminar los suyos.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Movimiento eliminado', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
          403: ErrorResponse('Sin acceso'),
          404: ErrorResponse('Movimiento no encontrado'),
          ...authResponses,
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════
    // GOOGLE CALENDAR
    // ════════════════════════════════════════════════════════════════════════

    '/api/google-calendar/connect': {
      get: {
        tags: ['Google Calendar'],
        summary: 'Obtener URL de autorización OAuth',
        description: 'Devuelve la URL a la que redirigir al usuario para autorizar acceso a su Google Calendar.',
        responses: {
          200: {
            description: 'URL de autorización',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { url: { type: 'string', description: 'URL de Google OAuth 2.0' } } },
              },
            },
          },
          ...authResponses,
        },
      },
    },

    '/api/google-calendar/callback': {
      get: {
        tags: ['Google Calendar'],
        summary: 'Callback OAuth de Google',
        description: 'Endpoint al que Google redirige tras la autorización. Intercambia el código por un refresh token y redirige al dashboard. **Este endpoint es público** (llamado por Google).',
        security: [],
        parameters: [
          { name: 'code',  in: 'query', required: true, schema: { type: 'string' }, description: 'Código de autorización de Google' },
          { name: 'state', in: 'query', required: true, schema: { type: 'string' }, description: 'ID del usuario (pasado como state en el OAuth)' },
        ],
        responses: {
          302: { description: 'Redirige a `/dashboard?googleConnected=true` o `?googleError=<reason>`' },
          400: ErrorResponse('Parámetros faltantes'),
        },
      },
    },

    '/api/google-calendar/status': {
      get: {
        tags: ['Google Calendar'],
        summary: 'Estado de la conexión con Google Calendar',
        responses: {
          200: {
            description: 'Estado',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { connected: { type: 'boolean' } } },
              },
            },
          },
          ...authResponses,
        },
      },
    },

    '/api/google-calendar/disconnect': {
      delete: {
        tags: ['Google Calendar'],
        summary: 'Desconectar Google Calendar',
        description: 'Elimina el refresh token guardado. Las novedades futuras no se sincronizarán.',
        responses: {
          200: { description: 'Desconectado', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
          ...authResponses,
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════
    // WHATSAPP
    // ════════════════════════════════════════════════════════════════════════

    '/api/whatsapp/connect': {
      post: {
        tags: ['WhatsApp'],
        summary: 'Iniciar sesión de WhatsApp',
        description: `Inicia el proceso de vinculación de WhatsApp mediante un código QR.

**Flujo completo:**
1. Llamar a este endpoint → devuelve \`{ status: "STARTING" }\` inmediatamente.
2. Hacer **polling** a \`GET /api/whatsapp/status\` cada ~2 segundos.
3. Cuando \`qr\` aparezca en la respuesta, mostrar la imagen al usuario.
4. El usuario escanea el QR desde **WhatsApp → Dispositivos vinculados → Vincular dispositivo**.
5. Cuando \`status\` cambie a \`CONNECTED\`, la vinculación fue exitosa.

Las credenciales se persisten en la base de datos vinculadas al usuario.`,
        responses: {
          200: {
            description: 'Sesión iniciada en background',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'STARTING' } },
                },
              },
            },
          },
          500: ErrorResponse('Error al iniciar la sesión'),
          ...authResponses,
        },
      },
    },

    '/api/whatsapp/status': {
      get: {
        tags: ['WhatsApp'],
        summary: 'Estado de la sesión de WhatsApp',
        description: 'Consulta el estado en tiempo real de la sesión. Incluye el QR en base64 cuando está disponible. Usar en polling cada ~2 segundos tras llamar a `/connect`.',
        responses: {
          200: {
            description: 'Estado actual',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/WhatsAppStatus' } } },
          },
          ...authResponses,
        },
      },
    },

    '/api/whatsapp/disconnect': {
      delete: {
        tags: ['WhatsApp'],
        summary: 'Desconectar WhatsApp',
        description: 'Cierra la sesión activa y elimina las credenciales de la base de datos.',
        responses: {
          200: { description: 'Desconectado', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } } } } } },
          500: ErrorResponse('Error al desconectar'),
          ...authResponses,
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════
    // ADMIN
    // ════════════════════════════════════════════════════════════════════════

    '/api/admin/stats': {
      get: {
        tags: ['Admin'],
        summary: 'Estadísticas del sistema',
        description: 'Panel de estado del servidor: uptime, memoria, latencia de base de datos, espacio en disco y conteos de entidades. **Rol:** `ADMIN`.',
        responses: {
          200: { description: 'Estadísticas del sistema', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminStats' } } } },
          ...authResponses,
        },
      },
    },
  },
};
