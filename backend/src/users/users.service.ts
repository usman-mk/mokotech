import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppUser } from './app-user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(AppUser)
    private readonly repo: Repository<AppUser>,
  ) {}

  findAll(): Promise<AppUser[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  findById(id: number): Promise<AppUser | null> {
    return this.repo.findOneBy({ id });
  }
}
