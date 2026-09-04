import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventResponseDto } from './dto/event-response.dto';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get all events' })
  @ApiResponse({ status: 200, type: [EventResponseDto] })
  findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.eventsService.findAll(req.user?.userId, req.user?.type, { page, limit, search, status });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Get('recent-registrations')
  @ApiOperation({ summary: 'Get recent registrations' })
  @ApiResponse({ status: 200 })
  getRecentRegistrations() {
    return this.eventsService.getRecentRegistrations();
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Get an event by its slug' })
  @ApiResponse({ status: 200, type: EventResponseDto })
  getBySlug(@Param('slug') slug: string, @Request() req: any) {
    return this.eventsService.findBySlug(slug, req.user?.userId, req.user?.type);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Get(':id/registrations')
  @ApiOperation({ summary: 'List registrations for an event' })
  getRegistrations(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.eventsService.getEventRegistrations(id, { page, limit, status });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({ status: 201, type: EventResponseDto })
  create(@Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(createEventDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Update an event' })
  @ApiResponse({ status: 200, type: EventResponseDto })
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventsService.update(id, updateEventDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an event' })
  @ApiResponse({ status: 200 })
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  @ApiBearerAuth()
  @Post(':id/register')
  @ApiOperation({ summary: 'Register for an event' })
  @ApiResponse({ status: 201 })
  register(@Param('id') id: string, @Request() req: any) {
    return this.eventsService.registerForEvent(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Post(':id/registrations/:regId/approve')
  @ApiOperation({ summary: 'Approve an event registration' })
  approveRegistration(@Param('id') id: string, @Param('regId') regId: string) {
    return this.eventsService.updateRegistrationStatus(id, regId, 'APPROVED');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Post(':id/registrations/:regId/reject')
  @ApiOperation({ summary: 'Reject an event registration' })
  rejectRegistration(@Param('id') id: string, @Param('regId') regId: string) {
    return this.eventsService.updateRegistrationStatus(id, regId, 'REJECTED');
  }
}
