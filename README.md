# Mafia Party - Jeu web multijoueur

Jeu frontend 100% HTML / CSS / Vanilla JS utilisant Firebase Realtime Database pour le multijoueur en temps réel.

## Architecture

- `index.html` : structure mobile-first et écrans du jeu.
- `style.css` : thème sombre moderne, responsive pour smartphones.
- `app.js` : logique du lobby, distribution des rôles, phases de nuit/jour/vote et synchronisation Firebase.

## Installation Firebase

1. Créez un projet Firebase dans la console : https://console.firebase.google.com/
2. Activez **Realtime Database**.
3. Sélectionnez le mode **Test** ou configurez des règles plus strictes.
4. Copiez les paramètres de configuration Firebase.
5. Remplacez les valeurs de `firebaseConfig` dans `app.js` :

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Règles Realtime Database recommandées

Pour un test simple, vous pouvez utiliser :

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> Pour plus de sécurité, ajoutez des règles basées sur l’authentification ou des validations de format, mais Firebase Auth nécessite une intégration backend si vous voulez éviter l’écriture côté client uniquement.

## Déploiement sur GitHub Pages

1. Poussez le projet sur GitHub.
2. Allez dans les **Settings** du dépôt.
3. Sélectionnez **Pages**.
4. Choisissez la branche `main` (ou `master`) et le dossier `/root`.
5. Enregistrez. Le site sera disponible via `https://<votre-utilisateur>.github.io/<nom-du-repo>/`.

## Utilisation

- Un joueur crée la salle et devient host.
- Les autres joueurs ouvrent le site, saisissent leur pseudo et le code de salle.
- Le host démarre la partie.
- La distribution des rôles se fait automatiquement.
- Les phases de nuit/jour/vote sont pilotées par le jeu, mais le débat vocal est réalisé dans la vraie vie.

## Remarques

- Le host doit garder la page ouverte pendant la partie pour garantir la transition entre les phases.
- Firebase gère la synchronisation des actions en temps réel sans serveur backend.
- Le jeu fonctionne sur GitHub Pages sans Node.js.
