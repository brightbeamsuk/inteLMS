import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ImageUpload";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  profileImageUrl?: string;
  jobTitle?: string;
  department?: string;
  phone?: string;
  bio?: string;
}

export function SuperAdminProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    jobTitle: "",
    department: "",
    phone: "",
    bio: "",
    profileImageUrl: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Fetch current user data
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['/api/auth/user'],
  });

  // Initialize form data when user data is loaded
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        jobTitle: user.jobTitle || "",
        department: user.department || "",
        phone: user.phone || "",
        bio: user.bio || "",
        profileImageUrl: user.profileImageUrl || "",
      });
    }
  }, [user]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      const response = await apiRequest('PUT', '/api/auth/profile', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        jobTitle: user.jobTitle || "",
        department: user.department || "",
        phone: user.phone || "",
        bio: user.bio || "",
        profileImageUrl: user.profileImageUrl || "",
      });
    }
    setIsEditing(false);
  };

  const handleImageUpload = (imageUrl: string) => {
    setFormData(prev => ({ ...prev, profileImageUrl: imageUrl }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li>
            <a onClick={() => setLocation('/superadmin')} className="cursor-pointer" data-testid="link-superadmin">
              SuperAdmin
            </a>
          </li>
          <li className="font-semibold" data-testid="text-current-page">Profile</li>
        </ul>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold" data-testid="text-profile-title">My Profile</h1>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="btn btn-primary"
              data-testid="button-edit-profile"
            >
              <i className="fas fa-edit"></i>
              Edit Profile
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile Image Section */}
            <div className="lg:col-span-1">
              <div className="text-center">
                <div className="avatar mb-4">
                  <div className="w-32 h-32 rounded-full">
                    {formData.profileImageUrl ? (
                      <img 
                        src={formData.profileImageUrl} 
                        alt="Profile"
                        className="object-cover w-full h-full rounded-full"
                        data-testid="img-profile-avatar"
                      />
                    ) : (
                      <div className="bg-neutral text-neutral-content rounded-full w-32 h-32 flex items-center justify-center">
                        <span className="text-2xl font-bold">
                          {formData.firstName?.[0]}{formData.lastName?.[0]}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="mb-4">
                    <ImageUpload
                      imageType="logo"
                      currentImageUrl={formData.profileImageUrl}
                      onImageUploaded={handleImageUpload}
                      buttonText="Upload Profile Photo"
                      data-testid="input-profile-image"
                    />
                  </div>
                )}

                <div className="text-lg font-semibold" data-testid="text-profile-name">
                  {formData.firstName} {formData.lastName}
                </div>
                <div className="text-primary font-medium" data-testid="text-profile-role">
                  SuperAdmin
                </div>
                {formData.jobTitle && (
                  <div className="text-sm text-base-content/60" data-testid="text-profile-job-title">
                    {formData.jobTitle}
                  </div>
                )}
              </div>
            </div>

            {/* Profile Information Section */}
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div>
                  <label className="form-control w-full">
                    <div className="label">
                      <span className="label-text">First Name</span>
                    </div>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      disabled={!isEditing}
                      data-testid="input-first-name"
                    />
                  </label>
                </div>

                <div>
                  <label className="form-control w-full">
                    <div className="label">
                      <span className="label-text">Last Name</span>
                    </div>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      disabled={!isEditing}
                      data-testid="input-last-name"
                    />
                  </label>
                </div>

                <div>
                  <label className="form-control w-full">
                    <div className="label">
                      <span className="label-text">Email</span>
                    </div>
                    <input
                      type="email"
                      className="input input-bordered w-full"
                      value={formData.email}
                      disabled={true}
                      data-testid="input-email"
                    />
                    <div className="label">
                      <span className="label-text-alt">Email cannot be changed</span>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="form-control w-full">
                    <div className="label">
                      <span className="label-text">Phone</span>
                    </div>
                    <input
                      type="tel"
                      className="input input-bordered w-full"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      disabled={!isEditing}
                      data-testid="input-phone"
                    />
                  </label>
                </div>

                <div>
                  <label className="form-control w-full">
                    <div className="label">
                      <span className="label-text">Job Title</span>
                    </div>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={formData.jobTitle}
                      onChange={(e) => handleInputChange('jobTitle', e.target.value)}
                      disabled={!isEditing}
                      data-testid="input-job-title"
                    />
                  </label>
                </div>

                <div>
                  <label className="form-control w-full">
                    <div className="label">
                      <span className="label-text">Department</span>
                    </div>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={formData.department}
                      onChange={(e) => handleInputChange('department', e.target.value)}
                      disabled={!isEditing}
                      data-testid="input-department"
                    />
                  </label>
                </div>
              </div>

              {/* Bio Section */}
              <div className="mt-6">
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text">Bio</span>
                  </div>
                  <textarea
                    className="textarea textarea-bordered w-full h-24"
                    value={formData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    disabled={!isEditing}
                    placeholder="Tell us about yourself..."
                    data-testid="input-bio"
                  ></textarea>
                </label>
              </div>

              {/* Action Buttons */}
              {isEditing && (
                <div className="flex gap-4 mt-8">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    {updateProfileMutation.isPending ? (
                      <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                      <>
                        <i className="fas fa-save"></i>
                        Save Changes
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleCancel}
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}