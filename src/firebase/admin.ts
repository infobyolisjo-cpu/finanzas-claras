
import * as admin from 'firebase-admin';

const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

let adminApp: admin.app.App;

export function initializeAdminApp() {
    if (admin.apps.length) {
        adminApp = admin.app();
    } else {
        if (serviceAccountEnv) {
            // Use service account from environment variable if available
            const parsedServiceAccount = JSON.parse(serviceAccountEnv);
            adminApp = admin.initializeApp({
                credential: admin.credential.cert(parsedServiceAccount),
            });
        } else {
            // Otherwise, use Application Default Credentials
            // This works automatically in Google Cloud environments (like App Hosting)
            console.log("Inicializando Firebase Admin con credenciales predeterminadas de la aplicación...");
            adminApp = admin.initializeApp({
                credential: admin.credential.applicationDefault(),
            });
        }
    }
    
    return {
        auth: admin.auth(adminApp),
        firestore: admin.firestore(adminApp),
    };
}
