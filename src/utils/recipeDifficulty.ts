import { DbRecipe, RecipeDifficulty } from "../types/recipe";

export function computeDifficulty(recipe: DbRecipe): RecipeDifficulty {
  const { ovenNeeded, specificEquipmentNeeded, exoticIngredients } = recipe;

  if (ovenNeeded && specificEquipmentNeeded && exoticIngredients) {
    return "Difficile";
  }

  if (ovenNeeded || specificEquipmentNeeded || exoticIngredients) {
    return "Difficulté moyenne";
  }

  return "Facile";
}