import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { PRACTITIONER_TYPE, type PractitionerType } from '@careconnect/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { DirectorySearchQueryDto } from './directory.dto';
import {
  DirectoryService,
  type DirectorySearchResult,
  type PractitionerProfile,
} from './directory.service';

/** No auth required — this is the public doctor/practitioner directory. */
@Controller('directory')
@Public()
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  @Get('practitioners')
  search(
    @Query() query: DirectorySearchQueryDto,
  ): Promise<DirectorySearchResult> {
    return this.directoryService.search(query);
  }

  /** Feeds the practitioner-registration specialty picker. */
  @Get('specialties')
  listSpecialties(@Query('practitionerType') practitionerType?: string) {
    if (
      practitionerType !== undefined &&
      !PRACTITIONER_TYPE.includes(practitionerType as PractitionerType)
    ) {
      throw new BadRequestException('Invalid practitionerType');
    }
    return this.directoryService.listSpecialties(
      practitionerType as PractitionerType | undefined,
    );
  }

  @Get('practitioners/:slug')
  async findBySlug(@Param('slug') slug: string): Promise<PractitionerProfile> {
    const profile = await this.directoryService.findBySlug(slug);
    if (!profile) {
      throw new NotFoundException('Practitioner not found');
    }
    return profile;
  }
}
