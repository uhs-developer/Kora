import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from "react";
import { AuthProvider } from "../contexts/AuthContext";
import { ProductProvider, useProducts } from "../contexts/ProductContext";
import { CartProvider, useCart, CartItem as GraphQLCartItem } from "../contexts/CartContext";
import ProtectedRoute from "../components/ProtectedRoute";
import { AdminRoute } from "../components/ProtectedRoute";
import { HeaderDynamic } from "../components/HeaderDynamic";
import { Homepage } from "../components/Homepage";
import { HomepageAPI } from "../components/HomepageAPI";
import { ProductListingPage } from "../components/ProductListingPage";
import { ProductListingPageAPI } from "../components/ProductListingPageAPI";
import { ProductListingPageDynamic } from "../components/ProductListingPageDynamic";
import { SearchResultsPage } from "../components/SearchResultsPage";
import { ProductDetailPage } from "../components/ProductDetailPage";
import { CartPage } from "../components/CartPage";
import { CheckoutPage } from "../components/CheckoutPage";
import { ThankYouPage } from "../components/ThankYouPage";
import { NotFoundPage } from "../components/NotFoundPage";
import { AuthPage } from "../components/AuthPage";
import { AboutPage } from "../components/AboutPage";
import { ContactPage } from "../components/ContactPage";
import { ReturnsWarrantyPage } from "../components/ReturnsWarrantyPage";
import { FAQPage } from "../components/FAQPage";
import { BlogPage } from "../components/BlogPage";
import { BlogDetailPage } from "../components/BlogDetailPage";
import { StaticPage } from "../components/StaticPage";
import { AccountDashboard } from "../components/AccountDashboard";
import { OrderHistoryPage } from "../components/OrderHistoryPage";
import { ProfileSettingsPage } from "../components/ProfileSettingsPage";
import { AddressBookPage } from "../components/AddressBookPage";
import { AccountSecurityPage } from "../components/AccountSecurityPage";
import { OfflinePage } from "../components/OfflinePage";
import { Footer } from "../components/Footer";
import { ShoppingCart, CartItem } from "../components/ShoppingCart";
import { MiniWishlist } from "../components/MiniWishlist";
import { FlashSalePopup } from "../components/FlashSalePopup";
import { Chatbot } from "../components/Chatbot";
import { Toaster } from "../components/ui/sonner";
import { toast } from "sonner";
import { Product, products } from "../data/products";
import { WishlistItem, getWishlistFromStorage, saveWishlistToStorage } from "../data/wishlist";
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useAuth } from "../contexts/AuthContext";
import { transformProductForDisplay } from "../services/product";
import AdminLayout from "../admin/AdminLayout";
import AdminDashboard from "../admin/AdminDashboard";
import AdminUsersPage from "../admin/pages/AdminUsersPage";
import CacheManagementPage from "../admin/pages/CacheManagementPage";
import AdminProfilePage from "../admin/pages/AdminProfilePage";
import CmsPagesPage from "../admin/pages/CmsPagesPage";
import CmsBlocksPage from "../admin/pages/CmsBlocksPage";
import AdminProductsPage from "../admin/pages/AdminProductsPage";
import AdminProductsPageGraphQL from "../admin/pages/AdminProductsPageGraphQL";
import AdminCategoriesPage from "../admin/pages/AdminCategoriesPage";
import AdminCategoriesPageGraphQL from "../admin/pages/AdminCategoriesPageGraphQL";
import AdminCustomersPage from "../admin/pages/AdminCustomersPage";
import AdminCustomersPageGraphQL from "../admin/pages/AdminCustomersPageGraphQL";
import AdminOrdersPage from "../admin/pages/AdminOrdersPage";
import AdminOrdersPageGraphQL from "../admin/pages/AdminOrdersPageGraphQL";
import AdminOrderDetailPage from "../admin/pages/AdminOrderDetailPage";
import AdminProductFormPage from "../admin/pages/AdminProductFormPage";
import AdminInvoicesPage from "../admin/pages/AdminInvoicesPage";
import AdminShipmentsPage from "../admin/pages/AdminShipmentsPage";
import AdminUsersManagementPage from "../admin/pages/AdminUsersManagementPage";
import AdminConfigurationPage from "../admin/pages/AdminConfigurationPage";
import AdminContentPage from "../admin/pages/AdminContentPage";
import AdminCurrencyPage from "../admin/pages/AdminCurrencyPage";
import AdminShippingMethodsPage from "../admin/pages/AdminShippingMethodsPage";
import AdminShippingRoutesPage from "../admin/pages/AdminShippingRoutesPage";
import AdminShippingPricingPage from "../admin/pages/AdminShippingPricingPage";
import AdminBrandsPage from "../admin/pages/AdminBrandsPage";
import { ComingSoonPage } from "../components/ComingSoonPage";

export function AppRouter() {
  return (
    <Router>
      <AuthProvider>
        <ProductProvider>
          <CartProvider>
            <AppRouterContent />
          </CartProvider>
        </ProductProvider>
      </AuthProvider>
    </Router>
  );
}

function AppRouterContent() {
  const { user, logout, isAuthenticated } = useAuth();
  const { cart, addToCart: addToCartGraphQL, updateCartItem, removeCartItem, getCartItemCount, refreshCart } = useCart();
  const navigate = useNavigate();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [showFlashSale, setShowFlashSale] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [showOfflinePage, setShowOfflinePage] = useState(false);

  const isOnline = useOnlineStatus();

  // Convert GraphQL cart items to old CartItem format for backward compatibility
  const cartItems: CartItem[] = cart?.items.map(item => ({
    id: item.product.id,
    name: item.product.name,
    slug: item.product.slug,
    price: item.product.specialPrice || item.product.price,
    image: item.product.images[0]?.url || '',
    brand: item.product.brand?.name || '',
    category: item.product.categories?.[0]?.name || '',
    description: '',
    quantity: item.quantity,
  })) || [];

  // Load wishlist from localStorage on mount
  useEffect(() => {
    // Load wishlist
    setWishlistItems(getWishlistFromStorage());

    // Show flash sale popup on first visit
    const hasSeenFlashSale = localStorage.getItem('rwanda-dubai-flash-sale-seen');
    if (!hasSeenFlashSale) {
      setShowFlashSale(true);
    }
  }, []);

  // Handle offline status changes
  useEffect(() => {
    if (!isOnline) {
      setShowOfflinePage(true);
      toast.error('You are now offline. Some features may not be available.');
    } else if (showOfflinePage) {
      setShowOfflinePage(false);
      toast.success('You are back online!');
    }
  }, [isOnline, showOfflinePage]);

  const addToCart = async (product: Product, quantity = 1) => {
    try {
      // Find the GraphQL cart item ID for this product
      const existingCartItem = cart?.items.find(item => item.product.id === product.id);
      
      if (existingCartItem) {
        // Update quantity if item already exists
        await updateCartQuantity(product.id, existingCartItem.quantity + quantity);
      } else {
        // Add new item via GraphQL
        await addToCartGraphQL(product.id, quantity);
      }
    } catch (error) {
      console.error('Failed to add to cart:', error);
      // Error toast is handled in CartContext
    }
  };

  const removeFromCart = async (productId: string) => {
    try {
      // Find the GraphQL cart item ID
      const cartItem = cart?.items.find(item => item.product.id === productId);
      if (cartItem) {
        await removeCartItem(cartItem.id);
      }
    } catch (error) {
      console.error('Failed to remove from cart:', error);
    }
  };

  const updateCartQuantity = async (productId: string, quantity: number) => {
    try {
      // Find the GraphQL cart item ID
      const cartItem = cart?.items.find(item => item.product.id === productId);
      if (cartItem) {
        await updateCartItem(cartItem.id, quantity);
      }
    } catch (error) {
      console.error('Failed to update cart quantity:', error);
    }
  };

  const addToWishlist = (product: Product) => {
    const newWishlistItem: WishlistItem = {
      ...product,
      dateAdded: new Date(),
    };

    setWishlistItems(prevItems => {
      const isAlreadyInWishlist = prevItems.some(item => item.id === product.id);
      if (isAlreadyInWishlist) {
        toast.info('Item already in wishlist');
        return prevItems;
      }
      const updatedItems = [...prevItems, newWishlistItem];
      saveWishlistToStorage(updatedItems);
      toast.success('Added to wishlist!');
      return updatedItems;
    });
  };

  const removeFromWishlist = (productId: string) => {
    setWishlistItems(prevItems => {
      const updatedItems = prevItems.filter(item => item.id !== productId);
      saveWishlistToStorage(updatedItems);
      toast.success('Removed from wishlist');
      return updatedItems;
    });
  };

  const handleProductClick = (_product: Product) => {
    const slug = (_product as any).slug ?? _product.id;
    window.location.assign(`/product/${slug}`);
  };

  const handleCheckout = () => {
    if (!cart || cart.items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    // Close cart sidebar if open
    setIsCartOpen(false);
    // If not logged in, send to auth with intended checkout redirect
    if (!isAuthenticated) {
      navigate('/auth', { state: { from: { pathname: '/checkout' } } });
      return;
    }
    // Navigate to checkout page
    navigate('/checkout');
  };

  const handlePlaceOrder = (orderData: any) => {
    setOrderData(orderData);
    // Clear cart via GraphQL refresh
    refreshCart();
    toast.success('Order placed successfully!');
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleFlashSaleClose = () => {
    setShowFlashSale(false);
    localStorage.setItem('rwanda-dubai-flash-sale-seen', 'true');
  };

  const handleFlashSaleShop = () => {
    handleFlashSaleClose();
  };

  const handleOfflineTryAgain = () => {
    // Force refresh the page to check connection
    window.location.reload();
  };

  const handleOfflineGoHome = () => {
    setShowOfflinePage(false);
    // Navigate to home will be handled by the route
  };

  const handleOfflineViewCart = () => {
    setShowOfflinePage(false);
    setIsCartOpen(true);
  };

  const handleOfflineDismiss = () => {
    setShowOfflinePage(false);
  };

  const cartItemCount = getCartItemCount();
  const wishlistItemCount = wishlistItems.length;

  // Get related products for product detail page
  const getRelatedProducts = (product: Product) => {
    return products
      .filter(p =>
        p.id !== product.id &&
        (p.category === product.category || p.brand === product.brand)
      )
      .slice(0, 4);
  };

  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  // Scroll to top on route change (except for hash links)
  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [location.pathname]);

  return (
      <div className="min-h-screen flex flex-col">
        {/* Header (hide on admin routes) */}
        {!isAdminPath && (
          <HeaderWrapper
            cartItemCount={cartItemCount}
            wishlistItemCount={wishlistItemCount}
            onWishlistClick={() => setIsWishlistOpen(true)}
            user={user}
            onLogout={handleLogout}
          />
        )}

        {/* Main Content */}
        <main className="flex-1">
          <Routes>
            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminLayout>
                    <AdminDashboard />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/products"
              element={
                <AdminRoute>
                  <AdminLayout title="Products">
                    <AdminProductsPageGraphQL />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/products/new"
              element={
                <AdminRoute>
                  <AdminLayout title="Add Product">
                    <AdminProductFormPage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/products/:id/edit"
              element={
                <AdminRoute>
                  <AdminLayout title="Edit Product">
                    <AdminProductFormPage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/categories"
              element={
                <AdminRoute>
                  <AdminLayout title="Categories">
                    <AdminCategoriesPageGraphQL />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/brands"
              element={
                <AdminRoute>
                  <AdminLayout title="Brands">
                    <AdminBrandsPage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/customers"
              element={
                <AdminRoute>
                  <AdminLayout title="Customers">
                    <AdminCustomersPageGraphQL />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <AdminLayout title="Users">
                    <AdminCustomersPageGraphQL />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <AdminRoute>
                  <AdminLayout title="Orders">
                    <AdminOrdersPageGraphQL />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/orders/:id"
              element={
                <AdminRoute>
                  <AdminLayout title="Order Details">
                    <AdminOrderDetailPage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/pages"
              element={
                <AdminRoute>
                  <AdminLayout title="Pages">
                    <CmsPagesPage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/blocks"
              element={
                <AdminRoute>
                  <AdminLayout title="Blocks">
                    <CmsBlocksPage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/admin-users"
              element={
                <AdminRoute>
                  <AdminLayout title="Admin Users & Roles">
                    <AdminUsersManagementPage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/invoices"
              element={
                <AdminRoute>
                  <AdminLayout title="Invoices">
                    <AdminInvoicesPage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/shipments"
              element={
                <AdminRoute>
                  <AdminLayout title="Shipments">
                    <AdminShipmentsPage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/shipping-methods"
              element={
                <AdminRoute>
                  <AdminLayout title="Shipping Methods">
                    <AdminShippingMethodsPage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/shipping-routes"
              element={
                <AdminRoute>
                  <AdminLayout title="Shipping Routes">
                    <AdminShippingRoutesPage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/shipping-pricing"
              element={
                <AdminRoute>
                  <AdminLayout title="Shipping Pricing">
                    <AdminShippingPricingPage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/configuration"
              element={
                <AdminRoute>
                  <AdminLayout title="Configuration">
                    <AdminConfigurationPage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/content"
              element={
                <AdminRoute>
                  <AdminLayout title="Content Management">
                    <AdminContentPage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/currency"
              element={
                <AdminRoute>
                  <AdminLayout title="Currency">
                    <AdminCurrencyPage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/cache"
              element={
                <AdminRoute>
                  <AdminLayout title="Cache Management">
                    <CacheManagementPage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/profile"
              element={
                <AdminRoute>
                  <AdminLayout title="Profile & Settings">
                    <AdminProfilePage />
                  </AdminLayout>
                </AdminRoute>
              }
            />
            <Route path="/" element={
              <HomepageAPI
                onAddToCart={addToCart}
                onAddToWishlist={addToWishlist}
                onProductClick={handleProductClick}
              />
            } />

            <Route path="/products" element={
              <ProductListingPageDynamic
                onAddToCart={addToCart}
                onAddToWishlist={addToWishlist}
                onProductClick={handleProductClick}
              />
            } />

            <Route path="/deals" element={
              <DealsPageWrapper />
            } />

            <Route path="/new-arrivals" element={
              <NewArrivalsPageWrapper />
            } />

            <Route path="/category/:categoryId" element={
              <CategoryPageWrapper
                onAddToCart={addToCart}
                onAddToWishlist={addToWishlist}
                onProductClick={handleProductClick}
              />
            } />

            <Route path="/category/:categoryId/:subcategory" element={
              <CategoryPageWrapper
                onAddToCart={addToCart}
                onAddToWishlist={addToWishlist}
                onProductClick={handleProductClick}
              />
            } />

            <Route path="/search" element={
              <SearchResultsPage
                onAddToCart={addToCart}
                onAddToWishlist={addToWishlist}
                onProductClick={handleProductClick}
              />
            } />

            <Route path="/product/:slug" element={
              <ProductDetailWrapper
                onAddToCart={addToCart}
                onAddToWishlist={addToWishlist}
                getRelatedProducts={getRelatedProducts}
                onRelatedProductClick={handleProductClick}
              />
            } />

            <Route path="/cart" element={
              <CartPage
                items={cartItems}
                onUpdateQuantity={updateCartQuantity}
                onRemoveItem={removeFromCart}
                onCheckout={handleCheckout}
                onContinueShopping={() => navigate('/')}
              />
            } />

            <Route path="/checkout" element={
              <CheckoutPage
                items={cartItems}
                onBack={() => { }}
                onPlaceOrder={handlePlaceOrder}
              />
            } />

            <Route path="/thank-you" element={
              <ThankYouPageWrapper
                orderData={orderData}
              />
            } />

            <Route path="/auth" element={<AuthPage />} />

            <Route path="/account" element={
              <ProtectedRoute>
                <AccountDashboardWrapper
                  user={user}
                  onLogout={handleLogout}
                />
              </ProtectedRoute>
            } />

            <Route path="/orders" element={
              <ProtectedRoute>
                <OrderHistoryPageWrapper />
              </ProtectedRoute>
            } />

            <Route path="/profile-settings" element={
              <ProtectedRoute>
                <ProfileSettingsPageWrapper
                  user={user}
                />
              </ProtectedRoute>
            } />

            <Route path="/address-book" element={
              <ProtectedRoute>
                <AddressBookPageWrapper />
              </ProtectedRoute>
            } />

            <Route path="/account-security" element={
              <ProtectedRoute>
                <AccountSecurityPageWrapper />
              </ProtectedRoute>
            } />

            <Route path="/offline" element={
              <OfflinePage
                onTryAgain={handleOfflineTryAgain}
                onGoHome={handleOfflineGoHome}
                onViewCart={handleOfflineViewCart}
                onDismiss={handleOfflineDismiss}
                cartItemCount={cartItemCount}
              />
            } />

            <Route path="/about" element={
              <AboutPageWrapper />
            } />

            <Route path="/contact" element={
              <ContactPageWrapper />
            } />

            <Route path="/returns" element={
              <ReturnsWarrantyPageWrapper />
            } />

            <Route path="/faq" element={
              <FAQPageWrapper />
            } />

            {/* Static policy/info pages driven by PageContent */}
            <Route path="/terms" element={<StaticPage pageKey="terms" titleFallback="Terms & Conditions" />} />
            <Route path="/privacy" element={<StaticPage pageKey="privacy" titleFallback="Privacy Policy" />} />
            <Route path="/cookies" element={<StaticPage pageKey="cookies" titleFallback="Cookie Policy" />} />
            <Route path="/shipping" element={<StaticPage pageKey="shipping" titleFallback="Shipping & Delivery" />} />
            <Route path="/dispute" element={<StaticPage pageKey="dispute" titleFallback="Dispute Resolution" />} />

            <Route path="/blog" element={
              <BlogPageWrapper />
            } />

            <Route path="/blog/:articleId" element={
              <BlogDetailWrapper />
            } />

            <Route path="/wishlist" element={
              <ProductListingPage
                onAddToCart={addToCart}
                onAddToWishlist={addToWishlist}
                onProductClick={handleProductClick}
              />
            } />

            {/* Catch-all route for 404 */}
            <Route path="*" element={
              <NotFoundPage
                onNavigateHome={() => { }}
                onNavigateCategory={() => { }}
                onSearch={() => { }}
              />
            } />
          </Routes>
        </main>

        {/* Footer (hide on admin routes) */}
        {!isAdminPath && <Footer />}

        {/* Shopping Cart Sidebar */}
        <ShoppingCart
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          items={cartItems}
          onUpdateQuantity={updateCartQuantity}
          onRemoveItem={removeFromCart}
          onCheckout={handleCheckout}
        />

        {/* Mini Wishlist */}
        <MiniWishlist
          isOpen={isWishlistOpen}
          onClose={() => setIsWishlistOpen(false)}
          items={wishlistItems}
          onRemoveItem={removeFromWishlist}
          onAddToCart={(item) => addToCart(item)}
          onProductClick={handleProductClick}
          onViewAll={() => {
            setIsWishlistOpen(false);
          }}
        />

        {/* Flash Sale Popup */}
        {showFlashSale && (
          <FlashSalePopup
            onClose={handleFlashSaleClose}
            onShopNow={handleFlashSaleShop}
          />
        )}

        {/* Chatbot (hide on admin routes) */}
        {!isAdminPath && (
          <Chatbot
            onAddToCart={addToCart}
            onProductClick={handleProductClick}
            cartItems={cartItems}
            wishlistItems={wishlistItems}
          />
        )}

        {/* Offline Page Overlay */}
        {showOfflinePage && (
          <div className="fixed inset-0 z-50 bg-white">
            <OfflinePage
              onTryAgain={handleOfflineTryAgain}
              onGoHome={handleOfflineGoHome}
              onViewCart={handleOfflineViewCart}
              onDismiss={handleOfflineDismiss}
              cartItemCount={cartItemCount}
            />
          </div>
        )}

        {/* Toast Notifications */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#343434',
              color: '#ffffff',
              border: 'none',
            },
          }}
        />
      </div>
  );
}

// Wrapper components to handle URL parameters
function HeaderWrapper({ cartItemCount, wishlistItemCount, onWishlistClick, user, onLogout }: any) {
  const navigate = useNavigate();

  const handleCategoryClick = (categorySlug: string) => {
    navigate(`/category/${categorySlug}`);
  };

  const handleSubcategoryClick = (categorySlug: string, subcategorySlug: string) => {
    navigate(`/category/${categorySlug}/${subcategorySlug}`);
  };

  const handleSearch = (query: string) => {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleNavigation = (view: string, data?: any) => {
    switch (view) {
      case 'home':
        navigate('/');
        break;
      case 'products':
        navigate('/products');
        break;
      case 'deals':
        navigate('/deals');
        break;
      case 'new-arrivals':
        navigate('/new-arrivals');
        break;
      case 'cart':
        navigate('/cart');
        break;
      case 'auth':
        navigate('/auth');
        break;
      case 'account-dashboard':
        {
          const hasAdminRole = Array.isArray(user?.roles)
            ? user.roles.some((r: any) => ['superadmin', 'admin'].includes((r?.name || '').toLowerCase()))
            : false;
          navigate(hasAdminRole ? '/admin' : '/account');
        }
        break;
      case 'order-history':
        navigate('/orders');
        break;
      case 'settings':
        navigate('/profile-settings');
        break;
      case 'about':
        navigate('/about');
        break;
      case 'contact':
        navigate('/contact');
        break;
      case 'returns':
        navigate('/returns');
        break;
      case 'faq':
        navigate('/faq');
        break;
      case 'blog':
        navigate('/blog');
        break;
      case 'category':
        if (data?.subcategory) {
          navigate(`/category/${data.category}/${data.subcategory}`);
        } else {
          navigate(`/category/${data.category}`);
        }
        break;
      default:
        navigate('/');
    }
  };

  return (
    <HeaderDynamic
      cartItemCount={cartItemCount}
      wishlistItemCount={wishlistItemCount}
      onCartClick={() => navigate('/cart')}
      onWishlistClick={onWishlistClick}
      onSearchClick={handleSearch}
      onCategoryClick={handleCategoryClick}
      onSubcategoryClick={handleSubcategoryClick}
      onNavigate={handleNavigation}
      user={user}
      onLogout={onLogout}
    />
  );
}

function CategoryPageWrapper({ onAddToCart, onAddToWishlist, onProductClick }: any) {
  const { categoryId, subcategory } = useParams();
  const navigate = useNavigate();

  return (
    <ProductListingPageDynamic
      category={categoryId}
      subcategory={subcategory}
      onAddToCart={onAddToCart}
      onAddToWishlist={onAddToWishlist}
      onProductClick={onProductClick}
      onBack={() => navigate('/')}
    />
  );
}

function SearchPageWrapper({ onAddToCart, onAddToWishlist, onProductClick }: any) {
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const query = searchParams.get('q') || '';

  return (
    <ProductListingPage
      searchQuery={query}
      onAddToCart={onAddToCart}
      onAddToWishlist={onAddToWishlist}
      onProductClick={onProductClick}
      onBack={() => navigate('/')}
    />
  );
}

function ProductDetailWrapper({ onAddToCart, onAddToWishlist }: any) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { getProduct } = useProducts();
  const [loading, setLoading] = useState(true);
  const [displayProduct, setDisplayProduct] = useState<any | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!slug) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const product = await getProduct(slug);
      if (!isMounted) return;
      if (product) {
        setDisplayProduct(transformProductForDisplay(product));
      } else {
        setDisplayProduct(null);
      }
      setLoading(false);
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [slug, getProduct]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="text-center text-muted-foreground">Loading product…</div>
      </div>
    );
  }

  if (!displayProduct) {
    return <NotFoundPage />;
  }

  return (
    <ProductDetailPage
      product={displayProduct as Product}
      onAddToCart={(p: Product, qty: number) => onAddToCart?.(p, qty)}
      onAddToWishlist={(p: Product) => onAddToWishlist?.(p)}
      onBack={() => navigate('/')}
      relatedProducts={[]}
      onRelatedProductClick={() => {}}
    />
  );
}

function BlogDetailWrapper() {
  const { articleId } = useParams();
  const navigate = useNavigate();

  return (
    <BlogDetailPage
      articleId={articleId}
      onBack={() => navigate('/blog')}
    />
  );
}

function AboutPageWrapper() {
  const navigate = useNavigate();
  return (
    <AboutPage
      onBack={() => navigate('/')}
    />
  );
}

function ContactPageWrapper() {
  const navigate = useNavigate();
  return (
    <ContactPage
      onBack={() => navigate('/')}
    />
  );
}

function ReturnsWarrantyPageWrapper() {
  const navigate = useNavigate();
  return (
    <ReturnsWarrantyPage
      onBack={() => navigate('/')}
    />
  );
}

function FAQPageWrapper() {
  const navigate = useNavigate();
  return (
    <FAQPage
      onBack={() => navigate('/')}
    />
  );
}

function BlogPageWrapper() {
  const navigate = useNavigate();
  return (
    <BlogPage
      onBack={() => navigate('/')}
    />
  );
}

function AccountDashboardWrapper({ user, onLogout }: any) {
  const navigate = useNavigate();

  return (
    <AccountDashboard
      user={user}
      onBack={() => navigate('/')}
      onNavigate={(view: string) => {
        switch (view) {
          case 'profile-settings':
            navigate('/profile-settings');
            break;
          case 'order-history':
            navigate('/orders');
            break;
          case 'address-book':
            navigate('/address-book');
            break;
          case 'account-security':
            navigate('/account-security');
            break;
          case 'wishlist':
            navigate('/wishlist');
            break;
          default:
            navigate('/');
        }
      }}
      onLogout={onLogout}
    />
  );
}

function ThankYouPageWrapper({ orderData }: { orderData?: any }) {
  const navigate = useNavigate();
  return (
    <ThankYouPage
      orderData={orderData}
      onContinueShopping={() => navigate('/')}
      onTrackOrder={() => navigate('/orders')}
    />
  );
}

function OrderHistoryPageWrapper() {
  const navigate = useNavigate();
  return (
    <OrderHistoryPage
      onBack={() => navigate('/account')}
    />
  );
}

function ProfileSettingsPageWrapper({ user }: any) {
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  return (
    <ProfileSettingsPage
      user={user}
      onBack={() => navigate('/account')}
      onUpdateUser={updateUser}
    />
  );
}

function AddressBookPageWrapper() {
  const navigate = useNavigate();
  return (
    <AddressBookPage
      onBack={() => navigate('/account')}
    />
  );
}

function AccountSecurityPageWrapper() {
  const navigate = useNavigate();
  return (
    <AccountSecurityPage
      onBack={() => navigate('/account')}
    />
  );
}

function DealsPageWrapper() {
  const navigate = useNavigate();
  return (
    <ComingSoonPage
      title="Deals"
      subtitle="Our best offers and limited-time promotions are on the way."
      onBack={() => navigate('/')}
    />
  );
}

function NewArrivalsPageWrapper() {
  const navigate = useNavigate();
  return (
    <ComingSoonPage
      title="New Arrivals"
      subtitle="Fresh products are coming soon. Check back for the latest drops."
      onBack={() => navigate('/')}
    />
  );
}
