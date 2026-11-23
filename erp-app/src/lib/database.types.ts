
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
            "addresses": {
                  Row: {
                    "area": string | null,"created_at": string,"customer_id": string,"id": string,"is_default": boolean,"label": string,"latitude": number | null,"line1": string,"line2": string | null,"longitude": number | null,"notes": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "area"?: string | null,"created_at"?: string,"customer_id": string,"id"?: string,"is_default"?: boolean,"label"?: string,"latitude"?: number | null,"line1": string,"line2"?: string | null,"longitude"?: number | null,"notes"?: string | null
                  }
                  Update: {
                    "area"?: string | null,"created_at"?: string,"customer_id"?: string,"id"?: string,"is_default"?: boolean,"label"?: string,"latitude"?: number | null,"line1"?: string,"line2"?: string | null,"longitude"?: number | null,"notes"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "addresses_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_form_snapshots": {
                  Row: {
                    "answers": NonNullable<Json>,"booking_id": string,"created_at": string,"form_definition_id": string | null,"form_version": number,"id": string,"questions": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "answers"?: NonNullable<Json>,"booking_id": string,"created_at"?: string,"form_definition_id"?: string | null,"form_version"?: number,"id"?: string,"questions"?: NonNullable<Json>
                  }
                  Update: {
                    "answers"?: NonNullable<Json>,"booking_id"?: string,"created_at"?: string,"form_definition_id"?: string | null,"form_version"?: number,"id"?: string,"questions"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_form_snapshots_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_form_snapshots_form_definition_id_fkey"
      columns: ["form_definition_id"]
isOneToOne: false
      referencedRelation: "service_form_definitions"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_items": {
                  Row: {
                    "booking_id": string,"id": string,"price": number,"quantity": number,"service_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"id"?: string,"price"?: number,"quantity"?: number,"service_id": string
                  }
                  Update: {
                    "booking_id"?: string,"id"?: string,"price"?: number,"quantity"?: number,"service_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_items_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_items_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_status_history": {
                  Row: {
                    "booking_id": string,"changed_at": string,"changed_by": string | null,"from_status": Database["public"]['Enums']["booking_status"] | null,"id": string,"note": string | null,"to_status": Database["public"]['Enums']["booking_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"changed_at"?: string,"changed_by"?: string | null,"from_status"?: Database["public"]['Enums']["booking_status"] | null,"id"?: string,"note"?: string | null,"to_status": Database["public"]['Enums']["booking_status"]
                  }
                  Update: {
                    "booking_id"?: string,"changed_at"?: string,"changed_by"?: string | null,"from_status"?: Database["public"]['Enums']["booking_status"] | null,"id"?: string,"note"?: string | null,"to_status"?: Database["public"]['Enums']["booking_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_status_history_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_status_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "address_id": string | null,"billed_hours": number | null,"cancel_reason": string | null,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"created_by": string | null,"customer_id": string,"customer_name": string | null,"customer_phone": string | null,"id": string,"notes": string | null,"reference": string,"scheduled_end": string,"scheduled_start": string,"source": Database["public"]['Enums']["booking_source"],"status": Database["public"]['Enums']["booking_status"],"technicians_needed": number,"total_price": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address_id"?: string | null,"billed_hours"?: number | null,"cancel_reason"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"customer_name"?: string | null,"customer_phone"?: string | null,"id"?: string,"notes"?: string | null,"reference"?: string,"scheduled_end": string,"scheduled_start": string,"source"?: Database["public"]['Enums']["booking_source"],"status"?: Database["public"]['Enums']["booking_status"],"technicians_needed"?: number,"total_price"?: number,"updated_at"?: string
                  }
                  Update: {
                    "address_id"?: string | null,"billed_hours"?: number | null,"cancel_reason"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"customer_name"?: string | null,"customer_phone"?: string | null,"id"?: string,"notes"?: string | null,"reference"?: string,"scheduled_end"?: string,"scheduled_start"?: string,"source"?: Database["public"]['Enums']["booking_source"],"status"?: Database["public"]['Enums']["booking_status"],"technicians_needed"?: number,"total_price"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_address_id_fkey"
      columns: ["address_id"]
isOneToOne: false
      referencedRelation: "addresses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"capabilities": {
                  Row: {
                    "description": string,"key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"key": string
                  }
                  Update: {
                    "description"?: string,"key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cash_disputes": {
                  Row: {
                    "created_at": string,"expected_amount": number,"id": string,"payment_id": string,"received_amount": number,"resolution_reason": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["cash_dispute_status"],"technician_id": string,"technician_note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expected_amount": number,"id"?: string,"payment_id": string,"received_amount": number,"resolution_reason"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["cash_dispute_status"],"technician_id": string,"technician_note"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"expected_amount"?: number,"id"?: string,"payment_id"?: string,"received_amount"?: number,"resolution_reason"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["cash_dispute_status"],"technician_id"?: string,"technician_note"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cash_disputes_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cash_disputes_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cash_disputes_technician_id_fkey"
      columns: ["technician_id"]
isOneToOne: false
      referencedRelation: "technician_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"cash_handovers": {
                  Row: {
                    "amount": number,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"id": string,"note": string | null,"technician_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"id"?: string,"note"?: string | null,"technician_id": string
                  }
                  Update: {
                    "amount"?: number,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"id"?: string,"note"?: string | null,"technician_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cash_handovers_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cash_handovers_technician_id_fkey"
      columns: ["technician_id"]
isOneToOne: false
      referencedRelation: "technician_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "active": boolean,"description": string | null,"display_order": number,"id": string,"image_path": string | null,"name": string,"parent_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"description"?: string | null,"display_order"?: number,"id"?: string,"image_path"?: string | null,"name": string,"parent_id"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"description"?: string | null,"display_order"?: number,"id"?: string,"image_path"?: string | null,"name"?: string,"parent_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"device_tokens": {
                  Row: {
                    "created_at": string,"expo_push_token": string,"id": string,"last_seen_at": string,"platform": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expo_push_token": string,"id"?: string,"last_seen_at"?: string,"platform": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"expo_push_token"?: string,"id"?: string,"last_seen_at"?: string,"platform"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "device_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"job_assignments": {
                  Row: {
                    "assigned_by": string | null,"booking_id": string,"completed_at": string | null,"created_at": string,"crew_role": Database["public"]['Enums']["crew_role"],"ends_at": string | null,"id": string,"started_at": string | null,"starts_at": string | null,"status": Database["public"]['Enums']["assignment_status"],"technician_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_by"?: string | null,"booking_id": string,"completed_at"?: string | null,"created_at"?: string,"crew_role"?: Database["public"]['Enums']["crew_role"],"ends_at"?: string | null,"id"?: string,"started_at"?: string | null,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["assignment_status"],"technician_id": string
                  }
                  Update: {
                    "assigned_by"?: string | null,"booking_id"?: string,"completed_at"?: string | null,"created_at"?: string,"crew_role"?: Database["public"]['Enums']["crew_role"],"ends_at"?: string | null,"id"?: string,"started_at"?: string | null,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["assignment_status"],"technician_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_assignments_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_assignments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_assignments_technician_id_fkey"
      columns: ["technician_id"]
isOneToOne: false
      referencedRelation: "technician_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"job_photos": {
                  Row: {
                    "booking_id": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["photo_kind"],"storage_path": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["photo_kind"],"storage_path": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "booking_id"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["photo_kind"],"storage_path"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_photos_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_photos_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"read_at": string | null,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"read_at"?: string | null,"title": string,"type"?: string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"read_at"?: string | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"booking_id": string,"created_at": string,"id": string,"method": Database["public"]['Enums']["payment_method"],"paid_at": string | null,"provider": string | null,"provider_reference": string | null,"recorded_by": string | null,"status": Database["public"]['Enums']["payment_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"booking_id": string,"created_at"?: string,"id"?: string,"method": Database["public"]['Enums']["payment_method"],"paid_at"?: string | null,"provider"?: string | null,"provider_reference"?: string | null,"recorded_by"?: string | null,"status"?: Database["public"]['Enums']["payment_status"]
                  }
                  Update: {
                    "amount"?: number,"booking_id"?: string,"created_at"?: string,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"paid_at"?: string | null,"provider"?: string | null,"provider_reference"?: string | null,"recorded_by"?: string | null,"status"?: Database["public"]['Enums']["payment_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "auth_user_id": string | null,"created_at": string,"deactivated_at": string | null,"deactivated_by": string | null,"full_name": string,"id": string,"phone": string | null,"role": Database["public"]['Enums']["app_role"],"status": Database["public"]['Enums']["profile_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_user_id"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"deactivated_by"?: string | null,"full_name": string,"id"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"status"?: Database["public"]['Enums']["profile_status"]
                  }
                  Update: {
                    "auth_user_id"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"deactivated_by"?: string | null,"full_name"?: string,"id"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"status"?: Database["public"]['Enums']["profile_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_deactivated_by_fkey"
      columns: ["deactivated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"role_capabilities": {
                  Row: {
                    "capability": string,"role": Database["public"]['Enums']["app_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "capability": string,"role": Database["public"]['Enums']["app_role"]
                  }
                  Update: {
                    "capability"?: string,"role"?: Database["public"]['Enums']["app_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_capabilities_capability_fkey"
      columns: ["capability"]
isOneToOne: false
      referencedRelation: "capabilities"
      referencedColumns: ["key"]
    }
                  ]
                },"service_form_definitions": {
                  Row: {
                    "category_id": string | null,"created_at": string,"created_by": string | null,"id": string,"is_current": boolean,"schema": NonNullable<Json>,"service_id": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_current"?: boolean,"schema": NonNullable<Json>,"service_id"?: string | null,"version"?: number
                  }
                  Update: {
                    "category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_current"?: boolean,"schema"?: NonNullable<Json>,"service_id"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_form_definitions_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_form_definitions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_form_definitions_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"services": {
                  Row: {
                    "active": boolean,"category_id": string,"created_at": string,"description": string | null,"duration_minutes": number,"id": string,"image_path": string | null,"name": string,"price": number,"pricing_type": Database["public"]['Enums']["pricing_type"],"required_skill_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"category_id": string,"created_at"?: string,"description"?: string | null,"duration_minutes"?: number,"id"?: string,"image_path"?: string | null,"name": string,"price"?: number,"pricing_type"?: Database["public"]['Enums']["pricing_type"],"required_skill_id"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"category_id"?: string,"created_at"?: string,"description"?: string | null,"duration_minutes"?: number,"id"?: string,"image_path"?: string | null,"name"?: string,"price"?: number,"pricing_type"?: Database["public"]['Enums']["pricing_type"],"required_skill_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "services_required_skill_id_fkey"
      columns: ["required_skill_id"]
isOneToOne: false
      referencedRelation: "skills"
      referencedColumns: ["id"]
    }
                  ]
                },"skills": {
                  Row: {
                    "id": string,"max_daily_hours": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"max_daily_hours"?: number,"name": string
                  }
                  Update: {
                    "id"?: string,"max_daily_hours"?: number,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"staff_invites": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"expires_at": string,"id": string,"revoked": boolean,"role": Database["public"]['Enums']["app_role"],"used_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"revoked"?: boolean,"role": Database["public"]['Enums']["app_role"],"used_at"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"revoked"?: boolean,"role"?: Database["public"]['Enums']["app_role"],"used_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"technician_availability": {
                  Row: {
                    "end_time": string,"id": string,"start_time": string,"technician_id": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "end_time": string,"id"?: string,"start_time": string,"technician_id": string,"weekday": number
                  }
                  Update: {
                    "end_time"?: string,"id"?: string,"start_time"?: string,"technician_id"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "technician_availability_technician_id_fkey"
      columns: ["technician_id"]
isOneToOne: false
      referencedRelation: "technician_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"technician_overrides": {
                  Row: {
                    "date": string,"end_time": string | null,"id": string,"is_off": boolean,"start_time": string | null,"technician_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "date": string,"end_time"?: string | null,"id"?: string,"is_off"?: boolean,"start_time"?: string | null,"technician_id": string
                  }
                  Update: {
                    "date"?: string,"end_time"?: string | null,"id"?: string,"is_off"?: boolean,"start_time"?: string | null,"technician_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "technician_overrides_technician_id_fkey"
      columns: ["technician_id"]
isOneToOne: false
      referencedRelation: "technician_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                },"technician_profiles": {
                  Row: {
                    "active": boolean,"display_name": string,"photo_path": string | null,"priority_rating": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"display_name": string,"photo_path"?: string | null,"priority_rating"?: number,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"display_name"?: string,"photo_path"?: string | null,"priority_rating"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "technician_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"technician_skills": {
                  Row: {
                    "skill_id": string,"technician_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "skill_id": string,"technician_id": string
                  }
                  Update: {
                    "skill_id"?: string,"technician_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "technician_skills_skill_id_fkey"
      columns: ["skill_id"]
isOneToOne: false
      referencedRelation: "skills"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "technician_skills_technician_id_fkey"
      columns: ["technician_id"]
isOneToOne: false
      referencedRelation: "technician_profiles"
      referencedColumns: ["user_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "assign_technician":
{ Args: { "p_booking": string,"p_crew_role"?: Database["public"]['Enums']["crew_role"],"p_technician": string }; Returns: {
              "assigned_by": string | null,
"booking_id": string,
"completed_at": string | null,
"created_at": string,
"crew_role": Database["public"]['Enums']["crew_role"],
"ends_at": string | null,
"id": string,
"started_at": string | null,
"starts_at": string | null,
"status": Database["public"]['Enums']["assignment_status"],
"technician_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "job_assignments"
        isOneToOne: true
        isSetofReturn: false
      } },
"auth_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"booking_id_from_path":
{ Args: { "p_path": string }; Returns: string
                           },
"can_view_booking":
{ Args: { "p_booking": string }; Returns: boolean
                           },
"complete_job":
{ Args: { "p_billed_hours"?: number,"p_booking": string }; Returns: undefined
                           },
"has_capability":
{ Args: { "p_capability": string }; Returns: boolean
                           },
"is_assigned_technician":
{ Args: { "p_booking": string }; Returns: boolean
                           },
"is_desk":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"move_booking_status":
{ Args: { "p_booking": string,"p_note"?: string,"p_to": Database["public"]['Enums']["booking_status"] }; Returns: undefined
                           },
"my_profile_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"owns_booking":
{ Args: { "p_booking": string }; Returns: boolean
                           },
"record_cash_handover":
{ Args: { "p_amount": number,"p_note"?: string }; Returns: {
              "amount": number,
"confirmed_at": string | null,
"confirmed_by": string | null,
"created_at": string,
"id": string,
"note": string | null,
"technician_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "cash_handovers"
        isOneToOne: true
        isSetofReturn: false
      } },
"record_cash_payment":
{ Args: { "p_amount": number,"p_booking": string }; Returns: {
              "amount": number,
"booking_id": string,
"created_at": string,
"id": string,
"method": Database["public"]['Enums']["payment_method"],
"paid_at": string | null,
"provider": string | null,
"provider_reference": string | null,
"recorded_by": string | null,
"status": Database["public"]['Enums']["payment_status"]
            }
                          SetofOptions: {
        from: "*"
        to: "payments"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_booking_on_the_way":
{ Args: { "p_booking": string }; Returns: undefined
                           },
"start_job":
{ Args: { "p_booking": string }; Returns: undefined
                           }
          }
          Enums: {
            "app_role": "customer"|"technician"|"laundry_operator"|"sales_operator"|"customer_relations"|"manager"|"admin","assignment_status": "assigned"|"accepted"|"declined"|"in_progress"|"done"|"removed","booking_source": "app"|"staff"|"sales","booking_status": "requested"|"awaiting_confirmation"|"confirmed"|"scheduled"|"on_the_way"|"in_progress"|"completed"|"cancelled","cash_dispute_status": "open"|"resolved","crew_role": "lead"|"helper","payment_method": "app"|"cash","payment_status": "pending"|"paid"|"failed"|"refunded","photo_kind": "before"|"after","pricing_type": "fixed"|"hourly"|"quote","profile_status": "active"|"deactivated"
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
            "app_role": ["customer", "technician", "laundry_operator", "sales_operator", "customer_relations", "manager", "admin"],"assignment_status": ["assigned", "accepted", "declined", "in_progress", "done", "removed"],"booking_source": ["app", "staff", "sales"],"booking_status": ["requested", "awaiting_confirmation", "confirmed", "scheduled", "on_the_way", "in_progress", "completed", "cancelled"],"cash_dispute_status": ["open", "resolved"],"crew_role": ["lead", "helper"],"payment_method": ["app", "cash"],"payment_status": ["pending", "paid", "failed", "refunded"],"photo_kind": ["before", "after"],"pricing_type": ["fixed", "hourly", "quote"],"profile_status": ["active", "deactivated"]
          }
        }
} as const
