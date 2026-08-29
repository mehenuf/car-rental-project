"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { Car } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Drop-in replacement for next/image, used everywhere a vehicle photo
 * renders. A handful of seeded Unsplash URLs 404 (upstream, not something
 * we control), which otherwise shows as a blank broken-image box — this
 * swaps in a car-icon placeholder instead so a dead image never reads as
 * "the page is broken."
 */
export function VehicleImage({ className, fill, alt, ...props }: ImageProps) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          fill && "absolute inset-0",
          className
        )}
      >
        <Car className="size-6" aria-hidden />
      </div>
    );
  }

  return (
    <Image
      {...props}
      alt={alt}
      fill={fill}
      className={className}
      onError={() => setErrored(true)}
    />
  );
}
