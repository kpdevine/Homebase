// Public web configuration only. No service-account keys or admin credentials.
// Redirect sign-in must share the app's origin on Safari and other strict browsers.
// Retain the original auth domain for the existing Firebase aliases and localhost.
export function authDomainFor(hostname) {
  return hostname==='pocketplanet.day'?'pocketplanet.day':'homebase-d3c6c.firebaseapp.com';
}
export const firebaseConfig = {
  apiKey:'AIzaSyCMHyjpMdBToiWE6Q2w8CuE8CScvv1KDIk',
  authDomain:authDomainFor(typeof location==='undefined'?'':location.hostname),
  projectId:'homebase-d3c6c',
  appId:'1:1097810811129:web:d56ab286536d254c3eea28',
};
