const express = require("express");
const session = require("express-session");
const path = require("path");
const mariadb = require("mariadb");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "mon_secret_session",
    resave: false,
    saveUninitialized: false
  })
);

// Static frontend
app.use(express.static(path.join(__dirname, "public")));

// Pool MariaDB
const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10
});

// ---------------- BDD ----------------

async function schemaExist() {
  const connection = await pool.getConnection();

  try {
    const tables = await connection.query("SHOW TABLES");
    const usersTableExists = tables.some(
      (table) => table["Tables_in_" + process.env.DB_NAME] === "users"
    );
    return usersTableExists;
  } finally {
    connection.end();
  }
}

async function createSchema() {
  const connection = await pool.getConnection();

  try {
    await connection.query(
      "CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), passwordHash VARCHAR(255))"
    );

    const passwordHash = await bcrypt.hash("ioupi", 10);

    await connection.query(
      "INSERT INTO users(name, passwordHash) VALUES (?, ?)",
      ["remy", passwordHash]
    );
  } finally {
    connection.end();
  }
}

async function deleteSchema() {
  const connection = await pool.getConnection();

  try {
    await connection.query("DROP TABLE users");
  } finally {
    connection.end();
  }
}

// ---------------- AUTH JWT ----------------

function checkAuth(req, res, next) {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({
        message: "Token manquant"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Token invalide"
    });
  }
}

// ---------------- ROUTES ----------------

app.get("/api", (req, res) => {
  res.send("API Express OK");
});

app.get("/hello/:name", (req, res) => {
  res.send(`Hello ${req.params.name}`);
});

app.post("/user", (req, res) => {
  res.json({
    message: "Utilisateur reçu",
    data: req.body
  });
});

app.post("/course", (req, res) => {
  res.json({
    message: "Cours reçu",
    data: req.body
  });
});

app.get("/test", (req, res) => {
  res.json({
    message: "Route test OK",
    received: req.body
  });
});

app.get("/db-test", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const result = await connection.query("SELECT 1 AS test");
    connection.end();

    res.json({
      message: "Connexion BDD OK",
      result: result
    });
  } catch (error) {
    console.error("Erreur db-test :", error);
    res.status(500).json({
      message: "Erreur connexion BDD",
      error: error.message
    });
  }
});

// LOGIN : vérifie user + crée JWT + met le token en cookie
app.post("/login", async (req, res) => {
  try {
    const loginData = req.body;

    const connection = await pool.getConnection();
    const dbUsers = await connection.query(
      "SELECT * FROM users WHERE name = ?",
      [loginData.name]
    );
    connection.end();

    if (dbUsers.length === 0) {
      return res.sendStatus(401);
    }

    const dbUser = dbUsers[0];

    const isPasswordValid = await bcrypt.compare(
      loginData.password,
      dbUser.passwordHash
    );

    if (!isPasswordValid) {
      return res.sendStatus(401);
    }

    const token = jwt.sign(
      {
        id: dbUser.id,
        name: dbUser.name
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h"
      }
    );

    res.cookie("token", token, {
      httpOnly: true
    });

    res.json({
      message: "Connexion réussie",
      token: token
    });
  } catch (error) {
    console.error("Erreur login :", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
});

// Route protégée avec middleware
app.get("/api/users", checkAuth, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const users = await connection.query("SELECT id, name FROM users");
    connection.end();

    res.json({
      message: "Accès autorisé",
      connectedUser: req.user,
      users: users
    });
  } catch (error) {
    console.error("Erreur /api/users :", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
});

// Anciennes routes conservées
app.get("/me", (req, res) => {
  res.json({
    message: "Cette route utilisait la session",
    note: "Maintenant l'auth principale passe par JWT + cookie"
  });
});

app.get("/private", checkAuth, (req, res) => {
  res.json({
    message: "Bienvenue sur la route privée",
    user: req.user
  });
});

// LOGOUT : suppression du cookie
app.get("/logout", (req, res) => {
  res.clearCookie("token");

  res.json({
    message: "Déconnexion réussie"
  });
});

// ---------------- START ----------------

async function startServer() {
  try {
    if (!(await schemaExist())) {
      console.log("database does not exist!, creating....");
      await createSchema();
    } else {
      console.log("database already exist!");
      // await deleteSchema()
    }

    app.listen(PORT, () => {
      console.log(`Serveur lancé sur http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Erreur au démarrage :", error);
  }
}

startServer();