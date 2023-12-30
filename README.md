## Image Compression Cloud Function

# How It Works
The function is triggerd by an event created when an image is uploaded 
to the Cloud Storage bucket.

** Make sure you have activated the necessary GCLOUD apis

** Make sure you have two sorage buckets, one for compressed images and aother for uncompressed images

# NOTE

The cloud function will automatically delete images when an image is succesfully compressed and converted to webp.

GIVE THE CLOUD FUNTION at least 512 MB memory and 1 CPU