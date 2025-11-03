import React, { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { apiClient } from '../api/client.js';

export default function PlaidLinkButton({ onSuccess }) {
  const [linkToken, setLinkToken] = useState(null);

  useEffect(() => {
    apiClient.post('/plaid/create_link_token').then((res) => {
      setLinkToken(res.data.link_token);
    });
  }, []);

  const onSuccessHandler = useCallback(
    (publicToken, metadata) => {
      apiClient
        .post('/plaid/exchange_public_token', { public_token: publicToken })
        .then((res) => {
          onSuccess?.(res.data, metadata);
        });
    },
    [onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onSuccessHandler,
  });

  return (
    <button onClick={() => open()} disabled={!ready} className="btn">
      {ready ? 'Connect a bank account' : 'Loading...'}
    </button>
  );
}
