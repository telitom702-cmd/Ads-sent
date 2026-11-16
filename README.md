# Shortener Admin System

## Features

- MongoDB storage
- `config.js` based server configuration
- Admin panel at `/admin`
- Create 20-character API keys
- Copy API keys
- Delete API keys permanently
- API key usage count
- Create short URLs through API
- View original + generated short URL
- Copy short URLs
- Copy original URLs
- Short-code auto generation
- Click statistics
- Delete short URLs permanently
- TTL cleanup for expired links
- Countdown/continue page
- Vercel-ready

## Setup

1. Copy `config.js.example` to `config.js`.
2. Set:
   - `MONGODB_URI`
   - `DATABASE_NAME`
   - `BASE_URL`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET`
3. Deploy the folder to Vercel.

## API

```text
GET /api?api=API_KEY&url=ORIGINAL_URL
```

Optional plain-text response:

```text
GET /api?api=API_KEY&url=ORIGINAL_URL&format=text
```

Example:

```text
https://your-domain.com/api?api=4b392f8eb6ad711fbe58&url=https://example.com
```

## Admin

```text
https://your-domain.com/admin
```

After creating an API key in the Admin Panel, it is saved in MongoDB. If the key is deleted, its database record and links created with that key are deleted too.

## Important

Keep `config.js` private. Do not upload it to GitHub.
