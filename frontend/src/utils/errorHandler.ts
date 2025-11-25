/**
 * Utility functions for handling and formatting errors
 * Converts raw GraphQL/API errors into user-friendly messages
 */

interface GraphQLError {
  message?: string;
  extensions?: {
    category?: string;
    code?: string;
    validation?: Record<string, string[]>;
  };
}

interface ErrorResponse {
  error?: {
    message?: string;
    graphQLErrors?: GraphQLError[];
    networkError?: {
      message?: string;
    };
  };
  message?: string;
}

/**
 * Extract user-friendly error message from GraphQL error response
 */
export function getErrorMessage(error: any): string {
  // If it's already a string, return it
  if (typeof error === 'string') {
    return error;
  }

  // If it's an Error object, check the message
  if (error instanceof Error) {
    const message = error.message;
    
    // Check if it's a GraphQL error format
    if (message.includes('[GraphQL]')) {
      return extractGraphQLError(message);
    }
    
    return message;
  }

  // Handle urql error structure (error.error contains the actual error)
  if (error?.error) {
    // urql wraps errors in error.error
    const urqlError = error.error;
    
    // Check for GraphQL errors array
    if (urqlError.graphQLErrors && Array.isArray(urqlError.graphQLErrors) && urqlError.graphQLErrors.length > 0) {
      const firstError = urqlError.graphQLErrors[0];
      
      // Check for validation errors
      if (firstError.extensions?.validation) {
        const validationErrors = Object.values(firstError.extensions.validation).flat();
        if (validationErrors.length > 0) {
          return validationErrors[0];
        }
      }
      
      // Check for specific error codes
      if (firstError.extensions?.code) {
        return getMessageForErrorCode(firstError.extensions.code, firstError.message);
      }
      
      // Use the error message (this is the most important - it contains our backend error message)
      if (firstError.message) {
        // For order status transition errors, return the message as-is (it's already user-friendly)
        const message = extractGraphQLError(firstError.message);
        return message;
      }
    }
    
    // Check network error
    if (urqlError.networkError) {
      const networkMsg = urqlError.networkError.message || urqlError.networkError;
      if (typeof networkMsg === 'string' && networkMsg.includes('Failed to fetch')) {
        return 'Network error. Please check your internet connection and try again.';
      }
      return 'Network error. Please check your internet connection and try again.';
    }
    
    // Check direct message
    if (urqlError.message) {
      return extractGraphQLError(urqlError.message);
    }
  }
  
  // Handle urql result.error format (direct error property from mutation result)
  // This is the format returned by useMutation: { error: { graphQLErrors: [...] } }
  if (error?.graphQLErrors && Array.isArray(error.graphQLErrors) && error.graphQLErrors.length > 0) {
    const firstError = error.graphQLErrors[0];
    if (firstError.message) {
      return extractGraphQLError(firstError.message);
    }
  }

  // Handle urql mutation result.error format (direct error property from mutation result)
  // This is the format: { error: { graphQLErrors: [...] } }
  if (error?.graphQLErrors && Array.isArray(error.graphQLErrors) && error.graphQLErrors.length > 0) {
    const firstError = error.graphQLErrors[0];
    
    // Check for validation errors
    if (firstError.extensions?.validation) {
      const validationErrors = Object.values(firstError.extensions.validation).flat();
      if (validationErrors.length > 0) {
        return validationErrors[0];
      }
    }
    
    // Use the error message (this contains our backend error message)
    if (firstError.message) {
      return extractGraphQLError(firstError.message);
    }
  }
  
  // Handle direct message property (could be from Error object or string)
  if (error?.message) {
    return extractGraphQLError(error.message);
  }

  // Default fallback
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Extract user-friendly message from GraphQL error string
 */
function extractGraphQLError(message: string): string {
  // Remove [GraphQL] prefix
  let cleanMessage = message.replace(/\[GraphQL\]\s*/i, '');
  
  // PRIORITY: Check for order status transition errors FIRST (these are already user-friendly)
  // Don't map these to generic messages - they contain specific, actionable information
  if (cleanMessage.toLowerCase().includes("sorry, the order status can't be updated") ||
      cleanMessage.toLowerCase().includes("sorry, you can't") ||
      cleanMessage.toLowerCase().includes("cannot transition") ||
      cleanMessage.toLowerCase().includes("cannot move order") ||
      cleanMessage.toLowerCase().includes("cannot cancel") ||
      cleanMessage.toLowerCase().includes("payment is still pending") ||
      cleanMessage.toLowerCase().includes("payment status is") ||
      cleanMessage.toLowerCase().includes("valid status changes") ||
      cleanMessage.toLowerCase().includes("valid transitions")) {
    // Return as-is - these are already user-friendly messages from the backend
    return cleanMessage;
  }
  
  // Map common GraphQL errors to user-friendly messages (only if not an order status error)
  const errorMappings: Record<string, string> = {
    'Internal server error': 'Something went wrong on our end. Please try again or contact support.',
    'Unauthenticated': 'Please log in to continue.',
    'Unauthorized': 'You do not have permission to perform this action.',
    'Validation failed': 'Please check your input and try again.',
    'Not found': 'The requested resource was not found.',
  };

  // Check for exact matches (but skip if it's an order status error)
  for (const [key, value] of Object.entries(errorMappings)) {
    if (cleanMessage.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // Map payment-specific errors
  if (cleanMessage.toLowerCase().includes('payment')) {
    if (cleanMessage.toLowerCase().includes('failed') || cleanMessage.toLowerCase().includes('error')) {
      return 'Payment processing failed. Please check your payment details and try again.';
    }
    if (cleanMessage.toLowerCase().includes('expired')) {
      return 'Your card has expired. Please use a different payment method.';
    }
    if (cleanMessage.toLowerCase().includes('encrypt') || cleanMessage.toLowerCase().includes('decrypt')) {
      return 'Card encryption error. Please verify your card details and try again.';
    }
    if (cleanMessage.toLowerCase().includes('invalid')) {
      return 'Invalid payment information. Please check your card details.';
    }
  }

  // Map order-specific errors
  if (cleanMessage.toLowerCase().includes('order')) {
    if (cleanMessage.toLowerCase().includes('not found')) {
      return 'Order not found. Please check your order number.';
    }
    if (cleanMessage.toLowerCase().includes('already')) {
      return 'This order has already been processed.';
    }
    // Order status transition errors
    if (cleanMessage.toLowerCase().includes('cannot transition')) {
      return cleanMessage; // Return the full message as it's already user-friendly
    }
    if (cleanMessage.toLowerCase().includes('cannot move order')) {
      return cleanMessage; // Return the full message as it's already user-friendly
    }
    if (cleanMessage.toLowerCase().includes('cannot cancel')) {
      return cleanMessage; // Return the full message as it's already user-friendly
    }
    if (cleanMessage.toLowerCase().includes('payment status')) {
      return cleanMessage; // Return the full message as it's already user-friendly
    }
    if (cleanMessage.toLowerCase().includes('refund')) {
      return cleanMessage; // Return the full message as it's already user-friendly
    }
  }

  // Map cart-specific errors
  if (cleanMessage.toLowerCase().includes('cart')) {
    if (cleanMessage.toLowerCase().includes('empty')) {
      return 'Your cart is empty. Please add items before checkout.';
    }
  }

  // Return cleaned message if no mapping found
  return cleanMessage || 'An error occurred. Please try again.';
}

/**
 * Get user-friendly message for specific error codes
 */
function getMessageForErrorCode(code: string, defaultMessage?: string): string {
  const codeMappings: Record<string, string> = {
    'UNAUTHENTICATED': 'Please log in to continue.',
    'UNAUTHORIZED': 'You do not have permission to perform this action.',
    'FORBIDDEN': 'Access denied.',
    'NOT_FOUND': 'The requested resource was not found.',
    'VALIDATION_ERROR': 'Please check your input and try again.',
    'INTERNAL_SERVER_ERROR': 'Something went wrong on our end. Please try again.',
    'BAD_REQUEST': 'Invalid request. Please check your input.',
    'PAYMENT_FAILED': 'Payment processing failed. Please try again or use a different payment method.',
    'CARD_EXPIRED': 'Your card has expired. Please use a different payment method.',
    'CARD_DECLINED': 'Your card was declined. Please use a different payment method.',
    'INSUFFICIENT_FUNDS': 'Insufficient funds. Please use a different payment method.',
    'INVALID_CARD': 'Invalid card details. Please check and try again.',
  };

  return codeMappings[code] || defaultMessage || 'An error occurred. Please try again.';
}

/**
 * Format success message for different actions
 */
export function getSuccessMessage(action: string, details?: any): string {
  const messages: Record<string, string> = {
    'order_placed': `Order ${details?.orderNumber || ''} placed successfully!`,
    'payment_initiated': 'Payment initiated successfully. Please complete the payment.',
    'payment_redirect': 'Redirecting to payment gateway...',
    'payment_pending': 'Payment initiated. Please check your mobile device to authorize.',
    'cart_updated': 'Cart updated successfully.',
    'item_added': 'Item added to cart.',
    'item_removed': 'Item removed from cart.',
  };

  return messages[action] || 'Action completed successfully.';
}

