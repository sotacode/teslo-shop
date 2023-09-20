import { Controller, Post, Res, UploadedFile, UseInterceptors, BadRequestException, Get, Param } from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { fileFilter } from './helpers/fileFilter.helper';
import { diskStorage } from 'multer';
import { fileNamer } from './helpers/fileNamer.helper';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    
    private readonly configService: ConfigService, 
  ) {}

  @Post('product')
  @UseInterceptors(FileInterceptor('file', {
    fileFilter: fileFilter,
    /* limits: {
      fileSize: 1000
    }, */
    storage: diskStorage({
      destination: './static/products',
      filename: fileNamer
    })
  }))
  uploadProductImage(@UploadedFile() file: Express.Multer.File ){
    console.log(file)
    if(!file) throw new BadRequestException(`Make sure that the file is an image.`)
    
    const secureUrl = `${this.configService.get('HOST_API')}/files/product/${file.filename}`

    return {file: secureUrl};
  }


  @Get('product/:imageName')
  findProductImage(
    @Res() response: Response,
    @Param('imageName') imageName: string
  ){
    const path = this.filesService.getStaticProductImage(imageName);

    response.sendFile(path)
  }
  
}
