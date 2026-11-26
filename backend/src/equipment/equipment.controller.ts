import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { parseIntId } from '../common/int-id.js';
import { Equipment } from './equipment.entity.js';
import { EquipmentService } from './equipment.service.js';

@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @Get()
  findAll(): Promise<Equipment[]> {
    return this.equipment.findAll();
  }

  @Get(':id')
  findOne(@Param('id') rawId: string): Promise<Equipment> {
    const id = parseIntId(rawId);
    if (id === null) {
      throw new NotFoundException(`Equipment ${rawId} not found`);
    }
    return this.equipment.findById(id);
  }
}
