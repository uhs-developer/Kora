import { gql } from 'urql';

// ========== ADMIN PRODUCTS ==========
export const GET_ADMIN_PRODUCTS = gql`
  query GetAdminProducts(
    $q: String
    $page: Int
    $perPage: Int
    $categoryId: ID
    $brandId: ID
    $status: String
    $sortBy: String
    $sortDir: String
  ) {
    adminProducts(
      q: $q
      page: $page
      perPage: $perPage
      categoryId: $categoryId
      brandId: $brandId
      status: $status
      sortBy: $sortBy
      sortDir: $sortDir
    ) {
      data {
        id
        sku
        name
        slug
        price
        stockQuantity
        isActive
        primaryImage
        category {
          id
          name
        }
        brand {
          id
          name
        }
        createdAt
        updatedAt
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

export const GET_ADMIN_PRODUCT = gql`
  query GetAdminProduct($id: ID!) {
    adminProduct(id: $id) {
      id
      sku
      name
      slug
      price
      stockQuantity
      isActive
      primaryImage
      category {
        id
        name
      }
      brand {
        id
        name
      }
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_PRODUCT = gql`
  mutation CreateProduct($input: CreateProductInput!) {
    createProduct(input: $input) {
      id
      sku
      name
      slug
      price
      stockQuantity
      isActive
    }
  }
`;

export const UPDATE_PRODUCT = gql`
  mutation UpdateProduct($id: ID!, $input: UpdateProductInput!) {
    updateProduct(id: $id, input: $input) {
      id
      sku
      name
      slug
      price
      stockQuantity
      isActive
    }
  }
`;

export const DELETE_PRODUCT = gql`
  mutation DeleteProduct($id: ID!) {
    deleteProduct(id: $id)
  }
`;

// ========== ADMIN CATEGORIES ==========
export const GET_ADMIN_CATEGORIES = gql`
  query GetAdminCategories($q: String, $page: Int, $perPage: Int) {
    adminCategories(q: $q, page: $page, perPage: $perPage) {
      data {
        id
        name
        slug
        parentId
        parent { id name }
        children { id name slug parentId }
        isActive
        createdAt
        updatedAt
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

export const CREATE_CATEGORY = gql`
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
      name
      slug
      isActive
    }
  }
`;

export const UPDATE_CATEGORY = gql`
  mutation UpdateCategory($id: ID!, $input: UpdateCategoryInput!) {
    updateCategory(id: $id, input: $input) {
      id
      name
      slug
      isActive
    }
  }
`;

export const DELETE_CATEGORY = gql`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;

// ========== ADMIN CUSTOMERS ==========
export const GET_ADMIN_CUSTOMERS = gql`
  query GetAdminCustomers($q: String, $page: Int, $perPage: Int, $groupId: ID) {
    adminCustomers(q: $q, page: $page, perPage: $perPage, groupId: $groupId) {
      data {
        id
        name
        email
        phone
        status
        roles {
          id
          name
        }
        createdAt
        lastLoginAt
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

export const CREATE_CUSTOMER = gql`
  mutation CreateCustomer($input: CreateCustomerInput!) {
    createCustomer(input: $input) {
      id
      name
      email
      status
    }
  }
`;

export const UPDATE_CUSTOMER = gql`
  mutation UpdateCustomer($id: ID!, $input: UpdateCustomerInput!) {
    updateCustomer(id: $id, input: $input) {
      id
      name
      email
      status
    }
  }
`;

export const DELETE_CUSTOMER = gql`
  mutation DeleteCustomer($id: ID!) {
    deleteCustomer(id: $id)
  }
`;

// ========== ADMIN ORDERS ==========
export const GET_ADMIN_ORDERS = gql`
  query GetAdminOrders(
    $q: String
    $page: Int
    $perPage: Int
    $status: String
    $paymentStatus: String
    $paymentMethod: String
    $shippingMethod: String
    $currency: String
    $minTotal: Float
    $maxTotal: Float
    $dateFrom: DateTime
    $dateTo: DateTime
    $customerEmail: String
    $customerName: String
  ) {
    adminOrders(
      q: $q
      page: $page
      perPage: $perPage
      status: $status
      paymentStatus: $paymentStatus
      paymentMethod: $paymentMethod
      shippingMethod: $shippingMethod
      currency: $currency
      minTotal: $minTotal
      maxTotal: $maxTotal
      dateFrom: $dateFrom
      dateTo: $dateTo
      customerEmail: $customerEmail
      customerName: $customerName
    ) {
      data {
        id
        orderNumber
        customer { id name email }
        status
        paymentStatus
        paymentMethod
        shippingMethod
        subtotal
        taxAmount
        shippingAmount
        discountAmount
        grandTotal
        currency
        createdAt
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

export const GET_ADMIN_ORDER = gql`
  query GetAdminOrder($id: ID!) {
    adminOrder(id: $id) {
      id
      orderNumber
      customer {
        id
        name
        email
      }
      status
      paymentStatus
      paymentMethod
      shippingMethod
      subtotal
      taxAmount
      shippingAmount
      discountAmount
      grandTotal
      currency
      items {
        id
        sku
        name
        quantity
        price
        rowTotal
        product {
          id
          name
          slug
          images {
            url
          }
        }
      }
      createdAt
    }
  }
`;

export const UPDATE_ORDER_STATUS = gql`
  mutation UpdateOrderStatus($id: ID!, $status: String!) {
    updateOrderStatus(id: $id, status: $status) {
      id
      status
    }
  }
`;

export const CANCEL_ORDER = gql`
  mutation CancelOrder($id: ID!, $reason: String) {
    cancelOrder(id: $id, reason: $reason) {
      id
      status
    }
  }
`;

// ========== ADMIN SHIPMENTS ==========
export const GET_ADMIN_SHIPMENTS = gql`
  query GetAdminShipments($orderId: ID, $page: Int, $perPage: Int) {
    adminShipments(orderId: $orderId, page: $page, perPage: $perPage) {
      data {
        id
        orderId
        trackingNumber
        carrier
        status
        createdAt
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

export const CREATE_SHIPMENT = gql`
  mutation CreateShipment($input: CreateShipmentInput!) {
    createShipment(input: $input) {
      id
      orderId
      trackingNumber
      carrier
      status
    }
  }
`;

// ========== ADMIN INVOICES ==========
export const GET_ADMIN_INVOICES = gql`
  query GetAdminInvoices(
    $q: String
    $orderId: ID
    $page: Int
    $perPage: Int
    $status: String
    $currency: String
    $minTotal: Float
    $maxTotal: Float
    $dateFrom: DateTime
    $dateTo: DateTime
  ) {
    adminInvoices(
      q: $q
      orderId: $orderId
      page: $page
      perPage: $perPage
      status: $status
      currency: $currency
      minTotal: $minTotal
      maxTotal: $maxTotal
      dateFrom: $dateFrom
      dateTo: $dateTo
    ) {
      data {
        id
        orderId
        invoiceNumber
        status
        grandTotal
        currency
        createdAt
        order { id orderNumber }
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

export const CREATE_INVOICE = gql`
  mutation CreateInvoice($orderId: ID!) {
    createInvoice(orderId: $orderId) {
      id
      invoiceNumber
      status
    }
  }
`;

// ========== ADMIN CREDIT MEMOS ==========
export const GET_ADMIN_CREDIT_MEMOS = gql`
  query GetAdminCreditMemos($orderId: ID, $page: Int, $perPage: Int) {
    adminCreditMemos(orderId: $orderId, page: $page, perPage: $perPage) {
      data {
        id
        orderId
        creditMemoNumber
        amount
        reason
        createdAt
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

export const CREATE_CREDIT_MEMO = gql`
  mutation CreateCreditMemo($input: CreateCreditMemoInput!) {
    createCreditMemo(input: $input) {
      id
      creditMemoNumber
      amount
    }
  }
`;

// ========== ADMIN USERS & ROLES ==========
export const GET_ADMIN_USERS = gql`
  query GetAdminUsers($q: String, $page: Int, $perPage: Int) {
    adminUsers(q: $q, page: $page, perPage: $perPage) {
      data {
        id
        name
        email
        roles {
          id
          name
        }
        status
        createdAt
        lastLoginAt
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

export const GET_ADMIN_ROLES = gql`
  query GetAdminRoles {
    adminRoles {
      id
      name
      slug
      permissions
    }
  }
`;

export const CREATE_ADMIN_USER = gql`
  mutation CreateAdminUser($input: CreateAdminUserInput!) {
    createAdminUser(input: $input) {
      id
      name
      email
    }
  }
`;

export const UPDATE_ADMIN_USER = gql`
  mutation UpdateAdminUser($id: ID!, $input: UpdateAdminUserInput!) {
    updateAdminUser(id: $id, input: $input) {
      id
      name
      email
      roles {
        id
        name
      }
      status
    }
  }
`;

export const DELETE_ADMIN_USER = gql`
  mutation DeleteAdminUser($id: ID!) {
    deleteAdminUser(id: $id)
  }
`;

// ========== DASHBOARD STATS ==========
export const GET_ADMIN_DASHBOARD_STATS = gql`
  query GetAdminDashboardStats {
    adminDashboardStats {
      totalRevenue
      totalOrders
      totalCustomers
      totalProducts
      recentOrders {
        id
        orderNumber
        status
        grandTotal
        createdAt
      }
    }
  }
`;

// ========== CONFIGURATION ==========
export const GET_ADMIN_TAX_RATES = gql`
  query GetAdminTaxRates($page: Int, $perPage: Int) {
    adminTaxRates(page: $page, perPage: $perPage) {
      data {
        id
        country
        state
        rate
        isActive
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

export const GET_ADMIN_SHIPPING_METHODS = gql`
  query GetAdminShippingMethods {
    adminShippingMethods {
      id
      name
      code
      isActive
      baseRate
    }
  }
`;

export const GET_ADMIN_COUPONS = gql`
  query GetAdminCoupons($page: Int, $perPage: Int) {
    adminCoupons(page: $page, perPage: $perPage) {
      data {
        id
        code
        discountType
        discountAmount
        isActive
        expiresAt
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

// ========== ATTRIBUTES ==========
export const GET_ADMIN_ATTRIBUTES = gql`
  query GetAdminAttributes($page: Int, $perPage: Int) {
    adminAttributes(page: $page, perPage: $perPage) {
      data {
        id
        code
        label
        type
        isRequired
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

// ========== CUSTOMER GROUPS ==========
export const GET_ADMIN_CUSTOMER_GROUPS = gql`
  query GetAdminCustomerGroups {
    adminCustomerGroups {
      id
      name
      discountPercent
    }
  }
`;

// ========== PROMOTIONS ==========
export const GET_ADMIN_PROMOTIONS = gql`
  query GetAdminPromotions($page: Int, $perPage: Int) {
    adminPromotions(page: $page, perPage: $perPage) {
      data {
        id
        name
        description
        discountType
        discountValue
        startsAt
        endsAt
        isActive
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

// ========== CMS ==========
export const GET_ADMIN_PAGES = gql`
  query GetAdminPages($page: Int, $perPage: Int) {
    adminPages(page: $page, perPage: $perPage) {
      data {
        id
        title
        slug
        content
        isActive
        createdAt
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

export const GET_ADMIN_BLOCKS = gql`
  query GetAdminBlocks($page: Int, $perPage: Int) {
    adminBlocks(page: $page, perPage: $perPage) {
      data {
        id
        identifier
        title
        content
        isActive
        createdAt
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

// ========== ADMIN BRANDS ==========
export const GET_ADMIN_BRANDS = gql`
  query GetAdminBrands(
    $q: String
    $page: Int
    $perPage: Int
  ) {
    adminBrands(
      q: $q
      page: $page
      perPage: $perPage
    ) {
      data {
        id
        name
        slug
        createdAt
        updatedAt
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

export const GET_ADMIN_BRAND = gql`
  query GetAdminBrand($id: ID!) {
    adminBrand(id: $id) {
      id
      name
      slug
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_BRAND = gql`
  mutation CreateBrand($input: CreateBrandInput!) {
    createBrand(input: $input) {
      id
      name
      slug
    }
  }
`;

export const UPDATE_BRAND = gql`
  mutation UpdateBrand($id: ID!, $input: UpdateBrandInput!) {
    updateBrand(id: $id, input: $input) {
      id
      name
      slug
    }
  }
`;

export const DELETE_BRAND = gql`
  mutation DeleteBrand($id: ID!) {
    deleteBrand(id: $id)
  }
`;

// Exchange Rates
export const GET_EXCHANGE_RATES = gql`
  query GetExchangeRates {
    adminExchangeRates {
      id
      codeFrom
      codeTo
      rate
      updatedAt
    }
  }
`;

export const CREATE_EXCHANGE_RATE = gql`
  mutation CreateExchangeRate($input: UpsertExchangeRateInput!) {
    createExchangeRate(input: $input) {
      id
      codeFrom
      codeTo
      rate
    }
  }
`;

export const UPDATE_EXCHANGE_RATE = gql`
  mutation UpdateExchangeRate($id: ID!, $input: UpsertExchangeRateInput!) {
    updateExchangeRate(id: $id, input: $input) {
      id
      codeFrom
      codeTo
      rate
    }
  }
`;

export const DELETE_EXCHANGE_RATE = gql`
  mutation DeleteExchangeRate($id: ID!) {
    deleteExchangeRate(id: $id)
  }
`;

// ========== CACHE ==========
export const FLUSH_CACHE = gql`
  mutation FlushCache($types: [String!]) {
    flushCache(types: $types)
  }
`;

// ========== SHIPPING METHODS ==========
export const GET_SHIPPING_METHODS = gql`
  query GetShippingMethods($isActive: Boolean) {
    shippingMethods(isActive: $isActive) {
      id
      name
      code
      description
      carrier
      type
      basePrice
      estimatedDaysMin
      estimatedDaysMax
      isActive
      sortOrder
      createdAt
      updatedAt
    }
  }
`;

export const GET_SHIPPING_METHOD = gql`
  query GetShippingMethod($id: ID!) {
    shippingMethod(id: $id) {
      id
      name
      code
      description
      carrier
      type
      basePrice
      estimatedDaysMin
      estimatedDaysMax
      isActive
      sortOrder
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_SHIPPING_METHOD = gql`
  mutation CreateShippingMethod($input: CreateShippingMethodInput!) {
    createShippingMethod(input: $input) {
      id
      name
      code
      type
      basePrice
    }
  }
`;

export const UPDATE_SHIPPING_METHOD = gql`
  mutation UpdateShippingMethod($id: ID!, $input: UpdateShippingMethodInput!) {
    updateShippingMethod(id: $id, input: $input) {
      id
      name
      code
      type
      basePrice
    }
  }
`;

export const DELETE_SHIPPING_METHOD = gql`
  mutation DeleteShippingMethod($id: ID!) {
    deleteShippingMethod(id: $id)
  }
`;

// ========== SHIPPING ROUTES ==========
export const GET_SHIPPING_ROUTES = gql`
  query GetShippingRoutes($originCountry: String, $destinationCountry: String, $isActive: Boolean) {
    shippingRoutes(originCountry: $originCountry, destinationCountry: $destinationCountry, isActive: $isActive) {
      id
      name
      code
      originCountry
      originCity
      destinationCountry
      destinationCity
      transitPoints
      description
      isActive
      sortOrder
      createdAt
      updatedAt
    }
  }
`;

export const GET_SHIPPING_ROUTE = gql`
  query GetShippingRoute($id: ID!) {
    shippingRoute(id: $id) {
      id
      name
      code
      originCountry
      originCity
      destinationCountry
      destinationCity
      transitPoints
      description
      isActive
      sortOrder
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_SHIPPING_ROUTE = gql`
  mutation CreateShippingRoute($input: CreateShippingRouteInput!) {
    createShippingRoute(input: $input) {
      id
      name
      code
      originCountry
      destinationCountry
    }
  }
`;

export const UPDATE_SHIPPING_ROUTE = gql`
  mutation UpdateShippingRoute($id: ID!, $input: UpdateShippingRouteInput!) {
    updateShippingRoute(id: $id, input: $input) {
      id
      name
      code
    }
  }
`;

export const DELETE_SHIPPING_ROUTE = gql`
  mutation DeleteShippingRoute($id: ID!) {
    deleteShippingRoute(id: $id)
  }
`;

// ========== SHIPPING METHOD ROUTE PRICING ==========
export const SET_METHOD_ROUTE_PRICE = gql`
  mutation SetMethodRoutePrice($input: SetMethodRoutePriceInput!) {
    setMethodRoutePrice(input: $input) {
      id
    }
  }
`;

// ========== SITE CONFIG ==========
export const GET_ADMIN_SITE_CONFIG = gql`
  query GetAdminSiteConfig {
    adminSiteConfig {
      contact {
        addressDubai
        addressKigali
        phoneDubai
        phoneKigali
        supportEmail
        ordersEmail
        whatsappNumber
        businessHours
      }
    }
  }
`;

export const UPDATE_SITE_CONFIG = gql`
  mutation UpdateSiteConfig($input: UpdateSiteConfigInput!) {
    updateSiteConfig(input: $input) {
      contact {
        addressDubai
        addressKigali
        phoneDubai
        phoneKigali
        supportEmail
        ordersEmail
        whatsappNumber
        businessHours
      }
    }
  }
`;

// ========== PAGE CONTENT MANAGEMENT ==========
export const GET_ADMIN_PAGE_CONTENTS = gql`
  query GetAdminPageContents {
    adminPageContents {
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

export const GET_ADMIN_PAGE_CONTENT = gql`
  query GetAdminPageContent($pageKey: String!) {
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

export const UPDATE_PAGE_CONTENT = gql`
  mutation UpdatePageContent($pageKey: String!, $input: UpdatePageContentInput!) {
    updatePageContent(pageKey: $pageKey, input: $input) {
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