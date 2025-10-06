@echo off
echo ========================================
echo    QUEST OBE Portal - Auto Deploy
echo ========================================
echo.

echo [1] Adding all changes to Git...
git add .

echo.
echo [2] Committing changes...
git commit -m "Update: %date% %time%"

echo.
echo [3] Pushing to GitHub...
git push origin main

echo.
echo [4] Deploying to Netlify...
echo Your website will update automatically!
echo.

echo ========================================
echo ✅ Update Complete!
echo 📱 Your website: https://your-site.netlify.app
echo 📊 GitHub: https://github.com/riabha/OBE
echo ========================================

pause
