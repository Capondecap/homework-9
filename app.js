require("dotenv").config();

const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { engine } = require("express-handlebars");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN || `http://localhost:${PORT}`;
const AUTH_USERNAME = process.env.AUTH_USERNAME || "energy-admin";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "CrudeOil2026!";
const JWT_SECRET =
  process.env.JWT_SECRET || "global-energy-exchange-jwt-secret";
const JWT_EXPIRES_IN = "1h";
const JWT_EXPIRES_IN_SECONDS = 60 * 60;
const JWT_ISSUER = "Global Energy Exchange";
const JWT_AUDIENCE = "energy-api-clients";

const oilPriceData = {
  market: "Global Energy Exchange",
  last_updated: "2026-03-15T12:55:00Z",
  currency: "USD",
  data: [
    {
      symbol: "WTI",
      name: "West Texas Intermediate",
      price: 78.45,
      change: 0.12,
    },
    {
      symbol: "BRENT",
      name: "Brent Crude",
      price: 82.3,
      change: -0.05,
    },
    {
      symbol: "NAT_GAS",
      name: "Natural Gas",
      price: 2.15,
      change: 0.02,
    },
  ],
};

const allowedIps = new Set(["127.0.0.1", "::1"]);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests from this IP. Please try again in 1 minute.",
  },
});

const corsOptions = {
  origin(origin, callback) {
    if (!origin || origin === ALLOWED_ORIGIN) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
};

function normalizeIp(ipAddress = "") {
  // Express can surface IPv4 localhost as an IPv6-mapped address.
  return ipAddress.startsWith("::ffff:") ? ipAddress.replace("::ffff:", "") : ipAddress;
}

function safeCompare(expected, actual) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual || "");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function ipFilter(req, res, next) {
  const clientIp = normalizeIp(req.ip || req.socket.remoteAddress);

  if (!allowedIps.has(clientIp)) {
    res.status(403).json({ message: "Forbidden: requests are limited to localhost." });
    return;
  }

  next();
}

function hasValidCredentials(username, password) {
  return (
    safeCompare(AUTH_USERNAME, username) && safeCompare(AUTH_PASSWORD, password)
  );
}

function bearerAuth(req, res, next) {
  const authHeader = req.get("Authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!bearerMatch) {
    res
      .status(401)
      .json({ message: "Unauthorized: a valid Bearer token is required." });
    return;
  }

  try {
    req.user = jwt.verify(bearerMatch[1].trim(), JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    next();
  } catch (error) {
    res
      .status(401)
      .json({ message: "Unauthorized: a valid Bearer token is required." });
  }
}

function requestBasicAuth(res, realm = "Energy Dashboard") {
  res.set("WWW-Authenticate", `Basic realm="${realm}", charset="UTF-8"`);
  res.status(401).type("html").send(`<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Authentication Required</title>
    </head>
    <body>
      <h1>Authentication Required</h1>
      <p>The dashboard uses HTTP Basic Auth.</p>
      <p>Use the exact username and password shown on the home page or in the README. They are case-sensitive.</p>
    </body>
  </html>`);
}

function basicAuth(req, res, next) {
  const authHeader = req.get("Authorization") || "";

  if (!authHeader.startsWith("Basic ")) {
    requestBasicAuth(res);
    return;
  }

  let decodedCredentials;

  try {
    decodedCredentials = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  } catch (error) {
    requestBasicAuth(res);
    return;
  }

  const separatorIndex = decodedCredentials.indexOf(":");

  if (separatorIndex === -1) {
    requestBasicAuth(res);
    return;
  }

  const username = decodedCredentials.slice(0, separatorIndex);
  const password = decodedCredentials.slice(separatorIndex + 1);

  if (!hasValidCredentials(username, password)) {
    requestBasicAuth(res);
    return;
  }

  next();
}

function createAccessToken(username) {
  return jwt.sign(
    {
      sub: username,
      scope: "oil:read",
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
}

app.engine(
  "handlebars",
  engine({
    defaultLayout: "main",
    helpers: {
      formatPrice(value) {
        return Number(value).toFixed(2);
      },
      formatChange(value) {
        const numericValue = Number(value).toFixed(2);
        return Number(value) >= 0 ? `+${numericValue}` : numericValue;
      },
      changeClass(value) {
        return Number(value) >= 0 ? "up" : "down";
      },
    },
  })
);

app.set("view engine", "handlebars");
app.set("views", path.join(__dirname, "views"));
app.disable("x-powered-by");

// Apply the shared middleware stack before any protected routes.
app.use(ipFilter);
app.use(cors(corsOptions));
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("home", {
    pageTitle: "Energy API",
    allowedOrigin: ALLOWED_ORIGIN,
  });
});

app.post("/auth/token", (req, res) => {
  const username = `${req.body?.username || ""}`.trim();
  const password = `${req.body?.password || ""}`;

  if (!username || !password) {
    res.status(400).json({
      message: "Username and password are required to generate a JWT token.",
    });
    return;
  }

  if (!hasValidCredentials(username, password)) {
    res.status(401).json({ message: "Invalid username or password." });
    return;
  }

  const accessToken = createAccessToken(username);

  res.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: JWT_EXPIRES_IN_SECONDS,
  });
});

app.get("/api/oil-prices", bearerAuth, (req, res) => {
  res.json(oilPriceData);
});

app.get("/dashboard", basicAuth, (req, res) => {
  res.render("dashboard", {
    pageTitle: "Energy Dashboard",
    prices: oilPriceData,
  });
});

app.get("/logout", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.redirect("/logged-out");
});

app.get("/logged-out", (req, res) => {
  // Basic Auth is browser-managed, so logout is best-effort and browser dependent.
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Clear-Site-Data", "\"cache\"");
  res.set("WWW-Authenticate", 'Basic realm="Logged Out", charset="UTF-8"');
  res.status(401).render("logged-out", {
    pageTitle: "Logged Out",
  });
});

app.use((error, req, res, next) => {
  if (error.message === "Not allowed by CORS") {
    res.status(403).json({ message: "Forbidden: this origin is not allowed." });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Internal server error." });
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});

app.listen(PORT, () => {
  console.log(`Energy API listening on http://localhost:${PORT}`);
});
