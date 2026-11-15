const cloudinary = require('cloudinary').v2;

// 1. Configure Cloudinary with environment credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function run() {
  try {
    console.log("1. Configured Cloudinary.");

    // 2. Upload an image from Cloudinary's demo domains
    const sampleImageUrl = 'https://res.cloudinary.com/demo/image/upload/dog.jpg';
    console.log("2. Uploading sample image: " + sampleImageUrl);
    
    const uploadResult = await cloudinary.uploader.upload(sampleImageUrl, {
      public_id: 'sample_dog_onboarding'
    });

    console.log("Secure URL: " + uploadResult.secure_url);
    console.log("Public ID: " + uploadResult.public_id);

    // 3. Get image details by fetching its resource metadata
    console.log("3. Fetching image details from Cloudinary API...");
    const details = await cloudinary.api.resource(uploadResult.public_id);
    
    console.log("Image Details:");
    console.log("Width: " + details.width + "px");
    console.log("Height: " + details.height + "px");
    console.log("Format: " + details.format);
    console.log("File Size: " + details.bytes + " bytes");

    // 4. Transform the image
    // - fetch_format: 'auto' (f_auto) dynamically selects the best image format for the client browser (e.g., webp, avif)
    // - quality: 'auto' (q_auto) optimizes compression to balance visual quality and small file sizes
    const transformedUrl = cloudinary.url(uploadResult.public_id, {
      fetch_format: 'auto',
      quality: 'auto',
      secure: true
    });

    console.log("\n4. Transforming the image...");
    console.log("Done! Click link below to see optimized version of the image. Check the size and the format.");
    console.log(transformedUrl);

  } catch (error) {
    console.error("Cloudinary error:", error);
  }
}

run();
