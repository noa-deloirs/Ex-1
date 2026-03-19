const express = require("express");
const session = require("express-session");
const path = require("path");
const mariadb = require("mariadb");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3000;

// Lire le JSON
app.use(express.json());

// Lire le x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "mon_secret_session",
    resave: false,
    saveUninitialized: false
  })
);

// Plugin static pour servir le frontend HTML
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

// ----------- FONCTIONS BDD -----------

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

// ----------- ROUTES -----------

// Route de base API
app.get("/api", (req, res) => {
  res.send("API Express OK");
});

// GET /hello/remy
app.get("/hello/:name", (req, res) => {
  res.send(`Hello ${req.params.name}`);
});

// POST /user en urlencoded
app.post("/user", (req, res) => {
  res.json({
    message: "Utilisateur reçu",
    data: req.body
  });
});

// POST /course en JSON
app.post("/course", (req, res) => {
  res.json({
    message: "Cours reçu",
    data: req.body
  });
});

// GET /test avec body JSON
app.get("/test", (req, res) => {
  res.json({
    message: "Route test OK",
    received: req.body
  });
});

// Test connexion BDD
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

// ----------- SESSION + LOGIN BDD -----------

// Login avec BDD
app.post("/login", async (req, res) => {
  try {
    const loginData = req.body;

    const connection = await pool.getConnection();
    const dbUsers = await connection.query(
      "SELECT * FROM users WHERE name = ?",
      [loginData.name]
    );

    console.log("users", dbUsers);
    connection.end();

    if (dbUsers.length === 0) {
      res.sendStatus(401);
      return;
    }

    const dbUser = dbUsers[0];

    const isPasswordValid = await bcrypt.compare(
      loginData.password,
      dbUser.passwordHash
    );

    if (!isPasswordValid) {
      res.sendStatus(401);
      return;
    }

    req.session.user = {
      id: dbUser.id,
      name: dbUser.name
    };

    res.json({
      message: "Connexion réussie",
      user: req.session.user
    });
  } catch (error) {
    console.error("Erreur login :", error);
    res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
});

// Vérif auth
app.get("/me", (req, res) => {
  if (req.session.user) {
    return res.json({
      message: "Utilisateur connecté",
      user: req.session.user
    });
  }

  res.status(401).json({
    message: "Non authentifié"
  });
});

// Donnée protégée
app.get("/private", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      message: "Accès refusé, veuillez vous connecter"
    });
  }

  res.json({
    message: "Bienvenue sur la route privée",
    secretData: "Voici les données secrètes",
    user: req.session.user
  });
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        message: "Erreur lors de la déconnexion"
      });
    }

    res.json({
      message: "Déconnexion réussie"
    });
  });
});

// ----------- DÉMARRAGE -----------

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