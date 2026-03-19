import express, { Request, Response } from "express";
import session from "express-session";
import { type Pool, createPool } from "mariadb";
import bcrypt, { hash, compare } from "bcrypt";

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false
  })
);

// ---- Types session ----
declare module "express-session" {
  interface SessionData {
    user?: {
      id: number;
      name: string;
    };
  }
}

// ---- Pool MariaDB ----
const pool: Pool = createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT!),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10
});

// ---- Fonctions BDD ----
async function schemaExist() {
  const connection = await pool.getConnection();

  try {
    const tables = await connection.query("SHOW TABLES");
    const usersTableExists = tables.some(
      (table: any) =>
        table["Tables_in_" + process.env.DB_NAME] === "users"
    );

    return usersTableExists;
  } finally {
    connection.end();
  }
}

async function createSchema() {
  const connection = await pool.getConnection();

  try {
    await connection.query(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        passwordHash VARCHAR(255)
      )
    `);

    const passwordHash = await hash("ioupi", 10);

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

// ---- Vérification auth ----
function isAuthenticated(req: Request, res: Response, next: Function) {
  if (!req.session.user) {
    res.status(401).json({ message: "Non authentifié" });
    return;
  }

  next();
}

// ---- Routes ----
app.get("/", (req: Request, res: Response) => {
  res.send("Serveur TypeScript + MariaDB OK");
});

app.get("/me", (req: Request, res: Response) => {
  if (!req.session.user) {
    res.status(401).json({ message: "Non authentifié" });
    return;
  }

  res.json({
    message: "Utilisateur connecté",
    user: req.session.user
  });
});

app.get("/private", isAuthenticated, (req: Request, res: Response) => {
  res.json({
    message: "Bienvenue sur la route privée",
    data: "Donnée protégée",
    user: req.session.user
  });
});

app.post("/login", async (req: Request, res: Response) => {
  try {
    const loginData = req.body;

    if (!loginData.name || !loginData.password) {
      res.status(400).json({
        message: "name et password sont obligatoires"
      });
      return;
    }

    const connection = await pool.getConnection();

    try {
      const dbUsers = await connection.query(
        "SELECT * FROM users WHERE name = ?",
        [loginData.name]
      );

      console.log("users", dbUsers);

      if (dbUsers.length === 0) {
        res.sendStatus(401);
        return;
      }

      const dbUser = dbUsers[0];

      const isPasswordValid = await compare(
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
    } finally {
      connection.end();
    }
  } catch (error) {
    console.error("Erreur login :", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({
        message: "Erreur lors de la déconnexion"
      });
      return;
    }

    res.json({
      message: "Déconnexion réussie"
    });
  });
});

// ---- Démarrage serveur ----
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