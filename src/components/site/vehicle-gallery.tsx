"use client";

import { useState } from "react";
import { VehicleImage } from "@/components/site/vehicle-image";
import { cn } from "@/lib/utils";

export function VehicleGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const safeImages = images.length > 0 ? images : [];
  const activeSrc = safeImages[active] ?? safeImages[0];

  return (
    <div className="flex flex-col gap-(--space-xs)">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-muted">
        {activeSrc && (
          <VehicleImage
            key={activeSrc}
            src={activeSrc}
            alt={name}
            fill
            sizes="(min-width: 1024px) 700px, 100vw"
            className="object-cover"
            priority
          />
        )}
      </div>
      {safeImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {safeImages.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-lg ring-2 transition-all",
                i === active ? "ring-accent" : "ring-transparent opacity-70 hover:opacity-100"
              )}
            >
              <VehicleImage src={src} alt={`${name} thumbnail ${i + 1}`} fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
