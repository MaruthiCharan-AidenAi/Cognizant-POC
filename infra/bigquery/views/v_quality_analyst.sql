-- ============================================================================
-- QUALITY ANALYST VIEWS (India & Brazil)
-- Purpose: Customer satisfaction & session quality — TCSAT deep dive, session metrics
-- Key questions: "Average OSAT?", "Lowest satisfaction pods?", "Session answer rate?", "Comment trends?"
-- ============================================================================

-- ── India ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW `tough-zoo-475011-s6.cognizant_poc.v_quality_analyst_india` AS
SELECT
  -- TCSAT (primary focus)
  tcsat_records.meeting_id                              AS meeting_id,
  tcsat_records.tcsat_company_id                        AS company_id,
  tcsat_records.company_name                            AS company_name,
  tcsat_records.q1_osat                                 AS osat_score,
  tcsat_records.q2_rsat                                 AS rsat_score,
  tcsat_records.q3_psat                                 AS psat_score,
  tcsat_records.response_start_date                     AS response_date,
  tcsat_records.response1_satisfaction                   AS satisfaction_response,
  tcsat_records.pod_name                                AS pod_name,
  tcsat_records.program                                 AS program,
  tcsat_records.response_id                             AS response_id,
  tcsat_records.has_comments                            AS has_comments,
  tcsat_records.seller_meeting_owner                    AS meeting_owner,
  tcsat_records.quarter                                 AS quarter,
  tcsat_records.tcsat_region                            AS region,
  tcsat_records.tcsat_sub_region                        AS sub_region,
  tcsat_records.tcsat_accounts_amount                   AS tcsat_accounts_amount,

  -- Session quality metrics
  session_data.sessions                                 AS total_sessions,
  session_data.completed_sessions                       AS completed_sessions,
  session_data.contact_attempt_sessions                 AS contact_attempt_sessions,
  session_data.answered_sessions                        AS answered_sessions,
  session_data.meet_session                             AS meet_sessions,
  session_data.meet_answered_sessions                   AS meet_answered_sessions,
  session_data.talk_time_seconds                        AS talk_time_seconds,
  session_data.phone_talk_time_seconds                  AS phone_talk_time_seconds,
  session_data.completed_phone_calls                    AS completed_phone_calls,
  session_data.final_status                             AS session_final_status,
  session_data.podname                                  AS session_pod_name,
  session_data.rep_ldap                                 AS rep_ldap,
  session_data.vendor_program                           AS session_vendor_program,
  session_data.session_start_hour                       AS session_start_hour,

  -- Productivity (for quality correlation)
  productivity_records.pointswoncapped                  AS points_won,
  productivity_records.pointswonandlivecapped           AS points_won_live,
  productivity_records.is_pitched                       AS is_pitched,
  productivity_records.is_adopted                       AS is_adopted,
  productivity_records.pitchstatus                      AS pitch_status,
  productivity_records.onboarding_pod_name              AS prod_pod_name,
  productivity_records.onboarding_program               AS prod_program,
  productivity_records.pp_year_quarter                  AS prod_year_quarter,

  -- Top-level
  off_program,
  off_podname,
  off_onboarding_region

FROM `tough-zoo-475011-s6.cognizant_poc.bqdata`
WHERE off_onboarding_region = 'India';


-- ── Brazil ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW `tough-zoo-475011-s6.cognizant_poc.v_quality_analyst_brazil` AS
SELECT
  tcsat_records.meeting_id                              AS meeting_id,
  tcsat_records.tcsat_company_id                        AS company_id,
  tcsat_records.company_name                            AS company_name,
  tcsat_records.q1_osat                                 AS osat_score,
  tcsat_records.q2_rsat                                 AS rsat_score,
  tcsat_records.q3_psat                                 AS psat_score,
  tcsat_records.response_start_date                     AS response_date,
  tcsat_records.response1_satisfaction                   AS satisfaction_response,
  tcsat_records.pod_name                                AS pod_name,
  tcsat_records.program                                 AS program,
  tcsat_records.response_id                             AS response_id,
  tcsat_records.has_comments                            AS has_comments,
  tcsat_records.seller_meeting_owner                    AS meeting_owner,
  tcsat_records.quarter                                 AS quarter,
  tcsat_records.tcsat_region                            AS region,
  tcsat_records.tcsat_sub_region                        AS sub_region,
  tcsat_records.tcsat_accounts_amount                   AS tcsat_accounts_amount,
  session_data.sessions                                 AS total_sessions,
  session_data.completed_sessions                       AS completed_sessions,
  session_data.contact_attempt_sessions                 AS contact_attempt_sessions,
  session_data.answered_sessions                        AS answered_sessions,
  session_data.meet_session                             AS meet_sessions,
  session_data.meet_answered_sessions                   AS meet_answered_sessions,
  session_data.talk_time_seconds                        AS talk_time_seconds,
  session_data.phone_talk_time_seconds                  AS phone_talk_time_seconds,
  session_data.completed_phone_calls                    AS completed_phone_calls,
  session_data.final_status                             AS session_final_status,
  session_data.podname                                  AS session_pod_name,
  session_data.rep_ldap                                 AS rep_ldap,
  session_data.vendor_program                           AS session_vendor_program,
  session_data.session_start_hour                       AS session_start_hour,
  productivity_records.pointswoncapped                  AS points_won,
  productivity_records.pointswonandlivecapped           AS points_won_live,
  productivity_records.is_pitched                       AS is_pitched,
  productivity_records.is_adopted                       AS is_adopted,
  productivity_records.pitchstatus                      AS pitch_status,
  productivity_records.onboarding_pod_name              AS prod_pod_name,
  productivity_records.onboarding_program               AS prod_program,
  productivity_records.pp_year_quarter                  AS prod_year_quarter,
  off_program,
  off_podname,
  off_onboarding_region
FROM `tough-zoo-475011-s6.cognizant_poc.bqdata`
WHERE off_onboarding_region = 'Brazil';
