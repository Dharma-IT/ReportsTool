# HubSpot deal fields

Verified through the connected HubSpot API on November 11, 2026. These are available deal properties, not the columns currently included in the contact migration CSVs.

## Pipelines

### New leads 2025 (693198644)

- NEW LEAD (1013987699)
- EVALUATION SCHEDULED (1013987700)
- WAITING FOR PAYMENT (1013987701)
- FUTURE CONTACT (1013987704)
- PAID (1013987702)
- MEDICALLY APPROVED (WON) (1013987703)
- LOST (1013987705)
- REFUND (1309338715)
- DISPUTE WON (1312177288)

### Customer Service (709161049)

- NEW CLIENT (1083360850)
- EVALUATION SCHEDULED (1036251693)
- WAITING FOT PAYMENT (1036251694)
- PAID (1036251695)
- FUTURE CONTACT (1036251698)
- MEDICALLY APPROVED (WON) (1036251696)
- PROBLEM (1083226191)
- LOST (1036251697)
- REFUND (1077842974)
- DISPUTE WON (1312178967)

## Available deal properties

| Field label | API property | Type | Hidden |
| --- | --- | --- | --- |
| Dirección del domicilio | address | string | No |
| Agent Lead Management | agent_lead_management | enumeration | No |
| Agent Notes | agent_notes | string | No |
| Amount | amount | number | No |
| Amount before installment fee | amount_before_installment_fee | number | No |
| Amount Dispute Won | amount_dispute_won | number | No |
| Amount in company currency | amount_in_home_currency | number | No |
| Amount Waiting for Payment | amount_waiting_for_payment | number | No |
| Appointment Status | appointment_status | enumeration | No |
| Medical approval | aprobacion_medica | enumeration | No |
| Biological Sex  | biological_sex | enumeration | No |
| Clasificación de prospecto  | calificacion_de_prospecto | enumeration | No |
| Call Status | call_status | enumeration | No |
| Call status nutri 1 | call_status_nutri_1 | enumeration | No |
| Call status nutri 2 | call_status_nutri_2 | enumeration | No |
| Call summary | call_summary | string | No |
| Cantidad producto 1 | cantidad_producto_1 | number | No |
| Account holder | card_holder | string | No |
| Chanel | chanel | enumeration | No |
| Channel | channel | enumeration | No |
| Lead Classification | classification | enumeration | No |
| Closed Lost Reason | closed_lost_reason | string | No |
| Closed Won Reason | closed_won_reason | string | No |
| Close Date | closedate | datetime | No |
| Contact Status | contact_status | enumeration | No |
| Create Deal | create_deal | enumeration | No |
| Created by AI Bot | created_by_ai_bot | bool | No |
| Create Date | createdate | datetime | No |
| Creation Source | creation_source | enumeration | No |
| CS - Date entered - PAID | cs___date_entered___paid | date | No |
| Evaluation date and hour (text) | date_and_hour_text | string | No |
| Date entered - EVALUATION SCHEDULED | date_entered___evaluation_scheduled | date | No |
| Date entered - FUTURE CONTACT | date_entered___future_contact | date | No |
| Date entered - ICE BOX | date_entered___ice_box | date | No |
| Date entered - LOST | date_entered___lost | date | No |
| Date Entered - MEDICALLY APPROVED | date_entered___medically_approved | date | No |
| Date entered - NEW LEAD | date_entered___new_lead | date | No |
| Date Entered - PAID | date_entered___paid | date | No |
| Date Entered - Problem | date_entered___problem | date | No |
| Date of contact | date_of_contact | datetime | No |
| Days to close | days_to_close | number | No |
| Currency | deal_currency_code | enumeration | No |
| Deal Description (Aggregate) | deal_description_items__test | string | No |
| Deal Name | dealname | string | No |
| Deal Stage | dealstage | enumeration | No |
| Deal Type | dealtype | enumeration | No |
| Deal Description | description | string | No |
| Description (Auto) | description_auto | string | No |
| Description (Line Items) | description_line_items | string | No |
| Desired treatment | desired_treatment | enumeration | No |
| Desired treatment Subscription 1 | desired_treatment_1 | enumeration | No |
| Desired treatment Subscription 2 | desired_treatment_2 | enumeration | No |
| Desired treatment Subscription 3 | desired_treatment_3 | enumeration | No |
| Desired Treatment Single Purchase | desired_treatment_form | enumeration | No |
| Desired Treatment Single Purchase 1 | desired_treatment_single_purchase_1 | enumeration | No |
| Peso deseado | desired_weight | string | No |
| Dia de shipping/s | dia_de_shipping_s | date | No |
| Diff Date | diff_date | number | No |
| Discount name | discount_name | string | No |
| Correo | email | string | No |
| Date of last meeting booked in meetings tool | engagements_last_meeting_booked | datetime | No |
| Campaign of last booking in meetings tool | engagements_last_meeting_booked_campaign | string | No |
| Medium of last booking in meetings tool | engagements_last_meeting_booked_medium | string | No |
| Source of last booking in meetings tool | engagements_last_meeting_booked_source | string | No |
| Escala de satisfacción | escala_de_satisfaccion | enumeration | No |
| Etapa desde la que se movió a ICEBOX | etapa_desde_la_que_se_movio_a_icebox | enumeration | No |
| Etiqueta vendedora | etiqueta_vendedora | enumeration | No |
| OLD - Evaluation date and hour | evaluation_date_and_hour | date | No |
| Evaluation date and hour | evaluation_date_and_hour_2 | datetime | No |
| Follow-Up Date | fecha_para_retomar_contacto | date | No |
| Fecha de teleconsulta | fecha_y_hora_de_teleconsulta | date | No |
| Nombre | firstname | string | No |
| Follow-up Needed? | follow_up_needed_ | enumeration | No |
| Free medication | free_medication | enumeration | No |
| Future Contact Reason | future_contact_reason | enumeration | No |
| ¿Ha usado antes el producto? Especifique cual utilizo | ha_usado_antes_el_producto | string | No |
| Hora de teleconsulta | hora_de_teleconsulta | enumeration | No |
| Actual duration | hs_actual_duration | number | No |
| Annual contract value | hs_acv | number | No |
| All teams | hs_all_accessible_team_ids | enumeration | Yes |
| Brands | hs_all_assigned_business_unit_ids | enumeration | No |
| Deal Collaborator | hs_all_collaborator_owner_ids | enumeration | No |
| Deal Split Users | hs_all_deal_split_owner_ids | enumeration | No |
| All owner IDs | hs_all_owner_ids | enumeration | Yes |
| All team IDs | hs_all_team_ids | enumeration | Yes |
| Latest Traffic Source | hs_analytics_latest_source | enumeration | No |
| Latest Traffic Source Company | hs_analytics_latest_source_company | enumeration | Yes |
| Latest Traffic Source Contact | hs_analytics_latest_source_contact | enumeration | Yes |
| Latest Traffic Source Data 1 | hs_analytics_latest_source_data_1 | string | No |
| Latest Traffic Source Data 1 Company | hs_analytics_latest_source_data_1_company | string | Yes |
| Latest Traffic Source Data 1 Contact | hs_analytics_latest_source_data_1_contact | string | Yes |
| Latest Traffic Source Data 2 | hs_analytics_latest_source_data_2 | string | No |
| Latest Traffic Source Data 2 Company | hs_analytics_latest_source_data_2_company | string | Yes |
| Latest Traffic Source Data 2 Contact | hs_analytics_latest_source_data_2_contact | string | Yes |
| Latest Traffic Source Timestamp | hs_analytics_latest_source_timestamp | datetime | No |
| Latest Traffic Source Timestamp Company | hs_analytics_latest_source_timestamp_company | datetime | Yes |
| Latest Traffic Source Timestamp Contact | hs_analytics_latest_source_timestamp_contact | datetime | Yes |
| Original Traffic Source | hs_analytics_source | enumeration | No |
| Original Traffic Source Drill-Down 1 | hs_analytics_source_data_1 | string | No |
| Original Traffic Source Drill-Down 2 | hs_analytics_source_data_2 | string | No |
| Annual recurring revenue | hs_arr | number | No |
| Associated Shared Deal Type | hs_associated_deal_registration_deal_type | enumeration | No |
| Associated Shared Deal Product Interests | hs_associated_deal_registration_product_interests | enumeration | No |
| Attributed reporting team | hs_attributed_team_ids | enumeration | Yes |
| Average call duration | hs_average_call_duration | number | Yes |
| Average Deal Owner Duration In Current Stage | hs_average_deal_owner_duration_in_current_stage | number | No |
| HubSpot Campaign | hs_campaign | string | Yes |
| Closed Deal Amount | hs_closed_amount | number | Yes |
| Closed deal amount in home currency | hs_closed_amount_in_home_currency | number | Yes |
| Closed Deal Close Date | hs_closed_deal_close_date | number | Yes |
| Closed Deal Create Date | hs_closed_deal_create_date | number | Yes |
| Closed won count | hs_closed_won_count | number | No |
| Closed Won Date (Internal) | hs_closed_won_date | datetime | Yes |
| Created by user ID | hs_created_by_user_id | number | No |
| HubSpot Create Date | hs_createdate | datetime | Yes |
| Cross-account note | hs_cross_account_note | string | Yes |
| Cross-sell Opportunity | hs_cross_sell_opportunity | bool | Yes |
| Days to close (without rounding) | hs_days_to_close_raw | number | Yes |
| Deal amount calculation preference | hs_deal_amount_calculation_preference | enumeration | Yes |
| HubSpot Shared Deal MRR | hs_deal_registration_mrr | number | No |
| HubSpot Shared Deal MRR Currency Code | hs_deal_registration_mrr_currency_code | enumeration | No |
| Deal Score | hs_deal_score | number | No |
| Deal probability | hs_deal_stage_probability | number | No |
| Deal stage probability shadow | hs_deal_stage_probability_shadow | number | Yes |
| Exchange rate | hs_exchange_rate | number | No |
| Forecast amount | hs_forecast_amount | number | No |
| Forecast probability | hs_forecast_probability | number | No |
| Form ID | hs_form_id | string | No |
| Has Empty Conditional Stage Properties | hs_has_empty_conditional_stage_properties | bool | Yes |
| Has Last Conversation Follow Ups | hs_has_last_conversation_follow_ups | bool | No |
| Has Last Meeting Follow Ups | hs_has_last_meeting_followups | bool | No |
| Is Active Shared Deal | hs_is_active_shared_deal | bool | No |
| Is Deal Closed? | hs_is_closed | bool | No |
| Is Closed (numeric) | hs_is_closed_count | number | No |
| Is closed lost | hs_is_closed_lost | bool | No |
| Is Closed Won | hs_is_closed_won | bool | No |
| Deal Split Added | hs_is_deal_split | bool | No |
| Is In First Deal Stage | hs_is_in_first_deal_stage | bool | Yes |
| Is Open (numeric) | hs_is_open_count | number | No |
| Is Stalled | hs_is_stalled | bool | No |
| Is Stalled After Timestamp | hs_is_stalled_after_timestamp | datetime | No |
| Last call ID with followups | hs_last_call_id_with_followups | number | Yes |
| Last conversation with follow-ups | hs_last_conversation_with_followups_object_coordinates | object_coordinates | No |
| Last email with follow-ups | hs_last_email_with_followups_object_coordinates | string | No |
| Last follow-up timestamp | hs_last_followup_timestamp | datetime | Yes |
| Last GS Shared Message | hs_last_gs_shared_message | datetime | No |
| Last meeting ID with followups | hs_last_meeting_id_with_followups | number | Yes |
| Last Partner Shared Message Date | hs_last_partner_shared_message_date | date | No |
| Last Shared Message Create Date | hs_last_shared_message_create_date | datetime | Yes |
| Last Modified Date | hs_lastmodifieddate | datetime | No |
| Latest Approval Status | hs_latest_approval_status | string | No |
| Latest Approval Status Approval ID | hs_latest_approval_status_approval_id | number | Yes |
| Latest marketing email click date | hs_latest_marketing_email_click_date | datetime | Yes |
| Latest marketing email open date | hs_latest_marketing_email_open_date | datetime | Yes |
| Latest marketing email reply date | hs_latest_marketing_email_reply_date | datetime | Yes |
| Latest meeting activity | hs_latest_meeting_activity | datetime | Yes |
| Latest sales email click date | hs_latest_sales_email_click_date | datetime | Yes |
| Latest sales email open date | hs_latest_sales_email_open_date | datetime | Yes |
| Latest sales email reply date | hs_latest_sales_email_reply_date | datetime | Yes |
| Likelihood to close by the close date | hs_likelihood_to_close | number | Yes |
| Global Term Line Item Discount Percentage | hs_line_item_global_term_hs_discount_percentage | string | Yes |
| Global Term Line Item Discount Percentage Enabled | hs_line_item_global_term_hs_discount_percentage_enabled | bool | Yes |
| Global Term Line Item Recurring Billing Period | hs_line_item_global_term_hs_recurring_billing_period | string | Yes |
| Global Term Line Item Recurring Billing Period Enabled | hs_line_item_global_term_hs_recurring_billing_period_enabled | bool | Yes |
| Global Term Line Item Recurring Billing Start Date | hs_line_item_global_term_hs_recurring_billing_start_date | string | Yes |
| Global Term Line Item Recurring Billing Start Date Enabled | hs_line_item_global_term_hs_recurring_billing_start_date_enabled | bool | Yes |
| Global Term Line Item Recurring Billing Frequency | hs_line_item_global_term_recurringbillingfrequency | string | Yes |
| Global Term Line Item Recurring Billing Frequency Enabled | hs_line_item_global_term_recurringbillingfrequency_enabled | bool | Yes |
| Manual campaign ids | hs_manual_campaign_ids | number | Yes |
| Forecast category | hs_manual_forecast_category | enumeration | No |
| Merged Deal IDs | hs_merged_object_ids | enumeration | No |
| Monthly recurring revenue | hs_mrr | number | No |
| Net Pipeline Impact | hs_net_pipeline_impact | number | Yes |
| Next Meeting | hs_next_meeting_id | number | No |
| Next Meeting Name | hs_next_meeting_name | string | No |
| Next Meeting Start Time | hs_next_meeting_start_time | datetime | No |
| Next step | hs_next_step | string | No |
| Next Step Updated At | hs_next_step_updated_at | datetime | Yes |
| Last Activity | hs_notes_last_activity | object_coordinates | Yes |
| Next Activity | hs_notes_next_activity | object_coordinates | No |
| Next Activity Type | hs_notes_next_activity_type | enumeration | Yes |
| Number of Active Deal Registrations | hs_num_associated_active_deal_registrations | number | No |
| Number of Deal Registrations | hs_num_associated_deal_registrations | number | No |
| Number of Deal Splits | hs_num_associated_deal_splits | number | Yes |
| Number of Associated Line Items | hs_num_of_associated_line_items | number | No |
| Number of target accounts | hs_num_target_accounts | number | Yes |
| Number of call engagements | hs_number_of_call_engagements | number | Yes |
| Number of inbound calls | hs_number_of_inbound_calls | number | Yes |
| Number of outbound calls | hs_number_of_outbound_calls | number | Yes |
| Number of overdue tasks | hs_number_of_overdue_tasks | number | Yes |
| Number of scheduled meetings | hs_number_of_scheduled_meetings | number | Yes |
| Record ID | hs_object_id | number | No |
| Record creation source | hs_object_source | string | Yes |
| Record source detail 1 | hs_object_source_detail_1 | string | No |
| Record source detail 2 | hs_object_source_detail_2 | string | No |
| Record source detail 3 | hs_object_source_detail_3 | string | No |
| Record creation source ID | hs_object_source_id | string | Yes |
| Record source | hs_object_source_label | enumeration | No |
| Record creation source user ID | hs_object_source_user_id | number | Yes |
| Open amount in home currency | hs_open_amount_in_home_currency | number | Yes |
| Open deal create date | hs_open_deal_create_date | number | Yes |
| Owning Teams | hs_owning_teams | enumeration | Yes |
| Partner Tech Win | hs_partner_tech_win | enumeration | No |
| Pinned Engagement ID | hs_pinned_engagement_id | number | Yes |
| The predicted deal amount | hs_predicted_amount | number | Yes |
| The predicted deal amount in your company's currency | hs_predicted_amount_in_home_currency | number | Yes |
| Price book reassignment status | hs_price_book_reassignment_status | enumeration | Yes |
| Primary Associated Company | hs_primary_associated_company | number | Yes |
| Primary quote data updated at | hs_primary_quote_data_updated_at | datetime | Yes |
| Priority | hs_priority | enumeration | No |
| Weighted amount | hs_projected_amount | number | No |
| Weighted amount in company currency | hs_projected_amount_in_home_currency | number | No |
| Read only object | hs_read_only | bool | Yes |
| Recent Sales Email Replied Date | hs_sales_email_last_replied | datetime | Yes |
| Shared teams | hs_shared_team_ids | enumeration | No |
| Shared users | hs_shared_user_ids | enumeration | No |
| Source Object ID | hs_source_object_id | number | Yes |
| Submission Idempotent ID | hs_submission_idempotent_id | string | Yes |
| HubSpot Sales Lead | hs_synced_deal_owner_name_and_email | string | No |
| Deal Tags | hs_tag_ids | enumeration | No |
| Total contract value | hs_tcv | number | No |
| Unique creation key | hs_unique_creation_key | string | Yes |
| Updated by user ID | hs_updated_by_user_id | number | No |
| User IDs of all notification followers | hs_user_ids_of_all_notification_followers | enumeration | Yes |
| Deal record followers | hs_user_ids_of_all_notification_recipients | enumeration | No |
| User IDs of all notification unfollowers | hs_user_ids_of_all_notification_unfollowers | enumeration | Yes |
| User IDs of all owners | hs_user_ids_of_all_owners | enumeration | Yes |
| Cumulative time in "NEW LEAD (New leads 2025)" | hs_v2_cumulative_time_in_1013987699 | number | No |
| Cumulative time in "EVALUATION SCHEDULED (New leads 2025)" | hs_v2_cumulative_time_in_1013987700 | number | No |
| Cumulative time in "WAITING FOR PAYMENT (New leads 2025)" | hs_v2_cumulative_time_in_1013987701 | number | No |
| Cumulative time in "PAID (New leads 2025)" | hs_v2_cumulative_time_in_1013987702 | number | No |
| Cumulative time in "MEDICALLY APPROVED (WON) (New leads 2025)" | hs_v2_cumulative_time_in_1013987703 | number | No |
| Cumulative time in "FUTURE CONTACT (New leads 2025)" | hs_v2_cumulative_time_in_1013987704 | number | No |
| Cumulative time in "LOST  (New leads 2025)" | hs_v2_cumulative_time_in_1013987705 | number | No |
| Cumulative time in "EVALUATION SCHEDULED (Customer Service)" | hs_v2_cumulative_time_in_1036251693 | number | No |
| Cumulative time in "WAITING FOT PAYMENT (Customer Service)" | hs_v2_cumulative_time_in_1036251694 | number | No |
| Cumulative time in "PAID (Customer Service)" | hs_v2_cumulative_time_in_1036251695 | number | No |
| Cumulative time in "MEDICALLY APPROVED (WON) (Customer Service)" | hs_v2_cumulative_time_in_1036251696 | number | No |
| Cumulative time in "LOST (Customer Service)" | hs_v2_cumulative_time_in_1036251697 | number | No |
| Cumulative time in "FUTURE CONTACT (Customer Service)" | hs_v2_cumulative_time_in_1036251698 | number | No |
| Cumulative time in "REFUND (Customer Service)" | hs_v2_cumulative_time_in_1077842974 | number | No |
| Cumulative time in "PROBLEM (Customer Service)" | hs_v2_cumulative_time_in_1083226191 | number | No |
| Cumulative time in "NEW CLIENT (Customer Service)" | hs_v2_cumulative_time_in_1083360850 | number | No |
| Cumulative time in "REFUND (New leads 2025)" | hs_v2_cumulative_time_in_1309338715 | number | No |
| Cumulative time in "DISPUTE WON (New leads 2025)" | hs_v2_cumulative_time_in_1312177288 | number | No |
| Cumulative time in "DISPUTE WON (Customer Service)" | hs_v2_cumulative_time_in_1312178967 | number | No |
| Date entered "NEW LEAD (New leads 2025)" | hs_v2_date_entered_1013987699 | datetime | No |
| Date entered "EVALUATION SCHEDULED (New leads 2025)" | hs_v2_date_entered_1013987700 | datetime | No |
| Date entered "WAITING FOR PAYMENT (New leads 2025)" | hs_v2_date_entered_1013987701 | datetime | No |
| Date entered "PAID (New leads 2025)" | hs_v2_date_entered_1013987702 | datetime | No |
| Date entered "MEDICALLY APPROVED (WON) (New leads 2025)" | hs_v2_date_entered_1013987703 | datetime | No |
| Date entered "FUTURE CONTACT (New leads 2025)" | hs_v2_date_entered_1013987704 | datetime | No |
| Date entered "LOST  (New leads 2025)" | hs_v2_date_entered_1013987705 | datetime | No |
| Date entered "EVALUATION SCHEDULED (Customer Service)" | hs_v2_date_entered_1036251693 | datetime | No |
| Date entered "WAITING FOT PAYMENT (Customer Service)" | hs_v2_date_entered_1036251694 | datetime | No |
| Date entered "PAID (Customer Service)" | hs_v2_date_entered_1036251695 | datetime | No |
| Date entered "MEDICALLY APPROVED (WON) (Customer Service)" | hs_v2_date_entered_1036251696 | datetime | No |
| Date entered "LOST (Customer Service)" | hs_v2_date_entered_1036251697 | datetime | No |
| Date entered "FUTURE CONTACT (Customer Service)" | hs_v2_date_entered_1036251698 | datetime | No |
| Date entered "REFUND (Customer Service)" | hs_v2_date_entered_1077842974 | datetime | No |
| Date entered "PROBLEM (Customer Service)" | hs_v2_date_entered_1083226191 | datetime | No |
| Date entered "NEW CLIENT (Customer Service)" | hs_v2_date_entered_1083360850 | datetime | No |
| Date entered "REFUND (New leads 2025)" | hs_v2_date_entered_1309338715 | datetime | No |
| Date entered "DISPUTE WON (New leads 2025)" | hs_v2_date_entered_1312177288 | datetime | No |
| Date entered "DISPUTE WON (Customer Service)" | hs_v2_date_entered_1312178967 | datetime | No |
| Date entered current stage | hs_v2_date_entered_current_stage | datetime | No |
| Date exited "NEW LEAD (New leads 2025)" | hs_v2_date_exited_1013987699 | datetime | No |
| Date exited "EVALUATION SCHEDULED (New leads 2025)" | hs_v2_date_exited_1013987700 | datetime | No |
| Date exited "WAITING FOR PAYMENT (New leads 2025)" | hs_v2_date_exited_1013987701 | datetime | No |
| Date exited "PAID (New leads 2025)" | hs_v2_date_exited_1013987702 | datetime | No |
| Date exited "MEDICALLY APPROVED (WON) (New leads 2025)" | hs_v2_date_exited_1013987703 | datetime | No |
| Date exited "FUTURE CONTACT (New leads 2025)" | hs_v2_date_exited_1013987704 | datetime | No |
| Date exited "LOST  (New leads 2025)" | hs_v2_date_exited_1013987705 | datetime | No |
| Date exited "EVALUATION SCHEDULED (Customer Service)" | hs_v2_date_exited_1036251693 | datetime | No |
| Date exited "WAITING FOT PAYMENT (Customer Service)" | hs_v2_date_exited_1036251694 | datetime | No |
| Date exited "PAID (Customer Service)" | hs_v2_date_exited_1036251695 | datetime | No |
| Date exited "MEDICALLY APPROVED (WON) (Customer Service)" | hs_v2_date_exited_1036251696 | datetime | No |
| Date exited "LOST (Customer Service)" | hs_v2_date_exited_1036251697 | datetime | No |
| Date exited "FUTURE CONTACT (Customer Service)" | hs_v2_date_exited_1036251698 | datetime | No |
| Date exited "REFUND (Customer Service)" | hs_v2_date_exited_1077842974 | datetime | No |
| Date exited "PROBLEM (Customer Service)" | hs_v2_date_exited_1083226191 | datetime | No |
| Date exited "NEW CLIENT (Customer Service)" | hs_v2_date_exited_1083360850 | datetime | No |
| Date exited "REFUND (New leads 2025)" | hs_v2_date_exited_1309338715 | datetime | No |
| Date exited "DISPUTE WON (New leads 2025)" | hs_v2_date_exited_1312177288 | datetime | No |
| Date exited "DISPUTE WON (Customer Service)" | hs_v2_date_exited_1312178967 | datetime | No |
| Latest time in "NEW LEAD (New leads 2025)" | hs_v2_latest_time_in_1013987699 | number | No |
| Latest time in "EVALUATION SCHEDULED (New leads 2025)" | hs_v2_latest_time_in_1013987700 | number | No |
| Latest time in "WAITING FOR PAYMENT (New leads 2025)" | hs_v2_latest_time_in_1013987701 | number | No |
| Latest time in "PAID (New leads 2025)" | hs_v2_latest_time_in_1013987702 | number | No |
| Latest time in "MEDICALLY APPROVED (WON) (New leads 2025)" | hs_v2_latest_time_in_1013987703 | number | No |
| Latest time in "FUTURE CONTACT (New leads 2025)" | hs_v2_latest_time_in_1013987704 | number | No |
| Latest time in "LOST  (New leads 2025)" | hs_v2_latest_time_in_1013987705 | number | No |
| Latest time in "EVALUATION SCHEDULED (Customer Service)" | hs_v2_latest_time_in_1036251693 | number | No |
| Latest time in "WAITING FOT PAYMENT (Customer Service)" | hs_v2_latest_time_in_1036251694 | number | No |
| Latest time in "PAID (Customer Service)" | hs_v2_latest_time_in_1036251695 | number | No |
| Latest time in "MEDICALLY APPROVED (WON) (Customer Service)" | hs_v2_latest_time_in_1036251696 | number | No |
| Latest time in "LOST (Customer Service)" | hs_v2_latest_time_in_1036251697 | number | No |
| Latest time in "FUTURE CONTACT (Customer Service)" | hs_v2_latest_time_in_1036251698 | number | No |
| Latest time in "REFUND (Customer Service)" | hs_v2_latest_time_in_1077842974 | number | No |
| Latest time in "PROBLEM (Customer Service)" | hs_v2_latest_time_in_1083226191 | number | No |
| Latest time in "NEW CLIENT (Customer Service)" | hs_v2_latest_time_in_1083360850 | number | No |
| Latest time in "REFUND (New leads 2025)" | hs_v2_latest_time_in_1309338715 | number | No |
| Latest time in "DISPUTE WON (New leads 2025)" | hs_v2_latest_time_in_1312177288 | number | No |
| Latest time in "DISPUTE WON (Customer Service)" | hs_v2_latest_time_in_1312178967 | number | No |
| Time in current stage | hs_v2_time_in_current_stage | datetime | No |
| Performed in an import | hs_was_imported | bool | Yes |
| Weighted open pipeline in company currency | hs_weighted_pipeline_in_company_currency | number | No |
| Owner assigned date | hubspot_owner_assigneddate | datetime | No |
| Deal owner | hubspot_owner_id | enumeration | No |
| HubSpot Team | hubspot_team_id | enumeration | No |
| Idioma | idioma_hablado | enumeration | No |
| Imported Deal | imported_deal | enumeration | No |
| Imported Source | imported_source | enumeration | No |
| include_in_yesterday_view | include_in_yesterday_view | enumeration | No |
| Installment fee | installment_fee | number | No |
| Estado de la factura | invoice_status_negocio | enumeration | No |
| Apellido | lastname | string | No |
| Line Item Count Helper | line_item_count_helper | number | No |
| Long-term reason | long_term_reason | enumeration | No |
| Medicamento ordenado  | medicamento_ordenado | enumeration | No |
| Meeting Type | meeting_type | enumeration | No |
| Payment Method OLD | metodo_de_pago | enumeration | No |
| Monto de pago | monto_de_pago | number | No |
| Motivo emocional por el que quiere comprar las inyecciones (si hay) | motivo_emocional_para_comprar_las_inyecciones | string | No |
| Net Revenue | net_revenue | number | No |
| Next Contact Date | next_contact_date | date | No |
| Nombre del paciente | nombre_del_paciente | string | No |
| Nombre del usuario | nombre_del_usuario | string | No |
| Nombre producto 1 | nombre_producto_1 | string | No |
| Notas | notas | string | No |
| Payment Notes | noted | string | No |
| Last Contacted | notes_last_contacted | datetime | No |
| Last Activity Date | notes_last_updated | datetime | No |
| Next Activity Date | notes_next_activity_date | datetime | No |
| Number of Associated Contacts | num_associated_contacts | number | No |
| Number of times contacted | num_contacted_notes | number | No |
| Number of Sales Activities | num_notes | number | No |
| Observation | observation | string | No |
| Paid date (all pipelines) | paid_date_all_pipelines | date | No |
| Date Entered - WAITING FOT PAYMENT | payment_pending_date | date | No |
| Payment Status | payment_status | enumeration | No |
| Payment Method | payment_type | enumeration | No |
| Peso actual | peso_actual | string | No |
| Phone Number | phone | string | No |
| Pipeline | pipeline | enumeration | No |
| Preffered Language | preffered_language | string | No |
| Prefered Language | preffered_language_ | enumeration | No |
| Problem description | problem_description | string | No |
| Producto enviado  | producto_enviado | enumeration | No |
| Quantity Desired Treatment Subscription 1 | quantity_desired_treatment_1 | number | No |
| Quantity Desired Treatment Subscription 2 | quantity_desired_treatment_2 | number | No |
| Quantity Desired Treatment Subscription 3 | quantity_desired_treatment_3 | number | No |
| Quantity Desired Treatment Single Purchase | quantity_desired_treatment_form | number | No |
| Quantity Desired Treatment Single Purchase 1 | quantity_desired_treatment_single_purchase_1 | number | No |
| Razón de cierres perdidos | razon_de_cierres_perdidos | string | No |
| Real Date | real_date | datetime | No |
| Reason why don't qualified | reason_why_don_t_qualified | enumeration | No |
| Referral | referral | string | No |
| Referral Phone Number | referral_phone_number | string | No |
| Refund | refound | enumeration | No |
| Refund date (all pipelines) | refund_date_all_pipelines | date | No |
| Refund Notes | refund_notes | string | No |
| Review / Photo | review_photo | enumeration | No |
| Secretaria | secretaria | enumeration | No |
| Seller Classification | seller_classification | enumeration | No |
| Send confirmation | send_confirmation_v2 | enumeration | No |
| Shipping | shipping | enumeration | No |
| Source | source | enumeration | No |
| Source_deal | source_deal | enumeration | No |
| State ISO | state_iso | enumeration | No |
| Status del pago | status_del_pago | enumeration | No |
| Teleconsulta asistida | teleconsulta_asistida | enumeration | No |
| Producto de interés | tipo_de_tratamiento | enumeration | No |
| Total gasto en Dharma | total_gasto_en_dharma | number | No |
| Total Price with Installment Fee | total_price_with_installment_fee | number | No |
| Tracking code | tracking_code | string | No |
| Transaction Count | transaction_count | number | No |
| Transaction Numbers | transaction_numbers | number | No |
| Type Refund | type_refund | enumeration | No |
| Valor producto 1 | valor_producto_1 | number | No |
| Value Desired Treatment Subscription 1 | value_desired_treatment_1 | number | No |
| Value Desired Treatment Subscription 2 | value_desired_treatment_2 | number | No |
| Value Desired Treatment Subscription 3 | value_desired_treatment_3 | number | No |
| Value Desired Treatment Single Purchase | value_desired_treatment_form | number | No |
| Value Desired Treatment Single Purchase 1 | value_desired_treatment_single_purchase_1 | number | No |
| Value Refund | value_refund | number | No |
| Peso al inicio | weight | string | No |