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
export type BookingStatus = "pending" | "confirmed" | "active" | "completed" | "cancelled" | "no_show";
export type ProviderType = "company" | "individual";
export type ProviderStatus = "draft" | "submitted" | "under_review" | "approved" | "rejected" | "suspended";
export type MemberRole = "owner" | "manager" | "agent";
export type FleetUnitStatus = "active" | "maintenance" | "retired";
export type OccupancyReason = "booking" | "maintenance" | "transfer" | "owner_block";

/** Insert shape helper: everything optional except the listed required keys. */
type InsertOf<Row, Required extends keyof Row> = Partial<Row> & Pick<Row, Required>;

export type ProviderRow = {
  id: string;
  type: ProviderType;
  legal_name: string;
  display_name: string;
  country_code: string;
  default_currency: string;
  status: ProviderStatus;
  commission_rate_override: number | null;
  created_at: string;
}

export type BranchRow = {
  id: number;
  provider_id: string;
  code: string;
  name: string;
  city: string;
  country: string;
  country_code: string;
  address: string | null;
  timezone: string;
  currency: string;
  turnaround_minutes: number;
  opening_hours: Json | null;
  is_active: boolean;
  created_at: string;
}

export type ProviderMemberRow = {
  provider_id: string;
  user_id: string;
  role: MemberRole;
  branch_id: number | null;
  created_at: string;
}

export type FleetUnitRow = {
  id: string;
  provider_id: string;
  branch_id: number;
  vehicle_id: string;
  plate: string;
  vin: string | null;
  mileage_km: number;
  status: FleetUnitStatus;
  requires_window: boolean;
  created_at: string;
}

/** `during` is a Postgres tstzrange in its text form, e.g. `["2030-01-01 00:00:00+00","2030-01-02 00:00:00+00")`. */
export type AvailabilityWindowRow = {
  id: string;
  fleet_unit_id: string;
  provider_id: string;
  during: string;
}

export type UnitOccupancyRow = {
  id: string;
  fleet_unit_id: string;
  provider_id: string;
  reason: OccupancyReason;
  booking_id: string | null;
  during: string;
  created_at: string;
}

export type BookingRow = {
  id: string;
  reference: string;
  vehicle_id: string | null;
  customer_name: string;
  email: string;
  phone: string | null;
  pickup_location_id: number | null;
  dropoff_location_id: number | null;
  guest_id: string | null;
  user_id: string | null;
  provider_id: string | null;
  fleet_unit_id: string | null;
  pickup_branch_id: number | null;
  dropoff_branch_id: number | null;
  currency: string | null;
  pickup_at: string;
  dropoff_at: string;
  /** Generated column (`greatest(1, extract(day from dropoff_at - pickup_at))`), read-only. */
  days: number;
  total_amount: number;
  payment_method: PaymentMethod | null;
  status: BookingStatus;
  lead_score: number | null;
  source: BookingSource | null;
  created_at: string | null;
}
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
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: "vehicles_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      providers: {
        Row: ProviderRow;
        Insert: InsertOf<ProviderRow, "type" | "legal_name" | "display_name" | "country_code" | "default_currency">;
        Update: Partial<ProviderRow>;
        Relationships: [];
      };
      branches: {
        Row: BranchRow;
        Insert: InsertOf<BranchRow, "provider_id" | "code" | "name" | "city" | "country" | "country_code" | "currency">;
        Update: Partial<BranchRow>;
        Relationships: [];
      };
      provider_members: {
        Row: ProviderMemberRow;
        Insert: InsertOf<ProviderMemberRow, "provider_id" | "user_id" | "role">;
        Update: Partial<ProviderMemberRow>;
        Relationships: [];
      };
      fleet_units: {
        Row: FleetUnitRow;
        Insert: InsertOf<FleetUnitRow, "provider_id" | "branch_id" | "vehicle_id" | "plate">;
        Update: Partial<FleetUnitRow>;
        Relationships: [];
      };
      availability_windows: {
        Row: AvailabilityWindowRow;
        Insert: InsertOf<AvailabilityWindowRow, "fleet_unit_id" | "provider_id" | "during">;
        Update: Partial<AvailabilityWindowRow>;
        Relationships: [];
      };
      unit_occupancy: {
        Row: UnitOccupancyRow;
        Insert: InsertOf<UnitOccupancyRow, "fleet_unit_id" | "provider_id" | "reason" | "during">;
        Update: Partial<UnitOccupancyRow>;
        Relationships: [];
      };
      bookings: {
        Row: BookingRow;
        Insert: {
          id?: string;
          reference: string;
          vehicle_id?: string | null;
          customer_name: string;
          email: string;
          phone?: string | null;
          pickup_location_id?: number | null;
          dropoff_location_id?: number | null;
          provider_id?: string | null;
          fleet_unit_id?: string | null;
          pickup_branch_id?: number | null;
          dropoff_branch_id?: number | null;
          currency?: string | null;
          guest_id?: string | null;
          user_id?: string | null;
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
          provider_id?: string | null;
          fleet_unit_id?: string | null;
          pickup_branch_id?: number | null;
          dropoff_branch_id?: number | null;
          currency?: string | null;
          guest_id?: string | null;
          user_id?: string | null;
          pickup_at?: string;
          dropoff_at?: string;
          total_amount?: number;
          payment_method?: PaymentMethod | null;
          status?: BookingStatus;
          lead_score?: number | null;
          source?: BookingSource | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_pickup_location_id_fkey";
            columns: ["pickup_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_dropoff_location_id_fkey";
            columns: ["dropoff_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      v_sales_by_country: {
        Row: {
          country: string;
          country_code: string;
          sales_count: number;
          revenue: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      refresh_daily_stats: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      create_booking_atomic: {
        Args: {
          p_vehicle_id: string;
          p_pickup_branch_id: number;
          p_dropoff_branch_id: number;
          p_pickup_at: string;
          p_dropoff_at: string;
          p_customer_name: string;
          p_email: string;
          p_total_amount: number;
          p_reference: string;
          p_phone?: string | null;
          p_payment_method?: PaymentMethod | null;
          p_source?: BookingSource;
          p_guest_id?: string | null;
          p_user_id?: string | null;
        };
        Returns: BookingRow;
      };
      transition_booking: {
        Args: { p_booking_id: string; p_to: BookingStatus };
        Returns: BookingRow;
      };
      available_vehicle_ids: {
        Args: {
          p_pickup_branch_id: number;
          p_dropoff_branch_id: number;
          p_start: string;
          p_end: string;
        };
        Returns: string[];
      };
      decrement_vehicle_stock: {
        Args: { p_vehicle_id: string };
        Returns: { id: string; stock: number; available: boolean }[];
      };
      increment_vehicle_stock: {
        Args: { p_vehicle_id: string };
        Returns: { id: string; stock: number; available: boolean }[];
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
