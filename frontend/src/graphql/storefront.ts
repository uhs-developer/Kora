import { gql } from 'urql';

// ========== PAGE CONTENT (STOREFRONT) ==========
export const GET_PAGE_CONTENT = gql`
  query GetPageContent($pageKey: String!) {
    adminPageContent(pageKey: $pageKey) {
      id
      pageKey
      pageName
      sections {
        key
        label
        content
      }
      updatedAt
    }
  }
`;

// ========== FAQs (STOREFRONT) ==========
export const GET_FAQS = gql`
  query GetFaqs {
    faqs {
      id
      category
      categoryLabel
      question
      answer
    }
  }
`;

// ========== STOREFRONT CATEGORIES ==========
export const GET_STOREFRONT_CATEGORIES = gql`
  query GetStorefrontCategories {
    categories {
      id
      name
      slug
      image
      productCount
      children {
        id
        name
        slug
        productCount
      }
    }
  }
`;

export const GET_CATEGORIES_WITH_MIN_PRODUCTS = gql`
  query GetCategoriesWithMinProducts {
    categories {
      id
      name
      slug
      image
      productCount
      children {
        id
        name
        slug
        productCount
      }
    }
  }
`;

// ========== STOREFRONT PRODUCTS ==========
export const GET_STOREFRONT_PRODUCTS = gql`
  query GetStorefrontProducts(
    $q: String
    $page: Int
    $perPage: Int
    $categorySlug: String
    $brandSlug: String
    $brandIds: [ID!]
    $minPrice: Float
    $maxPrice: Float
    $inStock: Boolean
    $sortBy: String
  ) {
    products(
      q: $q
      page: $page
      perPage: $perPage
      categorySlug: $categorySlug
      brandSlug: $brandSlug
      brandIds: $brandIds
      minPrice: $minPrice
      maxPrice: $maxPrice
      inStock: $inStock
      sortBy: $sortBy
    ) {
      data {
        id
        sku
        name
        slug
        price
        specialPrice
        shortDescription
        description
        images {
          url
          label
          role
        }
        categories {
          id
          name
          slug
        }
        brand {
          id
          name
          slug
        }
      }
      paginatorInfo {
        currentPage
        lastPage
        perPage
        total
      }
    }
  }
`;

export const GET_PRODUCT_FILTERS = gql`
  query GetProductFilters(
    $q: String
    $categorySlug: String
    $brandSlug: String
    $brandIds: [ID!]
    $minPrice: Float
    $maxPrice: Float
    $inStock: Boolean
  ) {
    productFilters(
      q: $q
      categorySlug: $categorySlug
      brandSlug: $brandSlug
      brandIds: $brandIds
      minPrice: $minPrice
      maxPrice: $maxPrice
      inStock: $inStock
    ) {
      minPrice
      maxPrice
      categories {
        id
        name
        slug
        image
        productCount
        children {
          id
          name
          slug
          productCount
        }
      }
      brands {
        id
        name
        slug
      }
      availableFilters {
        hasInStockFilter
        priceRange {
          min
          max
        }
        categoryCount
        brandCount
      }
    }
  }
`;

export const GET_CATEGORY_PRODUCTS = gql`
  query GetCategoryProducts(
    $categorySlug: String!
    $page: Int
    $perPage: Int
  ) {
    products(
      categorySlug: $categorySlug
      page: $page
      perPage: $perPage
    ) {
      data {
        id
        sku
        name
        slug
        price
        specialPrice
        shortDescription
        images {
          url
          label
          role
        }
        brand {
          id
          name
          slug
        }
      }
      paginatorInfo {
        currentPage
        lastPage
        perPage
        total
      }
    }
  }
`;

// ========== FEATURED PRODUCTS ==========
export const GET_FEATURED_PRODUCTS = gql`
  query GetFeaturedProducts($perPage: Int, $isFeatured: Boolean) {
    products(perPage: $perPage, isFeatured: $isFeatured) {
      data {
        id
        sku
        name
        slug
        price
        specialPrice
        shortDescription
        description
        images {
          url
          label
          role
        }
        categories {
          id
          name
          slug
        }
        brand {
          id
          name
          slug
        }
      }
      paginatorInfo {
        currentPage
        lastPage
        perPage
        total
      }
    }
  }
`;

// ========== STOREFRONT BRANDS ==========
export const GET_BRANDS = gql`
  query GetBrands {
    brands {
      id
      name
      slug
    }
  }
`;

// ========== CURRENT USER ==========
export const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    me {
      id
      name
      email
      addresses {
        firstname
        lastname
        street
        city
        region
        postcode
        country
        telephone
      }
    }
  }
`;

// ========== CART OPERATIONS ==========
export const GET_CART = gql`
  query GetCart($session_id: String) {
    cart(session_id: $session_id) {
      id
      items {
        id
        product {
          id
          sku
          name
          slug
          price
          specialPrice
          images {
            url
            label
            role
          }
          brand {
            id
            name
            slug
          }
        }
        sku
        name
        quantity
        price
        row_total
        custom_options
      }
      subtotal
      discount_amount
      tax_amount
      shipping_amount
      grand_total
      coupon_code
      currency
    }
  }
`;

export const ADD_TO_CART = gql`
  mutation AddToCart($product_id: ID!, $quantity: Int!, $custom_options: String, $session_id: String) {
    addToCart(product_id: $product_id, quantity: $quantity, custom_options: $custom_options, session_id: $session_id) {
      id
      items {
        id
        product {
          id
          sku
          name
          slug
          price
          specialPrice
          images {
            url
            label
            role
          }
          brand {
            id
            name
            slug
          }
        }
        sku
        name
        quantity
        price
        row_total
        custom_options
      }
      subtotal
      discount_amount
      tax_amount
      shipping_amount
      grand_total
      coupon_code
      currency
    }
  }
`;

export const UPDATE_CART_ITEM = gql`
  mutation UpdateCartItem($cart_item_id: ID!, $quantity: Int!, $session_id: String) {
    updateCartItem(cart_item_id: $cart_item_id, quantity: $quantity, session_id: $session_id) {
      id
      items {
        id
        product {
          id
          sku
          name
          slug
          price
          specialPrice
          images {
            url
            label
            role
          }
          brand {
            id
            name
            slug
          }
        }
        sku
        name
        quantity
        price
        row_total
        custom_options
      }
      subtotal
      discount_amount
      tax_amount
      shipping_amount
      grand_total
      coupon_code
      currency
    }
  }
`;

export const REMOVE_CART_ITEM = gql`
  mutation RemoveCartItem($cart_item_id: ID!, $session_id: String) {
    removeCartItem(cart_item_id: $cart_item_id, session_id: $session_id) {
      id
      items {
        id
        product {
          id
          sku
          name
          slug
          price
          specialPrice
          images {
            url
            label
            role
          }
          brand {
            id
            name
            slug
          }
        }
        sku
        name
        quantity
        price
        row_total
        custom_options
      }
      subtotal
      discount_amount
      tax_amount
      shipping_amount
      grand_total
      coupon_code
      currency
    }
  }
`;

// ========== CHECKOUT OPERATIONS ==========
export const PLACE_ORDER = gql`
  mutation PlaceOrder(
    $payment_method: String!
    $shipping_method: String!
    $billing_address: AddressInput!
    $shipping_address: AddressInput!
    $customer_note: String
  ) {
    placeOrder(
      payment_method: $payment_method
      shipping_method: $shipping_method
      billing_address: $billing_address
      shipping_address: $shipping_address
      customer_note: $customer_note
    ) {
      id
      order_number
      status
      payment_status
      payment_method
      shipping_method
      items {
        id
        product {
          id
          sku
          name
          slug
          price
          images {
            url
            label
            role
          }
        }
        sku
        name
        quantity
        price
        row_total
      }
      subtotal
      discount_amount
      tax_amount
      shipping_amount
      grand_total
      currency
      customer_note
      created_at
    }
  }
`;

export const MY_ORDERS = gql`
  query MyOrders($page: Int, $perPage: Int) {
    myOrders(page: $page, perPage: $perPage) {
      data {
        id
        order_number
        status
        payment_status
        payment_method
        shipping_method
        items {
          id
          sku
          name
          quantity
          price
          row_total
          product {
            id
            name
            slug
            images {
              url
            }
          }
        }
        subtotal
        discount_amount
        tax_amount
        shipping_amount
        grand_total
        currency
        customer_note
        created_at
      }
      paginatorInfo {
        currentPage
        lastPage
        perPage
        total
      }
    }
  }
`;

export const MY_ORDER = gql`
  query MyOrder($order_number: String!) {
    myOrder(order_number: $order_number) {
      id
      order_number
      status
      payment_status
      payment_method
      shipping_method
      items {
        id
        sku
        name
        quantity
        price
        row_total
        product {
          id
          name
          slug
          images {
            url
          }
        }
      }
      subtotal
      discount_amount
      tax_amount
      shipping_amount
      grand_total
      currency
      customer_note
      created_at
    }
  }
`;

export const INITIALIZE_PAYMENT = gql`
  mutation InitializePayment(
    $order_number: String!
    $payment_method: String
    $customer_phone: String
    $mobile_number: String
    $encrypted_card_number: String
    $encrypted_expiry_month: String
    $encrypted_expiry_year: String
    $encrypted_cvv: String
    $nonce: String
  ) {
    initializePayment(
      order_number: $order_number
      payment_method: $payment_method
      customer_phone: $customer_phone
      mobile_number: $mobile_number
      encrypted_card_number: $encrypted_card_number
      encrypted_expiry_month: $encrypted_expiry_month
      encrypted_expiry_year: $encrypted_expiry_year
      encrypted_cvv: $encrypted_cvv
      nonce: $nonce
    ) {
      payment_url
      transaction_id
      charge_id
      status
      next_action
      order_number
    }
  }
`;
