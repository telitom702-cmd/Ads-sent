// Server configuration only.
// Do NOT put this file in a public GitHub repository.
module.exports = {
  MONGODB_URI: "mongodb+srv://mongodbpy_db_user:pPgtRKyHsm8GvJF2@cluster0.u2ft5ps.mongodb.net/?appName=Cluster0",
  DATABASE_NAME: "shortener",

  // The public URL of this shortener service.
  // Example: https://my-shortener.vercel.app
  BASE_URL: "https://dreamlinkerin.onrender.com",

  PORT: 3000,

  // Admin login for /admin
  ADMIN_USERNAME: "Admin",
  ADMIN_PASSWORD: "12345678",

  // Used to sign admin sessions.
  SESSION_SECRET: "Skomar-Dreamlinker",

  // Link settings
  WAIT_SECONDS: 10,
  TTL_DAYS: 2,
  SHORT_CODE_LENGTH: 6,

  // Optional HTML snippets for ad networks.
  AD_HEAD: "",
  AD_TOP: "",
  AD_BOTTOM: ""
};
