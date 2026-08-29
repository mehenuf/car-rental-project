// Hand-written to match schema.sql. Regenerate/update this file whenever
// schema.sql changes (tables, views, or the refresh_daily_stats function).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type VehicleCategory = "popular" | "large" | "small" | "exclusive";
export type Transmission = "automatic" | "manual";
export type Fuel = "petrol" | "diesel" | "hybrid" | "electric";
export type PaymentMethod = "paypal" | "stripe" | "apple_pay" | "payu" | "paytm";
export type BookingStatus = "success" | "pending" | "cancelled";
export type BookingSource = "web" | "chat" | "phone";
export type BudgetBand = "low" | "mid" | "high" | "unknown";
export type Urgency = "immediate" | "this_week" | "browsing" | "unknown";

export interface Database {
  public: {
    Tables: {
      locations: {
        Row: {
          id: number;
          city: string;
          country: string;
          country_code: string;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          city: string;
          country: string;
          country_code: string;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          city?: string;
          country?: string;
          country_code?: string;
          created_at?: string | null;
        };
      };
      vehicles: {
        Row: {
          id: string;
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
          gallery: string[];
          description: string | null;
          features: string[];
          rating: number;
          review_count: number;
          stock: number;
          available: boolean;
          location_id: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          brand: string;
          category: VehicleCategory;
          price_per_day: number;
          seats?: number;
          doors?: number;
          transmission: Transmission;
          fuel: Fuel;
          image_url: string;
          gallery?: string[];
          description?: string | null;
          features?: string[];
          rating?: number;
          review_count?: number;
          stock?: number;
          available?: boolean;
          location_id?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          brand?: string;
          category?: VehicleCategory;
          price_per_day?: number;
          seats?: number;
          doors?: number;
          transmission?: Transmission;
          fuel?: Fuel;
          image_url?: string;
          gallery?: string[];
          description?: string | null;
          features?: string[];
          rating?: number;
          review_count?: number;
          stock?: number;
          available?: boolean;
          location_id?: number | null;
          created_at?: string | null;
        };
      };
      bookings: {
        Row: {
          id: string;
          reference: string;
          vehicle_id: string | null;
          customer_name: string;
          email: string;
          phone: string | null;
          pickup_location_id: number | null;
          dropoff_location_id: number | null;
          pickup_at: string;
          dropoff_at: string;
          /** Generated column (`greatest(1, extract(day from dropoff_at - pickup_at))`) — read-only. */
          days: number;
          total_amount: number;
          payment_method: PaymentMethod | null;
          status: BookingStatus;
          lead_score: number | null;
          source: BookingSource | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          reference: string;
          vehicle_id?: string | null;
          customer_name: string;
          email: string;
          phone?: string | null;
          pickup_location_id?: number | null;
          dropoff_location_id?: number | null;
          pickup_at: string;
          dropoff_at: string;
          total_amount: number;
          payment_method?: PaymentMethod | null;
          status?: BookingStatus;
          lead_score?: number | null;
          source?: BookingSource | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          reference?: string;
          vehicle_id?: string | null;
          customer_name?: string;
          email?: string;
          phone?: string | null;
          pickup_location_id?: number | null;
          dropoff_location_id?: number | null;
          pickup_at?: string;
          dropoff_at?: string;
          total_amount?: number;
          payment_method?: PaymentMethod | null;
          status?: BookingStatus;
          lead_score?: number | null;
          source?: BookingSource | null;
          created_at?: string | null;
        };
      };
      leads: {
        Row: {
          id: string;
          name: string | null;
          email: string | null;
          phone: string | null;
          intent_summary: string | null;
          budget_band: BudgetBand | null;
          urgency: Urgency | null;
          score: number;
          next_action: string | null;
          transcript: Json | null;
          source: string | null;
          notified: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name?: string | null;
          email?: string | null;
          phone?: string | null;
          intent_summary?: string | null;
          budget_band?: BudgetBand | null;
          urgency?: Urgency | null;
          score: number;
          next_action?: string | null;
          transcript?: Json | null;
          source?: string | null;
          notified?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string | null;
          email?: string | null;
          phone?: string | null;
          intent_summary?: string | null;
          budget_band?: BudgetBand | null;
          urgency?: Urgency | null;
          score?: number;
          next_action?: string | null;
          transcript?: Json | null;
          source?: string | null;
          notified?: boolean | null;
          created_at?: string | null;
        };
      };
      daily_stats: {
        Row: {
          date: string;
          revenue: number | null;
          sales_count: number | null;
          purchases: number | null;
        };
        Insert: {
          date: string;
          revenue?: number | null;
          sales_count?: number | null;
          purchases?: number | null;
        };
        Update: {
          date?: string;
          revenue?: number | null;
          sales_count?: number | null;
          purchases?: number | null;
        };
      };
    };
    Views: {
      v_best_sellers: {
        Row: {
          id: string;
          name: string;
          brand: string;
          image_url: string;
          price_per_day: number;
          sales_count: number;
          revenue: number;
        };
      };
      v_sales_by_country: {
        Row: {
          country: string;
          country_code: string;
          sales_count: number;
          revenue: number;
        };
      };
    };
    Functions: {
      refresh_daily_stats: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];

export type Views<T extends keyof PublicSchema["Views"]> =
  PublicSchema["Views"][T]["Row"];
