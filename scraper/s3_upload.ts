// Import required AWS SDK clients and commands for Node.js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Set the AWS region
const REGION = "eu-central-1"; //e.g. "us-east-1"

export async function uploadToS3(bucket: string, fileName: string, content: string) {
  // Set the parameters.
  const uploadParams = {
    Bucket: bucket,
    // Specify the name of the new object. For example, 'index.html'.
    // To create a directory for the object, use '/'. For example, 'myApp/package.json'.
    Key: fileName,
    // Content of the new object.
    Body: content,
  };

  // Create Amazon S3 service client object.
  const s3 = new S3Client({ region: REGION });

  try {
    const data = await s3.send(new PutObjectCommand(uploadParams));
    console.log(
      "Successfully uploaded object: " + uploadParams.Bucket + "/" + uploadParams.Key
    );
  } catch (err) {
    console.log("Error", err);
  }
}