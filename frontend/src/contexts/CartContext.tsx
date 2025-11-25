import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useQuery, useMutation } from 'urql';
import { useAuth } from './AuthContext';
import { GET_CART, ADD_TO_CART, UPDATE_CART_ITEM, REMOVE_CART_ITEM } from '../graphql/storefront';
import { toast } from 'sonner';

// Cart Item Type (matching GraphQL CartItem)
export interface CartItem {
  id: string;
  product: {
    id: string;
    sku: string;
    name: string;
    slug: string;
    price: number;
    specialPrice?: number;
    images: Array<{
      url: string;
      label?: string;
      role?: string;
    }>;
    brand?: {
      id: string;
      name: string;
      slug: string;
    };
  };
  sku: string;
  name: string;
  quantity: number;
  price: number;
  row_total: number;
  custom_options?: string;
}

// Cart Type (matching GraphQL Cart)
export interface Cart {
  id?: string;
  items: CartItem[];
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  shipping_amount: number;
  grand_total: number;
  coupon_code?: string;
  currency: string;
}

// Cart Context Types
interface CartContextType {
  cart: Cart | null;
  isLoading: boolean;
  error: Error | null;
  addToCart: (productId: string, quantity?: number, customOptions?: string) => Promise<void>;
  updateCartItem: (cartItemId: string, quantity: number) => Promise<void>;
  removeCartItem: (cartItemId: string) => Promise<void>;
  refreshCart: () => void;
  getCartItemCount: () => number;
  getCartTotal: () => number;
}

// Create context
const CartContext = createContext<CartContextType | undefined>(undefined);

// Cart Provider Props
interface CartProviderProps {
  children: ReactNode;
}

// LocalStorage keys
const CART_CACHE_KEY = 'rwanda-dubai-cart-cache';
const SESSION_ID_KEY = 'rwanda-dubai-session-id';

// Generate or retrieve session ID for guest carts
function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    // Generate a unique session ID
    sessionId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

// Cart Provider Component
export function CartProvider({ children }: CartProviderProps) {
  const { isAuthenticated } = useAuth();
  const [cartCache, setCartCache] = useState<Cart | null>(null);
  const [sessionId] = useState<string>(() => getOrCreateSessionId());

  // GraphQL Query - Fetch cart from backend (works for both authenticated and guest)
  const [cartResult, executeCartQuery] = useQuery({
    query: GET_CART,
    variables: { session_id: isAuthenticated ? undefined : sessionId },
    pause: false, // Always fetch cart (for both authenticated and guest)
  });

  // GraphQL Mutations
  const [, addToCartMutation] = useMutation(ADD_TO_CART);
  const [, updateCartItemMutation] = useMutation(UPDATE_CART_ITEM);
  const [, removeCartItemMutation] = useMutation(REMOVE_CART_ITEM);

  // Load cart cache from localStorage on mount
  useEffect(() => {
    const cached = localStorage.getItem(CART_CACHE_KEY);
    if (cached) {
      try {
        setCartCache(JSON.parse(cached));
      } catch (error) {
        console.error('Failed to load cart cache:', error);
        localStorage.removeItem(CART_CACHE_KEY);
      }
    }
  }, []);

  // Sync backend cart with cache (for both authenticated and guest)
  useEffect(() => {
    if (cartResult.data?.cart) {
      const backendCart = cartResult.data.cart;
      setCartCache(backendCart);
      localStorage.setItem(CART_CACHE_KEY, JSON.stringify(backendCart));
    }
  }, [cartResult.data]);

  // When user logs in, merge guest cart with user cart by refreshing with session_id
  useEffect(() => {
    if (isAuthenticated && sessionId) {
      // Refresh cart with session_id to trigger backend merge
      executeCartQuery({ 
        requestPolicy: 'network-only',
        variables: { session_id: sessionId },
      });
      // Clear session_id after merge (optional, but keeps things clean)
      // localStorage.removeItem(SESSION_ID_KEY);
    }
  }, [isAuthenticated]); // Only run when authentication status changes

  // Save cart cache to localStorage whenever it changes
  useEffect(() => {
    if (cartCache) {
      localStorage.setItem(CART_CACHE_KEY, JSON.stringify(cartCache));
    }
  }, [cartCache]);

  // Get current cart (use backend cart, fallback to cache)
  const cart = cartResult.data?.cart || cartCache;

  // Remove item from cart (defined first to avoid circular dependency)
  const removeCartItem = useCallback(async (cartItemId: string) => {
    try {
      const result = await removeCartItemMutation({
        cart_item_id: cartItemId,
        session_id: isAuthenticated ? undefined : sessionId,
      });

      if (result.error) {
        const errorMessage = result.error.graphQLErrors?.[0]?.message 
          || result.error.networkError?.message 
          || result.error.message 
          || 'Failed to remove item from cart';
        throw new Error(errorMessage);
      }

      if (result.data?.removeCartItem) {
        setCartCache(result.data.removeCartItem);
        // Refetch cart query to keep it in sync
        executeCartQuery({ 
          requestPolicy: 'network-only',
          variables: { session_id: isAuthenticated ? undefined : sessionId },
        });
        toast.success('Item removed from cart');
      } else {
        throw new Error('No data returned from server');
      }
    } catch (error: any) {
      console.error('Remove cart item error:', error);
      const errorMessage = error.message || 'Failed to remove item from cart';
      toast.error(errorMessage);
      throw error;
    }
  }, [isAuthenticated, removeCartItemMutation, sessionId, executeCartQuery]);

  // Add item to cart
  const addToCart = useCallback(async (productId: string, quantity: number = 1, customOptions?: string) => {
    try {
      const result = await addToCartMutation({
        product_id: productId,
        quantity,
        custom_options: customOptions,
        session_id: isAuthenticated ? undefined : sessionId,
      });

      if (result.error) {
        const errorMessage = result.error.graphQLErrors?.[0]?.message 
          || result.error.networkError?.message 
          || result.error.message 
          || 'Failed to add item to cart';
        throw new Error(errorMessage);
      }

      if (result.data?.addToCart) {
        setCartCache(result.data.addToCart);
        // Refetch cart query to keep it in sync
        executeCartQuery({ 
          requestPolicy: 'network-only',
          variables: { session_id: isAuthenticated ? undefined : sessionId },
        });
        toast.success('Item added to cart');
      } else {
        throw new Error('No data returned from server');
      }
    } catch (error: any) {
      console.error('Add to cart error:', error);
      const errorMessage = error.message || 'Failed to add item to cart';
      toast.error(errorMessage);
      throw error;
    }
  }, [isAuthenticated, addToCartMutation, sessionId, executeCartQuery]);

  // Update cart item quantity
  const updateCartItem = useCallback(async (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeCartItem(cartItemId);
      return;
    }

    try {
      const result = await updateCartItemMutation({
        cart_item_id: cartItemId,
        quantity,
        session_id: isAuthenticated ? undefined : sessionId,
      });

      if (result.error) {
        const errorMessage = result.error.graphQLErrors?.[0]?.message 
          || result.error.networkError?.message 
          || result.error.message 
          || 'Failed to update cart item';
        throw new Error(errorMessage);
      }

      if (result.data?.updateCartItem) {
        setCartCache(result.data.updateCartItem);
        // Refetch cart query to keep it in sync
        executeCartQuery({ 
          requestPolicy: 'network-only',
          variables: { session_id: isAuthenticated ? undefined : sessionId },
        });
        toast.success('Cart updated');
      } else {
        throw new Error('No data returned from server');
      }
    } catch (error: any) {
      console.error('Update cart item error:', error);
      const errorMessage = error.message || 'Failed to update cart item';
      toast.error(errorMessage);
      throw error;
    }
  }, [isAuthenticated, updateCartItemMutation, removeCartItem, sessionId, executeCartQuery]);

  // Refresh cart from backend
  const refreshCart = useCallback(() => {
    executeCartQuery({ 
      requestPolicy: 'network-only',
      variables: { session_id: isAuthenticated ? undefined : sessionId },
    });
  }, [isAuthenticated, executeCartQuery, sessionId]);

  // Get total item count
  const getCartItemCount = useCallback(() => {
    return cart?.items.reduce((sum:any, item:any) => sum + item.quantity, 0) || 0;
  }, [cart]);

  // Get cart total
  const getCartTotal = useCallback(() => {
    return cart?.grand_total || 0;
  }, [cart]);

  const contextValue: CartContextType = {
    cart: cart || null,
    isLoading: cartResult.fetching,
    error: cartResult.error || null,
    addToCart,
    updateCartItem,
    removeCartItem,
    refreshCart,
    getCartItemCount,
    getCartTotal,
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

// Custom hook to use cart context
export function useCart(): CartContextType {
  const context = useContext(CartContext);
  
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  
  return context;
}

export default CartContext;

