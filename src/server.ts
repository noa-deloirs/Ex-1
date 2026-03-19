import express, { Request, Response, NextFunction } from "express";
import session from "express-session";
import { type Pool, createPool } from "mariadb";
import bcrypt, { hash, compare } from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

// ---- Middlewares ----
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

// ---- Types internes ----
type DbRecipe = {
  id: number;
  name: string;
  ingredients: string;
  servings: number;
  ovenNeeded: number;
  specificEquipmentNeeded: number;
  exoticIngredients: number;
  countryOfOrigin: string;
  priceLevel: number;
  authorId: number;
  views: number;
  lastViewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateRecipeData = {
  name: string;
  ingredients: string;
  servings: number;
  ovenNeeded: boolean;
  specificEquipmentNeeded: boolean;
  exoticIngredients: boolean;
  countryOfOrigin: string;
  priceLevel: number;
};

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
async function schemaExist(tableName: string) {
  const connection = await pool.getConnection();

  try {
    const tables = await connection.query("SHOW TABLES");
    const tableExists = tables.some(
      (table: any) => table["Tables_in_" + process.env.DB_NAME] === tableName
    );

    return tableExists;
  } finally {
    connection.end();
  }
}

async function createUsersTable() {
  const connection = await pool.getConnection();

  try {
    await connection.query(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        passwordHash VARCHAR(255) NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
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

async function createRecipesTable() {
  const connection = await pool.getConnection();

  try {
    await connection.query(`
      CREATE TABLE recipes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        ingredients TEXT NOT NULL,
        servings INT NOT NULL,
        ovenNeeded BOOLEAN NOT NULL,
        specificEquipmentNeeded BOOLEAN NOT NULL,
        exoticIngredients BOOLEAN NOT NULL,
        countryOfOrigin VARCHAR(255) NOT NULL,
        priceLevel INT NOT NULL,
        authorId INT NOT NULL,
        views INT DEFAULT 0,
        lastViewedAt DATETIME NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (authorId) REFERENCES users(id)
      )
    `);

    console.log("recipes table created");
  } finally {
    connection.end();
  }
}

function computeDifficulty(recipe: DbRecipe) {
  const ovenNeeded = Boolean(recipe.ovenNeeded);
  const specificEquipmentNeeded = Boolean(recipe.specificEquipmentNeeded);
  const exoticIngredients = Boolean(recipe.exoticIngredients);

  if (ovenNeeded && specificEquipmentNeeded && exoticIngredients) {
    return "Difficile";
  }

  if (ovenNeeded || specificEquipmentNeeded || exoticIngredients) {
    return "Difficulté moyenne";
  }

  return "Facile";
}

// ---- Middleware Auth ----
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Non authentifié" });
  }

  next();
}

// ---- ROUTES API ----

// Health check
app.get("/", (req: Request, res: Response) => {
  res.send("Cordon-bleu API OK");
});

// ---- AUTH ----

app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({
        message: "name et password sont obligatoires"
      });
    }

    const connection = await pool.getConnection();

    try {
      const dbUsers = await connection.query(
        "SELECT * FROM users WHERE name = ?",
        [name]
      );

      if (dbUsers.length === 0) {
        return res.sendStatus(401);
      }

      const dbUser = dbUsers[0];

      const isPasswordValid = await compare(password, dbUser.passwordHash);

      if (!isPasswordValid) {
        return res.sendStatus(401);
      }

      req.session.user = {
        id: Number(dbUser.id),
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

app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({
        message: "name et password sont obligatoires"
      });
    }

    const connection = await pool.getConnection();

    try {
      const existingUsers = await connection.query(
        "SELECT * FROM users WHERE name = ?",
        [name]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({
          message: "Ce nom existe déjà"
        });
      }

      const passwordHash = await hash(password, 10);

      const result = await connection.query(
        "INSERT INTO users(name, passwordHash) VALUES (?, ?)",
        [name, passwordHash]
      );

      res.status(201).json({
        message: "Utilisateur créé",
        id: Number(result.insertId)
      });
    } finally {
      connection.end();
    }
  } catch (error) {
    console.error("Erreur register :", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.post("/api/auth/logout", (req: Request, res: Response) => {
  req.session.destroy((err: Error | null) => {
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

app.get("/api/auth/me", (req: Request, res: Response) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Non authentifié" });
  }

  res.json({
    user: req.session.user
  });
});

// ---- USERS ----

app.get("/api/users", isAuthenticated, (req: Request, res: Response) => {
  res.json({
    message: "Accès autorisé",
    user: req.session.user
  });
});

// ---- RECIPES ----

// Créer une recette
app.post("/api/recipes", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const data: CreateRecipeData = req.body;

    if (
      !data.name ||
      !data.ingredients ||
      data.servings === undefined ||
      data.ovenNeeded === undefined ||
      data.specificEquipmentNeeded === undefined ||
      data.exoticIngredients === undefined ||
      !data.countryOfOrigin ||
      data.priceLevel === undefined
    ) {
      return res.status(400).json({
        message: "Données recette incomplètes"
      });
    }

    const connection = await pool.getConnection();

    try {
      const result = await connection.query(
        `INSERT INTO recipes
        (name, ingredients, servings, ovenNeeded, specificEquipmentNeeded, exoticIngredients, countryOfOrigin, priceLevel, authorId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.name,
          data.ingredients,
          data.servings,
          data.ovenNeeded,
          data.specificEquipmentNeeded,
          data.exoticIngredients,
          data.countryOfOrigin,
          data.priceLevel,
          req.session.user!.id
        ]
      );

      res.status(201).json({
        message: "Recette créée",
        id: Number(result.insertId)
      });
    } finally {
      connection.end();
    }
  } catch (error) {
    console.error("Erreur création recette :", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Lister les recettes
app.get("/api/recipes", async (req: Request, res: Response) => {
  try {
    const connection = await pool.getConnection();

    try {
      const recipes: DbRecipe[] = await connection.query(
        "SELECT * FROM recipes ORDER BY createdAt DESC"
      );

      const formattedRecipes = recipes.map((recipe) => ({
        ...recipe,
        id: Number(recipe.id),
        authorId: Number(recipe.authorId),
        views: Number(recipe.views),
        difficulty: computeDifficulty(recipe)
      }));

      res.json(formattedRecipes);
    } finally {
      connection.end();
    }
  } catch (error) {
    console.error("Erreur liste recettes :", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Afficher une recette + augmenter vues
app.get("/api/recipes/:id", async (req: Request, res: Response) => {
  try {
    const recipeId = parseInt(String(req.params.id), 10);
    const connection = await pool.getConnection();

    try {
      const recipes: DbRecipe[] = await connection.query(
        "SELECT * FROM recipes WHERE id = ?",
        [recipeId]
      );

      if (recipes.length === 0) {
        return res.status(404).json({
          message: "Recette introuvable"
        });
      }

      await connection.query(
        "UPDATE recipes SET views = views + 1, lastViewedAt = NOW() WHERE id = ?",
        [recipeId]
      );

      const recipe = recipes[0];

      res.json({
        ...recipe,
        id: Number(recipe.id),
        authorId: Number(recipe.authorId),
        views: Number(recipe.views),
        difficulty: computeDifficulty(recipe)
      });
    } finally {
      connection.end();
    }
  } catch (error) {
    console.error("Erreur détail recette :", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Recherche
app.get("/api/recipes/search/:term", async (req: Request, res: Response) => {
  try {
    const term = `%${req.params.term}%`;
    const connection = await pool.getConnection();

    try {
      const recipes: DbRecipe[] = await connection.query(
        "SELECT * FROM recipes WHERE name LIKE ? ORDER BY createdAt DESC",
        [term]
      );

      const formattedRecipes = recipes.map((recipe) => ({
        ...recipe,
        id: Number(recipe.id),
        authorId: Number(recipe.authorId),
        views: Number(recipe.views),
        difficulty: computeDifficulty(recipe)
      }));

      res.json(formattedRecipes);
    } finally {
      connection.end();
    }
  } catch (error) {
    console.error("Erreur recherche recette :", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ---- START ----
async function startServer() {
  try {
    if (!(await schemaExist("users"))) {
      console.log("users table does not exist, creating...");
      await createUsersTable();
    } else {
      console.log("users table already exists");
    }

    if (!(await schemaExist("recipes"))) {
      console.log("recipes table does not exist, creating...");
      await createRecipesTable();
    } else {
      console.log("recipes table already exists");
    }

    app.listen(PORT, () => {
      console.log(`Serveur lancé sur http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Erreur au démarrage :", error);
  }
}

startServer();