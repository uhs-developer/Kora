<?php

namespace App\GraphQL\Resolvers;

use App\Models\Product;

class ProductImages
{
    public function __invoke(Product $product)
    {
        // Filter out images with null URLs and ensure we have at least an empty array
        $images = $product->images()->get()->filter(function ($image) {
            return $image->image_url || $image->image_path;
        });

        // Transform to array format that GraphQL expects (url, label, role)
        return $images->map(function ($image) {
            return [
                'url' => $image->url, // Uses accessor from ProductImage model
                'label' => $image->label ?? null, // Uses accessor from ProductImage model
                'role' => $image->role ?? null, // Uses accessor from ProductImage model
            ];
        })->values()->toArray();
    }
}
