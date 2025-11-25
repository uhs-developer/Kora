import { useQuery, useMutation, gql } from 'urql';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { formatPrice } from '../../services/product';
import { toast } from 'sonner';
import { GET_ADMIN_PRODUCTS, DELETE_PRODUCT, GET_ADMIN_BRANDS } from '../../graphql/admin';
import { useNavigate } from 'react-router-dom';

// Query for filter options (categories)
const GET_ADMIN_CATEGORIES_SIMPLE = gql`
  query GetAdminCategoriesSimple {
    adminCategories(page: 1, perPage: 100) {
      data {
        id
        name
      }
    }
  }
`;

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL is not defined. Please configure it in your frontend .env file.');
}

const backendBaseUrl = apiBaseUrl
  .replace(/\/api\/?$/, '')
  .replace(/\/+$/, '');

export default function AdminProductsPageGraphQL() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'name'|'sku'|'price'|'stockQuantity'|'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  // Load filter options
  const [categoriesResult] = useQuery({ query: GET_ADMIN_CATEGORIES_SIMPLE });
  const [brandsResult] = useQuery({ query: GET_ADMIN_BRANDS });

  // Load products
  const [productsResult, reexecuteQuery] = useQuery({
    query: GET_ADMIN_PRODUCTS,
    variables: {
      q: search || undefined,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      status: status || undefined,
      page,
      perPage: 20,
      sortBy,
      sortDir,
    },
  });

  // Delete mutation
  const [, deleteProductMutation] = useMutation(DELETE_PRODUCT);

  // Auto-apply filters with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      reexecuteQuery({ requestPolicy: 'network-only' });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, categoryId, brandId, status]);

  const handleDelete = async (id: string) =>
    {
      if (confirm('Are you sure you want to delete this product?')) {
        const result = await deleteProductMutation({ id });
        if (result.error) {
          toast.error(result.error.message || 'Failed to delete product');
        } else {
          toast.success('Product deleted successfully');
          reexecuteQuery({ requestPolicy: 'network-only' });
        }
      }
    };

  const products = productsResult.data?.adminProducts?.data || [];
  const paginatorInfo = productsResult.data?.adminProducts?.paginatorInfo;
  const categories = categoriesResult.data?.adminCategories?.data || [];
  const brands = brandsResult.data?.adminBrands?.data || [];
  const loading = productsResult.fetching;

  const getProductImageUrl = (product: any) => {
    if (product.primaryImage) {
      if (product.primaryImage.startsWith('http')) {
        return product.primaryImage;
      }

      const normalizedPath = product.primaryImage.startsWith('/')
        ? product.primaryImage
        : `/${product.primaryImage}`;

      return `${backendBaseUrl}${normalizedPath}`;
    }
    return 'https://via.placeholder.com/100';
  };

  const toggleSort = (field: 'name'|'sku'|'price'|'stockQuantity'|'createdAt') => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
    reexecuteQuery({ requestPolicy: 'network-only' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold">Products</h2>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
          <select
            className="h-9 border rounded px-2 text-sm"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="h-9 border rounded px-2 text-sm"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
          >
            <option value="">All Brands</option>
            {brands.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            className="h-9 border rounded px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
          <Button variant="outline" onClick={() => navigate('/admin/products/new')}>
            Add Product
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2">Image</th>
                <th className="text-left px-4 py-2">
                  <button className="flex items-center gap-1" onClick={() => toggleSort('sku')}>
                    SKU {sortBy === 'sku' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </button>
                </th>
                <th className="text-left px-4 py-2">
                  <button className="flex items-center gap-1" onClick={() => toggleSort('name')}>
                    Name {sortBy === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </button>
                </th>
                <th className="text-left px-4 py-2">Brand</th>
                <th className="text-left px-4 py-2">Category</th>
                <th className="text-right px-4 py-2">
                  <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort('price')}>
                    Price {sortBy === 'price' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </button>
                </th>
                <th className="text-right px-4 py-2">
                  <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort('stockQuantity')}>
                    Qty {sortBy === 'stockQuantity' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </button>
                </th>
                <th className="text-right px-4 py-2">
                  <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort('createdAt')}>
                    Created {sortBy === 'createdAt' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </button>
                </th>
                <th className="text-right px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={10}>
                    Loading…
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={10}>
                    No products
                  </td>
                </tr>
              ) : (
                products.map((p: any) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2">
                      <img
                        src={getProductImageUrl(p)}
                        alt={p.name}
                        className="h-10 w-10 rounded object-cover border"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <code>{p.sku}</code>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <strong className="font-medium">{p.name}</strong>
                        {p.brand?.name && (
                          <small className="text-muted-foreground">{p.brand.name}</small>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">{p.brand?.name || '—'}</td>
                    <td className="px-4 py-2">{p.category?.name || '—'}</td>
                    <td className="px-4 py-2 text-right">{formatPrice(p.price)}</td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${
                          (p.stockQuantity ?? 0) > 10
                            ? 'bg-green-100 text-green-700'
                            : (p.stockQuantity ?? 0) > 0
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {p.stockQuantity ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${
                          p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/admin/products/${p.id}/edit`)}
                          title="Edit"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(p.id)}
                          title="Delete"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {paginatorInfo && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {paginatorInfo.currentPage} of {paginatorInfo.lastPage} ({paginatorInfo.total}{' '}
            total)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= paginatorInfo.lastPage}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

