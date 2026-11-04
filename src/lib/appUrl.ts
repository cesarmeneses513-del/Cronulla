// The address to share (invitations, password emails), whatever address this copy of the app
// was opened from: the installed app may still run on the old one (cronulla.vercel.app).
// Running locally, links point back to this computer.
const PUBLIC_URL = 'https://inspectioncpr.vercel.app';
export const APP_URL = /^(localhost|127\.)/.test(window.location.hostname) ? window.location.origin : PUBLIC_URL;
