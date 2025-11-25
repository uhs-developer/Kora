<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class Cors
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Handle preflight OPTIONS request immediately
        if ($request->getMethod() === 'OPTIONS') {
            return $this->addCorsHeaders(response('', 200));
        }

        // Process the request
        $response = $next($request);

        // Add CORS headers to the response
        return $this->addCorsHeaders($response);
    }

    /**
     * Add CORS headers to response
     */
    private function addCorsHeaders(Response $response): Response
    {
        // Get the origin from the request
        $origin = request()->header('Origin');
        
        // Get allowed origins from environment variable (comma-separated)
        $allowedOriginsEnv = env('CORS_ALLOWED_ORIGINS');
        $allowedOrigins = $allowedOriginsEnv
            ? array_filter(array_map('trim', explode(',', $allowedOriginsEnv)))
            : [];

        // Always include configured frontend URL if set
        $frontendUrl = config('app.frontend_url');
        if ($frontendUrl) {
            $allowedOrigins[] = rtrim($frontendUrl, '/');
        }

        // Fall back to app URL when no dedicated frontend URL is configured
        if (!$frontendUrl && config('app.url')) {
            $allowedOrigins[] = rtrim(config('app.url'), '/');
        }

        $allowedOrigins = array_values(array_unique(array_filter($allowedOrigins)));
        
        // Determine the allowed origin
        $allowedOrigin = null;
        
        // If origin is in the allowed list, use it
        if ($origin && in_array($origin, $allowedOrigins, true)) {
            $allowedOrigin = $origin;
        } 
        // For local development, allow any origin if explicitly running in local env and no origins configured
        elseif ($origin && !$allowedOriginsEnv && app()->environment('local')) {
            $allowedOrigin = $origin;
        } 
        // Default to first allowed origin or configured frontend URL
        else {
            $allowedOrigin = $allowedOrigins[0] ?? rtrim((string) (config('app.frontend_url') ?? config('app.url')), '/');
        }
        
        return $response
            ->header('Access-Control-Allow-Origin', $allowedOrigin)
            ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, X-CSRF-TOKEN')
            ->header('Access-Control-Allow-Credentials', 'true')
            ->header('Access-Control-Max-Age', '86400');
    }
}

