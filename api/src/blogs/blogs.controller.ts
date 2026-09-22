import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BlogsService } from './blogs.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';

@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.blogsService.findAll(page, limit, search, category);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.blogsService.findOne(id);
  }

  @Post()
  @UseGuards(ClerkAuthGuard)
  create(@Body() createBlogDto: CreateBlogDto, @Req() req: any) {
    return this.blogsService.create(createBlogDto, req.user);
  }

  @Patch(':id')
  @UseGuards(ClerkAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBlogDto: UpdateBlogDto,
    @Req() req: any,
  ) {
    return this.blogsService.update(id, updateBlogDto, req.user);
  }

  @Delete(':id')
  @UseGuards(ClerkAuthGuard)
  delete(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.blogsService.delete(id, req.user);
  }
}
