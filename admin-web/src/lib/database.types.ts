
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "account_deletions": {
                  Row: {
                    "bookings_kept": number,"created_at": string,"deleted_by": string | null,"id": string,"phone_code": string,"profile_id": string,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bookings_kept"?: number,"created_at"?: string,"deleted_by"?: string | null,"id"?: string,"phone_code": string,"profile_id": string,"reason"?: string | null
                  }
                  Update: {
                    "bookings_kept"?: number,"created_at"?: string,"deleted_by"?: string | null,"id"?: string,"phone_code"?: string,"profile_id"?: string,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_deletions_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_deletions_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"addresses": {
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
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"id": number,"new_value": Json | null,"old_value": Json | null,"record_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"new_value"?: Json | null,"old_value"?: Json | null,"record_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"new_value"?: Json | null,"old_value"?: Json | null,"record_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"booking_drafts": {
                  Row: {
                    "abandoned_at": string | null,"booking_id": string | null,"created_at": string,"customer_id": string,"follow_up_reason": string | null,"followed_up_at": string | null,"followed_up_by": string | null,"id": string,"last_step": string | null,"payload": NonNullable<Json>,"selected_services": NonNullable<Json>,"status": Database["public"]['Enums']["draft_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "abandoned_at"?: string | null,"booking_id"?: string | null,"created_at"?: string,"customer_id": string,"follow_up_reason"?: string | null,"followed_up_at"?: string | null,"followed_up_by"?: string | null,"id"?: string,"last_step"?: string | null,"payload"?: NonNullable<Json>,"selected_services"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["draft_status"],"updated_at"?: string
                  }
                  Update: {
                    "abandoned_at"?: string | null,"booking_id"?: string | null,"created_at"?: string,"customer_id"?: string,"follow_up_reason"?: string | null,"followed_up_at"?: string | null,"followed_up_by"?: string | null,"id"?: string,"last_step"?: string | null,"payload"?: NonNullable<Json>,"selected_services"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["draft_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_drafts_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_drafts_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_drafts_followed_up_by_fkey"
      columns: ["followed_up_by"]
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
                },"booking_media": {
                  Row: {
                    "booking_id": string,"bytes": number | null,"client_id": string | null,"created_at": string,"created_by": string | null,"duration_ms": number | null,"height": number | null,"id": string,"kind": string,"mime_type": string | null,"status": string,"storage_path": string,"uploaded_at": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"bytes"?: number | null,"client_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"duration_ms"?: number | null,"height"?: number | null,"id"?: string,"kind": string,"mime_type"?: string | null,"status"?: string,"storage_path": string,"uploaded_at"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "booking_id"?: string,"bytes"?: number | null,"client_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"duration_ms"?: number | null,"height"?: number | null,"id"?: string,"kind"?: string,"mime_type"?: string | null,"status"?: string,"storage_path"?: string,"uploaded_at"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_media_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_media_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_messages": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"media_bytes": number | null,"media_duration_ms": number | null,"media_kind": string | null,"media_mime": string | null,"media_path": string | null,"sender_id": string,"thread_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"media_bytes"?: number | null,"media_duration_ms"?: number | null,"media_kind"?: string | null,"media_mime"?: string | null,"media_path"?: string | null,"sender_id": string,"thread_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"media_bytes"?: number | null,"media_duration_ms"?: number | null,"media_kind"?: string | null,"media_mime"?: string | null,"media_path"?: string | null,"sender_id"?: string,"thread_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_messages_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "booking_threads"
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
                },"booking_threads": {
                  Row: {
                    "booking_id": string,"created_at": string,"customer_id": string,"customer_last_read_at": string | null,"id": string,"last_message_at": string,"lead_id": string | null,"lead_last_read_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"created_at"?: string,"customer_id": string,"customer_last_read_at"?: string | null,"id"?: string,"last_message_at"?: string,"lead_id"?: string | null,"lead_last_read_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "booking_id"?: string,"created_at"?: string,"customer_id"?: string,"customer_last_read_at"?: string | null,"id"?: string,"last_message_at"?: string,"lead_id"?: string | null,"lead_last_read_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_threads_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_threads_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_threads_lead_id_fkey"
      columns: ["lead_id"]
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
                },"cancellation_requests": {
                  Row: {
                    "booking_id": string,"created_at": string,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"id": string,"reason": string,"requested_by": string,"status": Database["public"]['Enums']["request_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"reason": string,"requested_by": string,"status"?: Database["public"]['Enums']["request_status"]
                  }
                  Update: {
                    "booking_id"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"reason"?: string,"requested_by"?: string,"status"?: Database["public"]['Enums']["request_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "cancellation_requests_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cancellation_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cancellation_requests_requested_by_fkey"
      columns: ["requested_by"]
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
                    "active": boolean,"description": string | null,"display_order": number,"id": string,"image_path": string | null,"name": string,"parent_id": string | null,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"description"?: string | null,"display_order"?: number,"id"?: string,"image_path"?: string | null,"name": string,"parent_id"?: string | null,"slug": string
                  }
                  Update: {
                    "active"?: boolean,"description"?: string | null,"display_order"?: number,"id"?: string,"image_path"?: string | null,"name"?: string,"parent_id"?: string | null,"slug"?: string
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
                },"equipment": {
                  Row: {
                    "created_at": string,"id": string,"last_service_date": string | null,"location": string | null,"name": string,"status": Database["public"]['Enums']["equipment_status"],"type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_service_date"?: string | null,"location"?: string | null,"name": string,"status"?: Database["public"]['Enums']["equipment_status"],"type"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_service_date"?: string | null,"location"?: string | null,"name"?: string,"status"?: Database["public"]['Enums']["equipment_status"],"type"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"idempotency_keys": {
                  Row: {
                    "created_at": string,"id": string,"key": string,"method": string,"path": string,"response": Json | null,"status": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"key": string,"method": string,"path": string,"response"?: Json | null,"status": number,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"key"?: string,"method"?: string,"path"?: string,"response"?: Json | null,"status"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "idempotency_keys_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"inspection_addenda": {
                  Row: {
                    "author_id": string | null,"created_at": string,"id": string,"inspection_id": string,"note": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"created_at"?: string,"id"?: string,"inspection_id": string,"note": string
                  }
                  Update: {
                    "author_id"?: string | null,"created_at"?: string,"id"?: string,"inspection_id"?: string,"note"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inspection_addenda_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspection_addenda_inspection_id_fkey"
      columns: ["inspection_id"]
isOneToOne: false
      referencedRelation: "inspections"
      referencedColumns: ["id"]
    }
                  ]
                },"inspection_media": {
                  Row: {
                    "caption": string | null,"created_at": string,"id": string,"inspection_id": string,"kind": Database["public"]['Enums']["inspection_media_kind"],"storage_path": string,"taken_at": string | null,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string | null,"created_at"?: string,"id"?: string,"inspection_id": string,"kind"?: Database["public"]['Enums']["inspection_media_kind"],"storage_path": string,"taken_at"?: string | null,"uploaded_by"?: string | null
                  }
                  Update: {
                    "caption"?: string | null,"created_at"?: string,"id"?: string,"inspection_id"?: string,"kind"?: Database["public"]['Enums']["inspection_media_kind"],"storage_path"?: string,"taken_at"?: string | null,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inspection_media_inspection_id_fkey"
      columns: ["inspection_id"]
isOneToOne: false
      referencedRelation: "inspections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspection_media_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"inspections": {
                  Row: {
                    "booking_id": string,"checklist": NonNullable<Json>,"created_at": string,"id": string,"inspector_id": string | null,"measurements": NonNullable<Json>,"notes": string | null,"quote_id": string,"recommended_crew": number | null,"recommended_hours": number | null,"required_at": string,"required_by": string | null,"required_note": string | null,"scheduled_at": string | null,"started_at": string | null,"status": Database["public"]['Enums']["inspection_status"],"submitted_at": string | null,"updated_at": string,"withdrawn_by": string | null,"withdrawn_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"checklist"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"inspector_id"?: string | null,"measurements"?: NonNullable<Json>,"notes"?: string | null,"quote_id": string,"recommended_crew"?: number | null,"recommended_hours"?: number | null,"required_at"?: string,"required_by"?: string | null,"required_note"?: string | null,"scheduled_at"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["inspection_status"],"submitted_at"?: string | null,"updated_at"?: string,"withdrawn_by"?: string | null,"withdrawn_reason"?: string | null
                  }
                  Update: {
                    "booking_id"?: string,"checklist"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"inspector_id"?: string | null,"measurements"?: NonNullable<Json>,"notes"?: string | null,"quote_id"?: string,"recommended_crew"?: number | null,"recommended_hours"?: number | null,"required_at"?: string,"required_by"?: string | null,"required_note"?: string | null,"scheduled_at"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["inspection_status"],"submitted_at"?: string | null,"updated_at"?: string,"withdrawn_by"?: string | null,"withdrawn_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inspections_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspections_inspector_id_fkey"
      columns: ["inspector_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspections_quote_id_fkey"
      columns: ["quote_id"]
isOneToOne: false
      referencedRelation: "quotes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspections_required_by_fkey"
      columns: ["required_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspections_withdrawn_by_fkey"
      columns: ["withdrawn_by"]
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
                },"job_costs": {
                  Row: {
                    "amount": number,"approved_at": string | null,"approved_by": string | null,"booking_id": string,"created_at": string,"decision_note": string | null,"description": string,"entered_by": string,"id": string,"status": Database["public"]['Enums']["cost_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"approved_at"?: string | null,"approved_by"?: string | null,"booking_id": string,"created_at"?: string,"decision_note"?: string | null,"description": string,"entered_by": string,"id"?: string,"status"?: Database["public"]['Enums']["cost_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"approved_at"?: string | null,"approved_by"?: string | null,"booking_id"?: string,"created_at"?: string,"decision_note"?: string | null,"description"?: string,"entered_by"?: string,"id"?: string,"status"?: Database["public"]['Enums']["cost_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_costs_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_costs_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_costs_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
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
                },"laundry_orders": {
                  Row: {
                    "created_at": string,"created_by": string | null,"customer_id": string | null,"delivered_at": string | null,"id": string,"picked_up_at": string | null,"status": Database["public"]['Enums']["laundry_status"],"updated_at": string,"walk_in_name": string | null,"walk_in_phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"delivered_at"?: string | null,"id"?: string,"picked_up_at"?: string | null,"status"?: Database["public"]['Enums']["laundry_status"],"updated_at"?: string,"walk_in_name"?: string | null,"walk_in_phone"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"delivered_at"?: string | null,"id"?: string,"picked_up_at"?: string | null,"status"?: Database["public"]['Enums']["laundry_status"],"updated_at"?: string,"walk_in_name"?: string | null,"walk_in_phone"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "laundry_orders_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "laundry_orders_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"login_events": {
                  Row: {
                    "created_at": string,"device_name": string | null,"id": string,"ip": unknown,"location": string | null,"platform": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"device_name"?: string | null,"id"?: string,"ip"?: unknown,"location"?: string | null,"platform"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"device_name"?: string | null,"id"?: string,"ip"?: unknown,"location"?: string | null,"platform"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "login_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"machine_logs": {
                  Row: {
                    "action": string,"ended_at": string | null,"equipment_id": string,"id": string,"laundry_order_id": string | null,"operator_id": string | null,"started_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"ended_at"?: string | null,"equipment_id": string,"id"?: string,"laundry_order_id"?: string | null,"operator_id"?: string | null,"started_at"?: string
                  }
                  Update: {
                    "action"?: string,"ended_at"?: string | null,"equipment_id"?: string,"id"?: string,"laundry_order_id"?: string | null,"operator_id"?: string | null,"started_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "machine_logs_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "machine_logs_laundry_order_id_fkey"
      columns: ["laundry_order_id"]
isOneToOne: false
      referencedRelation: "laundry_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "machine_logs_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "booking_updates": boolean,"payment_updates": boolean,"promotions": boolean,"push_enabled": boolean,"quiet_end": string,"quiet_hours_enabled": boolean,"quiet_start": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_updates"?: boolean,"payment_updates"?: boolean,"promotions"?: boolean,"push_enabled"?: boolean,"quiet_end"?: string,"quiet_hours_enabled"?: boolean,"quiet_start"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "booking_updates"?: boolean,"payment_updates"?: boolean,"promotions"?: boolean,"push_enabled"?: boolean,"quiet_end"?: string,"quiet_hours_enabled"?: boolean,"quiet_start"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
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
                    "amount": number,"booking_id": string | null,"created_at": string,"id": string,"kind": string | null,"laundry_order_id": string | null,"method": Database["public"]['Enums']["payment_method"],"paid_at": string | null,"provider": string | null,"provider_reference": string | null,"recorded_by": string | null,"status": Database["public"]['Enums']["payment_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"booking_id"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string | null,"laundry_order_id"?: string | null,"method": Database["public"]['Enums']["payment_method"],"paid_at"?: string | null,"provider"?: string | null,"provider_reference"?: string | null,"recorded_by"?: string | null,"status"?: Database["public"]['Enums']["payment_status"]
                  }
                  Update: {
                    "amount"?: number,"booking_id"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string | null,"laundry_order_id"?: string | null,"method"?: Database["public"]['Enums']["payment_method"],"paid_at"?: string | null,"provider"?: string | null,"provider_reference"?: string | null,"recorded_by"?: string | null,"status"?: Database["public"]['Enums']["payment_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_laundry_order_id_fkey"
      columns: ["laundry_order_id"]
isOneToOne: false
      referencedRelation: "laundry_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"phone_otp_codes": {
                  Row: {
                    "attempts": number,"code_hash": string,"consumed_at": string | null,"created_at": string,"expires_at": string,"id": string,"phone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"code_hash": string,"consumed_at"?: string | null,"created_at"?: string,"expires_at": string,"id"?: string,"phone": string
                  }
                  Update: {
                    "attempts"?: number,"code_hash"?: string,"consumed_at"?: string | null,"created_at"?: string,"expires_at"?: string,"id"?: string,"phone"?: string
                  }
                  Relationships: [
                    
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
                },"quotes": {
                  Row: {
                    "booking_id": string,"created_at": string,"description": string | null,"expires_at": string | null,"id": string,"inspection_required": boolean,"prepared_by": string | null,"quoted_amount": number | null,"quoted_at": string | null,"requested_by": string | null,"responded_at": string | null,"status": Database["public"]['Enums']["quote_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"created_at"?: string,"description"?: string | null,"expires_at"?: string | null,"id"?: string,"inspection_required"?: boolean,"prepared_by"?: string | null,"quoted_amount"?: number | null,"quoted_at"?: string | null,"requested_by"?: string | null,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["quote_status"],"updated_at"?: string
                  }
                  Update: {
                    "booking_id"?: string,"created_at"?: string,"description"?: string | null,"expires_at"?: string | null,"id"?: string,"inspection_required"?: boolean,"prepared_by"?: string | null,"quoted_amount"?: number | null,"quoted_at"?: string | null,"requested_by"?: string | null,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["quote_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quotes_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: true
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotes_prepared_by_fkey"
      columns: ["prepared_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotes_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reactivation_requests": {
                  Row: {
                    "decided_at": string | null,"decided_by": string | null,"id": string,"message": string | null,"profile_id": string,"requested_at": string,"status": Database["public"]['Enums']["request_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"message"?: string | null,"profile_id": string,"requested_at"?: string,"status"?: Database["public"]['Enums']["request_status"]
                  }
                  Update: {
                    "decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"message"?: string | null,"profile_id"?: string,"requested_at"?: string,"status"?: Database["public"]['Enums']["request_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reactivation_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reactivation_requests_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"receipts": {
                  Row: {
                    "amount": number,"booking_id": string,"created_at": string,"id": string,"issued_to": string | null,"number": string,"payment_id": string | null,"storage_path": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"booking_id": string,"created_at"?: string,"id"?: string,"issued_to"?: string | null,"number": string,"payment_id"?: string | null,"storage_path"?: string | null
                  }
                  Update: {
                    "amount"?: number,"booking_id"?: string,"created_at"?: string,"id"?: string,"issued_to"?: string | null,"number"?: string,"payment_id"?: string | null,"storage_path"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "receipts_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "receipts_issued_to_fkey"
      columns: ["issued_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "receipts_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"referrals": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"invitee_id": string | null,"invitee_phone": string | null,"joined_at": string | null,"referrer_id": string,"reward_amount": number,"rewarded_at": string | null,"status": Database["public"]['Enums']["referral_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"invitee_id"?: string | null,"invitee_phone"?: string | null,"joined_at"?: string | null,"referrer_id": string,"reward_amount"?: number,"rewarded_at"?: string | null,"status"?: Database["public"]['Enums']["referral_status"]
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"invitee_id"?: string | null,"invitee_phone"?: string | null,"joined_at"?: string | null,"referrer_id"?: string,"reward_amount"?: number,"rewarded_at"?: string | null,"status"?: Database["public"]['Enums']["referral_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "referrals_invitee_id_fkey"
      columns: ["invitee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "referrals_referrer_id_fkey"
      columns: ["referrer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "booking_id": string,"comment": string | null,"created_at": string,"customer_id": string,"id": string,"rating": number,"service_id": string | null,"target_type": Database["public"]['Enums']["review_target"],"technician_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"comment"?: string | null,"created_at"?: string,"customer_id": string,"id"?: string,"rating": number,"service_id"?: string | null,"target_type": Database["public"]['Enums']["review_target"],"technician_id"?: string | null
                  }
                  Update: {
                    "booking_id"?: string,"comment"?: string | null,"created_at"?: string,"customer_id"?: string,"id"?: string,"rating"?: number,"service_id"?: string | null,"target_type"?: Database["public"]['Enums']["review_target"],"technician_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_technician_id_fkey"
      columns: ["technician_id"]
isOneToOne: false
      referencedRelation: "technician_profiles"
      referencedColumns: ["user_id"]
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
                },"saved_wallet_numbers": {
                  Row: {
                    "created_at": string,"id": string,"is_default": boolean,"label": string | null,"network": Database["public"]['Enums']["wallet_network"],"phone": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"label"?: string | null,"network": Database["public"]['Enums']["wallet_network"],"phone": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"label"?: string | null,"network"?: Database["public"]['Enums']["wallet_network"],"phone"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_wallet_numbers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
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
                    "active": boolean,"category_id": string,"created_at": string,"description": string | null,"duration_minutes": number,"excludes": (string)[] | null,"faqs": Json | null,"id": string,"image_path": string | null,"includes": (string)[] | null,"name": string,"popular_rank": number | null,"price": number,"pricing_type": Database["public"]['Enums']["pricing_type"],"required_skill_id": string | null,"slug": string | null,"tag": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"category_id": string,"created_at"?: string,"description"?: string | null,"duration_minutes"?: number,"excludes"?: (string)[] | null,"faqs"?: Json | null,"id"?: string,"image_path"?: string | null,"includes"?: (string)[] | null,"name": string,"popular_rank"?: number | null,"price"?: number,"pricing_type"?: Database["public"]['Enums']["pricing_type"],"required_skill_id"?: string | null,"slug"?: string | null,"tag"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"category_id"?: string,"created_at"?: string,"description"?: string | null,"duration_minutes"?: number,"excludes"?: (string)[] | null,"faqs"?: Json | null,"id"?: string,"image_path"?: string | null,"includes"?: (string)[] | null,"name"?: string,"popular_rank"?: number | null,"price"?: number,"pricing_type"?: Database["public"]['Enums']["pricing_type"],"required_skill_id"?: string | null,"slug"?: string | null,"tag"?: string | null
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
                },"support_conversations": {
                  Row: {
                    "category": Database["public"]['Enums']["support_category"],"created_at": string,"customer_id": string,"id": string,"last_message_at": string,"last_read_by_customer_at": string | null,"last_read_by_staff_at": string | null,"reference": string,"status": Database["public"]['Enums']["support_status"],"subject": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: Database["public"]['Enums']["support_category"],"created_at"?: string,"customer_id": string,"id"?: string,"last_message_at"?: string,"last_read_by_customer_at"?: string | null,"last_read_by_staff_at"?: string | null,"reference"?: string,"status"?: Database["public"]['Enums']["support_status"],"subject"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["support_category"],"created_at"?: string,"customer_id"?: string,"id"?: string,"last_message_at"?: string,"last_read_by_customer_at"?: string | null,"last_read_by_staff_at"?: string | null,"reference"?: string,"status"?: Database["public"]['Enums']["support_status"],"subject"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_conversations_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"support_messages": {
                  Row: {
                    "body": string,"booking_id": string | null,"conversation_id": string,"created_at": string,"id": string,"laundry_order_id": string | null,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"booking_id"?: string | null,"conversation_id": string,"created_at"?: string,"id"?: string,"laundry_order_id"?: string | null,"sender_id": string
                  }
                  Update: {
                    "body"?: string,"booking_id"?: string | null,"conversation_id"?: string,"created_at"?: string,"id"?: string,"laundry_order_id"?: string | null,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_messages_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "support_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "support_conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "support_messages_laundry_order_fk"
      columns: ["laundry_order_id"]
isOneToOne: false
      referencedRelation: "laundry_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "support_messages_sender_id_fkey"
      columns: ["sender_id"]
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
                    "active": boolean,"commission_rate": number,"display_name": string,"photo_path": string | null,"priority_rating": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"commission_rate"?: number,"display_name": string,"photo_path"?: string | null,"priority_rating"?: number,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"commission_rate"?: number,"display_name"?: string,"photo_path"?: string | null,"priority_rating"?: number,"user_id"?: string
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
            "account_deletion_blockers":
{ Args: { "p_profile": string }; Returns: Json
                           },
"account_deletion_status":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"add_job_cost":
{ Args: { "p_amount": number,"p_booking": string,"p_description": string }; Returns: {
              "amount": number,
"approved_at": string | null,
"approved_by": string | null,
"booking_id": string,
"created_at": string,
"decision_note": string | null,
"description": string,
"entered_by": string,
"id": string,
"status": Database["public"]['Enums']["cost_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "job_costs"
        isOneToOne: true
        isSetofReturn: false
      } },
"approve_cash_handover":
{ Args: { "p_handover": string,"p_note"?: string }; Returns: {
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
"audit_log_page":
{ Args: { "p_action"?: string,"p_actor"?: string,"p_from"?: string,"p_limit"?: number,"p_offset"?: number,"p_search"?: string,"p_table"?: string,"p_to"?: string }; Returns: {
              "action": string,"actor_id": string,"actor_name": string,"actor_role": string,"created_at": string,"id": number,"new_value": Json,"old_value": Json,"record_id": string,"table_name": string,"total": number
            }[]
                           },
"audit_log_summary":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"audit_log_tables":
{ Args: Record<PropertyKey, never>; Returns: {
              "events": number,"table_name": string
            }[]
                           },
"auth_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"booking_id_from_path":
{ Args: { "p_path": string }; Returns: string
                           },
"can_view_booking":
{ Args: { "p_booking": string }; Returns: boolean
                           },
"can_view_booking_thread":
{ Args: { "p_thread": string }; Returns: boolean
                           },
"can_view_conversation":
{ Args: { "p_conversation": string }; Returns: boolean
                           },
"can_view_inspection":
{ Args: { "p_inspection": string }; Returns: boolean
                           },
"cancel_booking":
{ Args: { "p_booking": string,"p_note"?: string,"p_reason": string }; Returns: Database["public"]['Enums']["booking_status"]
                           },
"complete_job":
{ Args: { "p_billed_hours"?: number,"p_booking": string }; Returns: undefined
                           },
"confirm_booking":
{ Args: { "p_booking": string,"p_note"?: string }; Returns: Database["public"]['Enums']["booking_status"]
                           },
"confirm_cash_handover":
{ Args: { "p_amount": number,"p_note"?: string,"p_technician": string }; Returns: {
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
"conversation_id_from_path":
{ Args: { "p_path": string }; Returns: string
                           },
"decide_cancellation_request":
{ Args: { "p_approve": boolean,"p_note"?: string,"p_request": string }; Returns: Database["public"]['Enums']["request_status"]
                           },
"decide_job_cost":
{ Args: { "p_approve": boolean,"p_cost": string,"p_note"?: string }; Returns: {
              "amount": number,
"approved_at": string | null,
"approved_by": string | null,
"booking_id": string,
"created_at": string,
"decision_note": string | null,
"description": string,
"entered_by": string,
"id": string,
"status": Database["public"]['Enums']["cost_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "job_costs"
        isOneToOne: true
        isSetofReturn: false
      } },
"expire_stale_quotes":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"finalise_customer_deletion":
{ Args: { "p_deleted_by"?: string,"p_phone_code": string,"p_profile": string,"p_reason"?: string }; Returns: Json
                           },
"has_capability":
{ Args: { "p_capability": string }; Returns: boolean
                           },
"inspection_detail":
{ Args: { "p_inspection": string }; Returns: {
              "address_line": string,"area": string,"booking_id": string,"booking_reference": string,"booking_status": Database["public"]['Enums']["booking_status"],"checklist": Json,"customer_name": string,"customer_phone": string,"id": string,"measurements": Json,"notes": string,"quote_amount": number,"quote_description": string,"quote_status": Database["public"]['Enums']["quote_status"],"recommended_crew": number,"recommended_hours": number,"required_at": string,"required_note": string,"scheduled_at": string,"scheduled_end": string,"scheduled_start": string,"services": string,"status": Database["public"]['Enums']["inspection_status"],"submitted_at": string
            }[]
                           },
"inspection_id_from_path":
{ Args: { "p_path": string }; Returns: string
                           },
"is_assigned_technician":
{ Args: { "p_booking": string }; Returns: boolean
                           },
"is_desk":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_laundry_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"job_cost_lines":
{ Args: { "p_booking"?: string }; Returns: {
              "amount": number,"approved_at": string,"approved_by_name": string,"booking_id": string,"created_at": string,"decision_note": string,"description": string,"entered_by_name": string,"id": string,"reference": string,"status": Database["public"]['Enums']["cost_status"]
            }[]
                           },
"job_cost_overview":
{ Args: { "p_from"?: string,"p_to"?: string }; Returns: {
              "booking_id": string,"commission": number,"commission_rate": number,"commission_ready": boolean,"costs": number,"customer_name": string,"margin": number,"pending_costs": number,"reference": string,"revenue": number,"scheduled_start": string,"status": Database["public"]['Enums']["booking_status"],"technicians": string
            }[]
                           },
"move_booking_status":
{ Args: { "p_booking": string,"p_note"?: string,"p_to": Database["public"]['Enums']["booking_status"] }; Returns: undefined
                           },
"my_inspections":
{ Args: Record<PropertyKey, never>; Returns: {
              "address_line": string,"area": string,"booking_id": string,"booking_reference": string,"booking_status": Database["public"]['Enums']["booking_status"],"checklist": Json,"customer_name": string,"customer_phone": string,"id": string,"measurements": Json,"notes": string,"quote_amount": number,"quote_description": string,"quote_status": Database["public"]['Enums']["quote_status"],"recommended_crew": number,"recommended_hours": number,"required_at": string,"required_note": string,"scheduled_at": string,"scheduled_end": string,"scheduled_start": string,"services": string,"status": Database["public"]['Enums']["inspection_status"],"submitted_at": string
            }[]
                           },
"my_profile_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"new_booking_reference":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"owns_booking":
{ Args: { "p_booking": string }; Returns: boolean
                           },
"queue_expo_push":
{ Args: { "p_body": string,"p_data"?: Json,"p_title": string,"p_user": string }; Returns: undefined
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
"booking_id": string | null,
"created_at": string,
"id": string,
"kind": string | null,
"laundry_order_id": string | null,
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
                           },
"submit_inspection":
{ Args: { "p_checklist"?: Json,"p_inspection": string,"p_measurements"?: Json,"p_notes"?: string,"p_recommended_crew"?: number,"p_recommended_hours"?: number }; Returns: Database["public"]['Enums']["inspection_status"]
                           }
          }
          Enums: {
            "app_role": "customer"|"technician"|"laundry_operator"|"sales_operator"|"customer_relations"|"manager"|"admin","assignment_status": "assigned"|"accepted"|"declined"|"in_progress"|"done"|"removed","booking_source": "app"|"staff"|"sales","booking_status": "requested"|"awaiting_confirmation"|"confirmed"|"scheduled"|"on_the_way"|"in_progress"|"completed"|"cancelled","cash_dispute_status": "open"|"resolved","cost_status": "submitted"|"approved"|"rejected","crew_role": "lead"|"helper","draft_status": "in_progress"|"abandoned"|"followed_up"|"completed","equipment_status": "available"|"in_use"|"maintenance"|"out_of_service","inspection_media_kind": "photo"|"video","inspection_status": "required"|"scheduled"|"in_progress"|"submitted"|"withdrawn","laundry_status": "received"|"washing"|"drying"|"ready"|"delivered","payment_method": "app"|"cash","payment_status": "pending"|"paid"|"failed"|"refunded","photo_kind": "before"|"after","pricing_type": "fixed"|"hourly"|"quote","profile_status": "active"|"deactivated","quote_status": "requested"|"inspection_required"|"inspection_scheduled"|"inspected"|"quoted"|"accepted"|"declined"|"expired","referral_status": "invited"|"joined"|"completed"|"rewarded"|"expired","request_status": "pending"|"approved"|"declined","review_target": "service"|"technician","support_category": "booking"|"payment"|"service"|"account"|"other","support_status": "open"|"waiting_on_customer"|"resolved","wallet_network": "MTN"|"Airtel"
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
  "public": {
          Enums: {
            "app_role": ["customer", "technician", "laundry_operator", "sales_operator", "customer_relations", "manager", "admin"],"assignment_status": ["assigned", "accepted", "declined", "in_progress", "done", "removed"],"booking_source": ["app", "staff", "sales"],"booking_status": ["requested", "awaiting_confirmation", "confirmed", "scheduled", "on_the_way", "in_progress", "completed", "cancelled"],"cash_dispute_status": ["open", "resolved"],"cost_status": ["submitted", "approved", "rejected"],"crew_role": ["lead", "helper"],"draft_status": ["in_progress", "abandoned", "followed_up", "completed"],"equipment_status": ["available", "in_use", "maintenance", "out_of_service"],"inspection_media_kind": ["photo", "video"],"inspection_status": ["required", "scheduled", "in_progress", "submitted", "withdrawn"],"laundry_status": ["received", "washing", "drying", "ready", "delivered"],"payment_method": ["app", "cash"],"payment_status": ["pending", "paid", "failed", "refunded"],"photo_kind": ["before", "after"],"pricing_type": ["fixed", "hourly", "quote"],"profile_status": ["active", "deactivated"],"quote_status": ["requested", "inspection_required", "inspection_scheduled", "inspected", "quoted", "accepted", "declined", "expired"],"referral_status": ["invited", "joined", "completed", "rewarded", "expired"],"request_status": ["pending", "approved", "declined"],"review_target": ["service", "technician"],"support_category": ["booking", "payment", "service", "account", "other"],"support_status": ["open", "waiting_on_customer", "resolved"],"wallet_network": ["MTN", "Airtel"]
          }
        }
} as const
