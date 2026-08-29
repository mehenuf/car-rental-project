"use client";

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Fuel, Tables, Transmission, VehicleCategory } from "@/types/database";

export interface VehicleFormValues {
  slug: string;
  name: string;
  brand: string;
  category: VehicleCategory;
  price_per_day: number;
  seats: number;
  doors: number;
  transmission: Transmission;
  fuel: Fuel;
  image_url: string;
  description: string;
  stock: number;
  available: boolean;
}

const EMPTY_FORM: VehicleFormValues = {
  slug: "",
  name: "",
  brand: "",
  category: "popular",
  price_per_day: 0,
  seats: 5,
  doors: 4,
  transmission: "automatic",
  fuel: "petrol",
  image_url: "",
  description: "",
  stock: 3,
  available: true,
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function VehicleFormDialog({
  open,
  onOpenChange,
  vehicle,
  onSubmit,
  isSaving,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = create mode */
  vehicle: Tables<"vehicles"> | null;
  onSubmit: (values: VehicleFormValues) => void;
  isSaving: boolean;
  error: string | null;
}) {
  const [values, setValues] = useState<VehicleFormValues>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);

  // Reset the form whenever the dialog transitions from closed to open.
  // Adjusting state during render (rather than in an effect) avoids an
  // extra render pass — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValues(
        vehicle
          ? {
              slug: vehicle.slug,
              name: vehicle.name,
              brand: vehicle.brand,
              category: vehicle.category,
              price_per_day: vehicle.price_per_day,
              seats: vehicle.seats,
              doors: vehicle.doors,
              transmission: vehicle.transmission,
              fuel: vehicle.fuel,
              image_url: vehicle.image_url,
              description: vehicle.description ?? "",
              stock: vehicle.stock,
              available: vehicle.available,
            }
          : EMPTY_FORM
      );
      setSlugTouched(Boolean(vehicle));
    }
  }

  function set<K extends keyof VehicleFormValues>(key: K, value: VehicleFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleNameChange(name: string) {
    set("name", name);
    if (!slugTouched) set("slug", slugify(name));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
          <DialogDescription>
            {vehicle ? "Update this vehicle's details." : "Add a new vehicle to the fleet."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-(--space-sm)"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(values);
          }}
        >
          <div className="grid grid-cols-1 gap-(--space-xs) sm:grid-cols-2">
            <Field label="Name" htmlFor="v-name">
              <Input
                id="v-name"
                value={values.name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </Field>
            <Field label="Slug" htmlFor="v-slug">
              <Input
                id="v-slug"
                value={values.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value);
                }}
                required
              />
            </Field>
            <Field label="Brand" htmlFor="v-brand">
              <Input
                id="v-brand"
                value={values.brand}
                onChange={(e) => set("brand", e.target.value)}
                required
              />
            </Field>
            <Field label="Category" htmlFor="v-category">
              <Select
                value={values.category}
                onValueChange={(value) => set("category", value as VehicleCategory)}
              >
                <SelectTrigger id="v-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Popular</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="exclusive">Exclusive</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Price / day" htmlFor="v-price">
              <Input
                id="v-price"
                type="number"
                min={0}
                step="0.01"
                value={values.price_per_day}
                onChange={(e) => set("price_per_day", Number(e.target.value))}
                required
              />
            </Field>
            <Field label="Stock" htmlFor="v-stock">
              <Input
                id="v-stock"
                type="number"
                min={0}
                value={values.stock}
                onChange={(e) => set("stock", Number(e.target.value))}
                required
              />
            </Field>
            <Field label="Seats" htmlFor="v-seats">
              <Input
                id="v-seats"
                type="number"
                min={1}
                value={values.seats}
                onChange={(e) => set("seats", Number(e.target.value))}
                required
              />
            </Field>
            <Field label="Doors" htmlFor="v-doors">
              <Input
                id="v-doors"
                type="number"
                min={1}
                value={values.doors}
                onChange={(e) => set("doors", Number(e.target.value))}
                required
              />
            </Field>
            <Field label="Transmission" htmlFor="v-transmission">
              <Select
                value={values.transmission}
                onValueChange={(value) => set("transmission", value as Transmission)}
              >
                <SelectTrigger id="v-transmission" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="automatic">Automatic</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fuel" htmlFor="v-fuel">
              <Select value={values.fuel} onValueChange={(value) => set("fuel", value as Fuel)}>
                <SelectTrigger id="v-fuel" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="petrol">Petrol</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Image URL" htmlFor="v-image">
            <Input
              id="v-image"
              type="url"
              value={values.image_url}
              onChange={(e) => set("image_url", e.target.value)}
              placeholder="https://images.unsplash.com/..."
              required
            />
          </Field>

          <Field label="Description" htmlFor="v-description">
            <Textarea
              id="v-description"
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
            />
          </Field>

          <div className="flex items-center gap-2">
            <Switch
              id="v-available"
              checked={values.available}
              onCheckedChange={(checked) => set("available", checked)}
            />
            <Label htmlFor="v-available">Available for booking</Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="-mx-4 -mb-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
