
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "challenge_tasks": {
                  Row: {
                    "challenge_id": string,"id": string,"key": string | null,"label": string,"note": string | null,"per_week": number,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_id": string,"id"?: string,"key"?: string | null,"label": string,"note"?: string | null,"per_week"?: number,"position": number
                  }
                  Update: {
                    "challenge_id"?: string,"id"?: string,"key"?: string | null,"label"?: string,"note"?: string | null,"per_week"?: number,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "challenge_tasks_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "challenges"
      referencedColumns: ["id"]
    }
                  ]
                },"challenges": {
                  Row: {
                    "category": Database["public"]['Enums']["challenge_category"] | null,"created_at": string,"creator_id": string | null,"default_days": number,"description": string,"id": string,"lives": number,"name": string,"photo_paths": (string)[],"slug": string | null,"stamp": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: Database["public"]['Enums']["challenge_category"] | null,"created_at"?: string,"creator_id"?: string | null,"default_days": number,"description"?: string,"id"?: string,"lives"?: number,"name": string,"photo_paths"?: (string)[],"slug"?: string | null,"stamp"?: string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["challenge_category"] | null,"created_at"?: string,"creator_id"?: string | null,"default_days"?: number,"description"?: string,"id"?: string,"lives"?: number,"name"?: string,"photo_paths"?: (string)[],"slug"?: string | null,"stamp"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "challenges_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"day": number,"id": string,"membership_id": string,"parent_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"day": number,"id"?: string,"membership_id": string,"parent_id"?: string | null
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"day"?: number,"id"?: string,"membership_id"?: string,"parent_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "membership_progress"
      referencedColumns: ["membership_id"]
    },{
      foreignKeyName: "comments_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    }
                  ]
                },"day_captions": {
                  Row: {
                    "caption": string,"day": number,"membership_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "caption": string,"day": number,"membership_id": string,"updated_at"?: string
                  }
                  Update: {
                    "caption"?: string,"day"?: number,"membership_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "day_captions_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "membership_progress"
      referencedColumns: ["membership_id"]
    },{
      foreignKeyName: "day_captions_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    }
                  ]
                },"day_posts": {
                  Row: {
                    "day": number,"membership_id": string,"posts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": number,"membership_id": string,"posts_at": string
                  }
                  Update: {
                    "day"?: number,"membership_id"?: string,"posts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "day_posts_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "membership_progress"
      referencedColumns: ["membership_id"]
    },{
      foreignKeyName: "day_posts_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    }
                  ]
                },"friend_request_log": {
                  Row: {
                    "addressee_id": string,"requester_id": string,"sent_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "addressee_id": string,"requester_id": string,"sent_at"?: string
                  }
                  Update: {
                    "addressee_id"?: string,"requester_id"?: string,"sent_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "friend_request_log_addressee_id_fkey"
      columns: ["addressee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "friend_request_log_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"friendships": {
                  Row: {
                    "accepted_at": string | null,"addressee_id": string,"created_at": string,"requester_id": string,"status": Database["public"]['Enums']["friendship_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"addressee_id": string,"created_at"?: string,"requester_id": string,"status"?: Database["public"]['Enums']["friendship_status"]
                  }
                  Update: {
                    "accepted_at"?: string | null,"addressee_id"?: string,"created_at"?: string,"requester_id"?: string,"status"?: Database["public"]['Enums']["friendship_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "friendships_addressee_id_fkey"
      columns: ["addressee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "friendships_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "ended_at": string | null,"id": string,"reminders": NonNullable<Json>,"round_id": string,"schedule": NonNullable<Json>,"signed_at": string,"status": Database["public"]['Enums']["membership_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ended_at"?: string | null,"id"?: string,"reminders"?: NonNullable<Json>,"round_id": string,"schedule"?: NonNullable<Json>,"signed_at"?: string,"status"?: Database["public"]['Enums']["membership_status"],"user_id": string
                  }
                  Update: {
                    "ended_at"?: string | null,"id"?: string,"reminders"?: NonNullable<Json>,"round_id"?: string,"schedule"?: NonNullable<Json>,"signed_at"?: string,"status"?: Database["public"]['Enums']["membership_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_round_id_fkey"
      columns: ["round_id"]
isOneToOne: false
      referencedRelation: "round_stats"
      referencedColumns: ["round_id"]
    },{
      foreignKeyName: "memberships_round_id_fkey"
      columns: ["round_id"]
isOneToOne: false
      referencedRelation: "rounds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string,"comment_id": string | null,"created_at": string,"day": number | null,"emoji": string | null,"id": string,"kind": Database["public"]['Enums']["notification_kind"],"membership_id": string | null,"read_at": string | null,"recipient_id": string,"round_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"comment_id"?: string | null,"created_at"?: string,"day"?: number | null,"emoji"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["notification_kind"],"membership_id"?: string | null,"read_at"?: string | null,"recipient_id": string,"round_id"?: string | null
                  }
                  Update: {
                    "actor_id"?: string,"comment_id"?: string | null,"created_at"?: string,"day"?: number | null,"emoji"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["notification_kind"],"membership_id"?: string | null,"read_at"?: string | null,"recipient_id"?: string,"round_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "membership_progress"
      referencedColumns: ["membership_id"]
    },{
      foreignKeyName: "notifications_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_round_id_fkey"
      columns: ["round_id"]
isOneToOne: false
      referencedRelation: "round_stats"
      referencedColumns: ["round_id"]
    },{
      foreignKeyName: "notifications_round_id_fkey"
      columns: ["round_id"]
isOneToOne: false
      referencedRelation: "rounds"
      referencedColumns: ["id"]
    }
                  ]
                },"photo_views": {
                  Row: {
                    "completion_id": string,"viewed_at": string,"viewer_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completion_id": string,"viewed_at"?: string,"viewer_id": string
                  }
                  Update: {
                    "completion_id"?: string,"viewed_at"?: string,"viewer_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "photo_views_completion_id_fkey"
      columns: ["completion_id"]
isOneToOne: false
      referencedRelation: "task_completions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "photo_views_viewer_id_fkey"
      columns: ["viewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"bio": string | null,"created_at": string,"handle": string,"id": string,"name": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"bio"?: string | null,"created_at"?: string,"handle": string,"id": string,"name"?: string,"timezone"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"bio"?: string | null,"created_at"?: string,"handle"?: string,"id"?: string,"name"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reactions": {
                  Row: {
                    "created_at": string,"day": number,"emoji": string,"membership_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": number,"emoji": string,"membership_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"day"?: number,"emoji"?: string,"membership_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reactions_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "membership_progress"
      referencedColumns: ["membership_id"]
    },{
      foreignKeyName: "reactions_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reactions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"rounds": {
                  Row: {
                    "challenge_id": string,"created_at": string,"days": number,"id": string,"start_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_id": string,"created_at"?: string,"days": number,"id"?: string,"start_date": string
                  }
                  Update: {
                    "challenge_id"?: string,"created_at"?: string,"days"?: number,"id"?: string,"start_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rounds_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "challenges"
      referencedColumns: ["id"]
    }
                  ]
                },"task_completions": {
                  Row: {
                    "completed_at": string,"day": number,"id": string,"membership_id": string,"photo_path": string,"photo_updated_at": string,"slot": number | null,"task_id": string,"thumb_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string,"day": number,"id"?: string,"membership_id": string,"photo_path": string,"photo_updated_at"?: string,"slot"?: number | null,"task_id": string,"thumb_path": string
                  }
                  Update: {
                    "completed_at"?: string,"day"?: number,"id"?: string,"membership_id"?: string,"photo_path"?: string,"photo_updated_at"?: string,"slot"?: number | null,"task_id"?: string,"thumb_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_completions_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "membership_progress"
      referencedColumns: ["membership_id"]
    },{
      foreignKeyName: "task_completions_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_completions_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "challenge_tasks"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "friends": {
                  Row: {
                    "accepted_at": string | null,"friend_id": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"membership_progress": {
                  Row: {
                    "challenge_id": string,"current_day": number | null,"days": number,"done_today": number | null,"lives": number,"lives_left": number | null,"membership_id": string,"missed_days": number | null,"round_id": string,"start_date": string,"status": Database["public"]['Enums']["membership_status"],"task_count": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "memberships_round_id_fkey"
      columns: ["round_id"]
isOneToOne: false
      referencedRelation: "round_stats"
      referencedColumns: ["round_id"]
    },{
      foreignKeyName: "memberships_round_id_fkey"
      columns: ["round_id"]
isOneToOne: false
      referencedRelation: "rounds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rounds_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "challenges"
      referencedColumns: ["id"]
    }
                  ]
                },"round_stats": {
                  Row: {
                    "finished": number | null,"members": number | null,"round_id": string,"still_going": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "can_read_task_photo":
{ Args: { "object_name": string }; Returns: boolean
                           },
"can_upload_task_photo":
{ Args: { "object_name": string }; Returns: boolean
                           },
"can_view_day":
{ Args: { "d": number,"mid": string }; Returns: boolean
                           },
"check_own_paths":
{ Args: { "paths": Json,"uid": string }; Returns: (string)[]
                           },
"community_today":
{ Args: { "scope": string }; Returns: {
              "avatar_path": string,"caption": string,"challenge_id": string,"comments": number,"day": number,"done": number,"handle": string,"is_friend": boolean,"last_completed_at": string,"lives_left": number,"membership_id": string,"my_reaction": string,"name": string,"posts_at": string,"reactions": number,"request_sent": boolean,"task_count": number,"unlocked": boolean,"user_id": string,"views": number
            }[]
                           },
"complete_task":
{ Args: { "photo_path": string,"slot"?: number,"task": string,"thumb_path": string }; Returns: Json
                           },
"create_challenge":
{ Args: { "p": Json }; Returns: string
                           },
"day_counting_down":
{ Args: { "d": number,"mid": string }; Returns: boolean
                           },
"day_posted":
{ Args: { "d": number,"mid": string }; Returns: boolean
                           },
"default_weekdays":
{ Args: { "per_week": number }; Returns: (number)[]
                           },
"delete_challenge":
{ Args: { "cid": string }; Returns: undefined
                           },
"due_tasks":
{ Args: { "d": number,"mid": string }; Returns: string[]
                           },
"friend_suggestions":
{ Args: { "max_rows"?: number }; Returns: {
              "mutual_count": number,"mutual_ids": (string)[],"user_id": string
            }[]
                           },
"in_own_folder":
{ Args: { "object_name": string }; Returns: boolean
                           },
"invite_to_round":
{ Args: { "rid": string,"target": string }; Returns: undefined
                           },
"join_round":
{ Args: { "reminders"?: Json,"rid": string,"schedule"?: Json }; Returns: string
                           },
"leave_round":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"local_today":
{ Args: { "uid": string }; Returns: string
                           },
"member_day":
{ Args: { "mid": string }; Returns: number
                           },
"my_membership_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"objects_under":
{ Args: { "bucket": string,"prefix": string }; Returns: number
                           },
"owns_membership":
{ Args: { "mid": string }; Returns: boolean
                           },
"post_countdown":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"post_now":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"request_friend":
{ Args: { "target": string }; Returns: Database["public"]['Enums']["friendship_status"]
                           },
"require_uid":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"round_standings":
{ Args: { "rid": string }; Returns: {
              "longest_streak": number,"status": Database["public"]['Enums']["membership_status"],"user_id": string
            }[]
                           },
"set_reminders":
{ Args: { "reminders": Json }; Returns: undefined
                           },
"settle_memberships":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"task_due":
{ Args: { "on_date": string,"per_week": number,"schedule": Json,"task": string }; Returns: boolean
                           },
"task_weekdays":
{ Args: { "per_week": number,"schedule": Json,"task": string }; Returns: (number)[]
                           },
"undo_task":
{ Args: { "task": string }; Returns: Json
                           },
"unfriend":
{ Args: { "target": string }; Returns: undefined
                           },
"unlocked_today":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"update_challenge":
{ Args: { "cid": string,"p": Json }; Returns: undefined
                           },
"valid_reminders":
{ Args: { "r": Json }; Returns: boolean
                           },
"valid_schedule":
{ Args: { "s": Json }; Returns: boolean
                           },
"write_challenge_tasks":
{ Args: { "cid": string,"tasks": Json }; Returns: undefined
                           }
          }
          Enums: {
            "challenge_category": "Fitness"|"Health"|"Mindset"|"Lifestyle"|"Study","friendship_status": "pending"|"accepted","membership_status": "active"|"lost"|"finished"|"left","notification_kind": "friend_request"|"friend_accepted"|"comment"|"reply"|"reaction"|"invite"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "challenge_category": ["Fitness", "Health", "Mindset", "Lifestyle", "Study"],"friendship_status": ["pending", "accepted"],"membership_status": ["active", "lost", "finished", "left"],"notification_kind": ["friend_request", "friend_accepted", "comment", "reply", "reaction", "invite"]
          }
        }
} as const
