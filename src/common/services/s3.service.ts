import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucketName = process.env.AWS_S3_BUCKET || '0xmart-products-bucket';

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    this.logger.log(`S3 Service initialized with bucket: ${this.bucketName} in region: ${this.region}`);
  }

  /**
   * Upload a file to S3 and return the public URL
   * @param file - File buffer and metadata
   * @param folder - Optional folder path within the bucket (e.g., 'products', 'sellers')
   * @returns Public URL of the uploaded file
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'products',
  ): Promise<string> {
    try {
      // Generate unique filename
      const fileExtension = file.originalname.split('.').pop() || '';
      const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

      // Determine Content-Disposition based on file type
      // For documents, use 'inline' to display in browser, with original filename
      const isDocument = ['pdf', 'doc', 'docx'].includes(fileExtension.toLowerCase());
      const contentDisposition = isDocument
        ? `inline; filename="${encodeURIComponent(file.originalname)}"`
        : undefined;

      // Upload to S3
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,

          ...(contentDisposition && { ContentDisposition: contentDisposition }),
        },
      });

      await upload.done();

      // Construct the public URL
      const publicUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${fileName}`;

      this.logger.log(`File uploaded successfully: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${error.message}`, error.stack);
      throw new Error('Failed to upload file to S3');
    }
  }

  /**
   * Upload multiple files to S3
   * @param files - Array of files to upload
   * @param folder - Optional folder path
   * @returns Array of public URLs
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = 'products',
  ): Promise<string[]> {
    try {
      const uploadPromises = files.map((file) => this.uploadFile(file, folder));
      const urls = await Promise.all(uploadPromises);
      this.logger.log(`Uploaded ${urls.length} files successfully`);
      return urls;
    } catch (error) {
      this.logger.error(`Failed to upload multiple files: ${error.message}`, error.stack);
      throw new Error('Failed to upload files to S3');
    }
  }

  /**
   * Delete a file from S3 using its URL
   * @param fileUrl - Public URL of the file to delete
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract the key from the URL
      const urlParts = fileUrl.split('.amazonaws.com/');
      if (urlParts.length !== 2) {
        throw new Error('Invalid S3 URL format');
      }

      const key = urlParts[1];

      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from S3: ${error.message}`, error.stack);
      throw new Error('Failed to delete file from S3');
    }
  }

  /**
   * Delete multiple files from S3
   * @param fileUrls - Array of public URLs to delete
   */
  async deleteMultipleFiles(fileUrls: string[]): Promise<void> {
    try {
      const deletePromises = fileUrls.map((url) => this.deleteFile(url));
      await Promise.all(deletePromises);
      this.logger.log(`Deleted ${fileUrls.length} files successfully`);
    } catch (error) {
      this.logger.error(`Failed to delete multiple files: ${error.message}`, error.stack);
      throw new Error('Failed to delete files from S3');
    }
  }

  /**
   * Check if S3 is properly configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_S3_BUCKET &&
      process.env.AWS_REGION
    );
  }
}
