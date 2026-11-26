import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Not,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { Equipment } from '../equipment/equipment.entity.js';
import type { AppUser } from '../users/app-user.entity.js';
import {
  canDecide,
  evaluateDeferralPolicy,
  resolveCycle,
  validateRequestedDate,
} from './deferral-policy.js';
import { DeferralRequest } from './deferral-request.entity.js';
import type {
  ApproveDeferralDto,
  CreateDeferralRequestDto,
  RejectDeferralDto,
} from './deferral.dto.js';

const PG_UNIQUE_VIOLATION = '23505';
const WITH_RELATIONS = { equipment: true, requestedBy: true, decidedBy: true };

/**
 * Submit / approve / reject. Every write runs in a transaction that first
 * locks the equipment row (SELECT ... FOR UPDATE), so two requests for the
 * same equipment are processed one after the other and policy 4.2 is always
 * evaluated against up-to-date data.
 */
@Injectable()
export class DeferralService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(DeferralRequest)
    private readonly requests: Repository<DeferralRequest>,
  ) {}

  async create(
    user: AppUser,
    dto: CreateDeferralRequestDto,
  ): Promise<DeferralRequest> {
    const id = await this.dataSource
      .transaction(async (m) => {
        const equipment = await this.lockEquipment(m, dto.equipmentId);

        const dateError = validateRequestedDate({
          requestedDueDate: dto.requestedDueDate,
          currentDueDate: equipment.nextDueDate,
          today: await this.databaseToday(m),
        });
        if (dateError) throw new BadRequestException(dateError);

        if (
          await m.existsBy(DeferralRequest, {
            equipmentId: equipment.id,
            status: 'pending',
          })
        ) {
          throw this.pendingConflict(equipment);
        }

        const { cycle, decision } = await this.evaluatePolicy(
          m,
          equipment,
          dto.requestedDueDate,
        );

        const saved = await m.save(
          m.create(DeferralRequest, {
            equipmentId: equipment.id,
            requestedById: user.id,
            previousDueDate: equipment.nextDueDate,
            cycleBaseDueDate: cycle.baseDueDate,
            requestedDueDate: dto.requestedDueDate,
            reason: dto.reason,
            status: 'pending',
            requiredApproverRole: decision.requiredApproverRole,
            policyNote: decision.reasons.join('; ') || null,
          }),
        );
        return saved.id;
      })
      .catch((error: unknown) => {
        // Backstop for the partial unique index (one pending per equipment).
        if (
          error instanceof QueryFailedError &&
          (error.driverError as { code?: string }).code === PG_UNIQUE_VIOLATION
        ) {
          throw new ConflictException(
            'This equipment already has a pending deferral request',
          );
        }
        throw error;
      });

    return this.findById(id);
  }

  async approve(
    user: AppUser,
    id: number,
    dto: ApproveDeferralDto,
  ): Promise<DeferralRequest> {
    await this.dataSource.transaction(async (m) => {
      const request = await this.lockPendingRequest(m, id);
      this.assertNotOwnRequest(user, request);

      const equipment = await this.lockEquipment(m, request.equipmentId);
      if (equipment.nextDueDate !== request.previousDueDate) {
        throw new ConflictException(
          `The equipment due date changed from ${request.previousDueDate} to ${equipment.nextDueDate} after this request was submitted; please submit a new request`,
        );
      }

      // Re-check policy 4.2 at approval time; never trust the stored routing.
      const { cycle, decision } = await this.evaluatePolicy(
        m,
        equipment,
        request.requestedDueDate,
      );
      if (!canDecide(user.role, decision.requiredApproverRole)) {
        throw this.forbiddenByPolicy(decision.requiredApproverRole);
      }

      await m.update(DeferralRequest, request.id, {
        status: 'approved',
        cycleBaseDueDate: cycle.baseDueDate,
        requiredApproverRole: decision.requiredApproverRole,
        policyNote: decision.reasons.join('; ') || null,
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNote: dto.note || null,
      });
      await m.update(Equipment, equipment.id, {
        nextDueDate: request.requestedDueDate,
      });
    });

    return this.findById(id);
  }

  async reject(
    user: AppUser,
    id: number,
    dto: RejectDeferralDto,
  ): Promise<DeferralRequest> {
    await this.dataSource.transaction(async (m) => {
      const request = await this.lockPendingRequest(m, id);
      this.assertNotOwnRequest(user, request);
      if (!canDecide(user.role, request.requiredApproverRole)) {
        throw this.forbiddenByPolicy(request.requiredApproverRole);
      }

      await m.update(DeferralRequest, request.id, {
        status: 'rejected',
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNote: dto.note,
      });
    });

    return this.findById(id);
  }

  /** All requests, newest first. */
  findAll(): Promise<DeferralRequest[]> {
    return this.requests.find({
      relations: WITH_RELATIONS,
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  /** Pending requests this user may decide (not their own), oldest first. */
  findPendingFor(user: AppUser): Promise<DeferralRequest[]> {
    return this.requests.find({
      where: {
        status: 'pending',
        requestedById: Not(user.id),
        ...(user.role === 'supervisor'
          ? { requiredApproverRole: 'supervisor' as const }
          : {}),
      },
      relations: WITH_RELATIONS,
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async findById(id: number): Promise<DeferralRequest> {
    const request = await this.requests.findOne({
      where: { id },
      relations: WITH_RELATIONS,
    });
    if (!request) {
      throw new NotFoundException(`Deferral request ${id} not found`);
    }
    return request;
  }

  // --- helpers -------------------------------------------------------------

  private async lockEquipment(
    m: EntityManager,
    equipmentId: number,
  ): Promise<Equipment> {
    const equipment = await m.findOne(Equipment, {
      where: { id: equipmentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!equipment) {
      throw new NotFoundException(`Equipment ${equipmentId} not found`);
    }
    return equipment;
  }

  private async lockPendingRequest(
    m: EntityManager,
    id: number,
  ): Promise<DeferralRequest> {
    const request = await m.findOne(DeferralRequest, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!request) {
      throw new NotFoundException(`Deferral request ${id} not found`);
    }
    if (request.status !== 'pending') {
      throw new ConflictException(
        `Deferral request ${id} is already ${request.status}`,
      );
    }
    return request;
  }

  /** Cycle + policy 4.2 decision from the approved history in the database. */
  private async evaluatePolicy(
    m: EntityManager,
    equipment: Equipment,
    requestedDueDate: string,
  ) {
    const approved = await m.find(DeferralRequest, {
      where: { equipmentId: equipment.id, status: 'approved' },
      order: { decidedAt: 'DESC', id: 'DESC' },
    });
    const cycle = resolveCycle(equipment.nextDueDate, approved);
    const decision = evaluateDeferralPolicy({
      criticality: equipment.criticality,
      cycle,
      requestedDueDate,
    });
    return { cycle, decision };
  }

  /** "Today" from Postgres, the same clock seed.sql's CURRENT_DATE uses. */
  private async databaseToday(m: EntityManager): Promise<string> {
    const rows: { today: string }[] = await m.query(
      `SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today`,
    );
    return rows[0].today;
  }

  private assertNotOwnRequest(user: AppUser, request: DeferralRequest): void {
    if (request.requestedById === user.id) {
      throw new ForbiddenException(
        'You cannot approve or reject your own request',
      );
    }
  }

  private forbiddenByPolicy(required: string): ForbiddenException {
    return new ForbiddenException(
      `Policy 4.2: this request must be decided by a ${required}`,
    );
  }

  private pendingConflict(equipment: Equipment): ConflictException {
    return new ConflictException(
      `Equipment ${equipment.tagNo} already has a pending deferral request`,
    );
  }
}
