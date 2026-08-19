import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { HorseIcon } from '@/components/ui/horse-icon.jsx';
import { apiFetchBlob } from '@/lib/apiClient.js';
import { cn } from '@/lib/utils.js';

/**
 * Portrait cheval : photo téléversée (auth) ou placeholder si aucune photo.
 *
 * @param {{
 *   horse: { id: string, photoUrl?: string | null },
 *   className?: string,
 *   alt?: string,
 * }} props
 */
export function HorsePortrait({ horse, className, alt = '' }) {
  const hasUpload = Boolean(horse?.photoUrl);
  const { data: blob } = useQuery({
    queryKey: ['horse-photo-blob', horse?.id, horse?.photoUrl],
    queryFn: () => apiFetchBlob(`/horses/${horse.id}/photo`),
    enabled: Boolean(horse?.id && hasUpload),
    staleTime: 5 * 60 * 1000,
  });

  const [objectUrl, setObjectUrl] = useState(/** @type {string | null} */ (null));
  useEffect(() => {
    if (!blob) {
      setObjectUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  if (!objectUrl) {
    return (
      <span
        className={cn('flex items-center justify-center bg-paper text-muted-on-card', className)}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      >
        <HorseIcon className="size-[45%]" />
      </span>
    );
  }

  return <img src={objectUrl} alt={alt} className={cn('object-cover', className)} />;
}
