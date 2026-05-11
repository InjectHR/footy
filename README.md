# Team Stat Counter

A simple tap-first AFL stat counter for Murrumbeena games. It is built as a static web app, so it can run from GitHub Pages with no server.

## What it does

- Tracks stats per team and per quarter.
- Starts with Clearances, Inside 50 marks, Tackles, and Contested marks.
- Adds custom stats during a game.
- Keeps Murrumbeena as the maroon home team.
- Lets you set the away team name and colour.
- Includes a configurable countdown clock.
- Opens your email app with the game summary filled in.

## Open it locally

Open `index.html` in a browser.

## Put it on GitHub Pages

1. Create a new GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, and `README.md`.
3. Open the repository settings.
4. Go to Pages.
5. Set the source to the main branch and root folder.
6. Save, then open the GitHub Pages link GitHub gives you.

The email button uses your device email app through a `mailto:` link. A static GitHub Pages site cannot send email silently in the background, but it can fill in the email for you to send.
