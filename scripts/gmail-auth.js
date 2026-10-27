// One-time helper: authorize SpendWise to send email from your Gmail account
// and print the refresh token to put in GMAIL_REFRESH_TOKEN.
//
//   1. Put GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET (a "Desktop app" OAuth
//      client from Google Cloud Console) in your local .env
//   2. npm run gmail:auth
//   3. Open the printed link, sign in with the Gmail account that should send
//      the emails, and allow "Send email on your behalf"
//
// Runs only on your own computer; nothing is stored except what it prints.
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const { GMAIL_CLIENT_ID: clientId, GMAIL_CLIENT_SECRET: clientSecret } = process.env;

if (!clientId || !clientSecret) {
  console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in your .env first.');
  process.exit(1);
}

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: SCOPE,
  access_type: 'offline', // ask for a refresh token
  prompt: 'consent', // always return a refresh token, even if authorized before
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }

  const finish = (status, message) => {
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' }).end(message);
    server.close();
  };

  const code = url.searchParams.get('code');
  if (!code) {
    console.error('Authorization was not granted:', url.searchParams.get('error'));
    finish(400, 'Authorization was not granted. You can close this tab and try again.');
    return;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const body = await response.json();

    if (!body.refresh_token) {
      console.error('No refresh token returned:', body.error_description || body.error || body);
      finish(500, 'No refresh token was returned. Check the terminal for details.');
      return;
    }

    console.log('\nSuccess! Add this to Render (and your local .env if you want to send email locally):\n');
    console.log(`GMAIL_REFRESH_TOKEN=${body.refresh_token}\n`);
    console.log('Keep it secret - it lets anyone send email as your Gmail account.');
    finish(200, 'Done! Return to your terminal to copy the refresh token. You can close this tab.');
  } catch (error) {
    console.error('Token exchange failed:', error);
    finish(500, 'Token exchange failed. Check the terminal for details.');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Open this link in your browser and sign in with the Gmail account that should send emails:\n');
  console.log(authUrl + '\n');
  console.log(`Waiting for Google to redirect back to ${REDIRECT_URI} ...`);
});
