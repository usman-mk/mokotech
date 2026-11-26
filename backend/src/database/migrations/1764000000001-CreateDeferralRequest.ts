import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * deferral_request: one row per request to move an equipment's inspection
 * due date. Policy 4.2 routing is decided at submission and stored in
 * required_approver_role; the DB enforces the invariants that must never
 * break regardless of application bugs.
 */
export class CreateDeferralRequest1764000000001 implements MigrationInterface {
  name = 'CreateDeferralRequest1764000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE deferral_request (
        id                      serial       PRIMARY KEY,
        equipment_id            integer      NOT NULL REFERENCES equipment(id),
        requested_by            integer      NOT NULL REFERENCES app_user(id),
        previous_due_date       date         NOT NULL,
        cycle_base_due_date     date         NOT NULL,
        requested_due_date      date         NOT NULL,
        reason                  text         NOT NULL,
        status                  varchar(20)  NOT NULL DEFAULT 'pending',
        required_approver_role  varchar(30)  NOT NULL,
        policy_note             text         NULL,
        decided_by              integer      NULL REFERENCES app_user(id),
        decided_at              timestamptz  NULL,
        decision_note           text         NULL,
        created_at              timestamptz  NOT NULL DEFAULT now(),

        CONSTRAINT chk_deferral_status
          CHECK (status IN ('pending', 'approved', 'rejected')),
        CONSTRAINT chk_deferral_required_role
          CHECK (required_approver_role IN ('supervisor', 'department_manager')),
        -- a deferral can only move the date later, never earlier or equal
        CONSTRAINT chk_deferral_date_later
          CHECK (requested_due_date > previous_due_date),
        -- the cycle base is the earliest due date of the cycle
        CONSTRAINT chk_deferral_cycle_base
          CHECK (cycle_base_due_date <= previous_due_date),
        CONSTRAINT chk_deferral_reason_not_blank
          CHECK (length(btrim(reason)) > 0),
        -- pending has no decision; approved/rejected must record who and when
        CONSTRAINT chk_deferral_decision_consistent
          CHECK (
            (status = 'pending'  AND decided_by IS NULL     AND decided_at IS NULL)
         OR (status <> 'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
          )
      )
    `);

    // At most one open request per equipment: blocks duplicate/racing submits.
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_deferral_one_pending_per_equipment
        ON deferral_request (equipment_id)
        WHERE status = 'pending'
    `);

    // Counting approved deferrals within an inspection cycle (policy 4.2).
    await queryRunner.query(`
      CREATE INDEX ix_deferral_approved_by_cycle
        ON deferral_request (equipment_id, cycle_base_due_date)
        WHERE status = 'approved'
    `);

    // Pending-approval list.
    await queryRunner.query(`
      CREATE INDEX ix_deferral_status ON deferral_request (status)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS deferral_request`);
  }
}
