import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { S3Service } from '../../common/services/s3.service';

@ApiTags('upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private readonly s3Service: S3Service) {}

  @Post('image')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
      fileFilter: (req, file, callback) => {
        // Accept images only
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return callback(
            new BadRequestException('Only image files are allowed (jpg, jpeg, png, gif, webp)'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload a single image to S3' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        folder: {
          type: 'string',
          description: 'Optional folder path (e.g., products, sellers)',
          default: 'products',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Image uploaded successfully',
    schema: {
      example: {
        url: 'https://0xmart-products-bucket.s3.us-east-1.amazonaws.com/products/uuid.jpg',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or file too large' })
  async uploadImage(@UploadedFile() file: Express.Multer.File): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!this.s3Service.isConfigured()) {
      throw new BadRequestException(
        'S3 is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, and AWS_REGION environment variables',
      );
    }

    const url = await this.s3Service.uploadFile(file, 'products');
    return { url };
  }

  @Post('images')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      // Max 10 files
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per file
      },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return callback(
            new BadRequestException('Only image files are allowed (jpg, jpeg, png, gif, webp)'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload multiple images to S3 (max 10)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        folder: {
          type: 'string',
          description: 'Optional folder path',
          default: 'products',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Images uploaded successfully',
    schema: {
      example: {
        urls: [
          'https://0xmart-products-bucket.s3.us-east-1.amazonaws.com/products/uuid1.jpg',
          'https://0xmart-products-bucket.s3.us-east-1.amazonaws.com/products/uuid2.jpg',
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or files too large' })
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]): Promise<{ urls: string[] }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    if (!this.s3Service.isConfigured()) {
      throw new BadRequestException(
        'S3 is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, and AWS_REGION environment variables',
      );
    }

    const urls = await this.s3Service.uploadMultipleFiles(files, 'products');
    return { urls };
  }

  @Post('document')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for documents
      },
      fileFilter: (req, file, callback) => {
        // Accept documents: PDF, DOC, DOCX, and images
        const allowedMimeTypes = [
          'application/pdf',
          'application/msword', // .doc
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
          'image/jpeg',
          'image/jpg',
          'image/png',
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Only PDF, DOC, DOCX, JPG, and PNG files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload a document (PDF, DOC, DOCX, JPG, PNG) to S3' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Document uploaded successfully',
    schema: {
      example: {
        url: 'https://0xmart-products-bucket.s3.us-east-1.amazonaws.com/documents/uuid.pdf',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or file too large' })
  async uploadDocument(@UploadedFile() file: Express.Multer.File): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!this.s3Service.isConfigured()) {
      throw new BadRequestException(
        'S3 is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, and AWS_REGION environment variables',
      );
    }

    const url = await this.s3Service.uploadFile(file, 'documents');
    return { url };
  }
}
