# GitHub Setup Instructions

Since the `gh` CLI is not available, follow these steps to create the GitHub repository and push your code:

## Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and sign in to your account
2. Click the "+" button in the top-right corner → "New repository"
3. Fill in the details:
   - **Repository name**: `pitch-detector`
   - **Description**: "A minimal web app that extracts pitch contours from YouTube videos and allows users to match pitch in real-time"
   - **Visibility**: Public (or Private if you prefer)
   - **Initialize**: Don't initialize with README (we already have one)
4. Click "Create repository"

## Step 2: Push Your Code

Run these commands in your terminal:

```bash
# Navigate to your project directory
cd /home/ibrahim/Documents/pitch-detector

# Add the remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/pitch-detector.git

# Push the code to GitHub
git push -u origin master
```

## Step 3: Enter Your Credentials

When prompted:
- **Username**: Your GitHub username
- **Password**: Your GitHub password (or personal access token if you have 2FA enabled)

> 💡 **Tip**: If you have 2FA enabled, you'll need to create a personal access token:
> 1. Go to GitHub → Settings → Developer settings → Personal access tokens
> 2. Generate new token with appropriate permissions
> 3. Use the token as your password when pushing

## Verification

After pushing, visit `https://github.com/YOUR_USERNAME/pitch-detector` to see your repository!

## Alternative: Using SSH (Recommended for Frequent Use)

If you prefer using SSH instead of HTTPS:

```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add SSH key to GitHub (Settings → SSH and GPG keys → New SSH key)

# Use SSH remote URL
git remote set-url origin git@github.com:YOUR_USERNAME/pitch-detector.git

# Push with SSH
git push -u origin master
```

## What's Been Set Up

✅ Git repository initialized
✅ First commit created with all project files
✅ Comprehensive .gitignore configured
✅ Ready to push to GitHub

Your pitch-detector project is ready to share with the world! 🌍
