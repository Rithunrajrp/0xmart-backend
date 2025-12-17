import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserAddressesService } from './user-addresses.service';
import { UserManagementModule } from '../user-management/user-management.module';

@Module({
  imports: [UserManagementModule],
  controllers: [UsersController],
  providers: [UsersService, UserAddressesService],
  exports: [UsersService, UserAddressesService],
})
export class UsersModule {}
