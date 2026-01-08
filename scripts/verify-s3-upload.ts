
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '../.env') });

const region = process.env.AWS_REGION;
const bucket = process.env.AWS_S3_BUCKET;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

console.log('--- S3 Verification Script ---');
console.log(`Region: ${region}`);
console.log(`Bucket: ${bucket}`);
console.log(`AccessKeyId: ${accessKeyId ? 'Set' : 'Missing'}`);
console.log(`SecretAccessKey: ${secretAccessKey ? 'Set' : 'Missing'}`);

if (!region || !bucket || !accessKeyId || !secretAccessKey) {
  console.error('ERROR: Missing environment variables.');
  process.exit(1);
}

const client = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function run() {
  const key = `test-upload-${Date.now()}.txt`;
  console.log(`\nAttempting to upload file: ${key}...`);
  
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: 'Hello from verification script',
      ContentType: 'text/plain',

    }));
    console.log('SUCCESS: File uploaded successfully.');
    console.log(`URL: https://${bucket}.s3.${region}.amazonaws.com/${key}`);
  } catch (error: any) {
    console.error('FAILURE: Upload failed.');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    if (error.$metadata) {
      console.error('Metadata:', error.$metadata);
    }
  }
}

run();
