"use client";

interface ImageGridProps {
  images: string[];
  onImageClick?: (index: number) => void;
}

export function ImageGrid({ images, onImageClick }: ImageGridProps) {
  if (!images || images.length === 0) return null;

  const getGridClass = () => {
    switch (images.length) {
      case 1:
        return "grid-cols-1";
      case 2:
        return "grid-cols-2 aspect-[2/1]";
      case 3:
      case 4:
        return "grid-cols-2 aspect-[4/3]";
      default:
        return "grid-cols-2 aspect-[4/3]";
    }
  };

  const getImageClass = (index: number, total: number) => {
    if (total === 1) return "aspect-auto max-h-[500px] w-full rounded-2xl";
    if (total === 3 && index === 0) return "row-span-2 h-full rounded-l-2xl border-r border-[var(--bg)]";
    if (total === 3 && index === 1) return "rounded-tr-2xl border-b border-[var(--bg)]";
    if (total === 3 && index === 2) return "rounded-br-2xl";
    
    if (total === 2 && index === 0) return "rounded-l-2xl border-r border-[var(--bg)]";
    if (total === 2 && index === 1) return "rounded-r-2xl";

    if (total === 4) {
      if (index === 0) return "rounded-tl-2xl border-r border-b border-[var(--bg)]";
      if (index === 1) return "rounded-tr-2xl border-b border-[var(--bg)]";
      if (index === 2) return "rounded-bl-2xl border-r border-[var(--bg)]";
      if (index === 3) return "rounded-br-2xl";
    }

    return "";
  };

  return (
    <div className={`mt-3 grid gap-[2px] overflow-hidden rounded-2xl ${getGridClass()}`}>
      {images.slice(0, 4).map((img, idx) => (
        <button
          key={idx}
          onClick={(e) => {
            e.stopPropagation();
            onImageClick?.(idx);
          }}
          className={`relative block w-full h-full overflow-hidden outline-none ${getImageClass(idx, images.length)}`}
        >
          <img
            src={img}
            alt="Post content"
            className="w-full h-full object-cover hover:opacity-90 transition-opacity"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
}
