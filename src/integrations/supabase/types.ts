export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      gtfs_calendar: {
        Row: {
          agency_id: string
          end_date: string
          friday: boolean
          monday: boolean
          saturday: boolean
          service_id: string
          start_date: string
          sunday: boolean
          thursday: boolean
          tuesday: boolean
          wednesday: boolean
        }
        Insert: {
          agency_id: string
          end_date: string
          friday?: boolean
          monday?: boolean
          saturday?: boolean
          service_id: string
          start_date: string
          sunday?: boolean
          thursday?: boolean
          tuesday?: boolean
          wednesday?: boolean
        }
        Update: {
          agency_id?: string
          end_date?: string
          friday?: boolean
          monday?: boolean
          saturday?: boolean
          service_id?: string
          start_date?: string
          sunday?: boolean
          thursday?: boolean
          tuesday?: boolean
          wednesday?: boolean
        }
        Relationships: []
      }
      gtfs_calendar_dates: {
        Row: {
          agency_id: string
          date: string
          exception_type: number
          service_id: string
        }
        Insert: {
          agency_id: string
          date: string
          exception_type: number
          service_id: string
        }
        Update: {
          agency_id?: string
          date?: string
          exception_type?: number
          service_id?: string
        }
        Relationships: []
      }
      gtfs_feeds: {
        Row: {
          agency_id: string
          last_synced_at: string | null
          name: string
          shape_count: number
          source_url: string
          stop_count: number
        }
        Insert: {
          agency_id: string
          last_synced_at?: string | null
          name: string
          shape_count?: number
          source_url: string
          stop_count?: number
        }
        Update: {
          agency_id?: string
          last_synced_at?: string | null
          name?: string
          shape_count?: number
          source_url?: string
          stop_count?: number
        }
        Relationships: []
      }
      gtfs_routes: {
        Row: {
          agency_id: string
          long_name: string | null
          route_id: string
          route_type: number | null
          short_name: string | null
        }
        Insert: {
          agency_id: string
          long_name?: string | null
          route_id: string
          route_type?: number | null
          short_name?: string | null
        }
        Update: {
          agency_id?: string
          long_name?: string | null
          route_id?: string
          route_type?: number | null
          short_name?: string | null
        }
        Relationships: []
      }
      gtfs_shapes: {
        Row: {
          agency_id: string
          bbox: number[]
          geometry: Json
          id: string
          mode: string
          shape_id: string
        }
        Insert: {
          agency_id: string
          bbox: number[]
          geometry: Json
          id: string
          mode: string
          shape_id: string
        }
        Update: {
          agency_id?: string
          bbox?: number[]
          geometry?: Json
          id?: string
          mode?: string
          shape_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gtfs_shapes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "gtfs_feeds"
            referencedColumns: ["agency_id"]
          },
        ]
      }
      gtfs_stop_times: {
        Row: {
          agency_id: string
          arrival_seconds: number | null
          departure_seconds: number | null
          stop_id: string
          stop_sequence: number
          trip_id: string
        }
        Insert: {
          agency_id: string
          arrival_seconds?: number | null
          departure_seconds?: number | null
          stop_id: string
          stop_sequence: number
          trip_id: string
        }
        Update: {
          agency_id?: string
          arrival_seconds?: number | null
          departure_seconds?: number | null
          stop_id?: string
          stop_sequence?: number
          trip_id?: string
        }
        Relationships: []
      }
      gtfs_stops: {
        Row: {
          agency_id: string
          id: string
          lat: number
          lng: number
          mode: string
          name: string
          parent_station: string | null
          stop_id: string
        }
        Insert: {
          agency_id: string
          id: string
          lat: number
          lng: number
          mode: string
          name: string
          parent_station?: string | null
          stop_id: string
        }
        Update: {
          agency_id?: string
          id?: string
          lat?: number
          lng?: number
          mode?: string
          name?: string
          parent_station?: string | null
          stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gtfs_stops_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "gtfs_feeds"
            referencedColumns: ["agency_id"]
          },
        ]
      }
      gtfs_trips: {
        Row: {
          agency_id: string
          direction_id: number | null
          route_id: string
          service_id: string
          trip_headsign: string | null
          trip_id: string
        }
        Insert: {
          agency_id: string
          direction_id?: number | null
          route_id: string
          service_id: string
          trip_headsign?: string | null
          trip_id: string
        }
        Update: {
          agency_id?: string
          direction_id?: number | null
          route_id?: string
          service_id?: string
          trip_headsign?: string | null
          trip_id?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          created_at: string
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          destination_osm_id: string | null
          distance_km: number | null
          end_time: string | null
          id: string
          is_live: boolean
          mode: Database["public"]["Enums"]["transit_mode"]
          notes: string | null
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          origin_osm_id: string | null
          route_geometry: Json | null
          route_name: string | null
          start_time: string
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          destination: string
          destination_lat?: number | null
          destination_lng?: number | null
          destination_osm_id?: string | null
          distance_km?: number | null
          end_time?: string | null
          id?: string
          is_live?: boolean
          mode?: Database["public"]["Enums"]["transit_mode"]
          notes?: string | null
          origin: string
          origin_lat?: number | null
          origin_lng?: number | null
          origin_osm_id?: string | null
          route_geometry?: Json | null
          route_name?: string | null
          start_time: string
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          destination?: string
          destination_lat?: number | null
          destination_lng?: number | null
          destination_osm_id?: string | null
          distance_km?: number | null
          end_time?: string | null
          id?: string
          is_live?: boolean
          mode?: Database["public"]["Enums"]["transit_mode"]
          notes?: string | null
          origin?: string
          origin_lat?: number | null
          origin_lng?: number | null
          origin_osm_id?: string | null
          route_geometry?: Json | null
          route_name?: string | null
          start_time?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          color: string | null
          created_at: string
          id: string
          make: string | null
          model: string | null
          name: string
          updated_at: string
          user_id: string
          year: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          make?: string | null
          model?: string | null
          name: string
          updated_at?: string
          user_id: string
          year?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          make?: string | null
          model?: string | null
          name?: string
          updated_at?: string
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gtfs_departures_between: {
        Args: {
          p_agency_id: string
          p_date: string
          p_destination_name: string
          p_limit?: number
          p_origin_name: string
        }
        Returns: {
          arrival_seconds: number
          departure_seconds: number
          route_long_name: string
          route_short_name: string
          trip_headsign: string
          trip_id: string
        }[]
      }
      gtfs_shapes_near: {
        Args: {
          d_lat: number
          d_lng: number
          modes?: string[]
          o_lat: number
          o_lng: number
          pad?: number
        }
        Returns: {
          geometry: Json
          id: string
          mode: string
        }[]
      }
    }
    Enums: {
      transit_mode:
        | "train"
        | "ferry"
        | "taxi"
        | "jetski"
        | "atv"
        | "skateboard"
        | "gondola"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      transit_mode: [
        "train",
        "ferry",
        "taxi",
        "jetski",
        "atv",
        "skateboard",
        "gondola",
      ],
    },
  },
} as const
