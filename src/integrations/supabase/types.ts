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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_secrets: {
        Row: {
          name: string
          updated_at: string
          value: string
        }
        Insert: {
          name: string
          updated_at?: string
          value: string
        }
        Update: {
          name?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expires_at: string | null
          id: string
          max_uses: number | null
          percent_off: number
          used_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          percent_off: number
          used_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          percent_off?: number
          used_count?: number
        }
        Relationships: []
      }
      eklas_stock: {
        Row: {
          external_id: string
          name: string
          price_text: string | null
          raw: Json | null
          stock: number | null
          updated_at: string
        }
        Insert: {
          external_id: string
          name?: string
          price_text?: string | null
          raw?: Json | null
          stock?: number | null
          updated_at?: string
        }
        Update: {
          external_id?: string
          name?: string
          price_text?: string | null
          raw?: Json | null
          stock?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          content: string
          created_at: string
          delivered_at: string | null
          id: string
          order_id: string | null
          position: number
          product_id: string
        }
        Insert: {
          content: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_id?: string | null
          position?: number
          product_id: string
        }
        Update: {
          content?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_id?: string | null
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_cents: number
          buyer_email: string
          buyer_name: string
          buyer_phone: string | null
          coupon_code: string | null
          created_at: string
          deliver_after: string | null
          delivery_status: string
          discount_cents: number
          id: string
          order_number: number
          paid_at: string | null
          product_id: string | null
          product_title: string
          quantity: number
          status: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          buyer_email: string
          buyer_name: string
          buyer_phone?: string | null
          coupon_code?: string | null
          created_at?: string
          deliver_after?: string | null
          delivery_status?: string
          discount_cents?: number
          id?: string
          order_number?: number
          paid_at?: string | null
          product_id?: string | null
          product_title?: string
          quantity?: number
          status?: string
          user_id?: string
        }
        Update: {
          amount_cents?: number
          buyer_email?: string
          buyer_name?: string
          buyer_phone?: string | null
          coupon_code?: string | null
          created_at?: string
          deliver_after?: string | null
          delivery_status?: string
          discount_cents?: number
          id?: string
          order_number?: number
          paid_at?: string | null
          product_id?: string | null
          product_title?: string
          quantity?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_assets: {
        Row: {
          access_url: string | null
          file_path: string | null
          install_instructions: string | null
          product_id: string
        }
        Insert: {
          access_url?: string | null
          file_path?: string | null
          install_instructions?: string | null
          product_id: string
        }
        Update: {
          access_url?: string | null
          file_path?: string | null
          install_instructions?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category_id: string | null
          cover_url: string | null
          created_at: string
          delivery_delay_minutes: number
          delivery_mode: string
          description: string | null
          eklas_external_id: string | null
          featured: boolean
          id: string
          low_stock_threshold: number
          price_cents: number
          slug: string
          sold_count: number
          stock_quantity: number | null
          subtitle: string | null
          supplier_id: string | null
          supplier_product_id: string | null
          title: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          cover_url?: string | null
          created_at?: string
          delivery_delay_minutes?: number
          delivery_mode?: string
          description?: string | null
          eklas_external_id?: string | null
          featured?: boolean
          id?: string
          low_stock_threshold?: number
          price_cents?: number
          slug: string
          sold_count?: number
          stock_quantity?: number | null
          subtitle?: string | null
          supplier_id?: string | null
          supplier_product_id?: string | null
          title: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          cover_url?: string | null
          created_at?: string
          delivery_delay_minutes?: number
          delivery_mode?: string
          description?: string | null
          eklas_external_id?: string | null
          featured?: boolean
          id?: string
          low_stock_threshold?: number
          price_cents?: number
          slug?: string
          sold_count?: number
          stock_quantity?: number | null
          subtitle?: string | null
          supplier_id?: string | null
          supplier_product_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_name: string
          comment: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          user_id: string
        }
        Insert: {
          author_name: string
          comment?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          user_id?: string
        }
        Update: {
          author_name?: string
          comment?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_alerts: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          contact_whatsapp: string | null
          id: number
          meta_keywords: string | null
          og_image_url: string | null
          pix_city: string
          pix_key: string
          pix_name: string
          site_description: string
          site_title: string
        }
        Insert: {
          contact_whatsapp?: string | null
          id?: number
          meta_keywords?: string | null
          og_image_url?: string | null
          pix_city?: string
          pix_key?: string
          pix_name?: string
          site_description?: string
          site_title?: string
        }
        Update: {
          contact_whatsapp?: string | null
          id?: number
          meta_keywords?: string | null
          og_image_url?: string | null
          pix_city?: string
          pix_key?: string
          pix_name?: string
          site_description?: string
          site_title?: string
        }
        Relationships: []
      }
      supplier_products: {
        Row: {
          external_id: string
          name: string
          price_text: string | null
          raw: Json | null
          stock: number | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          external_id: string
          name?: string
          price_text?: string | null
          raw?: Json | null
          stock?: number | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          external_id?: string
          name?: string
          price_text?: string | null
          raw?: Json | null
          stock?: number | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_purchases: {
        Row: {
          created_at: string
          error: string | null
          external_order_id: string | null
          id: string
          order_id: string
          raw: Json | null
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          external_order_id?: string | null
          id?: string
          order_id: string
          raw?: Json | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          external_order_id?: string | null
          id?: string
          order_id?: string
          raw?: Json | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_purchases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_refresh_log: {
        Row: {
          changes: Json
          created_at: string
          error: string | null
          id: string
          item_count: number
          ok: boolean
          supplier: string
          supplier_id: string | null
        }
        Insert: {
          changes?: Json
          created_at?: string
          error?: string | null
          id?: string
          item_count?: number
          ok?: boolean
          supplier?: string
          supplier_id?: string | null
        }
        Update: {
          changes?: Json
          created_at?: string
          error?: string | null
          id?: string
          item_count?: number
          ok?: boolean
          supplier?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_refresh_log_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          api_base_url: string
          created_at: string
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          active?: boolean
          api_base_url?: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          active?: boolean
          api_base_url?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          from_admin: boolean
          id: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          from_admin?: boolean
          id?: string
          sender_id?: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          from_admin?: boolean
          id?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          due_at: string | null
          id: string
          last_message_at: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_at?: string | null
          id?: string
          last_message_at?: string
          status?: string
          subject: string
          user_id?: string
        }
        Update: {
          created_at?: string
          due_at?: string | null
          id?: string
          last_message_at?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_inventory: { Args: { _order: string }; Returns: boolean }
      check_coupon: { Args: { _code: string }; Returns: number }
      has_paid: { Args: { _product: string; _user: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recount_inventory: { Args: { _product: string }; Returns: undefined }
      reserved_qty: { Args: { _product: string }; Returns: number }
      username_available: { Args: { _u: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
