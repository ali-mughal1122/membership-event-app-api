import { Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SupportService } from './support.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateSupportStatusDto } from './dto/update-support-status.dto';

@ApiTags('Support')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  @ApiBearerAuth()
  @Get('unread-count')
  @ApiOperation({ summary: 'Unread support conversation count for the current user' })
  unreadCount(@Request() req) {
    return this.supportService.unreadCount(req.user.userId, req.user.type);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'List the logged-in member support conversations' })
  findMine(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.supportService.findMine(req.user.userId, { page, limit, search, status });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  @ApiBearerAuth()
  @Get('me/:id')
  @ApiOperation({ summary: 'Get a member support conversation' })
  getMine(@Request() req, @Param('id') id: string) {
    return this.supportService.getForMember(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  @ApiBearerAuth()
  @Post('me/:id/messages')
  @ApiOperation({ summary: 'Reply to a member support conversation' })
  replyMine(@Request() req, @Param('id') id: string, @Body() dto: CreateMessageDto) {
    return this.supportService.replyAsMember(req.user.userId, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a support request' })
  create(@Request() req, @Body() dto: CreateConversationDto) {
    return this.supportService.createForMember(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'List all support conversations' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('urgency') urgency?: string,
  ) {
    return this.supportService.findAllForAdmin({ page, limit, search, status, categoryId, urgency });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: 'Get a support conversation' })
  getOne(@Param('id') id: string) {
    return this.supportService.getForAdmin(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Post(':id/messages')
  @ApiOperation({ summary: 'Reply to a support conversation as admin' })
  replyAdmin(@Request() req, @Param('id') id: string, @Body() dto: CreateMessageDto) {
    return this.supportService.replyAsAdmin(req.user.userId, id, dto, { email: req.user.email });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Put(':id/status')
  @ApiOperation({ summary: 'Resolve or reopen a support conversation' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateSupportStatusDto) {
    return this.supportService.updateStatus(id, dto.status);
  }
}
