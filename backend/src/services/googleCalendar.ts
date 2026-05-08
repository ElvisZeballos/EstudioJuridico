import { google } from 'googleapis';

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(userId: string): string {
  const client = makeOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/drive.file',
    ],
    state: userId,
    prompt: 'consent',
  });
}

export async function getTokensFromCode(code: string) {
  const client = makeOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function createCalendarEvent(
  refreshToken: string,
  event: { titulo: string; contenido: string; fechaAgendada: Date; casoTitulo?: string }
): Promise<string | null> {
  const client = makeOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: client });

  const end = new Date(event.fechaAgendada.getTime() + 60 * 60 * 1000); // +1 hora

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: event.titulo + (event.casoTitulo ? ` — ${event.casoTitulo}` : ''),
      description: event.contenido,
      start: { dateTime: event.fechaAgendada.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
      end: { dateTime: end.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
    },
  });

  return res.data.id ?? null;
}

export async function updateCalendarEvent(
  refreshToken: string,
  eventId: string,
  event: { titulo: string; contenido: string; fechaAgendada: Date; casoTitulo?: string }
): Promise<void> {
  const client = makeOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: client });

  const end = new Date(event.fechaAgendada.getTime() + 60 * 60 * 1000);

  await calendar.events.update({
    calendarId: 'primary',
    eventId,
    requestBody: {
      summary: event.titulo + (event.casoTitulo ? ` — ${event.casoTitulo}` : ''),
      description: event.contenido,
      start: { dateTime: event.fechaAgendada.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
      end: { dateTime: end.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
    },
  });
}

export async function deleteCalendarEvent(refreshToken: string, eventId: string): Promise<void> {
  const client = makeOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: client });
  await calendar.events.delete({ calendarId: 'primary', eventId });
}
