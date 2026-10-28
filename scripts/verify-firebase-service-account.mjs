import console from 'node:console';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const credentialPath = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;

if (!credentialPath) {
  throw new Error('Missing temporary Firebase service-account file.');
}

let credential;
try {
  credential = JSON.parse(readFileSync(credentialPath, 'utf8'));
} catch {
  throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid service-account JSON.');
}

if (
  typeof credential !== 'object' ||
  credential === null ||
  credential.type !== 'service_account' ||
  typeof credential.client_email !== 'string' ||
  !/^github-hosting-deployer@[^@\s]+\.iam\.gserviceaccount\.com$/.test(credential.client_email) ||
  typeof credential.private_key !== 'string' ||
  credential.private_key.length === 0
) {
  throw new Error(
    'FIREBASE_SERVICE_ACCOUNT is not the intended github-hosting-deployer service account.',
  );
}

console.info('Verified Firebase service-account identity: github-hosting-deployer.');
