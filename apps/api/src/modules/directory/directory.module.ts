import { Module } from '@nestjs/common';
import { ReviewsModule } from '../reviews/reviews.module';
import { DirectoryController } from './directory.controller';
import { DirectoryService } from './directory.service';

@Module({
  imports: [ReviewsModule],
  controllers: [DirectoryController],
  providers: [DirectoryService],
})
export class DirectoryModule {}
