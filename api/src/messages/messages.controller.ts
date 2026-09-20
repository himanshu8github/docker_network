import { Controller, Get, Post, Body, Param, Query, ParseIntPipe, Req } from '@nestjs/common';
import { Request } from 'express';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { Message } from './message.entity';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('telemetry/live')
  getTelemetry(@Req() req: Request) {
    return this.messagesService.getTelemetry(req.headers);
  }

  @Post()
  create(@Body() createMessageDto: CreateMessageDto): Promise<Message> {
    return this.messagesService.create(createMessageDto);
  }

  @Get()
  findAll(@Query('tab') tab?: string): Promise<Message[]> {
    return this.messagesService.findAll(tab);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Message> {
    return this.messagesService.findOne(id);
  }
}
