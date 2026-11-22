import { useState } from 'react';
import { Code2, Smartphone, Terminal, Layers, Box } from 'lucide-react';
import type { ProductCategory } from '../types';
import { isSafeHttpUrl } from '../lib/sanitize';

interface ProductImageProps {
  src?: string;
  alt: string;
  category: ProductCategory;
  className?: string;
}

export function ProductImage({ src, alt, category, className = '' }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  const Icon =
    category === 'apk'
      ? Smartphone
      : category === 'scripts'
      ? Terminal
      : category === 'tools'
      ? Code2
      : category === 'assets'
      ? Layers
      : Box;

  if (!src || failed || !isSafeHttpUrl(src)) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#131C31] to-[#0B1120] text-slate-400 p-4 ${className}`}
        role="img"
        aria-label={alt}
      >
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/80 p-3 text-amber-400 mb-2">
          <Icon className="h-7 w-7" />
        </div>
        <span className="text-xs font-medium text-slate-300 text-center line-clamp-2 max-w-[80%]">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
