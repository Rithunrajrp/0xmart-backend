import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserAddressesService } from './user-addresses.service';
import { UserManagementModule } from '../user-management/user-management.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [UserManagementModule, forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersService, UserAddressesService],
  exports: [UsersService, UserAddressesService],
})
export class UsersModule {}
