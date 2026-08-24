@echo off
echo Creating or updating repo on GitHub for Nhj-sz/marx-skill...
echo.
echo Opening browser to create the repo...
start "" "https://github.com/new?name=marx-skill&owner=Nhj-sz&visibility=public&description=马克思.skill - 辩证批判人格 - 独立原创的马克思主义理论批判Persona Skill。&template=empty&gitignore_template=None&license_template=mit&auto_init=false"

echo.
echo Please create the repo in the opened browser (Public, MIT license, DO NOT initialize with README or .gitignore).
echo After creation, press any key to continue the push...
pause

git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Success! Repo published at https://github.com/Nhj-sz/marx-skill
    echo You can now install with: npx skills add Nhj-sz/marx-skill
) else (
    echo.
    echo Push failed. Please create the repo first or check authentication.
    echo Run 'git push -u origin main' manually after creating the empty repo.
)
pause
