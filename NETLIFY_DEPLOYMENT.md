# Netlify Deployment Guide - Zackhub2

## Prerequisites
- GitHub account (repo already connected)
- Netlify account
- Firebase credentials

## Step-by-Step Deployment

### 1. Connect GitHub to Netlify
- Go to [Netlify](https://netlify.com)
- Click "New site from Git"
- Select GitHub and authorize
- Choose `Enayatalibarkaat/Zackhub2` repository
- Click "Deploy site"

### 2. Configure Environment Variables in Netlify
After connecting the repo, go to:
**Site Settings → Build & Deploy → Environment**

Add these environment variables:

```
VITE_FIREBASE_API_KEY = AIzaSyB_CE95Hyc_KLU4LljAwicTT7
VITE_FIREBASE_AUTH_DOMAIN = zackhub2.firebaseapp.com
VITE_FIREBASE_PROJECT_ID = zackhub2
VITE_FIREBASE_STORAGE_BUCKET = zackhub2.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID = 96379295937
VITE_FIREBASE_APP_ID = 1:96379295937:web:7e466c3d401fb
VITE_FIREBASE_MEASUREMENT_ID = G-5VHBYL13TQ
VITE_GEMINI_API_KEY = your_gemini_api_key_here
```

### 3. Configure Build Settings
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Node version:** 20.x (recommended)

### 4. Deploy
- Netlify will automatically deploy when you push to GitHub
- Check deployment status in Netlify dashboard
- Your site will be live at: `https://your-site-name.netlify.app`

## Firebase Integration
- Firebase is now properly configured with Firestore
- All environment variables are securely stored in Netlify
- Database operations will work in production

## Troubleshooting

### Build fails with "Firebase not found"
- Ensure `firebase` package is in `package.json`
- Check that all environment variables are set in Netlify

### Environment variables not loading
- Redeploy the site after adding environment variables
- Clear Netlify cache: Site Settings → Deploys → Clear cache and redeploy

### Firebase connection issues
- Verify Firebase credentials are correct
- Check Firebase project security rules allow read/write
- Ensure Firestore database is created in Firebase console

## Local Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Important Notes
- Never commit `.env.local` to GitHub (already in .gitignore)
- Use `.env.example` as reference for required variables
- Keep Firebase credentials secure - only store in Netlify environment variables