import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Equipment } from './equipment.entity.js';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(Equipment)
    private readonly repo: Repository<Equipment>,
  ) {}

  /** Most urgent first (overdue at the top). */
  findAll(): Promise<Equipment[]> {
    return this.repo.find({ order: { nextDueDate: 'ASC', tagNo: 'ASC' } });
  }

  async findById(id: number): Promise<Equipment> {
    const equipment = await this.repo.findOneBy({ id });
    if (!equipment) {
      throw new NotFoundException(`Equipment ${id} not found`);
    }
    return equipment;
  }
}
