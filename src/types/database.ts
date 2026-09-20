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
  pickup_surcharge_minor: number;
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

export type PlatformSettingsRow = {
  id: boolean;
  commission_bp: number;
  service_fee_bp: number;
};

export type RatePlanRow = {
  id: string;
  provider_id: string;
  vehicle_id: string;
  branch_id: number;
  currency: string;
  base_daily_minor: number;
  weekend_uplift_bp: number;
  weekly_discount_bp: number;
  monthly_discount_bp: number;
  min_days: number;
  max_days: number | null;
  included_km_per_day: number | null;
  extra_km_minor: number | null;
  created_at: string;
};

/** `during` is a Postgres daterange in text form, e.g. `[2030-07-01,2030-08-01)`. */
export type RateSeasonRow = {
  id: string;
  rate_plan_id: string;
  provider_id: string;
  during: string;
  daily_minor: number;
};

export type ExtraRow = {
  id: string;
  provider_id: string;
  code: string;
  name: string;
  kind: "extra" | "insurance";
  pricing: "per_day" | "per_rental";
  unit_price_minor: number;
  currency: string;
  max_quantity: number;
  cap_minor: number | null;
  is_mandatory: boolean;
  is_active: boolean;
};

export type ProviderPolicyRow = {
  provider_id: string;
  deposit_type: "fixed" | "percent";
  deposit_value: number;
  cancellation_tiers: Json;
  min_driver_age: number;
  young_driver_age: number | null;
  young_driver_fee_minor: number;
};

export type OneWayFeeRow = {
  provider_id: string;
  from_branch_id: number;
  to_branch_id: number;
  amount_minor: number;
};

export type TaxRuleRow = {
  id: string;
  country_code: string;
  name: string;
  rate_bp: number;
  applies_to: string[];
  inclusive: boolean;
  is_active: boolean;
};

export type PromoCodeRow = {
  id: string;
  code: string;
  issuer: "platform" | "provider";
  provider_id: string | null;
  discount_type: "percent" | "fixed";
  value: number;
  currency: string | null;
  valid_during: string | null;
  min_days: number;
  vehicle_id: string | null;
  is_active: boolean;
};

export type BookingRow = {
  id: string;
  reference: string;
  vehicle_id: string | null;
  customer_name: string;
  email: string;
  phone: string | null;
  guest_id: string | null;
  user_id: string | null;
  provider_id: string | null;
  fleet_unit_id: string | null;
  pickup_branch_id: number | null;
  dropoff_branch_id: number | null;
  currency: string | null;
  price_snapshot: Json | null;
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
            referencedRelation: "branches";
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
      platform_settings: {
        Row: PlatformSettingsRow;
        Insert: Partial<PlatformSettingsRow>;
        Update: Partial<PlatformSettingsRow>;
        Relationships: [];
      };
      rate_plans: {
        Row: RatePlanRow;
        Insert: InsertOf<RatePlanRow, "provider_id" | "vehicle_id" | "branch_id" | "currency" | "base_daily_minor">;
        Update: Partial<RatePlanRow>;
        Relationships: [];
      };
      rate_seasons: {
        Row: RateSeasonRow;
        Insert: InsertOf<RateSeasonRow, "rate_plan_id" | "provider_id" | "during" | "daily_minor">;
        Update: Partial<RateSeasonRow>;
        Relationships: [];
      };
      extras: {
        Row: ExtraRow;
        Insert: InsertOf<ExtraRow, "provider_id" | "code" | "name" | "kind" | "pricing" | "unit_price_minor" | "currency">;
        Update: Partial<ExtraRow>;
        Relationships: [];
      };
      provider_policies: {
        Row: ProviderPolicyRow;
        Insert: InsertOf<ProviderPolicyRow, "provider_id">;
        Update: Partial<ProviderPolicyRow>;
        Relationships: [];
      };
      one_way_fees: {
        Row: OneWayFeeRow;
        Insert: OneWayFeeRow;
        Update: Partial<OneWayFeeRow>;
        Relationships: [];
      };
      tax_rules: {
        Row: TaxRuleRow;
        Insert: InsertOf<TaxRuleRow, "country_code" | "name" | "rate_bp" | "applies_to">;
        Update: Partial<TaxRuleRow>;
        Relationships: [];
      };
      promo_codes: {
        Row: PromoCodeRow;
        Insert: InsertOf<PromoCodeRow, "code" | "issuer" | "discount_type" | "value">;
        Update: Partial<PromoCodeRow>;
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
          provider_id?: string | null;
          fleet_unit_id?: string | null;
          pickup_branch_id?: number | null;
          dropoff_branch_id?: number | null;
          currency?: string | null;
          price_snapshot?: Json | null;
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
          provider_id?: string | null;
          fleet_unit_id?: string | null;
          pickup_branch_id?: number | null;
          dropoff_branch_id?: number | null;
          currency?: string | null;
          price_snapshot?: Json | null;
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
          p_price_snapshot?: Json | null;
        };
        Returns: BookingRow;
      };
      free_units: {
        Args: {
          p_vehicle_id: string | null;
          p_pickup_branch_id: number;
          p_dropoff_branch_id: number;
          p_start: string;
          p_end: string;
        };
        Returns: { unit_id: string; vehicle_id: string }[];
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
