import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";

export function UserProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    jobTitle: user?.jobTitle || '',
    department: user?.department || '',
    profileImageUrl: user?.profileImageUrl || '',
  });

  const [imageUploading, setImageUploading] = useState(false);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest('PUT', '/api/auth/profile', data);
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      jobTitle: user?.jobTitle || '',
      department: user?.department || '',
      profileImageUrl: user?.profileImageUrl || '',
    });
    setIsEditing(false);
  };

  const handleImageUpload = async () => {
    try {
      const response = await fetch('/api/objects/upload', {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to get upload URL');
      }
      const data = await response.json();
      return {
        method: 'PUT' as const,
        url: data.uploadURL
      };
    } catch (error) {
      console.error('Error getting upload parameters:', error);
      throw error;
    }
  };

  const handleImageUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      const imageUrl = uploadedFile.uploadURL;
      
      try {
        setImageUploading(true);
        
        // Update profile with new image URL
        await apiRequest('PUT', '/api/auth/profile', {
          ...formData,
          profileImageUrl: imageUrl
        });
        
        // Update form data
        setFormData(prev => ({
          ...prev,
          profileImageUrl: imageUrl
        }));
        
        // Refresh user data
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        
        toast({
          title: "Profile image updated",
          description: "Your profile image has been successfully updated.",
        });
      } catch (error) {
        console.error('Error updating profile image:', error);
        toast({
          title: "Upload failed",
          description: "Failed to update profile image. Please try again.",
          variant: "destructive",
        });
      } finally {
        setImageUploading(false);
      }
    }
  };

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li className="font-semibold" data-testid="text-current-page">Profile</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">My Profile</h1>
        <div>
          {!isEditing ? (
            <button 
              className="btn btn-primary" 
              onClick={() => setIsEditing(true)}
              data-testid="button-edit-profile"
            >
              <i className="fas fa-edit"></i>
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                className="btn btn-ghost" 
                onClick={handleCancel}
                data-testid="button-cancel-edit"
              >
                Cancel
              </button>
              <button 
                className={`btn btn-primary ${updateProfileMutation.isPending ? 'loading' : ''}`}
                onClick={handleSubmit}
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Avatar */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body text-center">
            <div className="avatar mb-4">
              <div className="w-32 rounded-full">
                {formData.profileImageUrl || user?.profileImageUrl ? (
                  <img 
                    src={formData.profileImageUrl || user?.profileImageUrl} 
                    alt="Profile" 
                    className="object-cover"
                  />
                ) : (
                  <div className="bg-neutral text-neutral-content rounded-full w-32 h-32 flex items-center justify-center">
                    <span className="text-4xl">{user?.firstName?.charAt(0) || 'U'}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Upload Button */}
            <div className="mb-4">
              <ObjectUploader
                maxNumberOfFiles={1}
                maxFileSize={5242880} // 5MB
                onGetUploadParameters={handleImageUpload}
                onComplete={handleImageUploadComplete}
                buttonClassName="btn btn-sm btn-outline"
              >
                {imageUploading ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Uploading...
                  </>
                ) : (
                  <>
                    <i className="fas fa-camera mr-2"></i>
                    Change Photo
                  </>
                )}
              </ObjectUploader>
            </div>
            
            <h3 className="text-xl font-bold" data-testid="text-user-name">
              {user?.firstName} {user?.lastName}
            </h3>
            <p className="text-base-content/60" data-testid="text-user-role">
              {user?.jobTitle || 'Learner'}
            </p>
            <div className="badge badge-success mt-2" data-testid="badge-user-status">
              Active
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="lg:col-span-2">
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body">
              <h3 className="card-title mb-4">Personal Information</h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">First Name</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      className="input input-bordered"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      data-testid="input-first-name"
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Last Name</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      className="input input-bordered"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      data-testid="input-last-name"
                    />
                  </div>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Email</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    className="input input-bordered"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={true} // Email should not be editable by user
                    data-testid="input-email"
                  />
                  <label className="label">
                    <span className="label-text-alt">Contact your administrator to change email</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Job Title</span>
                  </label>
                  <input
                    type="text"
                    name="jobTitle"
                    className="input input-bordered"
                    value={formData.jobTitle}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    data-testid="input-job-title"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Department</span>
                  </label>
                  <input
                    type="text"
                    name="department"
                    className="input input-bordered"
                    value={formData.department}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    data-testid="input-department"
                  />
                </div>

                {/* Account Information */}
                <div className="divider">Account Information</div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Member Since</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered"
                      value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      disabled
                      data-testid="input-member-since"
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">User Role</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered"
                      value="Learner"
                      disabled
                      data-testid="input-user-role"
                    />
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}