'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ShareRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const shareToken = params?.shareToken as string;

  useEffect(() => {
    if (shareToken) {
      router.replace(`/sets/share/${shareToken}`);
    }
  }, [shareToken, router]);

  return null;
}
