import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Query, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberResponseDto } from './dto/member-response.dto';

@ApiTags('Members')
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Get all members' })
  @ApiResponse({ status: 200, type: [MemberResponseDto] })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('duration') duration?: string,
  ) {
    return this.membersService.findAll({ page, limit, search, status, duration });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  @ApiBearerAuth()
  @Get('my-membership')
  @ApiOperation({ summary: 'Get current user membership' })
  @ApiResponse({ status: 200 })
  getMyMembership(@Request() req) {
    return this.membersService.getMyMembership(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Get('pending')
  @ApiOperation({ summary: 'Get all pending members' })
  @ApiResponse({ status: 200 })
  getPending() {
    return this.membersService.getPending();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER') // Assuming CLIENT uses this to apply for membership
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a new member' })
  @ApiResponse({ status: 201, type: MemberResponseDto })
  create(@Request() req, @Body() createMemberDto: CreateMemberDto) {
    return this.membersService.create({
      ...createMemberDto,
      userId: req.user.userId,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Update a member' })
  @ApiResponse({ status: 200, type: MemberResponseDto })
  update(@Param('id') id: string, @Body() updateMemberDto: UpdateMemberDto) {
    return this.membersService.update(id, updateMemberDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a member' })
  @ApiResponse({ status: 200 })
  remove(@Param('id') id: string) {
    return this.membersService.remove(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Post('pending/approve')
  @ApiOperation({ summary: 'Approve a pending member' })
  @ApiResponse({ status: 200 })
  approvePending(@Body() body: { id: string }) {
    return this.membersService.approvePending(body.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Post('pending/reject')
  @ApiOperation({ summary: 'Reject a pending member' })
  @ApiResponse({ status: 200 })
  rejectPending(@Body() body: { id: string }) {
    return this.membersService.rejectPending(body.id);
  }
}
