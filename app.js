const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = 3000;

// Lire le JSON
app.use(express.json());

// Lire le x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// Session
app.use(
  session({
    secret: "mon_secret_session",
    resave: false,
    saveUninitialized: false
  })
);

// Plugin static pour servir le frontend HTML
app.use(express.static(path.join(__dirname, "public")));

// Route de base API
app.get("/api", (req, res) => {
  res.send("API Express OK");
});

// ----------- EXOS D'AVANT -----------

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

// ----------- SESSION -----------

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Exemple simple
  if (username === "admin" && password === "1234") {
    req.session.user = {
      username: username
    };

    return res.json({
      message: "Connexion réussie",
      user: req.session.user
    });
  }

  res.status(401).json({
    message: "Identifiants invalides"
  });
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

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});