# Smart Fridge AI — Stage 1 (core inventory)
Includes: login/signup/guest, inventory (fridge/freezer/pantry, batches with separate expiry), expiry badges, search, shopping list (move to inventory), real-time sync, offline cache, PWA, secure Firestore rules.
NOT yet built: AI scan, recipes, notifications (Stage 2).

## Setup (Windows)
1. Install Node.js LTS from nodejs.org.
2. Firebase console (console.firebase.google.com, free Spark plan): create project → Add web app → copy config. Build → Authentication → enable Email/Password and Anonymous. Build → Firestore Database → create (production mode).
3. In this folder, open Command Prompt:
   copy .env.example .env   (then paste your 4 Firebase values into .env)
   npm install
   npm run dev
4. Publish rules: npm install -g firebase-tools, firebase login, firebase init (choose existing project; keep firestore.rules and firebase.json), firebase deploy --only firestore:rules
5. Deploy: npm run build, then firebase deploy --only hosting
6. Android: open the https URL in Chrome → ⋮ menu → Install app / Add to Home screen.

Stage 2: enhanced inventory, search, shopping, expiry and settings (no AI).
