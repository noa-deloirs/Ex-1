# Cordon-bleu API

API REST pour l'application Cordon-bleu.

## Stack
- Node.js
- Express.js
- TypeScript
- MariaDB

## Routes

### Auth
- POST /api/auth/register : créer un profil utilisateur
- POST /api/auth/login : connecter un utilisateur
- POST /api/auth/logout : déconnecter un utilisateur

### Recipes
- GET /api/recipes : lister les recettes
- GET /api/recipes/search?q=... : rechercher une recette
- GET /api/recipes/home : récupérer les 10 recettes les plus consultées
- GET /api/recipes/:id : afficher une recette
- POST /api/recipes : ajouter une recette
- POST /api/recipes/:id/duplicate : dupliquer une recette
- PUT /api/recipes/:id : modifier une recette
- DELETE /api/recipes/:id : supprimer une recette
- GET /api/recipes/home : récupérer les 10 recettes les plus consultées pour la page d'accueil

### Difficulté
- Difficile : four + matériel spécifique + ingrédients exotiques
- Difficulté moyenne : four OU matériel spécifique OU ingrédients exotiques
- Facile : sinon

### Popularité
- La page d'accueil affiche les 10 recettes les plus consultées
- Si une recette n'est pas consultée pendant 10 jours, elle ne s'affiche plus
- Exception : si elle provient de France, elle peut rester affichée