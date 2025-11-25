import { createClient, fetchExchange } from 'urql';

const graphqlUrl = import.meta.env.VITE_GRAPHQL_URL;

if (!graphqlUrl) {
  throw new Error('VITE_GRAPHQL_URL is not defined. Please configure it in your frontend .env file.');
}

export const graphqlClient = createClient({
  url: graphqlUrl,
  fetchOptions: () => {
    // Check both token keys for backward compatibility
    const token = localStorage.getItem('rwanda-dubai-token') || localStorage.getItem('auth_token');
    return {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
  },
  exchanges: [fetchExchange],
});

