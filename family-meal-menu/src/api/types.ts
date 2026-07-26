export type MemberRole = 'creator' | 'admin' | 'member'

export interface FamilyMember {
  id: string; name: string; avatar: string; role: MemberRole
}

export type RecipeCategory = 'meat' | 'vegetable' | 'soup' | 'seafood' | 'staple' | 'drink'

export const RecipeCategoryLabels: Record<RecipeCategory, string> = {
  meat: '荤菜', vegetable: '素菜', soup: '汤羹', seafood: '海鲜', staple: '主食', drink: '饮品',
}

export const RecipeCategoryIcons: Record<RecipeCategory, string> = {
  meat: '🥩', vegetable: '🥬', soup: '🍲', seafood: '🦐', staple: '🍚', drink: '🥤',
}

export interface Recipe {
  id: string; name: string; category: RecipeCategory; coverImage: string
  ingredients: Ingredient[]; steps: StepItem[]
  cookingTime: number; difficulty: 1 | 2 | 3; tags: string[]
  nutritions: Nutrition; servings: number; orderCount: number
  createdAt: string; updatedAt: string
}

export interface StepItem { text: string; image: string }

export interface Ingredient {
  name: string; amount: string; unit: string
  category: 'main' | 'sub' | 'seasoning'
}

export interface Nutrition { calories: number; protein: number; fat: number; carbs: number }

export interface OrderItem {
  recipeId: string; recipeName: string; recipeCategory: RecipeCategory
}

export interface Order {
  id: string
  items: OrderItem[]
  memberId: string
  memberName: string
  createdAt: string
}

export interface CartItem {
  id?: number | string        // 服务端购物车条目 ID（本地创建的条目可能没有）
  recipeId: string; recipeName: string; recipeCategory: RecipeCategory; cookName: string; quantity: number
}
