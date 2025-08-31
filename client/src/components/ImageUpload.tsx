import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ImageUploadProps {
  imageType: 'logo' | 'course-cover' | 'certificate-bg' | 'certificate-signature';
  currentImageUrl?: string;
  onImageUploaded: (publicPath: string) => void;
  buttonText?: string;
  buttonClassName?: string;
  showPreview?: boolean;
  previewClassName?: string;
  children?: React.ReactNode;
}

export function ImageUpload({
  imageType,
  currentImageUrl,
  onImageUploaded,
  buttonText,
  buttonClassName = "btn btn-outline",
  showPreview = true,
  previewClassName = "w-32 h-20 object-cover rounded border",
  children
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Only PNG, JPG, JPEG, WebP, and HEIC files are allowed.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Image must be smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      console.log(`Uploading ${imageType}:`, file.name, file.type, file.size);

      // Use new multipart/form-data upload
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/images/upload', {
        method: 'POST',
        credentials: 'include', // Include session cookies
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      console.log('Upload result:', result);

      // Call the callback with the image URL
      onImageUploaded(result.imageUrl);

      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset the input
      event.target.value = '';
    }
  };

  const getDefaultImage = () => {
    switch (imageType) {
      case 'logo':
        return '/placeholder-logo.png';
      case 'course-cover':
        return '/placeholder-course.png';
      case 'certificate-bg':
        return '/placeholder-certificate.png';
      case 'certificate-signature':
        return '/placeholder-signature.png';
      default:
        return '/placeholder-image.png';
    }
  };

  return (
    <div className="space-y-3">
      {/* Upload Button */}
      <div>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
          id={`image-upload-${imageType}`}
          disabled={isUploading}
        />
        <label 
          htmlFor={`image-upload-${imageType}`} 
          className={`${buttonClassName} ${isUploading ? 'loading' : ''}`}
          data-testid={`button-upload-${imageType}`}
        >
          {isUploading ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            <i className="fas fa-upload mr-2"></i>
          )}
          {buttonText || (currentImageUrl ? "Replace Image" : "Upload Image")}
        </label>
      </div>

      {/* Custom content (like additional buttons) */}
      {children}

      {/* Preview */}
      {showPreview && (
        <div>
          {currentImageUrl ? (
            <div>
              <div className="text-xs text-green-600 mb-1">✓ Image uploaded</div>
              <img 
                src={currentImageUrl} 
                alt={`${imageType} preview`} 
                className={previewClassName}
                onError={(e) => {
                  // Show placeholder if image fails to load
                  e.currentTarget.src = getDefaultImage();
                  e.currentTarget.onerror = null; // Prevent infinite loop
                }}
                data-testid={`img-preview-${imageType}`}
              />
            </div>
          ) : (
            <div className={`${previewClassName} bg-gray-100 flex items-center justify-center text-gray-400`}>
              <i className={`fas ${imageType === 'logo' ? 'fa-building' : imageType === 'course-cover' ? 'fa-graduation-cap' : 'fa-image'} text-2xl`}></i>
            </div>
          )}
        </div>
      )}
    </div>
  );
}