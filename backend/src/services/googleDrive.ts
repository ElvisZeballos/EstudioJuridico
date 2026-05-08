import { google } from 'googleapis';
import fs from 'fs';

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export async function uploadToDrive(
  refreshToken: string,
  filePath: string,
  mimeType: string,
  fileName: string
): Promise<{ driveId: string; driveUrl: string }> {
  const client = makeOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: 'v3', auth: client });

  const res = await drive.files.create({
    requestBody: { name: fileName, mimeType },
    media: { mimeType, body: fs.createReadStream(filePath) },
    fields: 'id,webViewLink',
  });

  const fileId = res.data.id!;

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return {
    driveId: fileId,
    driveUrl: res.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
  };
}
