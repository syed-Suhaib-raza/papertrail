export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          actor_id?: string | null;
          type: string;
          payload: Json;
          is_read: boolean;
          sent_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          actor_id?: string | null;
          type: string;
          payload: Json;
          is_read?: boolean;
          sent_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          actor_id?: string | null;
          type?: string;
          payload?: Json;
          is_read?: boolean;
          sent_at?: string;
        };
      };
      // add other tables as needed
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}