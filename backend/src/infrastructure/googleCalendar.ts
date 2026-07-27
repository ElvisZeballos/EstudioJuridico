import { google } from 'googleapis';
import jwt from 'jsonwebtoken';

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(userId: string): string {
  const client = makeOAuth2Client();
  const state = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '10m' });
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/drive.file',
    ],
    state,
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

  const end = new Date(event.fechaAgendada.getTime() + 60 * 60 * 1000);

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: event.titulo + (event.casoTitulo ? ` — ${event.casoTitulo}` : ''),
      description: event.contenido,
      start: { dateTime: event.fechaAgendada.toISOString(), timeZone: 'America/La_Paz' },
      end: { dateTime: end.toISOString(), timeZone: 'America/La_Paz' },
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
      start: { dateTime: event.fechaAgendada.toISOString(), timeZone: 'America/La_Paz' },
      end: { dateTime: end.toISOString(), timeZone: 'America/La_Paz' },
    },
  });
}

export async function deleteCalendarEvent(refreshToken: string, eventId: string): Promise<void> {
  const client = makeOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: client });
  await calendar.events.delete({ calendarId: 'primary', eventId });
}
