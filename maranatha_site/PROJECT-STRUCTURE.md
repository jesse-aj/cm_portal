# Project Structure

## Active project

```text
bra_kay_website/
├── server.js                 # Main Node/Express server entry point
├── package.json              # Project metadata, scripts, and dependencies
├── package-lock.json         # Locked dependency versions
├── node_modules/             # Installed dependencies; generated, not source code
├── public/                   # Website files served by Express
│   ├── index.html            # Main public feedback page
│   ├── login.html            # Admin login page
│   ├── register.html         # Registration page
│   ├── user login.html       # Separate hard-coded user login page
│   ├── user.html             # User learning portal
│   ├── admin.html            # Admin dashboard mockup
│   ├── all feedback.html     # Feedback page mockup
│   ├── Categories.html       # Categories page mockup
│   ├── report.html            # Reports page mockup
│   ├── Settings.html         # Settings page mockup
│   ├── attach photo.html     # Photo upload mockup
│   ├── logout.html            # Logout page
│   ├── *.css                  # Page stylesheets
│   ├── logo.png              # Logo image
│   ├── new.png               # Image asset
│   └── sky.jpg               # Image asset
```

## Important note

The structure was reorganized without changing the images or visual design. The old duplicate backend and nested project files are no longer part of the active project.

The active server serves the website from `public/`, creates the database tables on startup, and provides registration, login, logout, feedback, session, health, and protected admin endpoints.

The active server now creates the `cm_portal` database and its `users` and `feedback` tables on startup. To create or promote the first administrator, start the server with `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` environment variables. The password should not be committed to source control.

## Cleanup

Unused duplicate login files and unused stylesheets were removed after checking active HTML references. The active login page uses `register.css`, and the active admin pages use `admin.css`.
