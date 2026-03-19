export type RecipeDifficulty = "Facile" | "Difficulté moyenne" | "Difficile";

export type DbRecipe = {
  id: number;
  name: string;
  ingredients: string;
  servings: number;
  ovenNeeded: boolean;
  specificEquipmentNeeded: boolean;
  exoticIngredients: boolean;
  countryOfOrigin: string;
  priceLevel: number;
  createdAt: Date;
  updatedAt: Date;
  authorId: number;
  views: number;
  lastViewedAt: Date | null;
};

export type CreateRecipeData = {
  name: string;
  ingredients: string;
  servings: number;
  ovenNeeded: boolean;
  specificEquipmentNeeded: boolean;
  exoticIngredients: boolean;
  countryOfOrigin: string;
  priceLevel: number;
};

export type UpdateRecipeData = {
  name?: string;
  ingredients?: string;
  servings?: number;
  ovenNeeded?: boolean;
  specificEquipmentNeeded?: boolean;
  exoticIngredients?: boolean;
  countryOfOrigin?: string;
  priceLevel?: number;
};