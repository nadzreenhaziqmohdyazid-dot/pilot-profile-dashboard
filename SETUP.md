# Firebase & GitHub Pages Setup Guide

This app has been updated to use Firebase for data storage and will be deployed on GitHub Pages.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a new project"
3. Name it something like "Pilot-Profile-Dashboard"
4. Disable Google Analytics (optional)
5. Click "Create project"

## Step 2: Get Your Firebase Credentials

1. In Firebase Console, go to Project Settings (⚙️ gear icon)
2. Click "Your apps" section
3. Click "Create app" → Select "Web"
4. Name it "Pilot Profile Dashboard"
5. Click "Register app"
6. Copy the config object (looks like this):
```javascript
{
  apiKey: "AIzaSyXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def"
}
```

## Step 3: Add Firebase Config to Your App

1. Open `index.html` in your editor
2. Find the `firebaseConfig` object (around line 160)
3. Replace it with your actual Firebase config from Step 2
4. Save the file

## Step 4: Set Up Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **"Create database"**
3. Choose "Start in test mode"
4. Select your preferred location (closest to you)
5. Click "Enable"

6. Once created, create a collection:
   - Click "Create collection"
   - Collection ID: `profiles` (must be exactly this)
   - Click "Next"
   - You can skip adding a document - click "Save"

## Step 5: Create a GitHub Repository

1. Go to [GitHub.com](https://github.com)
2. Create a new repository:
   - Name: `pilot-profile-dashboard` (can be any name)
   - Description: "Pilot Profile Dashboard"
   - Make it **Public** (required for GitHub Pages free tier)
   - **Do NOT initialize with README** (you already have files)
   - Click "Create repository"

## Step 6: Push Your Code to GitHub

In your terminal, run these commands in the project folder:

```bash
git init
git add .
git commit -m "Initial commit: Pilot Profile Dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pilot-profile-dashboard.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

## Step 7: Enable GitHub Pages

1. Go to your GitHub repository
2. Click **Settings**
3. Go to **Pages** (in the left sidebar)
4. Under "Build and deployment":
   - Source: Select **"Deploy from a branch"**
   - Branch: Select **main** / **root**
   - Click **Save**

5. Wait a few minutes. GitHub will show you a URL like:
   `https://YOUR_USERNAME.github.io/pilot-profile-dashboard`

## Step 8: Create a `.gitignore` (Optional but Recommended)

Create a file named `.gitignore` in your project root with:
```
node_modules/
.DS_Store
profiles.json
server.py
```

This prevents unnecessary files from being uploaded.

## Step 9: Access Your App

Once deployment is complete, open:
```
https://YOUR_USERNAME.github.io/pilot-profile-dashboard
```

You can now access it from anywhere!

## Troubleshooting

**Firebase not loading?**
- Check browser console (F12) for errors
- Verify Firebase config is correct in `index.html`
- Make sure Firestore Database is created in Firebase

**Profiles not saving?**
- Check Firebase Firestore has a "profiles" collection
- Check browser console for any errors
- Make sure Firebase config is correct

**GitHub Pages not deploying?**
- Wait a few minutes after pushing
- Check the "Actions" tab in GitHub for deployment status
- Make sure repository is public

## Need Help?

If you encounter issues:
1. Check the browser console (F12 → Console tab)
2. Look for error messages
3. Share the error details for debugging

