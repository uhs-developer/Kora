<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\BrandController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes - STOREFRONT ONLY (Public-facing)
|--------------------------------------------------------------------------
| All admin operations now use GraphQL at /graphql
| These routes are for the public storefront (customer-facing)
*/

// ===== AUTHENTICATION (Public & Protected) =====
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/logout-all', [AuthController::class, 'logoutAll']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
});

// ===== STOREFRONT PUBLIC ROUTES =====
// These remain as REST for storefront performance and simplicity

Route::prefix('categories')->group(function () {
    Route::get('/', [CategoryController::class, 'index']);
    Route::get('/{slug}', [CategoryController::class, 'show']);
});

Route::prefix('products')->group(function () {
    Route::get('/', [ProductController::class, 'index']);
    Route::get('/featured', [ProductController::class, 'featured']);
    Route::get('/search', [ProductController::class, 'search']);
    Route::get('/filter-options', [ProductController::class, 'filterOptions']);
    Route::get('/{slug}', [ProductController::class, 'show']);
});

Route::prefix('brands')->group(function () {
    Route::get('/', [BrandController::class, 'index']);
    Route::get('/{slug}', [BrandController::class, 'show']);
});

// ===== PAYMENT WEBHOOKS =====
Route::post('/webhooks/flutterwave', [\App\Http\Controllers\FlutterwaveWebhookController::class, 'handleWebhook']);

/*
|--------------------------------------------------------------------------
| ADMIN OPERATIONS - Use GraphQL at /graphql
|--------------------------------------------------------------------------
| All admin CRUD operations (products, categories, orders, customers, etc.)
| are handled via GraphQL queries and mutations.
| 
| Example queries:
| - adminProducts(q: "search", page: 1)
| - adminOrders(status: "pending")
| - adminCustomers(page: 1)
| 
| Example mutations:
| - createProduct(input: {...})
| - updateOrder(id: 1, status: "completed")
| - deleteCategory(id: 5)
|--------------------------------------------------------------------------
*/
