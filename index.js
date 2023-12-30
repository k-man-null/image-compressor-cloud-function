const functions = require('@google-cloud/functions-framework');
const { Storage } = require('@google-cloud/storage');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

const compressedImagesBucket = process.env.COMPRESSED_IMAGES_BUCKET

const storage = new Storage();

let type;

functions.cloudEvent('helloGCS', async (cloudEvent) => {

  const bucket = cloudEvent.data.bucket;
  const name = cloudEvent.data.name;
  const file = storage.bucket(bucket).file(name);
  const destinationFolder = 'compressed';

  const [metadata] = await storage.bucket(bucket).file(name).getMetadata();

  type = metadata.metadata["type"];

  const compressedFilename = path.basename(file.name, path.extname(file.name)) + '.webp';
  const compressedFile = storage.bucket('tikitiki-image-server').file(`${destinationFolder}/${compressedFilename}`);
  const [compressedFileExists] = await compressedFile.exists();
  if (compressedFileExists) {
    console.log(`File ${compressedFilename} already exists in ${destinationFolder}. Skipping processing.`);
    return;
  }

  console.log(`Compressing file :  ${name}`);

  try {

    return await processImage(file, compressedFilename, destinationFolder, bucket);

  } catch (err) {
    console.error(`Failed to compress ${file.name}.`, err);
    throw err;
  }


});

const processImage = async (file, compressedFilename, destinationFolder) => {
  const tempLocalPath = `/tmp/${path.parse(file.name).base}`;
  const tempCompressedPath = `/tmp/${path.parse(file.name).name}-compressed.webp`;

  // Download file from bucket.
  try {
    await file.download({ destination: tempLocalPath });

    console.log(`Downloaded ${file.name} to ${tempLocalPath}.`);

  } catch (err) {

    throw new Error(`File download failed: ${err}`);

  }

  await new Promise((resolve, reject) => {

    const format = path.extname(file.name);

    let transformer;

    if (format === '.jpeg' || format === '.jpg') {
      transformer = sharp(tempLocalPath).jpeg({ quality: 40 });
    } else if (format === '.png') {
      transformer = sharp(tempLocalPath).png({ compressionLevel: 4 });
    } else {
      console.log(`Unsupported format: ${format}`);
      return;
    }

    if (type === 'avatar') {
      transformer = transformer.resize({
        width: 100,
        height: 100,
        fit: 'cover',
      });
    }

    transformer.toFormat("webp").toFile(tempCompressedPath, (err, stdout) => {
      if (err) {
        console.error('Failed to process image.', err);
        reject(err);
      } else {
        console.log(`Compressed image: ${file.name}`);
        resolve(stdout);
      }
    })


  });

  const bucket = storage.bucket(compressedImagesBucket);

  try {
    await bucket.upload(tempCompressedPath, { destination: `${destinationFolder}/${compressedFilename}` });
    console.log(`Uploaded processed image to: ${destinationFolder}`);
  } catch (err) {
    throw new Error(`Unable to upload processed image to ${destinationFolder}: ${err}`);
  }

  try {
    const exists = await file.exists();
    if (exists[0]) {
      await file.delete();
      console.log('Deleted original image from uncompressed');
    } else {
      console.log('Original image does not exist in uncompressed');
    }
  } catch (err) {
    throw new Error(`Unable to delete original image from uncompressed: ${err}`);
  }


  fs.unlink(tempLocalPath);
  fs.unlink(tempCompressedPath);

  return;

}